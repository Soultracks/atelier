/* Atelier Soultracks · noyau partagé entre la page et le service worker.
   - base du téléphone (IndexedDB) : dernière copie de la base + file des saisies à envoyer ;
   - appel de la passerelle Apps Script ;
   - envoi de la file (idempotent : chaque saisie a un opId, la passerelle ignore les doublons). */
(function (G) {
  "use strict";
  var DB_NAME = "atelier-soultracks", DB_VER = 1, BATCH = 50;
  var dbp = null;

  function idb() {
    if (dbp) return dbp;
    dbp = new Promise(function (res, rej) {
      var rq = indexedDB.open(DB_NAME, DB_VER);
      rq.onupgradeneeded = function () {
        var db = rq.result;
        if (!db.objectStoreNames.contains("kv")) db.createObjectStore("kv");
        if (!db.objectStoreNames.contains("queue")) db.createObjectStore("queue", {keyPath: "opId"});
      };
      rq.onsuccess = function () { res(rq.result); };
      rq.onerror = function () { dbp = null; rej(rq.error); };
    });
    return dbp;
  }
  function tx(store, mode, fn) {
    return idb().then(function (db) {
      return new Promise(function (res, rej) {
        var t = db.transaction(store, mode), s = t.objectStore(store), out;
        var r = fn(s);
        if (r && "onsuccess" in r) r.onsuccess = function () { out = r.result; };
        t.oncomplete = function () { res(out); };
        t.onerror = t.onabort = function () { rej(t.error); };
      });
    });
  }
  var kv = {
    get: function (k) { return tx("kv", "readonly", function (s) { return s.get(k); }); },
    set: function (k, v) { return tx("kv", "readwrite", function (s) { return s.put(v, k); }); },
    del: function (k) { return tx("kv", "readwrite", function (s) { return s.delete(k); }); }
  };
  var queue = {
    all: function () {
      return tx("queue", "readonly", function (s) { return s.getAll(); }).then(function (a) {
        return (a || []).sort(function (x, y) { return String(x.at).localeCompare(String(y.at)) || (x.seq || 0) - (y.seq || 0); });
      });
    },
    put: function (op) { return tx("queue", "readwrite", function (s) { return s.put(op); }); },
    del: function (id) { return tx("queue", "readwrite", function (s) { return s.delete(id); }); },
    count: function () { return tx("queue", "readonly", function (s) { return s.count(); }); }
  };

  var seq = 0;
  function newId() {
    var r = new Uint8Array(6);
    (G.crypto || {}).getRandomValues ? G.crypto.getRandomValues(r) : r.forEach(function (_, i) { r[i] = Math.random() * 256; });
    return Date.now().toString(36) + Array.prototype.map.call(r, function (b) { return ("0" + b.toString(16)).slice(-2); }).join("");
  }
  function makeOp(o) {
    return {opId: newId(), seq: ++seq, at: new Date().toISOString(), kind: o.kind, coll: o.coll, id: o.id, doc: o.doc, merge: !!o.merge, allowQte: !!o.allowQte, create: !!o.create};
  }

  function gateway() { return (G.CARNET_CONFIG && G.CARNET_CONFIG.gateway) || ""; }

  function err(code, message) { var e = new Error(message || code); e.code = code; return e; }

  /* Appel de la passerelle. Corps en text/plain : requête « simple », sans pré-vérification CORS ;
     Apps Script répond par une redirection vers script.googleusercontent.com, suivie automatiquement. */
  function call(action, body) {
    var url = gateway();
    if (!url) return Promise.reject(err("nogateway", "Passerelle pas encore installée"));
    return kv.get("key").then(function (key) {
      if (!key) throw err("nokey", "Clé d'accès absente");
      var ctl = typeof AbortController !== "undefined" ? new AbortController() : null;
      var to = setTimeout(function () { if (ctl) ctl.abort(); }, 45000);
      var payload = JSON.stringify(Object.assign({action: action, key: key, client: "pwa-1"}, body || {}));
      return fetch(url, {method: "POST", headers: {"Content-Type": "text/plain;charset=utf-8"}, body: payload,
        redirect: "follow", cache: "no-store", credentials: "omit", signal: ctl ? ctl.signal : undefined})
        .then(function (r) {
          clearTimeout(to);
          if (!r.ok) throw err("http", "Réponse " + r.status);
          return r.json().catch(function () { throw err("badjson", "Réponse illisible (connexion Google à refaire ?)"); });
        }, function (e) { clearTimeout(to); throw err("network", "Réseau indisponible"); })
        .then(function (j) {
          if (!j || j.ok !== true) throw err((j && j.err) || "server", (j && j.message) || "Refus de la passerelle");
          return j;
        });
    });
  }

  function withLock(fn) {
    if (G.navigator && G.navigator.locks && G.navigator.locks.request) return G.navigator.locks.request("atelier-sync", fn);
    return fn();
  }

  /* Envoie la file par paquets, puis rapporte la base à jour (pull) si demandé.
     Retourne {sent, refused:[...], left, data, role, nom}. */
  function sync(opts) {
    opts = opts || {};
    return withLock(function () {
      var out = {sent: 0, dup: 0, refused: [], left: 0, data: null};
      function round() {
        return queue.all().then(function (ops) {
          if (!ops.length) {
            if (!opts.pull) return out;
            return call("carnet.pull", {}).then(function (j) { return store(j); });
          }
          var batch = ops.slice(0, BATCH);
          var last = ops.length <= BATCH;
          var wire = batch.map(function (o) { return {opId: o.opId, kind: o.kind, coll: o.coll, id: o.id, doc: o.doc, merge: o.merge, allowQte: o.allowQte, create: o.create}; });
          return call("carnet.push", {ops: wire, pull: !!(opts.pull && last)}).then(function (j) {
            var chain = Promise.resolve(), stop = false;
            (j.results || []).forEach(function (r) {
              var op = batch.filter(function (o) { return o.opId === r.opId; })[0];
              if (!op) return;
              if (r.ok) { out.sent++; if (r.dup) out.dup++; chain = chain.then(function () { return queue.del(op.opId); }); }
              else if (r.permanent) {
                out.refused.push({opId: op.opId, coll: op.coll, id: op.id, err: r.err, at: op.at, doc: op.doc});
                chain = chain.then(function () { return queue.del(op.opId); });
              } else stop = true;
            });
            return chain.then(function () {
              if (out.refused.length) return kv.get("refus").then(function (old) { return kv.set("refus", (old || []).concat(out.refused).slice(-50)); });
            }).then(function () {
              if (j.data) return store(j);
              if (stop || !(j.results || []).length) return queue.count().then(function (n) { out.left = n; return out; });
              return round();
            });
          });
        });
      }
      function store(j) {
        out.data = j.data; out.role = j.role; out.nom = j.nom;
        var meta = {role: j.role, nom: j.nom, at: new Date().toISOString(), serverTime: j.serverTime, version: j.version};
        return kv.set("data", j.data).then(function () { return kv.set("meta", meta); })
          .then(function () { return queue.count(); }).then(function (n) { out.left = n; return out; });
      }
      return round();
    });
  }

  G.AtelierCore = {kv: kv, queue: queue, makeOp: makeOp, newId: newId, call: call, sync: sync, gateway: gateway, err: err};
})(self);
