/* Atelier Soultracks · service worker
   - garde toute l'appli sur le téléphone (elle s'ouvre en mode avion) ;
   - ne touche jamais aux appels de la passerelle Google (toujours en direct) ;
   - Android : envoie la file des saisies dès que le réseau revient, même appli fermée (Background Sync). */
var VERSION = "atelier-1.2.0";
var SHELL = [
  "./", "index.html", "styles.css", "tableau.css", "config.js", "core.js", "app.js",
  "modules/carnet.js", "modules/tableau.js",
  "vendor/jsQR-1.4.0.js", "vendor/qrcode-generator-1.4.4.js",
  "manifest.webmanifest",
  "icons/icon-192.png", "icons/icon-512.png", "icons/icon-maskable-512.png", "icons/apple-touch-icon.png", "icons/favicon-64.png", "icons/logo-96.png",
  "fonts/barlow-latin-400-normal.woff2", "fonts/barlow-latin-500-normal.woff2", "fonts/barlow-latin-600-normal.woff2", "fonts/barlow-latin-700-normal.woff2",
  "fonts/barlow-condensed-latin-600-normal.woff2", "fonts/barlow-condensed-latin-700-normal.woff2"
];

importScripts("config.js", "core.js");

self.addEventListener("install", function (e) {
  e.waitUntil(caches.open(VERSION).then(function (c) {
    return c.addAll(SHELL.map(function (u) { return new Request(u, {cache: "reload"}); }));
  }));
});

self.addEventListener("activate", function (e) {
  e.waitUntil(caches.keys().then(function (keys) {
    return Promise.all(keys.filter(function (k) { return k.indexOf("atelier-") === 0 && k !== VERSION; }).map(function (k) { return caches.delete(k); }));
  }).then(function () { return self.clients.claim(); }));
});

self.addEventListener("message", function (e) {
  if (e.data === "skipWaiting") self.skipWaiting();
});

self.addEventListener("fetch", function (e) {
  var req = e.request;
  if (req.method !== "GET") return;
  var url = new URL(req.url);
  if (url.origin !== self.location.origin) return; // passerelle Google, etc. : jamais en cache
  if (req.mode === "navigate") {
    // Page : copie du téléphone d'abord (ouverture instantanée, même sans réseau).
    e.respondWith(caches.match("index.html").then(function (r) { return r || fetch(req); }));
    return;
  }
  e.respondWith(caches.match(req, {ignoreSearch: true}).then(function (hit) {
    return hit || fetch(req).then(function (res) {
      if (res && res.ok && res.type === "basic") {
        var copy = res.clone();
        caches.open(VERSION).then(function (c) { c.put(req, copy); });
      }
      return res;
    });
  }));
});

/* Envoi en arrière-plan (Chrome Android). iPhone : pas de Background Sync, l'envoi part à la réouverture. */
self.addEventListener("sync", function (e) {
  if (e.tag !== "atelier-envoi") return;
  e.waitUntil(AtelierCore.sync({pull: true}).then(function (r) {
    return self.clients.matchAll({type: "window"}).then(function (cs) {
      cs.forEach(function (c) { c.postMessage({type: "synced", sent: r.sent, left: r.left, refused: r.refused.length}); });
    });
  }, function (err) {
    // Échec : le navigateur réessaiera plus tard (sauf clé refusée).
    if (err && (err.code === "auth" || err.code === "nokey" || err.code === "nogateway")) return;
    throw err;
  }));
});
