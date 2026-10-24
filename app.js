/* Atelier Soultracks · coquille de l'appli : profils, navigation, voyant d'envoi, file hors ligne,
   lecteur de QR par la caméra, réglages et accès des mécaniciens, mises à jour de l'appli. */
"use strict";
const APP_VERSION="1.0.0";
const S={D:null,veh:{},parts:{},inter:[],moves:[],locs:[],trajets:[],ready:false,view:"flotte",fiche:null,sel:new Set(),
  role:null,nom:"",pending:0,lastOk:0,lastErr:null,authErr:false,syncing:false,refused:[],pendingOps:[]};
const $=s=>document.querySelector(s);
const $$=s=>Array.from(document.querySelectorAll(s));
const esc=v=>String(v==null?"":v).replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
const nf0=new Intl.NumberFormat("fr-FR",{maximumFractionDigits:0});
const nf2=new Intl.NumberFormat("fr-FR",{minimumFractionDigits:2,maximumFractionDigits:2});
const eur=v=>nf2.format(+v||0)+" €";
const km=v=>(v==null||v==="")?"—":nf0.format(+v)+" km";
const today=()=>{const d=new Date();return d.getFullYear()+"-"+String(d.getMonth()+1).padStart(2,"0")+"-"+String(d.getDate()).padStart(2,"0")};
const fdate=s=>{if(!s)return"—";const [y,m,d]=String(s).slice(0,10).split("-");return d&&m&&y?`${d}/${m}/${y}`:s};
const hhmm=t=>t?new Date(t).toLocaleString("fr-FR",{day:"2-digit",month:"2-digit",hour:"2-digit",minute:"2-digit"}).replace(" "," à "):"jamais";
function store(k,v){try{if(v===undefined)return JSON.parse(localStorage.getItem("st_atelier_"+k)||"null");localStorage.setItem("st_atelier_"+k,JSON.stringify(v))}catch(e){return null}}
function toast(msg){const t=$("#toast");t.textContent=msg;t.hidden=false;clearTimeout(toast._t);toast._t=setTimeout(()=>t.hidden=true,3600)}
const MODS=self.ATELIER_MODULES||[];
const CFG=self.CARNET_CONFIG||{};
const ACCESS_RE=/^STX:CLE:([A-Za-z0-9]{24,64})$/i;

/* ---------- navigation ---------- */
function go(view){if(!App.key&&view!=="accueil")view="accueil";S.view=view;
  $$("section.view").forEach(s=>s.hidden=(s.id!=="v-"+view));
  $$(".tab").forEach(t=>t.setAttribute("aria-selected",String(t.dataset.view===view||(view==="fiche"&&t.dataset.view==="flotte"))));
  window.scrollTo({top:0});renderAll()}
function renderAll(){
  for(const m of MODS)if(m.views.includes(S.view)&&m.render)m.render(S.view);
  if(S.view==="reglages")renderReglages();
  if(S.view==="accueil")renderAccueil();
}
/* Ne pas redessiner sous les doigts de quelqu'un qui tape : on attend qu'il sorte du formulaire. */
let renderLater=false;
function softRender(){const a=document.activeElement;if(a&&a.closest&&a.closest("form")&&a!==document.body){renderLater=true;return}renderAll()}
document.addEventListener("focusout",()=>setTimeout(()=>{if(renderLater){const a=document.activeElement;if(!(a&&a.closest&&a.closest("form"))){renderLater=false;renderAll()}}},50));

/* ---------- profils ---------- */
function applyRole(){
  const guide=S.role==="guide";
  document.body.classList.toggle("meca",!guide);
  document.body.classList.toggle("atelier",!guide||store("apercuMeca")===true);
  $("#modeAtelier").checked=!guide||store("apercuMeca")===true;
  $("#tabTableau").hidden=!(guide&&CFG.modules&&CFG.modules.tableau);
  const noKey=!App.key;
  $("#tabs").hidden=noKey;$("#scanBtn").hidden=false;
  if(!guide&&["trajets","export","tableau"].includes(S.view))go("flotte");
}

/* ---------- téléchargements ---------- */
async function offer(filename,data,mime){
  const blob=data instanceof Blob?data:new Blob([data],{type:mime||(filename.endsWith(".csv")?"text/csv;charset=utf-8":"application/octet-stream")});
  const mobile=/Android|iPhone|iPad|iPod/i.test(navigator.userAgent);
  try{if(mobile&&navigator.canShare){const f=new File([blob],filename,{type:blob.type});if(navigator.canShare({files:[f]})){await navigator.share({files:[f],title:filename});return}}}catch(e){if(e&&e.name==="AbortError")return}
  const a=document.createElement("a");a.href=URL.createObjectURL(blob);a.download=filename;document.body.appendChild(a);a.click();setTimeout(()=>{URL.revokeObjectURL(a.href);a.remove()},4000);toast("Fichier enregistré : "+filename);
}

/* ---------- voyant d'envoi (toujours la vérité) ---------- */
function setConn(state,txt){$("#connDot").className="dot "+(state===true?"on":state==="warn"?"warn":state==="busy"?"busy":"off");$("#connTxt").textContent=txt}
function updateConn(){
  const n=S.pending,on=App.online();
  if(!App.gw)setConn("warn","Démonstration · passerelle pas installée");
  else if(!App.key)setConn(false,"Pas encore ouvert sur ce téléphone");
  else if(S.syncing)setConn("busy",n?`Envoi de ${n} saisie${n>1?"s":""} au Drive…`:"Lecture du Drive…");
  else if(S.authErr)setConn(false,"Accès refusé · voir Réglages");
  else if(n&&!on)setConn("warn",`Hors ligne · ${n} saisie${n>1?"s":""} gardée${n>1?"s":""} ici`);
  else if(n)setConn("warn",`${n} à envoyer · nouvel essai automatique`);
  else if(!on)setConn("warn",`Hors ligne · copie du ${hhmm(S.lastOk)}`);
  else if(!S.lastOk)setConn("warn","Pas encore relié au Drive");
  else setConn(true,`À jour · Drive le ${hhmm(S.lastOk)}`);
  const b=$("#syncNowBtn");if(b)b.textContent="Envoyer maintenant"+(n?` (${n})`:"");
}
async function refreshPending(){try{S.pendingOps=await AtelierCore.queue.all();S.pending=S.pendingOps.length}catch(e){}}

/* ---------- synchronisation ---------- */
async function reloadLocal(){
  const [data,meta,ops,refus]=await Promise.all([AtelierCore.kv.get("data"),AtelierCore.kv.get("meta"),AtelierCore.queue.all(),AtelierCore.kv.get("refus")]);
  S.pendingOps=ops||[];S.pending=S.pendingOps.length;S.refused=refus||[];
  if(meta){S.role=meta.role||S.role;S.nom=meta.nom||S.nom;S.lastOk=S.lastOk||Date.parse(meta.at)||0}
  for(const m of MODS)if(m.load)m.load(data||{},S.pendingOps);
  S.ready=!!data;
  applyRole();updateConn();softRender();
}
let syncTimer=null;
function scheduleSync(ms){clearTimeout(syncTimer);syncTimer=setTimeout(()=>doSync(false),ms==null?400:ms)}
async function doSync(manual){
  if(!App.gw||!App.key){if(manual)toast(App.gw?"Ouvre d'abord l'appli avec ton QR d'accès.":"La passerelle n'est pas encore installée.");return}
  if(S.syncing)return;
  if(!App.online()){updateConn();if(manual)toast("Pas de réseau : tout reste gardé sur le téléphone et partira tout seul.");return}
  S.syncing=true;updateConn();
  try{
    const r=await AtelierCore.sync({pull:true});
    S.lastOk=Date.now();S.lastErr=null;S.authErr=false;
    if(r.refused&&r.refused.length)toast(`${r.refused.length} saisie(s) refusée(s) par le Drive : voir Réglages.`);
    else if(manual)toast(r.sent?`${r.sent} saisie(s) envoyée(s) au Drive.`:"Rien en attente : tout est dans le Drive.");
    S.syncing=false;await reloadLocal();
  }catch(e){
    S.lastErr=e;if(e&&e.code==="auth")S.authErr=true;
    if(manual||e.code==="auth")toast(e.code==="auth"?"Cette clé d'accès n'est plus valable : demande un nouveau QR au guide.":e.code==="network"?"Le Drive ne répond pas : les saisies restent gardées ici.":"Envoi impossible : "+(e.message||e.code));
  }finally{S.syncing=false;await refreshPending();updateConn();if(S.view==="reglages")renderReglages()}
}
async function bgSync(){try{const reg=await navigator.serviceWorker.ready;if(reg.sync)await reg.sync.register("atelier-envoi")}catch(e){}}

const App={
  key:null,gw:AtelierCore.gateway(),install:null,updating:false,
  hasKey(){return !!App.key},
  online(){return navigator.onLine!==false},
  async afterWrite(){await refreshPending();updateConn();if(App.online())scheduleSync(300);else bgSync()},
  setAtelier(on){store("apercuMeca",!!on);applyRole();renderAll()},
  scan(){Scan.open()},
  async setKey(k,fromLink){
    const msg=t=>{const m=$("#accMsg");if(m)m.innerHTML=t};
    if(!/^[A-Za-z0-9]{24,64}$/.test(k)){msg(`<span style="color:var(--bad)">Ce code n'est pas un code d'accès de l'atelier.</span>`);return}
    await AtelierCore.kv.set("key",k);App.key=k;
    if(!App.gw){msg("Code gardé. La passerelle n'est pas encore installée : rien ne peut être chargé.");go("flotte");return}
    if(!App.online()){msg("Code gardé. Il faut du réseau une première fois pour charger la base de l'atelier.");go("flotte");return}
    msg("Vérification du code…");
    try{const j=await AtelierCore.call("hello",{});await AtelierCore.kv.set("meta",Object.assign({},(await AtelierCore.kv.get("meta"))||{},{role:j.role,nom:j.nom}));S.role=j.role;S.nom=j.nom;
      toast(j.role==="guide"?"Bienvenue : profil guide.":`Bienvenue ${j.nom||""} : profil mécanicien.`);applyRole();go("flotte");await doSync(false)}
    catch(e){if(e.code==="auth"){await AtelierCore.kv.del("key");App.key=null;msg(`<span style="color:var(--bad)">Ce QR d'accès n'est pas (ou plus) valable. Demande-en un nouveau au guide.</span>`)}
      else{msg("Code gardé. Le Drive ne répond pas pour l'instant : la base se chargera dès que possible.");go("flotte")}}
  },
  handleScan(text){
    const s=String(text||"").trim();const m=s.match(ACCESS_RE);
    if(m){App.setKey(m[1]);return}
    if(!App.key){toast("Flashe d'abord ton QR d'accès (montré par le guide).");return}
    for(const mod of MODS)if(mod.onToken&&mod.onToken(s))return;
    toast("Ce QR code n'appartient pas au carnet Soultracks.");
  }
};

/* ---------- lecteur de QR (caméra en direct, photo en secours) ---------- */
const Scan={stream:null,timer:0,canvas:null,
  async open(){
    if(!(navigator.mediaDevices&&navigator.mediaDevices.getUserMedia)){Scan.photo();return}
    $("#scanner").hidden=false;$("#scanHint").textContent="Vise le QR code, il se lit tout seul.";
    try{Scan.stream=await navigator.mediaDevices.getUserMedia({video:{facingMode:{ideal:"environment"},width:{ideal:1280},height:{ideal:720}},audio:false});
      const v=$("#scanVideo");v.srcObject=Scan.stream;await v.play();Scan.loop()}
    catch(e){Scan.close();toast("Caméra indisponible : prends une photo du QR.");Scan.photo()}
  },
  loop(){
    const v=$("#scanVideo");if(!Scan.stream)return;
    if(v.readyState>=2&&v.videoWidth){
      const c=Scan.canvas||(Scan.canvas=document.createElement("canvas"));const s=Math.min(1,720/Math.max(v.videoWidth,v.videoHeight));
      c.width=Math.round(v.videoWidth*s);c.height=Math.round(v.videoHeight*s);const g=c.getContext("2d",{willReadFrequently:true});g.drawImage(v,0,0,c.width,c.height);
      const d=g.getImageData(0,0,c.width,c.height);const r=jsQR(d.data,c.width,c.height,{inversionAttempts:"attemptBoth"});
      if(r&&r.data){Scan.close();try{navigator.vibrate&&navigator.vibrate(60)}catch(e){}App.handleScan(r.data);return}
    }
    Scan.timer=setTimeout(Scan.loop,120);
  },
  close(){clearTimeout(Scan.timer);if(Scan.stream){Scan.stream.getTracks().forEach(t=>t.stop());Scan.stream=null}const v=$("#scanVideo");if(v)v.srcObject=null;$("#scanner").hidden=true},
  photo(){Scan.close();const f=$("#scanFile");f.value="";f.click()}
};
async function decodeFile(file){
  const url=URL.createObjectURL(file);
  try{const img=await new Promise((res,rej)=>{const i=new Image();i.onload=()=>res(i);i.onerror=rej;i.src=url});
    for(const maxSide of [1400,900,2200]){const s=Math.min(1,maxSide/Math.max(img.width,img.height));const w=Math.round(img.width*s),h=Math.round(img.height*s);const c=document.createElement("canvas");c.width=w;c.height=h;const g=c.getContext("2d",{willReadFrequently:true});g.drawImage(img,0,0,w,h);const d=g.getImageData(0,0,w,h);const r=jsQR(d.data,w,h,{inversionAttempts:"attemptBoth"});if(r&&r.data)return r.data}
    return null}finally{URL.revokeObjectURL(url)}
}

/* ---------- accueil et installation ---------- */
const isIOS=()=>/iPhone|iPad|iPod/i.test(navigator.userAgent)||(navigator.platform==="MacIntel"&&navigator.maxTouchPoints>1);
const isStandalone=()=>window.matchMedia("(display-mode: standalone)").matches||navigator.standalone===true;
function installHtml(){
  if(isStandalone())return `<p class="small muted" style="margin:0">L'appli est installée sur ce téléphone.</p>`;
  if(App.install)return `<div class="row"><button class="btn primary" type="button" id="doInstall">Installer l'appli sur ce téléphone</button><span class="small muted">Une icône « Atelier ST » apparaît sur l'écran d'accueil.</span></div>`;
  if(isIOS())return `<div class="note small"><strong>iPhone :</strong> dans Safari, touche le bouton Partager (carré avec une flèche), puis « Sur l'écran d'accueil », puis « Ajouter ». Ouvre ensuite l'appli depuis son icône et flashe ton QR d'accès <em>dans l'appli</em> (l'iPhone sépare l'appli de Safari).</div>`;
  return `<div class="note small"><strong>Android :</strong> menu ⋮ de Chrome, puis « Installer l'application » (ou « Ajouter à l'écran d'accueil »).</div>`;
}
function renderAccueil(){$("#installHelp").innerHTML=`<div class="form"><h3>Installer l'appli</h3>${installHtml()}</div>`;bindInstall()}
function bindInstall(){const b=$("#doInstall");if(b)b.onclick=async()=>{if(!App.install)return;App.install.prompt();try{await App.install.userChoice}catch(e){}App.install=null;renderAll()}}

/* ---------- réglages ---------- */
const COLL_LBL={vehicules:"Fiche véhicule",pieces:"Fiche pièce",mouvements:"Mouvement de stock",interventions:"Intervention",locations:"Location",trajets:"Trajet"};
function opLabel(o){const d=o.doc||{};if(o.kind==="move")return `${d.delta>0?"Entrée":"Sortie"} de stock · ${esc(d.designation||d.pieceId)} (${d.delta>0?"+":""}${esc(d.delta)})`;
  const v=S.veh[d.vehiculeId||o.id];return `${COLL_LBL[o.coll]||o.coll} · ${esc(o.coll==="vehicules"?(v&&v.nom||o.id):(v?(v.nom||v.id):(d.designation||d.raid||d.objet||o.id)))}${d.date?" · "+fdate(d.date):""}`}
function renderReglages(){
  const n=S.pending,e=S.lastErr;
  $("#syncBox").innerHTML=`<h3>Envoi vers le Drive</h3>
    <div class="kv"><span class="k">Voyant</span><span>${esc($("#connTxt").textContent)}</span>
    <span class="k">Dernier échange réussi</span><span>${esc(hhmm(S.lastOk))}</span>
    <span class="k">Réseau du téléphone</span><span>${App.online()?"oui":"non (mode avion ou zone blanche)"}</span>
    <span class="k">Saisies gardées sur ce téléphone</span><span><b>${n}</b>${n?" · elles partent toutes seules dès que le réseau revient":""}</span>
    ${e&&!S.syncing?`<span class="k">Dernier problème</span><span>${esc(e.message||e.code)}</span>`:""}</div>
    ${n?`<details class="box"><summary>Voir les ${n} saisie(s) en attente</summary><ul class="small">${S.pendingOps.map(o=>`<li>${opLabel(o)} <span class="muted">(${hhmm(o.at)})</span></li>`).join("")}</ul></details>`:""}
    ${S.refused.length?`<div class="note bad small"><strong>${S.refused.length} saisie(s) refusée(s) par le Drive</strong> (rien n'a été écrit pour elles) :<ul>${S.refused.map(r=>`<li>${opLabel(r)} : ${esc(r.err)}</li>`).join("")}</ul><button class="btn small" type="button" id="clearRefus">J'ai vu, effacer cette liste</button></div>`:""}
    <div class="row"><button class="btn primary" type="button" id="syncNowBtn">Envoyer maintenant${n?` (${n})`:""}</button><span class="small muted">Les données vivent dans le Google Sheets SOULTRACKS_BASE_FLOTTE_STOCK (Drive soultracks.admin) ; ce téléphone en garde une copie pour travailler sans réseau.</span></div>`;
  $("#syncNowBtn").onclick=()=>doSync(true);
  const cr=$("#clearRefus");if(cr)cr.onclick=async()=>{await AtelierCore.kv.set("refus",[]);S.refused=[];renderReglages()};
  if(S.role==="guide")renderAccess();else $("#accessBox").innerHTML="";
  $("#meBox").innerHTML=`<h3>Ce téléphone</h3>
    <div class="kv"><span class="k">Profil</span><span>${S.role==="guide"?"Guide (tout voir)":S.role==="mecanicien"?"Mécanicien (flash, pièces, km ; pas de prix)":"pas encore vérifié"}</span>
    ${S.nom?`<span class="k">Nom</span><span>${esc(S.nom)}</span>`:""}
    <span class="k">Version de l'appli</span><span>${APP_VERSION}</span>
    <span class="k">Passerelle</span><span>${App.gw?"installée":"pas encore installée (démonstration)"}</span></div>
    ${installHtml()}
    <div class="row"><button class="btn ghost small" type="button" id="logoutBtn">Retirer l'accès de ce téléphone</button></div>`;
  bindInstall();
  $("#logoutBtn").onclick=async()=>{
    if(S.pending){toast(`Impossible : ${S.pending} saisie(s) pas encore envoyée(s). Envoie-les d'abord.`);return}
    if(!confirmTwice("logout")){toast("Touche encore une fois pour confirmer.");return}
    await AtelierCore.kv.del("key");await AtelierCore.kv.del("data");await AtelierCore.kv.del("meta");App.key=null;S.role=null;location.hash="";location.reload()};
}
const confirmTwice=(k)=>{const now=Date.now();if(confirmTwice[k]&&now-confirmTwice[k]<4000){confirmTwice[k]=0;return true}confirmTwice[k]=now;return false};
let accessPeople=null,accessNew=null;
function renderAccess(){
  const box=$("#accessBox");
  const appUrl=location.origin+location.pathname.replace(/index\.html$/,"");
  box.innerHTML=`<h3>Accès des mécaniciens</h3>
    <p class="small muted" style="margin:0">Chaque personne a son propre QR d'accès. Le mécanicien flashe, sort les pièces et saisit les km ; il ne voit ni les prix ni les frais km. Un accès se coupe en un geste, sans toucher aux autres.</p>
    <form class="row" id="accAdd" autocomplete="off"><input type="text" id="accNom" maxlength="30" required placeholder="Prénom du mécanicien" style="flex:1;min-width:160px" aria-label="Prénom du mécanicien"><button class="btn primary" type="submit">Créer son QR d'accès</button></form>
    ${accessNew?`<div class="qrbig">${qrSvg("STX:CLE:"+accessNew.key)}<b>Accès de ${esc(accessNew.nom)}</b><span class="small" style="color:#444444;max-width:260px;text-align:center">Il installe l'appli (lien ci-dessous), l'ouvre, touche « Flasher mon QR d'accès » et vise ce code. À ne pas poster sur un groupe.</span><span class="keytxt">${esc(appUrl)}</span><button class="btn small" type="button" id="accHide" style="color:#111111;background:#FFFFFF;border-color:#CCCCCC">C'est fait, masquer</button></div>`:""}
    <div id="accList">${accessPeople?accessTable(accessPeople):`<button class="btn small" type="button" id="accLoad">Voir qui a accès</button>`}</div>`;
  $("#accAdd").onsubmit=async e=>{e.preventDefault();if(!App.online()){toast("Il faut du réseau pour créer un accès.");return}
    try{const j=await AtelierCore.call("acces.add",{nom:$("#accNom").value.trim(),role:"mecanicien"});accessNew=j.person;accessPeople=j.people;renderAccess()}catch(err){toast("Création impossible : "+(err.message||err.code))}};
  const h=$("#accHide");if(h)h.onclick=()=>{accessNew=null;renderAccess()};
  const l=$("#accLoad");if(l)l.onclick=loadAccess;
  $$("[data-acc-row]").forEach(b=>b.onclick=async()=>{try{const j=await AtelierCore.call("acces.toggle",{row:+b.dataset.accRow,actif:b.dataset.accOn==="1"});accessPeople=j.people;renderAccess();toast("Accès mis à jour")}catch(err){toast("Impossible : "+(err.message||err.code))}});
}
async function loadAccess(){if(!App.online()){toast("Il faut du réseau pour voir les accès.");return}try{const j=await AtelierCore.call("acces.list",{});accessPeople=j.people;renderAccess()}catch(err){toast("Lecture impossible : "+(err.message||err.code))}}
function accessTable(p){return p.length?`<div class="tablebox"><table><thead><tr><th>Nom</th><th>Profil</th><th>Dernière connexion</th><th>Accès</th></tr></thead><tbody>${p.map(x=>`<tr><td>${esc(x.nom)}</td><td>${x.role==="guide"?"Guide":"Mécanicien"}</td><td class="small">${esc(x.vu?hhmm(x.vu):"jamais")}</td><td>${x.actif?`<span class="pill ok">actif</span> ${x.role==="guide"?"":`<button class="btn small ghost" type="button" data-acc-row="${x.row}" data-acc-on="0">Couper</button>`}`:`<span class="pill bad">coupé</span> <button class="btn small ghost" type="button" data-acc-row="${x.row}" data-acc-on="1">Rétablir</button>`}</td></tr>`).join("")}</tbody></table></div>`:`<div class="empty">Personne d'autre que le guide.</div>`}

/* ---------- mise à jour de l'appli ---------- */
function showUpdate(reg){$("#update").hidden=false;$("#update").innerHTML=`<div class="note"><span><strong>Nouvelle version de l'appli prête.</strong> Tes saisies restent sur le téléphone.</span><button class="btn small primary" type="button" id="updBtn">Mettre à jour</button></div>`;
  $("#updBtn").onclick=()=>{App.updating=true;if(reg.waiting)reg.waiting.postMessage("skipWaiting");else location.reload()}}

/* ---------- démarrage ---------- */
async function boot(){
  for(const m of MODS)if(m.init)m.init();
  $$(".tab").forEach(t=>t.addEventListener("click",()=>go(t.dataset.view)));
  $("#scanBtn").onclick=()=>Scan.open();
  $("#accScan").onclick=()=>Scan.open();
  $("#scanClose").onclick=()=>Scan.close();
  $("#scanPhoto").onclick=()=>Scan.photo();
  $("#scanFile").addEventListener("change",async e=>{const f=e.target.files&&e.target.files[0];if(!f)return;toast("Lecture du QR code…");try{const txt=await decodeFile(f);if(!txt){toast("QR code illisible : reprends la photo plus près et bien à plat.");return}App.handleScan(txt)}catch(err){toast("Photo illisible.")}});
  $("#accForm").onsubmit=e=>{e.preventDefault();App.setKey($("#accKey").value.trim())};
  $("#conn").onclick=()=>doSync(true);
  document.addEventListener("keydown",e=>{if(e.key==="Escape"&&!$("#scanner").hidden)Scan.close()});
  window.addEventListener("online",()=>{updateConn();scheduleSync(200)});
  window.addEventListener("offline",updateConn);
  document.addEventListener("visibilitychange",()=>{if(!document.hidden&&App.online()&&Date.now()-S.lastOk>30000)scheduleSync(100)});
  setInterval(()=>{if(!document.hidden&&App.online()&&App.key&&(S.pending||Date.now()-S.lastOk>300000))doSync(false)},60000);
  window.addEventListener("beforeinstallprompt",e=>{e.preventDefault();App.install=e;if(S.view==="accueil"||S.view==="reglages")renderAll()});
  window.addEventListener("appinstalled",()=>{App.install=null;toast("Appli installée sur l'écran d'accueil.")});

  if("serviceWorker" in navigator){
    navigator.serviceWorker.addEventListener("message",e=>{if(e.data&&e.data.type==="synced"){S.lastOk=Date.now();reloadLocal()}});
    navigator.serviceWorker.addEventListener("controllerchange",()=>{if(App.updating){App.updating=false;location.reload()}});
    navigator.serviceWorker.register("sw.js").then(reg=>{
      if(reg.waiting&&navigator.serviceWorker.controller)showUpdate(reg);
      reg.addEventListener("updatefound",()=>{const w=reg.installing;if(w)w.addEventListener("statechange",()=>{if(w.state==="installed"&&navigator.serviceWorker.controller)showUpdate(reg)})});
      setInterval(()=>reg.update().catch(()=>{}),3600000);
    }).catch(err=>console.warn("service worker",err));
  }

  // Clé passée par le lien d'accès (#cle=…) : rangée dans le téléphone, puis effacée de l'adresse.
  const hm=(location.hash||"").match(/cle=([A-Za-z0-9]{24,64})/);
  if(hm){history.replaceState(null,"",location.pathname+location.search);await App.setKey(hm[1],true)}
  App.key=App.key||await AtelierCore.kv.get("key");
  await reloadLocal();
  if(!App.key){go("accueil");updateConn();return}
  const want=(location.hash||"").slice(1);
  go(["intervention","stock","locations","reference","reglages"].includes(want)?want:"flotte");
  if(new URLSearchParams(location.search).get("action")==="scan")Scan.open();
  if(App.online())doSync(false);
}
boot();
