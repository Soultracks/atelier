/* Atelier Soultracks · module « Carnet d'entretien »
   Logique et écrans repris du carnet artefact v1.4.1 (mêmes calculs, mêmes libellés).
   Différence : toute saisie part d'abord dans la base du téléphone (file d'envoi), puis vers
   le Google Sheets par la passerelle dès qu'il y a du réseau. Le stock bouge par mouvements. */
"use strict";

/* ---------- données de référence (manuel Soultracks Kove 450 Rally Factory, table TORQUE INSPECTION) ---------- */
const OPS = [
  {id:"vidange", label:"Vidange + filtre à huile", every:2000, unit:"km", firstEvery:500, firstUntil:2000},
  {id:"filtre_air", label:"Filtre à air", every:1000, unit:"km"},
  {id:"soupapes", label:"Jeu aux soupapes", every:2000, unit:"km"},
  {id:"filtre_carbu", label:"Filtre à carburant", every:10000, unit:"km"},
  {id:"suspension", label:"Huile de suspension", every:5000, unit:"km"},
  {id:"refroid", label:"Liquide de refroidissement", every:30000, unit:"km"},
  {id:"embrayage", label:"Embrayage"},
  {id:"chaine", label:"Chaîne / kit chaîne"},
  {id:"pneus", label:"Pneus"},
  {id:"plaquettes", label:"Plaquettes"},
  {id:"batterie", label:"Batterie"},
  {id:"revision", label:"Révision complète"},
  {id:"reparation", label:"Réparation"},
  {id:"controle", label:"Contrôle avant départ"}
];
const OPS_BY_ID = Object.fromEntries(OPS.map(o=>[o.id,o]));
const INTERVALS = [
  ["Huile moteur","500 km les 2 000 premiers km, puis tous les 2 000 km"],
  ["Filtre à huile (cartouche)","À chaque vidange"],
  ["Filtre à carburant","Tous les 10 000 km / 1 an"],
  ["Filtre à air (mousse)","1 000 km ou 1 mois ; chaque jour en désert, tous les 3 jours en piste poussiéreuse"],
  ["Jeu aux soupapes (adm. + éch.)","Tous les 2 000 km / 30 h"],
  ["Chaîne","Contrôle et graissage fréquents"],
  ["Batterie","Contrôle tous les mois"],
  ["Embrayage","Route 5 000 km / hors-route 20 h"],
  ["Liquide de refroidissement","Tous les 30 000 km / 2 ans"],
  ["Huile de suspension","Tous les 5 000 km / 100 h"]
];
const MEMO = [
  ["Huile moteur","API SN 10W-40"],["Huile, vidange + filtre","1,6 L"],["Huile, après ouverture moteur","1,8 L"],
  ["Liquide de frein","DOT4"],["Refroidissement","Pré-mélange Kove (−38 / 125 °C)"],["Carburant","≈ 30 L, SP92+, avant puis arrière, max 90 %"],
  ["Bougie","NGK CR8E, 0,7 à 0,8 mm"],["Flèche de chaîne","35 à 50 mm (max 50)"],["Garde d'embrayage","10 à 15 mm"],
  ["Garde d'accélérateur","2 à 6 mm"],["Plaquettes AV / AR","limite 3 mm / 5,4 mm"],["Jeu soupapes adm. / éch.","0,10 / 0,15 mm"],
  ["Bouchon de vidange","24 N·m"],["Filtre fin / crépine","11 à 13 N·m"],["Bouchon de remplissage huile","11 à 13 N·m"],
  ["Vis de purge de fourche","1,3 N·m"],["Contre-écrou ressort AR","44 ± 3 N·m"],["Vis de blocage axe AV (M8)","22 N·m"],["Étrier de frein AV","32 N·m"]
];
const TORQUE = [
 [1,"Axe de colonne de direction",70,"","x","x"],[2,"Tés de fourche supérieur",19,"","","x"],[3,"Tés de fourche inférieur",15,"","","x"],
 [4,"Collier inférieur et plaque de connexion supérieure",34,"x","","x"],[5,"Amortisseur de direction",10,"x","",""],[6,"Support d'amortisseur de direction",10,"","",""],
 [7,"Écrou d'axe de roue avant",70,"","","x"],[8,"Vis de pieds de fourche",15,"","","x"],[9,"Vis d'étrier de frein avant",32,"x","","x"],
 [10,"Vis de disque de frein avant",12,"x","","x"],[11,"Vidange banjo",22,"","","x"],[12,"Axe moteur avant",55,"","","x"],
 [13,"Vis de fixation pattes moteur",25,"","","x"],[14,"Vis de fixation moteur supérieure",45,"x","","x"],[15,"Vis de pontet de fourche",25,"x","","x"],
 [16,"Vis de pontets de fourche sur tés",45,"x","","x"],[17,"Suspension arrière moteur et cadre",55,"","","x"],[18,"Écrou du bras oscillant",70,"x","","x"],
 [19,"Vis banjo maître-cylindre frein avant",30,"x","x","x"],[20,"Vis de maître-cylindre arrière",10,"x","","x"],[21,"Boulon de pédale de frein",5,"x","","x"],
 [22,"Boulon de béquille latérale",25,"","x",""],[23,"Écrou de béquille latérale",25,"x","","x"],[24,"Amortisseur, boulon supérieur sur cadre",45,"x","","x"],
 [25,"Amortisseur, boulon inférieur sur bras oscillant",45,"x","","x"],[26,"Bras oscillant et cadre",60,"","","x"],[27,"Roulette de guide-chaîne",22,"","","x"],
 [28,"Biellette",60,"","","x"],[29,"Basculeur",60,"","","x"],[30,"Écrou d'axe de roue arrière",100,"","","x"],
 [31,"Vis de disque de frein arrière",12,"x","","x"],[32,"Vis de sélecteur de vitesse",12,"x","","x"],[33,"Écrou de coude d'échappement sur culasse",22,"","","x"],
 [34,"Vis de raccord de collecteur d'échappement",22,"x","","x"],[35,"Vis de fixation de silencieux",22,"","","x"],[36,"Vis banjo radiateur d'huile",22,"","","x"],
 [37,"Durite d'essence et plaque de fixation",22,"","","x"],[38,"Réservoir arrière et cadre",25,"x","","x"],[39,"Supports de pare-brise G et D sur cadre",22,"x","","x"],
 [40,"Roulements de direction sup. et inf.","","","x",""],[41,"Joint d'étanchéité de roue arrière","","","x",""],[42,"Roulements de tube de fourche","","","x",""],
 [43,"Butées de fourche","","","x",""],[44,"Roulements de bras oscillant en U","","","x",""],[45,"Roulements de bras oscillant triangulaire","","","x",""]
];
const STD = [["M5","0,8","4 à 6","Carénages, leviers, fixations légères"],["M6","1,0","7 à 10","Réservoir, commandes, phares"],["M8","1,25","18 à 25","Étriers de frein, platines, guidon"],["M10","1,5","35 à 45","Roues, supports moteur"],["M12","1,75","60 à 70","Axe de roue, bras oscillant"],["M14","2,0","90 à 110","Pivot de direction, roue arrière (gros cubes)"]];

const COLLS = ["vehicules","pieces","mouvements","interventions","locations","trajets","fournisseurs","parametres"];
const SKEY = {vehicules:"veh",pieces:"parts",mouvements:"moves",interventions:"inter",locations:"locs",trajets:"trajets",fournisseurs:"fours",parametres:"params"};
const ORDER = {mouvements:"createdAt",interventions:"createdAt",locations:"du",trajets:"date"};

/* ---------- QR ---------- */
function qrPayload(token){const id=token.slice(2);return "STX:"+(token[0]==="v"?"VEH-"+id:id)}
function qrMatrix(text){const q=qrcode(0,"M");q.addData(text);q.make();const n=q.getModuleCount();const m=[];for(let r=0;r<n;r++){m.push([]);for(let c=0;c<n;c++)m[r].push(q.isDark(r,c))}return m}
function qrSvg(text){const m=qrMatrix(text),n=m.length,q=2;let p="";for(let r=0;r<n;r++)for(let c=0;c<n;c++)if(m[r][c])p+=`M${c+q} ${r+q}h1v1h-1z`;return `<svg viewBox="0 0 ${n+2*q} ${n+2*q}" shape-rendering="crispEdges" role="img" aria-label="QR code"><rect width="100%" height="100%" fill="#FFFFFF"/><path d="${p}" fill="#111111"/></svg>`}
function parseToken(text){if(!text)return null;let s=String(text).trim();if(/^STX:/i.test(s))s=s.slice(4).trim();else return null;
  if(/^VEH-[A-Za-z0-9._~-]+$/.test(s))return "v-"+s.slice(4);if(/^ST-\d{4,}$/.test(s))return "p-"+s;return null}

/* ---------- base locale : copie du Drive + saisies en attente rejouées par-dessus ---------- */
const clone = o=>o==null?o:JSON.parse(JSON.stringify(o));
function toMaps(data){const D={};COLLS.forEach(c=>{const src=(data&&data[c])||{};D[c]={};if(Array.isArray(src))src.forEach(d=>{const x=Object.assign({},d);const id=x.id;delete x.id;if(id)D[c][id]=x});else Object.entries(src).forEach(([id,d])=>D[c][id]=Object.assign({},d))});return D}
function defImput(v){return v&&v.statut==="perso"?"proprietaire":"societe"}
/* Même règle que la passerelle (Carnet.gs) : ce que le téléphone affiche tout de suite = ce que le Drive aura. */
function applyOp(D,op){
  const now=op.at||new Date().toISOString();
  if(op.kind==="move"){
    const doc=clone(op.doc)||{};const p=D.pieces[doc.pieceId];if(!p)return;
    const delta=+doc.delta||0;const motif=doc.motif||(delta>0?"entrée":"sortie");let qte=+p.qte||0;
    if(delta>0&&motif==="entrée"){const prix=+doc.prixHT||0;const base=p.aConfirmer?0:Math.max(0,qte);p.pmp=base>0?Math.round(((base*(+p.pmp||0))+delta*prix)/(base+delta)*10000)/10000:prix;if(p.aConfirmer)qte=0;p.aConfirmer=false;p.qteProposee=null;doc.coutRetenu=prix;
      if(doc.fournisseur||doc.ref){const refs=Array.isArray(p.refs)?p.refs:[];const ix=refs.findIndex(r=>r.fournisseur===(doc.fournisseur||"")&&(r.ref||"")===(doc.ref||""));const e={type:ix>=0?(refs[ix].type||"fournisseur"):"fournisseur",fournisseur:doc.fournisseur||"",ref:doc.ref||"",prixHT:prix,date:doc.date||"",facture:doc.facture||""};if(ix>=0)refs[ix]=e;else refs.push(e);p.refs=refs}
      if(doc.emplacement)p.emplacement=doc.emplacement;
      p.prixAchat=prix;if(doc.fournisseur)p.fournisseur=doc.fournisseur;if(doc.ref)p.refFournisseur=doc.ref;if(doc.facture)p.facture=doc.facture;p.prixVente=priceOf(p)}
    else{if(p.pmp!=null){doc.prixHT=+p.pmp||0;doc.coutRetenu=+p.pmp||0}}
    p.qte=qte+delta;p._local=true;doc.motif=motif;doc.createdAt=doc.createdAt||now;doc._local=true;D.mouvements[op.id]=doc;return}
  const c=op.coll;if(!D[c])return;
  let doc=clone(op.doc)||{};const cur=D[c][op.id];
  if(op.merge&&cur)doc=Object.assign(clone(cur),doc);
  if(c==="pieces"&&!op.allowQte)doc.qte=cur?cur.qte:0;
  if(c==="pieces"){if(!(doc.prixVenteManuel&&doc.prixVente!=null&&doc.prixVente!=="")){doc.prixVenteManuel=false;doc.prixVente=priceOf(doc)}if(doc.pmp!=null&&doc.prixAchat==null)doc.prixAchat=doc.pmp}
  if(c==="interventions"){const v=D.vehicules[doc.vehiculeId];if(v&&!doc.imputation)doc.imputation=defImput(v);let tot=0;(doc.pieces||[]).forEach(p=>{const sp=D.pieces[p.id]||{};if(sp.pmp!=null)p.prixHT=+sp.pmp||0;tot+=(+p.qte||0)*(+p.prixHT||0)});doc.coutPieces=Math.round(tot*100)/100}
  doc.createdAt=doc.createdAt||(cur&&cur.createdAt)||now;doc._local=true;D[c][op.id]=doc;
  const kmNew=c==="interventions"?+doc.km:c==="locations"?+doc.kmRetour:0;
  if(kmNew>0&&doc.vehiculeId){const v=D.vehicules[doc.vehiculeId];if(v&&!(+v.km>=kmNew)){v.km=kmNew;v._local=true}}
}
function publishData(D){
  for(const c of COLLS){const arr=Object.entries(D[c]||{}).map(([id,d])=>Object.assign({},d,{id}));const k=SKEY[c];
    if(k==="veh"||k==="parts"||k==="fours"||k==="params"){const o={};arr.forEach(d=>o[d.id]=d);S[k]=o}
    else{const f=ORDER[c];if(f)arr.sort((a,b)=>String(b[f]||"").localeCompare(String(a[f]||"")));S[k]=arr}}
  S.ready=true;
}
/* Écriture : saisie rangée dans la file du téléphone, appliquée à l'écran, envoyée dès que possible. */
const W={
  async put(o){const op=AtelierCore.makeOp(o);await AtelierCore.queue.put(op);applyOp(S.D,op);publishData(S.D);App.afterWrite();return op},
  upsert(coll,id,doc,opt){return W.put(Object.assign({kind:"upsert",coll,id,doc},opt||{}))},
  move(id,doc){return W.put({kind:"move",coll:"mouvements",id:id||AtelierCore.newId(),doc})},
  newId(){return AtelierCore.newId()}
};
function writable(){return App.hasKey()}
function isGuide(){return S.role==="guide"}
function dbErr(err){console.error(err);toast("Enregistrement impossible sur ce téléphone : "+((err&&err.message)||"erreur")+".")}

/* ---------- calculs ---------- */
const VEH_ORDER=v=>(v.ordre!=null?v.ordre:99);
function vehList(){return Object.values(S.veh).sort((a,b)=>VEH_ORDER(a)-VEH_ORDER(b)||String(a.id).localeCompare(b.id))}
function partList(){return Object.values(S.parts).sort((a,b)=>String(a.designation||"").localeCompare(b.designation||"","fr"))}
function interFor(vid){return S.inter.filter(i=>i.vehiculeId===vid).sort((a,b)=>String(b.date).localeCompare(a.date)||(b.km||0)-(a.km||0))}
function lastOp(vid,op){return interFor(vid).find(i=>(i.operations||[]).includes(op))}
function nextDue(v){
  if(v.type!=="moto")return [];
  const cur=+v.km||0, out=[];
  for(const op of OPS.filter(o=>o.every)){
    const last=lastOp(v.id,op.id);
    let every=op.every;
    if(op.firstEvery&&(last?last.km:cur)<op.firstUntil)every=op.firstEvery;
    if(!last){out.push({op,state:"none",txt:"Aucune saisie"});continue}
    const due=(+last.km||0)+every, left=due-cur;
    out.push({op,due,left,state:left<0?"bad":left<=Math.max(150,every*0.15)?"warn":"ok",txt:left<0?`Dépassé de ${nf0.format(-left)} km`:`dans ${nf0.format(left)} km`});
  }
  return out;
}
function vehAlert(v){const d=nextDue(v).concat(echeances(v).filter(x=>x.state!=="none"));if(d.some(x=>x.state==="bad"))return"bad";if(d.some(x=>x.state==="warn"))return"warn";if(d.length&&d.every(x=>x.state==="none"))return"none";return"ok"}
const STATUTS={loue:["Loué à Off Road Toulouse par SOULTRACKS EXPEDITION","acc"],perso:["Véhicule personnel du guide (mis à disposition)","warn"],societe:["Propriété de SOULTRACKS EXPEDITION","ok"]};
const IMPUT={societe:"Charge société",proprietaire:"Charge du propriétaire",refacturable:"Refacturable"};
const ECHEANCES=[["ct","Contrôle technique"],["assurance","Assurance"],["cartegrise","Carte grise"]];
/* Barème kilométrique fiscal des automobiles (impots.gouv.fr) : taux des revenus 2022, gelés depuis ; à reprendre quand le barème des revenus 2026 paraîtra. d = distance annuelle en km. */
const BAREME={3:[[5000,0.529,0],[20000,0.316,1065],[Infinity,0.370,0]],4:[[5000,0.606,0],[20000,0.340,1330],[Infinity,0.407,0]],5:[[5000,0.636,0],[20000,0.357,1395],[Infinity,0.427,0]],6:[[5000,0.665,0],[20000,0.374,1457],[Infinity,0.447,0]],7:[[5000,0.697,0],[20000,0.394,1515],[Infinity,0.470,0]]};
function ik(cv,d){cv=Math.min(7,Math.max(3,Math.round(+cv)));const t=BAREME[cv];if(!t||!d)return 0;for(const [max,a,b] of t)if(d<=max)return d*a+b;return 0}
function echeances(v){const out=[];const e=v.echeances||{};const now=new Date(today()).getTime();for(const [k,l] of ECHEANCES){const d=e[k];if(!d){if(v.type!=="moto")out.push({k,l,state:"none",txt:"à saisir"});continue}const days=Math.round((new Date(d).getTime()-now)/864e5);out.push({k,l,d,state:days<0?"bad":days<=30?"warn":"ok",txt:days<0?`échue depuis le ${fdate(d)}`:`le ${fdate(d)}`})}return out}
const ETATS={service:["En service","ok"],raid:["En raid","acc"],revision:["En révision","warn"],prestataire:["Chez un prestataire","warn"],immobilise:["Immobilisé","bad"]};
function etatPill(e){const x=ETATS[e]||["État à saisir",""];return `<span class="pill ${x[1]}">${x[0]}</span>`}
function plate(im){return im?`<span class="plate"><b>F</b><span>${esc(im)}</span></span>`:`<span class="plate none"><b>F</b><span>à saisir</span></span>`}
function pmp(p){if(!p)return 0;if(p.pmp!=null)return +p.pmp;return +p.prixHT||0}
function supplierRefs(p){return Array.isArray(p.refs)?p.refs:[]}
function stockState(p){if(p.aConfirmer)return"todo";if((+p.qte||0)<=(+p.seuil||0))return"low";return"ok"}
const localPill=d=>d&&d._local?` <span class="pill warn" title="Gardé sur ce téléphone, part au Drive dès qu'il y a du réseau">à envoyer</span>`:"";

/* ---------- rendus ---------- */
function waitingEmpty(what){return !S.ready?`<div class="empty"><h3>Chargement…</h3>Lecture de la base de l'atelier.</div>`:`<div class="empty"><h3>${what}</h3></div>`}
function renderFleet(){
  const vs=vehList();
  const motos=vs.filter(v=>v.type==="moto"&&/kove/i.test(v.marque||v.nom||""));
  const alerts=vs.filter(v=>["bad","warn"].includes(vehAlert(v))).length;
  const inService=vs.filter(v=>v.etat==="service"||v.etat==="raid").length;
  const kmTot=motos.reduce((s,v)=>s+(+v.km||0),0);
  $("#fleetStats").innerHTML=vs.length?`
    <div class="stat"><span class="v num">${vs.length}</span><span class="l">véhicules suivis (${motos.length} Kove)</span></div>
    <div class="stat"><span class="v num">${inService}</span><span class="l">en service ou en raid</span></div>
    <div class="stat"><span class="v num" style="color:${alerts?"var(--warn)":"var(--ok)"}">${alerts}</span><span class="l">avec un entretien proche ou dépassé</span></div>
    <div class="stat"><span class="v num">${nf0.format(kmTot)}</span><span class="l">km cumulés des Kove</span></div>`:"";
  if(!vs.length){$("#fleetGrid").innerHTML=waitingEmpty("Aucun véhicule dans la base");return}
  $("#fleetGrid").innerHTML=vs.map(v=>{
    const due=nextDue(v);
    const ech=echeances(v).map(x=>`<div><span class="k">${esc(x.l)}</span><span class="pill ${x.state==="none"?"":x.state}">${esc(x.txt)}</span></div>`).join("");
    const lines=(v.type==="moto"?due.filter(d=>["vidange","filtre_air","soupapes"].includes(d.op.id)).map(d=>`<div><span class="k">${esc(d.op.label)}</span><span class="pill ${d.state==="none"?"":d.state}">${esc(d.txt)}</span></div>`).join(""):"")+ech+`<div class="small muted">${esc((STATUTS[v.statut]||["Statut à saisir"])[0])}</div>`;
    return `<button class="card click" type="button" data-fiche="${esc(v.id)}">
      <div class="vtop"><div><div class="vcode">${esc(v.nom||v.id)}${localPill(v)}</div><div class="vsub">${esc([v.marque,v.modele].filter(Boolean).join(" "))}</div></div>${etatPill(v.etat)}</div>
      <div class="row" style="justify-content:space-between">${plate(v.immat)}<div class="odo"><span class="km">${v.km!=null&&v.km!==""?nf0.format(+v.km):"—"}</span><small>km</small></div></div>
      <div class="alerts">${lines}</div>
    </button>`}).join("");
}
function renderFiche(){
  const v=S.veh[S.fiche];
  if(!v){$("#ficheBody").innerHTML=waitingEmpty("Véhicule introuvable");return}
  const due=nextDue(v), ins=interFor(v.id), locs=S.locs.filter(l=>l.vehiculeId===v.id);
  const byImp={societe:0,proprietaire:0,refacturable:0};ins.forEach(i=>{const k=i.imputation||defImput(v);byImp[k]=(byImp[k]||0)+(+i.coutPieces||0)+(+i.coutMO||0)});
  const ech=echeances(v);
  const token="v-"+v.id;
  const editable=writable()?"":"disabled";
  $("#ficheBody").innerHTML=`
  <div class="card">
    <div class="fiche-head">
      <div style="display:flex;flex-direction:column;gap:10px;min-width:0">
        <div class="vtop"><div><div class="eyebrow">${esc(v.type==="moto"?"Moto":v.type==="fourgon"?"Fourgon d'assistance":"Remorque")}</div><h2>${esc(v.nom||v.id)}</h2><div class="vsub">${esc([v.marque,v.modele].filter(Boolean).join(" "))}</div></div></div>
        <div class="row">${plate(v.immat)} ${etatPill(v.etat)}</div>
        <div class="facts">
          <div><span class="k">N° de série (VIN)</span><span class="v num">${esc(v.vin||"à saisir")}</span></div>
          <div><span class="k">1re immatriculation</span><span class="v">${esc(v.premiereImmat?fdate(v.premiereImmat):"à saisir")}</span></div>
          <div><span class="k">Propriétaire / statut</span><span class="v">${esc((STATUTS[v.statut]||["à saisir"])[0])}</span></div>
          ${v.statut==="loue"?`<div><span class="k">Propriétaire</span><span class="v">${esc(v.proprietaire||"OFF ROAD TOULOUSE")}</span></div>`:""}
          ${v.type==="fourgon"?`<div class="admin-only"><span class="k">Puissance fiscale</span><span class="v">${v.cv?esc(v.cv)+" CV":"à saisir"}</span></div>`:""}
          <div><span class="k">Emplacement</span><span class="v">${esc(v.emplacement||"à saisir")}</span></div>
          <div class="admin-only"><span class="k">Coûts saisis (HT)</span><span class="v num">Société ${eur(byImp.societe)} · Propriétaire ${eur(byImp.proprietaire)} · Refacturable ${eur(byImp.refacturable)}</span></div>
        </div>
      </div>
      <div class="qrbox">${qrSvg(qrPayload(token))}<span class="c">${esc(v.nom||v.id)}</span><button class="btn small admin-only" type="button" data-label-veh="${esc(v.id)}" style="color:#111111;background:#FFFFFF;border-color:#CCCCCC">Autocollant 50 × 50 mm (SVG)</button></div>
    </div>
  </div>
  <form class="form" id="vehEdit">
    <h3>Mettre à jour</h3>
    <div class="fgrid">
      <label class="f"><span>Kilométrage</span><input type="number" id="veKm" inputmode="numeric" min="0" step="1" value="${esc(v.km??"")}" ${editable}></label>
      <label class="f"><span>État</span><select id="veEtat" ${editable}>${Object.entries(ETATS).map(([k,x])=>`<option value="${k}" ${v.etat===k?"selected":""}>${x[0]}</option>`).join("")}</select></label>
      <label class="f"><span>Emplacement</span><input type="text" id="veLoc" maxlength="60" value="${esc(v.emplacement||"")}" placeholder="ex. atelier d'Orthez, remorque, Sádaba" ${editable}></label>
      <label class="f admin-only"><span>Immatriculation</span><input type="text" id="veImmat" maxlength="12" value="${esc(v.immat||"")}" ${editable}></label>
      <label class="f admin-only"><span>Propriétaire / statut</span><select id="veStatut" ${editable}><option value="">À saisir</option>${Object.entries(STATUTS).map(([k,x])=>`<option value="${k}" ${v.statut===k?"selected":""}>${x[0]}</option>`).join("")}</select></label>
      ${v.type==="fourgon"?`<label class="f admin-only"><span>Puissance fiscale (CV)</span><input type="number" id="veCv" min="1" max="20" step="1" value="${esc(v.cv??"")}" placeholder="case P.6 de la carte grise" ${editable}></label>`:""}
      ${ECHEANCES.map(([k,l])=>`<label class="f admin-only"><span>${l} : échéance</span><input type="date" id="veE_${k}" value="${esc((v.echeances||{})[k]||"")}" ${editable}></label>`).join("")}
    </div>
    <label class="f"><span>Notes</span><textarea id="veNotes" maxlength="800" ${editable}>${esc(v.notes||"")}</textarea></label>
    <div class="row"><button class="btn" type="submit" ${editable}>Enregistrer la fiche</button><button class="btn primary" type="button" data-new-iv="${esc(v.id)}">Nouvelle intervention sur ${esc(v.nom||v.id)}</button></div>
  </form>
  ${ech.length?`<h3>Échéances administratives</h3><div class="tablebox"><table><thead><tr><th>Document</th><th>Échéance</th><th>État</th></tr></thead><tbody>${ech.map(x=>`<tr><td>${esc(x.l)}</td><td>${x.d?fdate(x.d):"—"}</td><td><span class="pill ${x.state==="none"?"":x.state}">${esc(x.state==="bad"?"Échue":x.state==="warn"?"Moins de 30 jours":x.state==="ok"?"À jour":"À saisir")}</span></td></tr>`).join("")}</tbody></table></div>`:""}
  ${v.type==="moto"?`<h3>Prochains entretiens</h3><div class="tablebox"><table><thead><tr><th>Opération</th><th>Intervalle</th><th class="n">Dernière (km)</th><th class="n">Prochaine (km)</th><th>État</th></tr></thead><tbody>${due.map(d=>{const l=lastOp(v.id,d.op.id);const every=d.op.firstEvery&&((l?l.km:+v.km||0)<d.op.firstUntil)?d.op.firstEvery:d.op.every;return `<tr><td>${esc(d.op.label)}</td><td class="muted">tous les ${nf0.format(every)} km</td><td class="n">${l?nf0.format(+l.km||0):"—"}</td><td class="n">${d.due!=null?nf0.format(d.due):"—"}</td><td><span class="pill ${d.state==="none"?"":d.state}">${esc(d.txt)}</span></td></tr>`}).join("")}</tbody></table></div><p class="small muted" style="margin:0">Intervalles du manuel. En désert ou piste poussiéreuse, réduire de moitié ; filtre à air chaque jour en désert.</p>`:""}
  <h3>Journal des interventions</h3>
  ${ins.length?`<div class="tablebox"><table><thead><tr><th>Date</th><th class="n">Km</th><th>Travaux</th><th>Pièces montées</th><th class="n admin-only">Coût HT</th><th class="admin-only">Imputation</th><th>Par</th></tr></thead><tbody>${ins.map(i=>`<tr><td>${fdate(i.date)}${localPill(i)}</td><td class="n">${i.km!=null&&i.km!==""?nf0.format(+i.km):"—"}</td><td>${esc((i.operations||[]).map(o=>(OPS_BY_ID[o]||{label:o}).label).join(", "))}${i.remarque?`<div class="small muted">${esc(i.remarque)}</div>`:""}</td><td class="small">${(i.pieces||[]).map(p=>`${esc(p.qte)} × ${esc(p.designation)}`).join("<br>")||"—"}</td><td class="n admin-only">${eur((+i.coutPieces||0)+(+i.coutMO||0))}</td><td class="small admin-only">${esc(IMPUT[i.imputation||defImput(v)])}</td><td class="small">${esc(i.par||"")}${i.qui?" ("+esc(i.qui)+")":""}</td></tr>`).join("")}</tbody></table></div>`:`<div class="empty"><h3>Aucune intervention</h3>La première vidange ou le premier contrôle saisi ici lancera le calcul des prochains entretiens.</div>`}
  <h3>Locations</h3>
  ${locs.length?locTable(locs):`<div class="empty">Aucune location enregistrée pour ce véhicule.</div>`}`;
  $("#vehEdit").addEventListener("submit",async e=>{e.preventDefault();if(!writable())return;
    const patch={km:$("#veKm").value===""?null:Math.round(+$("#veKm").value),etat:$("#veEtat").value,emplacement:$("#veLoc").value.trim(),notes:$("#veNotes").value.trim()};
    if(isGuide()){
      patch.immat=$("#veImmat").value.trim().toUpperCase();
      patch.statut=$("#veStatut").value;
      if($("#veCv"))patch.cv=$("#veCv").value===""?null:Math.round(+$("#veCv").value);
      const ec={};ECHEANCES.forEach(([k])=>ec[k]=$("#veE_"+k).value||null);patch.echeances=ec}
    try{await W.upsert("vehicules",v.id,patch,{merge:true});toast("Fiche enregistrée");renderAll()}catch(err){dbErr(err)}});
}
function locTable(locs){return `<div class="tablebox"><table><thead><tr><th>Raid</th><th>Pilote</th><th>Véhicule</th><th>Du</th><th>Au</th><th class="n">Km départ</th><th class="n">Km retour</th><th class="n">Parcourus</th><th>État départ / retour</th><th>Caution</th><th>Incidents</th></tr></thead><tbody>${locs.map(l=>{const v=S.veh[l.vehiculeId]||{};const d=(l.kmRetour!=null&&l.kmRetour!==""&&l.kmDepart!=null&&l.kmDepart!=="")?(+l.kmRetour-+l.kmDepart):null;return `<tr><td>${esc(l.raid||"")}${localPill(l)}</td><td>${esc(l.pilote||"")}</td><td>${esc(v.nom||l.vehiculeId)}</td><td>${fdate(l.du)}</td><td>${fdate(l.au)}</td><td class="n">${l.kmDepart!=null&&l.kmDepart!==""?nf0.format(+l.kmDepart):"—"}</td><td class="n">${l.kmRetour!=null&&l.kmRetour!==""?nf0.format(+l.kmRetour):"—"}</td><td class="n">${d!=null?nf0.format(d):"—"}</td><td class="small">${esc(l.etatDepart||"—")} / ${esc(l.etatRetour||"—")}</td><td class="small">${esc(l.caution||"—")}</td><td class="small">${esc(l.incidents||"—")}</td></tr>`}).join("")}</tbody></table></div>`}

/* ---------- intervention (brouillon gardé sur le téléphone) ---------- */
function draft(){return store("draft")||{veh:"",date:today(),km:"",ops:[],parts:[],by:"Guide",who:"",mo:"",note:""}}
function saveDraft(d){store("draft",d)}
function renderInterForm(){
  const d=draft();
  const vs=vehList();
  $("#ivVeh").innerHTML=`<option value="">Choisir un véhicule…</option>`+vs.map(v=>`<option value="${esc(v.id)}" ${d.veh===v.id?"selected":""}>${esc(v.nom||v.id)}${v.immat?" · "+esc(v.immat):""}</option>`).join("");
  $("#ivDate").value=d.date||today();
  $("#ivKm").value=d.km;
  const v=S.veh[d.veh];
  $("#ivVehInfo").textContent=v?`Compteur enregistré : ${km(v.km)}`:"";
  $("#ivOps").innerHTML=OPS.map(o=>`<button type="button" class="chip" data-op="${o.id}" aria-pressed="${d.ops.includes(o.id)}">${esc(o.label)}</button>`).join("");
  $("#ivParts").innerHTML=d.parts.length?d.parts.map((p,i)=>{const sp=S.parts[p.id]||{};const left=(+sp.qte||0);return `<div class="line"><span class="d"><b>${esc(sp.designation||p.designation||p.id)}</b><br><span class="small muted">${esc(p.id)} · en stock : ${nf0.format(left)}${isGuide()&&pmp(sp)?` · ${eur(pmp(sp))} HT l'unité`:""}</span></span><span class="qty"><button type="button" data-q="-1" data-i="${i}" aria-label="Moins">−</button><input type="number" min="1" step="1" value="${esc(p.qte)}" data-qi="${i}" aria-label="Quantité"><button type="button" data-q="1" data-i="${i}" aria-label="Plus">+</button></span><button type="button" class="btn small ghost" data-rm="${i}">Retirer</button></div>`}).join(""):`<div class="small muted">Aucune pièce pour l'instant.</div>`;
  $("#ivAddPart").innerHTML=`<option value="">Ou choisir dans le stock…</option>`+partList().filter(p=>!p.aConfirmer).map(p=>`<option value="${esc(p.id)}">${esc(p.designation)} (${esc(p.id)}, stock ${nf0.format(+p.qte||0)})</option>`).join("");
  $("#ivImp").value=d.imp||"";$("#ivBy").value=d.by||"Guide";$("#ivWho").value=d.who||"";$("#ivMO").value=d.mo;$("#ivNote").value=d.note||"";
  const tot=d.parts.reduce((s,p)=>s+pmp(S.parts[p.id])*(+p.qte||0),0)+(+d.mo||0);
  $("#ivTotal").textContent=isGuide()&&(d.parts.length||d.mo)?`Total estimé : ${eur(tot)} HT`:"";
  const short=d.parts.filter(p=>(+((S.parts[p.id]||{}).qte)||0)<(+p.qte||0));
  $("#ivWarn").innerHTML=short.length?`<div class="note warn small">Stock insuffisant pour : ${short.map(p=>esc((S.parts[p.id]||{}).designation||p.id)).join(", ")}. L'intervention s'enregistre quand même et le stock passera en négatif : préviens le guide pour l'entrée de stock manquante.</div>`:"";
  $("#ivSave").disabled=!writable();
}
function readForm(){const d=draft();d.imp=$("#ivImp").value;d.veh=$("#ivVeh").value;d.date=$("#ivDate").value;d.km=$("#ivKm").value;d.by=$("#ivBy").value;d.who=$("#ivWho").value;d.mo=$("#ivMO").value;d.note=$("#ivNote").value;return d}
function addPartToDraft(pid){const p=S.parts[pid];if(!p){toast("Pièce inconnue : "+pid);return}
  if(p.aConfirmer){toast("Cette pièce attend la confirmation de son entrée en stock.");}
  const d=S.view==="intervention"?readForm():draft();const ex=d.parts.find(x=>x.id===pid);if(ex)ex.qte=(+ex.qte||0)+1;else d.parts.push({id:pid,designation:p.designation,qte:1});saveDraft(d);if(S.view!=="intervention")go("intervention");else renderInterForm();toast("Ajoutée : "+p.designation)}
async function saveIntervention(e){
  e.preventDefault();if(!writable()){toast("Ouvre d'abord l'appli avec ton QR d'accès.");return}
  const d=readForm();const v=S.veh[d.veh];
  if(!v){toast("Choisis ou flashe d'abord le véhicule.");return}
  if(!d.ops.length&&!d.parts.length&&!d.note.trim()){toast("Coche au moins un travail, une pièce ou une remarque.");return}
  const kmVal=d.km===""?null:Math.round(+d.km);
  if(kmVal!=null&&v.km!=null&&v.km!==""&&kmVal<+v.km&&!confirmLow(kmVal,v)){return}
  const guide=isGuide();
  const pieces=d.parts.map(p=>{const sp=S.parts[p.id]||{};const o={id:p.id,designation:sp.designation||p.designation||p.id,ref:(supplierRefs(sp)[0]||{}).ref||sp.refFournisseur||"",qte:Math.max(1,Math.round(+p.qte||1))};if(guide)o.prixHT=pmp(sp);return o});
  const iid=W.newId();
  const doc={vehiculeId:v.id,vehicule:v.nom||v.id,date:d.date||today(),km:kmVal,operations:d.ops,pieces,par:guide?d.by:"Mécanicien",qui:d.who.trim()||(guide?"":S.nom||""),remarque:d.note.trim(),createdAt:new Date().toISOString()};
  if(guide){doc.coutMO=d.mo===""?0:Math.round(+d.mo*100)/100;doc.imputation=d.imp||defImput(v)}
  $("#ivSave").disabled=true;
  try{
    await W.upsert("interventions",iid,doc,{create:true});
    for(const p of pieces){await W.move(null,{pieceId:p.id,designation:p.designation,delta:-p.qte,motif:"sortie",vehiculeId:v.id,vehicule:doc.vehicule,interventionId:iid,date:doc.date,createdAt:new Date().toISOString()})}
    store("draft",null);toast(App.online()?"Intervention enregistrée sur "+(v.nom||v.id):"Intervention gardée sur le téléphone : elle part au Drive au retour du réseau");S.fiche=v.id;go("fiche");
  }catch(err){dbErr(err)}finally{$("#ivSave").disabled=!writable()}
}
let lowOk=false;
function confirmLow(kmVal,v){if(lowOk){lowOk=false;return true}
  $("#ivWarn").innerHTML=`<div class="note bad small">Le kilométrage saisi (${nf0.format(kmVal)}) est inférieur au compteur enregistré (${km(v.km)}). Vérifie le chiffre, puis appuie de nouveau sur Enregistrer pour confirmer.</div>`;lowOk=true;return false}

/* ---------- stock ---------- */
/* Règles (décisions du 31/10/2026) : prix d'achat, prix public, marge et fournisseurs ne sont renvoyés par la passerelle
   qu'au profil guide ; le mécanicien reçoit code, désignation, quantité, unité, compatibilité, emplacement. Le prix public HT
   par défaut = prix d'achat moyen HT × coefficient (1,3), modifiable par le guide, pièce par pièce. */
const COEF_DEFAUT=1.3;
function coefDefaut(){const p=S.params&&S.params.coefVente;const v=p&&+String(p.valeur).replace(",",".");return v>0?v:COEF_DEFAUT}
function coefOf(p){return p&&+p.coef>0?+p.coef:coefDefaut()}
function priceOf(p){if(!p)return null;if(p.prixVenteManuel&&p.prixVente!=null&&p.prixVente!=="")return +p.prixVente;return p.pmp==null?null:Math.round(+p.pmp*coefOf(p)*100)/100}
function margeOf(p){const v=priceOf(p),a=pmp(p);if(v==null||!a)return null;return {eur:Math.round((v-a)*100)/100,pct:Math.round((v/a-1)*1000)/10}}
function aCommander(p){if(p.aConfirmer)return 0;const q=+p.qte||0,s=+p.seuil||0;if(s<=0||q>s)return 0;return Math.max(1,2*s-q)}
function fourList(){return Object.values(S.fours||{}).sort((a,b)=>String(a.nom||"").localeCompare(b.nom||"","fr"))}
function fourNames(){const set=new Set(["Kove","TRC Racing","Parts Europe","Thorn Racing","Würth France","Solosan","AD Blanchardet","Mx Graf'X"]);fourList().forEach(f=>f.nom&&set.add(f.nom));partList().forEach(p=>{if(p.fournisseur)set.add(p.fournisseur);supplierRefs(p).forEach(r=>r.fournisseur&&set.add(r.fournisseur))});return [...set]}
function stockResume(){const ps=partList();const r={references:ps.length,aConfirmer:0,sousSeuil:0,aCommander:0,negatif:0,valeurAchatHT:0,valeurVenteHT:0,lignesCommande:0};
  ps.forEach(p=>{if(p.aConfirmer){r.aConfirmer++;return}const q=+p.qte||0;if(q<0)r.negatif++;const c=aCommander(p);if(c){r.sousSeuil++;r.aCommander+=c;r.lignesCommande++}r.valeurAchatHT+=Math.max(0,q)*pmp(p);r.valeurVenteHT+=Math.max(0,q)*(priceOf(p)||0)});
  r.valeurAchatHT=Math.round(r.valeurAchatHT*100)/100;r.valeurVenteHT=Math.round(r.valeurVenteHT*100)/100;return r}
self.ATELIER_STOCK={resume:stockResume}; // pour le tableau de bord (rangée « Flotte et stock »)
let invCount={}; // inventaire en cours (quantités comptées), gardé le temps de la saisie
function renderStock(){
  const ps=partList(),guide=isGuide(),r=stockResume();
  $("#stockStats").innerHTML=ps.length?`<div class="stat"><span class="v num">${ps.length}</span><span class="l">références</span></div><div class="stat admin-only"><span class="v num">${eur(r.valeurAchatHT)}</span><span class="l">valeur du stock HT (coût moyen)</span></div><div class="stat admin-only"><span class="v num">${eur(r.valeurVenteHT)}</span><span class="l">valeur au prix public HT</span></div><div class="stat"><span class="v num" style="color:${r.sousSeuil?"var(--warn)":"var(--ok)"}">${r.sousSeuil}</span><span class="l">sous le seuil d'alerte</span></div><div class="stat"><span class="v num" style="color:${r.aConfirmer?"var(--accent)":"var(--ok)"}">${r.aConfirmer}</span><span class="l">entrées à confirmer</span></div>`:"";
  const sel=$("#stockFilter");if(guide&&!sel.querySelector('[value="cmd"]'))sel.insertAdjacentHTML("beforeend",`<option value="cmd">Proposition de commande</option><option value="inv">Inventaire (comptage)</option><option value="mvt">Mouvements</option>`);
  if(!guide&&sel.querySelector('[value="cmd"]')){["cmd","inv","mvt"].forEach(v=>{const o=sel.querySelector(`[value="${v}"]`);if(o)o.remove()});if(!sel.value)sel.value=""}
  const q=($("#stockSearch").value||"").toLowerCase().trim(), f=$("#stockFilter").value;
  if(!ps.length){$("#stockList").innerHTML=waitingEmpty("Aucune pièce dans le stock");renderLabels();renderStockBoxes();return}
  if(f==="cmd"&&guide){renderCommande();renderLabels();renderStockBoxes();return}
  if(f==="inv"&&guide){renderInventaire(q);renderLabels();renderStockBoxes();return}
  if(f==="mvt"&&guide){renderMouvements(q);renderLabels();renderStockBoxes();return}
  const list=ps.filter(p=>(!q||[p.id,p.designation,p.refFournisseur,p.refConstructeur,p.fournisseur,p.emplacement,p.compat,...supplierRefs(p).map(r=>r.fournisseur+" "+r.ref)].join(" ").toLowerCase().includes(q))&&(!f||(f==="low"?aCommander(p)>0:stockState(p)===f)));
  const w=writable()&&guide;
  const refsHtml=p=>{const rs=supplierRefs(p);const lines=rs.length?rs.map(r=>`${esc(r.fournisseur||"—")}${r.ref?` <span class="muted">${esc(r.ref)}</span>`:""}${r.type==="constructeur"?` <span class="pill">constr.</span>`:""}`):[esc(p.fournisseur||"—")+(p.refFournisseur?` <span class="muted">${esc(p.refFournisseur)}</span>`:"")];if(p.refConstructeur&&!rs.some(r=>r.type==="constructeur"))lines.push(`Constructeur <span class="muted">${esc(p.refConstructeur)}</span>`);return lines.join("<br>")};
  $("#stockList").innerHTML=`<div class="tablebox"><table><thead><tr><th class="admin-only"></th><th>Code</th><th>Pièce</th><th class="admin-only">Fournisseur · références</th><th class="n">Stock</th><th class="n admin-only">Seuil</th><th>Emplacement</th><th class="n admin-only">Achat HT</th><th class="n admin-only">Public HT</th><th class="n admin-only">Marge</th><th></th></tr></thead><tbody>${list.map(p=>{const st=stockState(p),m=margeOf(p),pv=priceOf(p),cmd=aCommander(p);return `<tr id="row-${esc(p.id)}">
    <td class="admin-only"><input type="checkbox" data-sel="${esc(p.id)}" ${S.sel.has(p.id)?"checked":""} aria-label="Sélectionner pour les étiquettes"></td>
    <td class="num"><b>${esc(p.id)}</b></td>
    <td>${esc(p.designation)}${localPill(p)}${p.compat?`<div class="small muted">${esc(p.compat)}</div>`:""}${p.aConfirmer?`<div class="small" style="color:var(--accent)">${esc(guide?(p.source||"Entrée proposée"):"Entrée proposée, pas encore en stock")}</div>`:""}${guide&&p.facture?`<div class="small muted">Facture : ${esc(p.facture)}</div>`:""}</td>
    <td class="small admin-only">${refsHtml(p)}</td>
    <td class="n">${p.aConfirmer?`<span class="pill acc">+${nf0.format(+p.qteProposee||0)} à confirmer</span>`:`<span class="pill ${st==="low"?"warn":"ok"}">${nf0.format(+p.qte||0)} ${esc(p.unite||"")}</span>${cmd?`<div class="small" style="color:var(--warn)">à commander : ${cmd}</div>`:""}`}</td>
    <td class="n admin-only">${nf0.format(+p.seuil||0)}</td>
    <td class="small">${esc(p.emplacement||"—")}</td>
    <td class="n admin-only">${pmp(p)?eur(pmp(p)):"—"}</td>
    <td class="n admin-only">${pv!=null?eur(pv)+(p.prixVenteManuel?"":`<div class="small muted">× ${String(coefOf(p)).replace(".",",")}</div>`):"—"}${p.boutique&&p.boutique.vendable?`<div><span class="pill acc">Boutique${p.boutique.prixVente!=null?" "+eur(p.boutique.prixVente)+" TTC":""}</span></div>`:""}</td>
    <td class="n admin-only">${m?`${eur(m.eur)}<div class="small muted">${String(m.pct).replace(".",",")} %</div>`:"—"}</td>
    <td><div class="row" style="flex-wrap:nowrap;gap:6px">${guide?(p.aConfirmer?`<button class="btn small primary" type="button" data-confirm="${esc(p.id)}" ${w?"":"disabled"}>Confirmer</button>`:`<button class="btn small" type="button" data-entree="${esc(p.id)}" ${w?"":"disabled"}>Entrée</button>`)+`<button class="btn small ghost" type="button" data-edit="${esc(p.id)}" ${w?"":"disabled"}>Modifier</button>`:""}${p.aConfirmer?"":`<button class="btn small ghost" type="button" data-sortie="${esc(p.id)}" ${writable()?"":"disabled"} title="Sortir cette pièce sur une moto">Sortir</button>`}</div></td></tr>`}).join("")||`<tr><td colspan="11" class="muted">Aucune pièce ne correspond.</td></tr>`}</tbody></table></div>`;
  renderLabels();renderStockBoxes();
}
/* Proposition de commande : pièces au seuil ou en dessous, quantité = 2 × seuil − stock (au moins 1), groupées par fournisseur. */
function commandeRows(){return partList().map(p=>({p,q:aCommander(p)})).filter(x=>x.q>0).map(({p,q})=>{const r0=supplierRefs(p).find(r=>r.type!=="constructeur")||{};return {id:p.id,des:p.designation,four:r0.fournisseur||p.fournisseur||"Fournisseur à choisir",ref:r0.ref||p.refFournisseur||"",qte:+p.qte||0,seuil:+p.seuil||0,q,pu:pmp(p),tot:Math.round(q*pmp(p)*100)/100}}).sort((a,b)=>a.four.localeCompare(b.four,"fr")||a.id.localeCompare(b.id))}
function renderCommande(){const rows=commandeRows();if(!rows.length){$("#stockList").innerHTML=`<div class="empty"><h3>Rien à commander</h3>Aucune pièce n'est au seuil d'alerte ou en dessous.</div>`;return}
  const by={};rows.forEach(r=>{(by[r.four]=by[r.four]||[]).push(r)});
  $("#stockList").innerHTML=`<p class="small muted">Quantité proposée : deux fois le seuil d'alerte, moins le stock (au moins 1). À ajuster à la commande ; l'entrée se fait à la réception, facture en main.</p>`+Object.entries(by).map(([four,rs])=>`<div class="form"><h3>${esc(four)} <span class="small muted">· ${rs.length} référence${rs.length>1?"s":""} · ${eur(rs.reduce((s,r)=>s+r.tot,0))} HT estimés</span></h3><div class="tablebox"><table><thead><tr><th>Code</th><th>Pièce</th><th>Référence</th><th class="n">Stock</th><th class="n">Seuil</th><th class="n">À commander</th><th class="n">Dernier coût HT</th></tr></thead><tbody>${rs.map(r=>`<tr><td class="num"><b>${esc(r.id)}</b></td><td>${esc(r.des)}</td><td class="small">${esc(r.ref)}</td><td class="n">${nf0.format(r.qte)}</td><td class="n">${nf0.format(r.seuil)}</td><td class="n"><b>${nf0.format(r.q)}</b></td><td class="n">${r.pu?eur(r.pu):"—"}</td></tr>`).join("")}</tbody></table></div></div>`).join("")+`<div class="row"><button class="btn primary" type="button" id="dlCommande">Télécharger la proposition (CSV)</button></div>`;
  $("#dlCommande").onclick=()=>offer(`commande_pieces_${today()}.csv`,csv([["Fournisseur","Code","Désignation","Référence fournisseur","Stock","Seuil","Quantité à commander","Dernier coût HT","Montant estimé HT"],...rows.map(r=>[r.four,r.id,r.des,r.ref,r.qte,r.seuil,r.q,dec(r.pu),dec(r.tot)])]))}
/* Inventaire : on compte, l'appli enregistre une correction par pièce dont le compte diffère (motif « inventaire »). */
function renderInventaire(q){const ps=partList().filter(p=>!p.aConfirmer&&(!q||[p.id,p.designation,p.emplacement].join(" ").toLowerCase().includes(q)));
  const diff=ps.filter(p=>invCount[p.id]!=null&&invCount[p.id]!==""&&Math.round(+invCount[p.id])!==(+p.qte||0));
  $("#stockList").innerHTML=`<p class="small muted">Compte chaque pièce et saisis la quantité trouvée. Seules les lignes où le compte diffère du stock seront corrigées (mouvement « inventaire », daté d'aujourd'hui, au coût moyen).</p><div class="tablebox"><table><thead><tr><th>Code</th><th>Pièce</th><th>Emplacement</th><th class="n">Stock</th><th class="n">Compté</th><th class="n">Écart</th></tr></thead><tbody>${ps.map(p=>{const c=invCount[p.id];const d=(c==null||c==="")?null:Math.round(+c)-(+p.qte||0);return `<tr><td class="num"><b>${esc(p.id)}</b></td><td>${esc(p.designation)}</td><td class="small">${esc(p.emplacement||"—")}</td><td class="n">${nf0.format(+p.qte||0)}</td><td class="n"><input type="number" inputmode="numeric" min="0" step="1" style="width:84px" data-inv="${esc(p.id)}" value="${c==null?"":esc(c)}" aria-label="Quantité comptée"></td><td class="n">${d==null?"":d===0?`<span class="pill ok">ok</span>`:`<span class="pill ${d<0?"bad":"warn"}">${d>0?"+":""}${d}</span>`}</td></tr>`}).join("")||`<tr><td colspan="6" class="muted">Aucune pièce.</td></tr>`}</tbody></table></div>
    <div class="row"><button class="btn primary" type="button" id="invSave" ${diff.length&&writable()?"":"disabled"}>Enregistrer ${diff.length} correction${diff.length>1?"s":""}</button><button class="btn ghost" type="button" id="invClear">Effacer les comptes</button><span class="small muted">Les pièces non comptées ne bougent pas.</span></div>`;
  $("#invClear").onclick=()=>{invCount={};renderStock()};
  $("#invSave").onclick=async()=>{if(!writable()||!isGuide())return;try{for(const p of diff){const n=Math.round(+invCount[p.id]);await W.move(null,{pieceId:p.id,designation:p.designation,delta:n-(+p.qte||0),motif:"inventaire",date:today(),createdAt:new Date().toISOString()})}toast(`${diff.length} correction(s) d'inventaire enregistrée(s)`);invCount={};renderStock()}catch(err){dbErr(err)}}}
function renderMouvements(q){const ms=S.moves.filter(m=>!q||[m.pieceId,m.designation,m.motif,m.fournisseur,m.facture,m.vehicule].join(" ").toLowerCase().includes(q)).slice(0,300);
  $("#stockList").innerHTML=ms.length?`<div class="tablebox"><table><thead><tr><th>Date</th><th>Pièce</th><th class="n">Qté</th><th>Motif</th><th>Véhicule</th><th>Fournisseur · facture</th><th class="n">Coût unitaire HT</th><th>Par</th></tr></thead><tbody>${ms.map(m=>`<tr><td class="small">${fdate(m.date)}</td><td><b>${esc(m.pieceId)}</b> ${esc(m.designation||(S.parts[m.pieceId]||{}).designation||"")}${localPill(m)}</td><td class="n">${m.delta>0?"+":""}${nf0.format(+m.delta||0)}</td><td class="small">${esc(m.motif||"")}</td><td class="small">${esc(m.vehicule||(S.veh[m.vehiculeId]||{}).nom||m.vehiculeId||"")}</td><td class="small">${esc([m.fournisseur,m.facture].filter(Boolean).join(" · "))}</td><td class="n">${m.coutRetenu!=null||m.prixHT!=null?eur(m.coutRetenu??m.prixHT):"—"}</td><td class="small">${esc(m.par||"")}</td></tr>`).join("")}</tbody></table></div>`:`<div class="empty"><h3>Aucun mouvement</h3></div>`}
/* Encadrés du guide sous la liste : coefficient par défaut, fournisseurs. */
function renderStockBoxes(){const box=$("#stockBoxes");if(!isGuide()){box.innerHTML="";return}
  const fs=fourList();
  box.innerHTML=`<details class="box" id="coefBox"><summary>Prix public et coefficient de revente</summary><form class="row" id="coefForm" style="margin-top:10px" autocomplete="off"><label class="f"><span>Coefficient par défaut (prix public HT = coût d'achat HT × coefficient)</span><input type="number" id="coefVal" min="1" max="19" step="0.01" inputmode="decimal" value="${esc(coefDefaut())}" style="width:120px"></label><button class="btn primary" type="submit">Enregistrer</button><span class="small muted">Aujourd'hui × ${esc(String(coefDefaut()).replace(".",","))} : marge de ${esc(String(Math.round((coefDefaut()-1)*1000)/10).replace(".",","))} % sur l'achat. Une pièce peut avoir son propre coefficient ou un prix saisi à la main (bouton Modifier). Les pièces au prix calculé suivent le nouveau coefficient.</span></form></details>
  <details class="box" id="fourBox"><summary>Fournisseurs (${fs.length})</summary><div style="margin-top:10px">${fs.length?`<div class="tablebox"><table><thead><tr><th>Nom</th><th>Site</th><th>Contact</th><th>N° client</th><th>Conditions</th><th></th></tr></thead><tbody>${fs.map(f=>`<tr><td><b>${esc(f.nom)}</b>${localPill(f)}</td><td class="small">${esc(f.site||"")}</td><td class="small">${esc([f.email,f.telephone].filter(Boolean).join(" · "))}</td><td class="small">${esc(f.numeroClient||"")}</td><td class="small">${esc(f.conditions||"")}${f.notes?`<div class="muted">${esc(f.notes)}</div>`:""}</td><td><button class="btn small ghost" type="button" data-four="${esc(f.id)}">Modifier</button></td></tr>`).join("")}</tbody></table></div>`:`<div class="small muted">Aucun fournisseur enregistré.</div>`}<div class="row" style="margin-top:8px"><button class="btn small" type="button" id="newFourBtn">Nouveau fournisseur</button></div><div id="fourFormBox"></div></div></details>`;
  $("#coefForm").onsubmit=async e=>{e.preventDefault();if(!writable())return;const v=Math.round(+String($("#coefVal").value).replace(",",".")*100)/100;if(!(v>0&&v<20)){toast("Coefficient invalide");return}try{await W.upsert("parametres","coefVente",{valeur:v,libelle:"Coefficient de revente par défaut (prix public HT = prix d'achat HT × coefficient)"},{merge:true});toast("Coefficient enregistré : × "+String(v).replace(".",","));renderStock()}catch(err){dbErr(err)}};
  $("#newFourBtn").onclick=()=>fourForm(null);
  $$("[data-four]").forEach(b=>b.onclick=()=>fourForm(S.fours[b.dataset.four]));
}
function fourForm(f){const isNew=!f;f=f||{};const box=$("#fourFormBox");$("#fourBox").open=true;
  box.innerHTML=`<form class="form" id="fourForm" autocomplete="off"><h3>${isNew?"Nouveau fournisseur":"Modifier "+esc(f.nom)}</h3><div class="fgrid"><label class="f"><span>Nom</span><input type="text" id="ffNom" maxlength="60" required value="${esc(f.nom||"")}"></label><label class="f"><span>Site web</span><input type="url" id="ffSite" maxlength="120" value="${esc(f.site||"")}" placeholder="https://"></label><label class="f"><span>E-mail</span><input type="email" id="ffMail" maxlength="80" value="${esc(f.email||"")}"></label><label class="f"><span>Téléphone</span><input type="tel" id="ffTel" maxlength="30" value="${esc(f.telephone||"")}"></label><label class="f"><span>N° client chez eux</span><input type="text" id="ffNum" maxlength="40" value="${esc(f.numeroClient||"")}"></label><label class="f"><span>Conditions (remise, port, délai)</span><input type="text" id="ffCond" maxlength="120" value="${esc(f.conditions||"")}"></label></div><label class="f"><span>Notes</span><textarea id="ffNotes" maxlength="400">${esc(f.notes||"")}</textarea></label><div class="row"><button class="btn primary" type="submit">${isNew?"Créer":"Enregistrer"}</button><button class="btn ghost" type="button" id="ffCancel">Annuler</button></div></form>`;
  $("#ffCancel").onclick=()=>{box.innerHTML=""};
  $("#fourForm").onsubmit=async e=>{e.preventDefault();if(!writable()||!isGuide())return;const doc={nom:$("#ffNom").value.trim(),site:$("#ffSite").value.trim(),email:$("#ffMail").value.trim(),telephone:$("#ffTel").value.trim(),numeroClient:$("#ffNum").value.trim(),conditions:$("#ffCond").value.trim(),notes:$("#ffNotes").value.trim()};
    try{await W.upsert("fournisseurs",isNew?"F-"+W.newId().slice(-8).toUpperCase():f.id,doc,isNew?{create:true}:{merge:true});toast("Fournisseur enregistré");renderStock()}catch(err){dbErr(err)}}}
function refRow(r,i){r=r||{};return `<div class="line refrow" data-ri="${i}"><select class="rfType" style="width:auto"><option value="fournisseur" ${r.type!=="constructeur"?"selected":""}>Fournisseur</option><option value="constructeur" ${r.type==="constructeur"?"selected":""}>Constructeur</option></select><input type="text" class="rfFour" list="fourList" maxlength="40" placeholder="Kove, Parts Europe, TRC Racing…" value="${esc(r.fournisseur||"")}" style="flex:1;min-width:130px"><input type="text" class="rfRef" maxlength="40" placeholder="Référence" value="${esc(r.ref||"")}" style="flex:1;min-width:110px"><input type="number" class="rfPrix" min="0" step="0.01" placeholder="Prix HT" value="${esc(r.prixHT??"")}" style="width:110px"><input type="date" class="rfDate" value="${esc(r.date||"")}" style="width:150px"><input type="text" class="rfFact" maxlength="60" placeholder="Facture" value="${esc(r.facture||"")}" style="flex:1;min-width:120px"><button type="button" class="btn small ghost" data-rfdel="${i}">Retirer</button></div>`}
function readRefs(){return $$("#pfRefs .refrow").map(r=>({type:r.querySelector(".rfType").value,fournisseur:r.querySelector(".rfFour").value.trim(),ref:r.querySelector(".rfRef").value.trim(),prixHT:r.querySelector(".rfPrix").value===""?null:Math.round(+r.querySelector(".rfPrix").value*100)/100,date:r.querySelector(".rfDate").value||null,facture:r.querySelector(".rfFact").value.trim()})).filter(r=>r.fournisseur||r.ref)}
function partForm(p){
  const isNew=!p;p=p||{};
  const refs=supplierRefs(p).length?supplierRefs(p):[{}];
  $("#partFormBox").hidden=false;
  $("#partFormBox").innerHTML=`<form class="form" id="partForm"><h3>${isNew?"Nouvelle pièce · code "+esc(nextPartId()):"Modifier "+esc(p.id)}</h3>
    <div class="fgrid">
      <label class="f"><span>Désignation</span><input type="text" id="pfDes" maxlength="80" required value="${esc(p.designation||"")}"></label>
      <label class="f"><span>Désignation courte (étiquette, 2 lignes max)</span><input type="text" id="pfCourt" maxlength="40" value="${esc(p.designationCourte||"")}" placeholder="vide = début de la désignation"></label>
      <label class="f"><span>Compatibilité</span><input type="text" id="pfCompat" maxlength="60" value="${esc(p.compat||"Kove 450 Rally")}"></label>
      <label class="f"><span>${isNew?"Quantité en stock":"Quantité en stock (correction)"}</span><input type="number" id="pfQte" min="0" step="1" value="${esc(p.qte??0)}"></label>
      <label class="f"><span>Unité</span><input type="text" id="pfUnit" maxlength="12" value="${esc(p.unite||"pièce")}"></label>
      <label class="f"><span>Seuil d'alerte</span><input type="number" id="pfSeuil" min="0" step="1" value="${esc(p.seuil??1)}"></label>
      <label class="f"><span>Emplacement</span><input type="text" id="pfLoc" maxlength="40" value="${esc(p.emplacement||"")}" placeholder="ex. bac 3, étagère B, fourgon"></label>
      <label class="f"><span>Coût d'achat unitaire moyen (€ HT)${isNew?"":", une correction crée un ajustement"}</span><input type="number" id="pfPrix" min="0" step="0.01" value="${esc(p.pmp??p.prixHT??"")}"></label>
      <label class="f"><span>Coefficient de cette pièce (vide = ${esc(String(coefDefaut()).replace(".",","))} par défaut)</span><input type="number" id="pfCoef" min="1" max="19" step="0.01" inputmode="decimal" value="${esc(p.coef??"")}"></label>
      <label class="f"><span>Prix public (€ HT) — vide = coût × coefficient</span><input type="number" id="pfVente" min="0" step="0.01" value="${esc(p.prixVenteManuel&&p.prixVente!=null?p.prixVente:"")}"></label>
      <label class="f"><span>Facture d'origine</span><input type="text" id="pfFact" maxlength="80" value="${esc(p.facture||"")}" placeholder="ex. Würth 4336114564"></label>
    </div>
    <div class="small muted" id="pfMarge"></div>
    <div class="f"><span class="small muted" style="font-weight:600">Références fournisseurs et constructeur (prix d'achat, date, facture)</span><div class="lines" id="pfRefs">${refs.map(refRow).join("")}</div><div class="row"><button type="button" class="btn small" id="pfAddRef">Ajouter une référence</button></div></div>
    <div class="fgrid"><label class="row small"><input type="checkbox" id="pfShop" ${p.boutique&&p.boutique.vendable?"checked":""}> Vendable en boutique</label><label class="f"><span>Prix de vente TTC (boutique)</span><input type="number" id="pfShopPrix" min="0" step="0.01" value="${esc(p.boutique&&p.boutique.prixVente!=null?p.boutique.prixVente:"")}"></label></div>
    <datalist id="fourList">${fourNames().map(f=>`<option>${esc(f)}</option>`).join("")}</datalist>
    <div class="row"><button class="btn primary" type="submit">${isNew?"Créer la pièce":"Enregistrer"}</button><button class="btn ghost" type="button" id="pfCancel">Annuler</button></div></form>`;
  const showMarge=()=>{const a=+$("#pfPrix").value||0,c=+String($("#pfCoef").value).replace(",",".")||coefDefaut(),vm=$("#pfVente").value;const v=vm===""?(a?Math.round(a*c*100)/100:null):+vm;$("#pfMarge").textContent=v==null?"Prix public : à calculer dès qu'un coût d'achat est connu.":`Prix public ${vm===""?"calculé":"saisi"} : ${eur(v)} HT · marge ${eur(v-a)} (${a?String(Math.round((v/a-1)*1000)/10).replace(".",","):"—"} % sur l'achat).`};
  ["pfPrix","pfCoef","pfVente"].forEach(id=>$("#"+id).addEventListener("input",showMarge));showMarge();
  $("#pfAddRef").onclick=()=>{$("#pfRefs").insertAdjacentHTML("beforeend",refRow({},$$("#pfRefs .refrow").length))};
  $("#pfRefs").addEventListener("click",e=>{const b=e.target.closest("[data-rfdel]");if(b)b.closest(".refrow").remove()});
  $("#pfCancel").onclick=()=>{$("#partFormBox").hidden=true;$("#partFormBox").innerHTML=""};
  $("#partForm").onsubmit=async e=>{e.preventDefault();if(!writable()||!isGuide())return;
    const refsVal=readRefs();const rf=refsVal.find(r=>r.type!=="constructeur")||{},rc=refsVal.find(r=>r.type==="constructeur")||{};
    const qte=Math.round(+$("#pfQte").value||0);
    const vente=$("#pfVente").value,coef=$("#pfCoef").value;
    const body={designation:$("#pfDes").value.trim(),designationCourte:$("#pfCourt").value.trim(),compat:$("#pfCompat").value.trim(),unite:$("#pfUnit").value.trim(),seuil:Math.round(+$("#pfSeuil").value||0),emplacement:$("#pfLoc").value.trim(),pmp:$("#pfPrix").value===""?null:Math.round(+$("#pfPrix").value*100)/100,refs:refsVal,fournisseur:rf.fournisseur||"",refFournisseur:rf.ref||"",refConstructeur:rc.ref||"",facture:$("#pfFact").value.trim()||rf.facture||"",coef:coef===""?null:Math.round(+String(coef).replace(",",".")*100)/100,prixVenteManuel:vente!=="",prixVente:vente===""?null:Math.round(+vente*100)/100,boutique:{vendable:$("#pfShop").checked,prixVente:$("#pfShopPrix").value===""?null:Math.round(+$("#pfShopPrix").value*100)/100}};
    if(body.coef!=null&&!(body.coef>0&&body.coef<20)){toast("Coefficient invalide");return}
    if(qte>0&&body.pmp==null){toast("Indique le coût d'achat : il est obligatoire dès qu'il y a du stock.");return}
    try{
      if(isNew){const id=nextPartId();await W.upsert("pieces",id,Object.assign({aConfirmer:false,qte:0},body),{create:true});
        if(qte>0)await W.move(null,{pieceId:id,designation:body.designation,delta:qte,motif:"entrée",fournisseur:body.fournisseur,ref:body.refFournisseur,facture:body.facture,date:today(),prixHT:body.pmp||0,createdAt:new Date().toISOString()});
        toast("Pièce créée : "+id);S.sel.add(id)}
      else{const old=+p.qte||0,oldC=pmp(p);await W.upsert("pieces",p.id,body,{merge:true});
        if(body.pmp!=null&&Math.abs(body.pmp-oldC)>0.0001)await W.move(null,{pieceId:p.id,designation:body.designation,delta:0,motif:"ajustement de coût",ancienCout:oldC,nouveauCout:body.pmp,qteConcernee:old,date:today(),createdAt:new Date().toISOString()});
        if(qte!==old)await W.move(null,{pieceId:p.id,designation:body.designation,delta:qte-old,motif:"correction d'inventaire",date:today(),createdAt:new Date().toISOString()});
        toast("Pièce enregistrée")}
      $("#partFormBox").hidden=true;$("#partFormBox").innerHTML="";renderStock();
    }catch(err){dbErr(err)}};
  $("#pfDes").focus();
}
function nextPartId(){let m=0;for(const id of Object.keys(S.parts)){const x=/^ST-(\d+)$/.exec(id);if(x)m=Math.max(m,+x[1])}return "ST-"+String(m+1).padStart(4,"0")}
function entreeForm(pid){const p=S.parts[pid];if(!p)return;
  const refs=supplierRefs(p);const r0=refs[0]||{};
  $("#partFormBox").hidden=false;
  $("#partFormBox").innerHTML=`<form class="form" id="inForm"><h3>Entrée de stock · ${esc(p.id)} · ${esc(p.designation)}</h3><div class="fgrid">
    <label class="f"><span>Quantité reçue</span><input type="number" id="inQte" min="1" step="1" value="${esc(p.aConfirmer?(p.qteProposee||1):1)}" required></label>
    <label class="f"><span>Fournisseur</span><input type="text" id="inFour" list="fourList2" maxlength="40" value="${esc(r0.fournisseur||p.fournisseur||"")}"></label>
    <label class="f"><span>Référence chez ce fournisseur</span><input type="text" id="inRef" maxlength="40" value="${esc(r0.ref||p.refFournisseur||"")}"></label>
    <label class="f"><span>Prix unitaire (€ HT), obligatoire</span><input type="number" id="inPrix" min="0" step="0.01" required value="${esc(r0.prixHT??p.prixHT??"")}"></label>
    <label class="f"><span>Date</span><input type="date" id="inDate" value="${today()}"></label>
    <label class="f"><span>Facture ou bon de livraison</span><input type="text" id="inFact" maxlength="80" value="${esc(r0.facture||p.facture||"")}"></label>
    <label class="f"><span>Emplacement</span><input type="text" id="inLoc" maxlength="40" value="${esc(p.emplacement||"")}"></label></div>
    <datalist id="fourList2">${[...new Set(refs.map(r=>r.fournisseur).filter(Boolean).concat(["Kove","TRC Racing","Parts Europe","Thorn","Würth France","Solosan","AD Blanchardet"]))].map(f=>`<option>${esc(f)}</option>`).join("")}</datalist>
    <div class="row"><button class="btn primary" type="submit">${p.aConfirmer?"Confirmer l'entrée":"Ajouter au stock"}</button><button class="btn ghost" type="button" id="inCancel">Annuler</button></div></form>`;
  $("#inCancel").onclick=()=>{$("#partFormBox").hidden=true;$("#partFormBox").innerHTML=""};
  $("#inForm").onsubmit=async e=>{e.preventDefault();if(!writable()||!isGuide())return;
    const q=Math.max(1,Math.round(+$("#inQte").value||1)),prix=$("#inPrix").value===""?null:Math.round(+$("#inPrix").value*100)/100;
    if(prix==null){toast("Le prix d'achat est obligatoire : sans prix, l'entrée reste à confirmer.");return}
    try{await W.move(null,{pieceId:pid,designation:p.designation,delta:q,motif:"entrée",fournisseur:$("#inFour").value.trim(),ref:$("#inRef").value.trim(),facture:$("#inFact").value.trim(),date:$("#inDate").value||today(),prixHT:prix,emplacement:$("#inLoc").value.trim(),createdAt:new Date().toISOString()});
      toast("Stock mis à jour : "+p.designation);S.sel.add(pid);$("#partFormBox").hidden=true;$("#partFormBox").innerHTML="";renderStock()}catch(err){dbErr(err)}};
  $("#partFormBox").scrollIntoView({behavior:"smooth",block:"start"});
}
/* ---------- étiquettes (DK-22211 : 29 mm, zone imprimable 306 points à 300 dpi ; étiquette de 40 mm) ---------- */
const DK={dpi:300,widthPx:306,lenMm:40,hint:"Chaque étiquette : 29 × 40 mm."};
function labelCanvas(kind,obj){
  const H=DK.widthPx,W2=Math.round(DK.lenMm*DK.dpi/25.4);
  const c=document.createElement("canvas");c.width=W2;c.height=H;const g=c.getContext("2d");
  g.fillStyle="#FFFFFF";g.fillRect(0,0,W2,H);
  // QR de 21 mm environ (comme le PDF), zone silencieuse comprise ; texte à droite sur 16 mm
  const m=qrMatrix(qrPayload((kind==="v"?"v-":"p-")+obj.id)),n=m.length,quiet=2,mod=Math.floor((H*0.8)/(n+2*quiet)),qs=mod*(n+2*quiet),offX=10,offY=Math.floor((H-qs)/2);
  g.fillStyle="#000000";for(let r=0;r<n;r++)for(let col=0;col<n;col++)if(m[r][col])g.fillRect(offX+(col+quiet)*mod,offY+(r+quiet)*mod,mod,mod);
  const x=offX+qs+8,maxW=W2-x-8;g.textBaseline="middle";g.fillStyle="#000000";
  let size=Math.round(H*0.26);g.font=`700 ${size}px "Barlow Condensed", Arial Narrow, Arial, sans-serif`;
  const code=kind==="v"?"VEH-"+obj.id:obj.id;while(g.measureText(code).width>maxW&&size>20){size-=2;g.font=`700 ${size}px "Barlow Condensed", Arial Narrow, Arial, sans-serif`}
  const lines=kind==="v"?[obj.immat||""]:shortLines(obj,maxW,g);
  const lh=Math.round(H*0.17);const total=size+lines.length*lh+6;let y=Math.round(H/2-total/2+size/2);
  g.fillText(code,x,y);y+=size/2+6+lh/2;
  g.font=`500 ${Math.round(H*0.135)}px Barlow, Arial, sans-serif`;
  lines.forEach(l=>{g.fillText(l,x,y);y+=lh});
  return c;
}
/* Désignation courte de l'étiquette : champ dédié, sinon le début de la désignation, coupé en 3 lignes au plus (jamais de prix). */
function shortText(p){return (p.designationCourte||p.designation||"").trim()}
function shortLines(p,maxW,g){const words=shortText(p).split(/\s+/).filter(Boolean);const lines=[];let cur="";g.font=`500 ${Math.round(DK.widthPx*0.135)}px Barlow, Arial, sans-serif`;
  for(const w of words){const t=cur?cur+" "+w:w;if(g.measureText(t).width<=maxW)cur=t;else{if(cur)lines.push(cur);cur=w;if(lines.length===3)break}}
  if(lines.length<3&&cur)lines.push(cur);while(lines.length&&g.measureText(lines[lines.length-1]).width>maxW)lines[lines.length-1]=lines[lines.length-1].slice(0,-1);return lines.slice(0,3)}
function vehSvg(v){const m=qrMatrix(qrPayload("v-"+v.id)),n=m.length,qmm=27,mod=qmm/n,x0=11.5,y0=4.5;let p="";for(let r=0;r<n;r++)for(let c=0;c<n;c++)if(m[r][c])p+=`M${(x0+c*mod).toFixed(3)} ${(y0+r*mod).toFixed(3)}h${mod.toFixed(3)}v${mod.toFixed(3)}h-${mod.toFixed(3)}z`;
  const t=s=>esc(s);return `<?xml version="1.0" encoding="UTF-8"?>\n<svg xmlns="http://www.w3.org/2000/svg" width="50mm" height="50mm" viewBox="0 0 50 50"><rect width="50" height="50" rx="3" fill="#FFFFFF"/><path d="${p}" fill="#000000"/><text x="25" y="39.6" font-family="Barlow Condensed, Arial Narrow, Arial, sans-serif" font-weight="700" font-size="5.2" text-anchor="middle" fill="#000000">${t("VEH-"+v.id)}</text><text x="25" y="45.8" font-family="Barlow Condensed, Arial Narrow, Arial, sans-serif" font-weight="600" font-size="4.2" text-anchor="middle" letter-spacing="0.3" fill="#000000">${t(v.immat||"")}</text></svg>`}
function renderLabels(){
  $("#tapeHint").textContent=DK.hint;
  if(document.fonts&&!renderLabels._fonts){renderLabels._fonts=true;Promise.all([document.fonts.load('700 20px "Barlow Condensed"'),document.fonts.load('500 20px Barlow')]).then(renderLabels,()=>{})}
  const box=$("#labelPreview");box.innerHTML="";
  const ids=[...S.sel].filter(id=>S.parts[id]);
  if(!ids.length){box.innerHTML=`<span class="small muted">Aucune pièce cochée.</span>`;return}
  ids.slice(0,8).forEach(id=>box.appendChild(labelCanvas("p",S.parts[id])));
  if(ids.length>8){const s=document.createElement("span");s.className="small muted";s.textContent=`+ ${ids.length-8} autre(s) dans le téléchargement`;box.appendChild(s)}
}
function sheetCanvas(items){const cs=items.map(([k,o])=>labelCanvas(k,o));const gap=20,Wd=cs[0].width,H=cs.reduce((s,c)=>s+c.height+gap,gap);const sh=document.createElement("canvas");sh.width=Wd+2*gap;sh.height=H;const g=sh.getContext("2d");g.fillStyle="#FFFFFF";g.fillRect(0,0,sh.width,H);let y=gap;cs.forEach(c=>{g.drawImage(c,gap,y);g.strokeStyle="#BBBBBB";g.setLineDash([6,6]);g.strokeRect(gap-0.5,y-0.5,c.width+1,c.height+1);y+=c.height+gap});return sh}
async function canvasBlob(c){return await new Promise(r=>c.toBlob(r,"image/png"))}
const csvCell=v=>{const s=v==null?"":String(v);return /[;"\n]/.test(s)?'"'+s.replace(/"/g,'""')+'"':s};
const csv=(rows)=>"﻿"+rows.map(r=>r.map(csvCell).join(";")).join("\r\n");
const dec=v=>(Math.round((+v||0)*100)/100).toFixed(2).replace(".",",");

/* ---------- locations ---------- */
function renderLocs(){
  const ls=[...S.locs].sort((a,b)=>String(b.du).localeCompare(a.du));
  $("#locList").innerHTML=ls.length?locTable(ls):waitingEmpty("Aucune location enregistrée");
  $("#newLocBtn").disabled=!writable();
}
function locForm(){
  $("#locFormBox").hidden=false;
  $("#locFormBox").innerHTML=`<form class="form" id="lf"><h3>Nouvelle location</h3><div class="fgrid">
   <label class="f"><span>Moto</span><select id="lfVeh" required><option value="">Choisir…</option>${vehList().filter(v=>v.type==="moto").map(v=>`<option value="${esc(v.id)}">${esc(v.nom||v.id)} · ${esc(v.immat||"")}</option>`).join("")}</select></label>
   <label class="f"><span>Pilote (prénom + initiale)</span><input type="text" id="lfPil" maxlength="30" required pattern="^\\S.* [A-Z]\\.$" title="Prénom puis initiale du nom suivie d'un point, ex. Paul M." placeholder="ex. Paul M."></label>
   <label class="f"><span>Raid</span><input type="text" id="lfRaid" maxlength="60" required placeholder="ex. Aragon, octobre 2026"></label>
   <label class="f"><span>Du</span><input type="date" id="lfDu" required></label>
   <label class="f"><span>Au</span><input type="date" id="lfAu" required></label>
   <label class="f"><span>Km au départ</span><input type="number" id="lfKd" min="0" step="1"></label>
   <label class="f"><span>Km au retour</span><input type="number" id="lfKr" min="0" step="1"></label>
   <label class="f"><span>Caution</span><input type="text" id="lfCau" maxlength="40" placeholder="ex. reçue, rendue le…"></label></div>
   <div class="fgrid"><label class="f"><span>État au départ</span><textarea id="lfEd" maxlength="300"></textarea></label><label class="f"><span>État au retour</span><textarea id="lfEr" maxlength="300"></textarea></label><label class="f"><span>Incidents</span><textarea id="lfInc" maxlength="400"></textarea></label></div>
   <div class="row"><button class="btn primary" type="submit">Enregistrer la location</button><button class="btn ghost" type="button" id="lfCancel">Annuler</button></div></form>`;
  $("#lfCancel").onclick=()=>{$("#locFormBox").hidden=true;$("#locFormBox").innerHTML=""};
  $("#lf").onsubmit=async e=>{e.preventDefault();if(!writable()||!isGuide())return;
    const n=v=>v===""?null:Math.round(+v);
    const body={vehiculeId:$("#lfVeh").value,pilote:$("#lfPil").value.trim(),raid:$("#lfRaid").value.trim(),du:$("#lfDu").value,au:$("#lfAu").value,kmDepart:n($("#lfKd").value),kmRetour:n($("#lfKr").value),caution:$("#lfCau").value.trim(),etatDepart:$("#lfEd").value.trim(),etatRetour:$("#lfEr").value.trim(),incidents:$("#lfInc").value.trim(),createdAt:new Date().toISOString()};
    if(body.au<body.du){toast("La date de retour est avant la date de départ.");return}
    try{await W.upsert("locations",W.newId(),body,{create:true});toast("Location enregistrée");$("#locFormBox").hidden=true;$("#locFormBox").innerHTML="";renderLocs()}catch(err){dbErr(err)}};
}

/* ---------- export ---------- */
function exRange(){const f=$("#exFrom").value||"0000-01-01",t=$("#exTo").value||"9999-12-31",v=$("#exVeh").value;return {f,t,v}}
function consoRows(){const {f,t,v}=exRange();const rows=[];S.inter.filter(i=>i.date>=f&&i.date<=t&&(!v||i.vehiculeId===v)).forEach(i=>(i.pieces||[]).forEach(p=>rows.push({date:i.date,veh:i.vehicule||i.vehiculeId,vid:i.vehiculeId,immat:(S.veh[i.vehiculeId]||{}).immat||"",id:p.id,des:p.designation,ref:p.ref||"",qte:+p.qte||0,pu:+p.prixHT||0})));return rows.sort((a,b)=>String(a.veh).localeCompare(b.veh)||a.date.localeCompare(b.date))}
function renderExport(){
  const vs=vehList();const cur=$("#exVeh").value;$("#exVeh").innerHTML=`<option value="">Tous les véhicules</option>`+vs.map(v=>`<option value="${esc(v.id)}" ${cur===v.id?"selected":""}>${esc(v.nom||v.id)}</option>`).join("");
  if(!$("#exFrom").value){const d=new Date();$("#exFrom").value=d.getFullYear()+"-01-01";$("#exTo").value=today()}
  const rows=consoRows();const by={};rows.forEach(r=>{by[r.vid]=by[r.vid]||{veh:r.veh,immat:r.immat,qte:0,tot:0};by[r.vid].qte+=r.qte;by[r.vid].tot+=r.qte*r.pu});
  const tot=rows.reduce((s,r)=>s+r.qte*r.pu,0);
  $("#exTable").innerHTML=rows.length?`<div class="tablebox"><table><thead><tr><th>Véhicule</th><th>Immatriculation</th><th class="n">Pièces</th><th class="n">Montant HT</th></tr></thead><tbody>${Object.values(by).map(b=>`<tr><td>${esc(b.veh)}</td><td>${esc(b.immat)}</td><td class="n">${nf0.format(b.qte)}</td><td class="n">${eur(b.tot)}</td></tr>`).join("")}<tr><td colspan="3"><b>Total de la période</b></td><td class="n"><b>${eur(tot)}</b></td></tr></tbody></table></div>`:`<div class="empty">Aucune pièce consommée sur cette période.</div>`;
}
function bindExport(){
  ["exFrom","exTo","exVeh"].forEach(id=>$("#"+id).addEventListener("change",renderExport));
  $("#dlConso").onclick=()=>{const {f,t}=exRange();const rows=consoRows();offer(`pieces_par_vehicule_${f}_${t}.csv`.replace(/0000-01-01|9999-12-31/g,"tout"),csv([["Date","Véhicule","Immatriculation","Code pièce","Désignation","Réf. fournisseur","Quantité","Prix unitaire HT","Montant HT"],...rows.map(r=>[fdate(r.date),r.veh,r.immat,r.id,r.des,r.ref,r.qte,dec(r.pu),dec(r.qte*r.pu)])]))};
  $("#dlStock").onclick=()=>{const ps=partList().filter(p=>!p.aConfirmer);offer(`valeur_stock_${today()}.csv`,csv([["Code","Désignation","Fournisseur","Réf. fournisseur","Réf. constructeur","Facture","Quantité","Unité","Seuil","Coût moyen pondéré HT","Valeur HT","Prix public HT","Marge HT","Marge % (sur achat)","Emplacement","Vendable en boutique","Prix de vente TTC"],...ps.map(p=>{const m=margeOf(p),pv=priceOf(p);return [p.id,p.designation,p.fournisseur||"",p.refFournisseur||"",p.refConstructeur||"",p.facture||"",+p.qte||0,p.unite||"",+p.seuil||0,dec(pmp(p)),dec(Math.max(0,+p.qte||0)*pmp(p)),pv!=null?dec(pv):"",m?dec(m.eur):"",m?String(m.pct).replace(".",","):"",p.emplacement||"",p.boutique&&p.boutique.vendable?"oui":"non",p.boutique&&p.boutique.prixVente!=null?dec(p.boutique.prixVente):""]})]))};
  $("#dlInter").onclick=()=>{const {f,t,v}=exRange();const is=S.inter.filter(i=>i.date>=f&&i.date<=t&&(!v||i.vehiculeId===v)).sort((a,b)=>a.date.localeCompare(b.date));offer(`interventions_${today()}.csv`,csv([["Date","Véhicule","Km","Travaux","Pièces","Coût pièces HT","Main d'œuvre HT","Imputation","Fait par","Remarque"],...is.map(i=>[fdate(i.date),i.vehicule||i.vehiculeId,i.km??"",(i.operations||[]).map(o=>(OPS_BY_ID[o]||{label:o}).label).join(", "),(i.pieces||[]).map(p=>p.qte+" x "+p.designation).join(" | "),dec(i.coutPieces),dec(i.coutMO),IMPUT[i.imputation||defImput(S.veh[i.vehiculeId])],(i.par||"")+(i.qui?" ("+i.qui+")":""),i.remarque||""])]))};
}

/* ---------- frais kilométriques ---------- */
function fourgon(){return vehList().find(v=>v.type==="fourgon")}
function tripsYear(y){return S.trajets.filter(t=>String(t.date).slice(0,4)===String(y)).sort((a,b)=>String(a.date).localeCompare(b.date)||String(a.createdAt).localeCompare(b.createdAt))}
function monthIK(month){const v=fourgon();const cv=v&&v.cv;const y=month.slice(0,4);const all=tripsYear(y);const before=all.filter(t=>t.date.slice(0,7)<month).reduce((s,t)=>s+(+t.km||0),0);const list=all.filter(t=>t.date.slice(0,7)===month);const kmM=list.reduce((s,t)=>s+(+t.km||0),0);const amt=cv?Math.round((ik(cv,before+kmM)-ik(cv,before))*100)/100:null;return {cv,list,kmM,before,cumul:before+kmM,amt}}
function renderTrips(){
  if(!$("#tripMonth").value)$("#tripMonth").value=today().slice(0,7);
  const v=fourgon();
  $("#tripCv").innerHTML=!v?`<div class="note warn small">Aucun fourgon dans la flotte.</div>`:v.cv?"":`<div class="note warn small">Puissance fiscale du fourgon à saisir (case P.6 de la carte grise, dans sa fiche) : les indemnités ne sont pas calculées tant qu'elle manque.</div>`;
  const m=monthIK($("#tripMonth").value);
  $("#tripStats").innerHTML=`<div class="stat"><span class="v num">${nf0.format(m.kmM)}</span><span class="l">km professionnels ce mois</span></div><div class="stat"><span class="v num">${nf0.format(m.cumul)}</span><span class="l">km cumulés depuis le 1er janvier</span></div><div class="stat"><span class="v num">${m.amt==null?"—":eur(m.amt)}</span><span class="l">indemnités du mois${m.cv?" ("+m.cv+" CV)":""}</span></div>`;
  $("#tripList").innerHTML=m.list.length?`<div class="tablebox"><table><thead><tr><th>Date</th><th>Objet</th><th>Départ</th><th>Arrivée</th><th class="n">Km</th></tr></thead><tbody>${m.list.map(t=>`<tr><td>${fdate(t.date)}${localPill(t)}</td><td>${esc(t.objet||"")}${t.detail?`<div class="small muted">${esc(t.detail)}</div>`:""}</td><td>${esc(t.depart||"")}</td><td>${esc(t.arrivee||"")}</td><td class="n">${nf0.format(+t.km||0)}</td></tr>`).join("")}</tbody></table></div>`:`<div class="empty">Aucun trajet ce mois-ci.</div>`;
  $("#newTripBtn").disabled=!writable();
}
function tripForm(){
  $("#tripFormBox").hidden=false;
  $("#tripFormBox").innerHTML=`<form class="form" id="tf"><h3>Nouveau trajet professionnel</h3><div class="fgrid">
    <label class="f"><span>Date</span><input type="date" id="tfDate" value="${today()}" required></label>
    <label class="f"><span>Objet</span><select id="tfObj"><option>Raid</option><option>Convoyage des motos</option><option>Achat de pièces</option><option>Rendez-vous fournisseur</option><option>Autre</option></select></label>
    <label class="f"><span>Précision</span><input type="text" id="tfDet" maxlength="80" placeholder="ex. Aragon, retrait des Kove"></label>
    <label class="f"><span>Départ</span><input type="text" id="tfDep" maxlength="60" required placeholder="ex. Orthez"></label>
    <label class="f"><span>Arrivée</span><input type="text" id="tfArr" maxlength="60" required placeholder="ex. Toulouse"></label>
    <label class="f"><span>Kilomètres</span><input type="number" id="tfKm" min="1" step="1" required></label></div>
    <div class="row"><button class="btn primary" type="submit">Enregistrer le trajet</button><button class="btn ghost" type="button" id="tfCancel">Annuler</button></div></form>`;
  $("#tfCancel").onclick=()=>{$("#tripFormBox").hidden=true;$("#tripFormBox").innerHTML=""};
  $("#tf").onsubmit=async e=>{e.preventDefault();if(!writable()||!isGuide())return;const v=fourgon();
    const body={date:$("#tfDate").value,objet:$("#tfObj").value,detail:$("#tfDet").value.trim(),depart:$("#tfDep").value.trim(),arrivee:$("#tfArr").value.trim(),km:Math.round(+$("#tfKm").value||0),vehiculeId:v?v.id:"",createdAt:new Date().toISOString()};
    try{await W.upsert("trajets",W.newId(),body,{create:true});$("#tripMonth").value=body.date.slice(0,7);toast("Trajet enregistré");$("#tripFormBox").hidden=true;$("#tripFormBox").innerHTML="";renderTrips()}catch(err){dbErr(err)}};
}
function tripsCsv(){const month=$("#tripMonth").value||today().slice(0,7);const m=monthIK(month);
  return {name:`frais_km_fourgon_${month}.csv`,data:csv([["Mois",month],["Véhicule","Fourgon, véhicule personnel du guide (mis à disposition)"],["Puissance fiscale",m.cv?m.cv+" CV":"à saisir"],[],["Date","Objet","Précision","Départ","Arrivée","Km"],...m.list.map(t=>[fdate(t.date),t.objet,t.detail||"",t.depart,t.arrivee,+t.km||0]),[],["Km du mois",m.kmM],["Km cumulés au 1er du mois",m.before],["Km cumulés en fin de mois",m.cumul],["Indemnités kilométriques du mois (€)",m.amt==null?"puissance fiscale à saisir":dec(m.amt)],["Barème","Barème kilométrique fiscal des automobiles (impots.gouv.fr), taux des revenus 2022 gelés depuis, cumul annuel ; à reprendre quand le barème des revenus 2026 paraîtra"],["Condition","Valable si la carte grise est au nom du guide ou de son conjoint, et si la société ne paie ni carburant, ni entretien, ni assurance du fourgon (à confirmer par l'expert-comptable)"]])}}

/* ---------- rapport annuel ---------- */
function annual(y){
  const f=y+"-01-01",t=y+"-12-31";
  const moves=S.moves.filter(m=>m.date>=f&&m.date<=t);
  const buys={};moves.filter(m=>m.motif==="entrée"&&m.delta>0).forEach(m=>{const k=m.fournisseur||"Non renseigné";buys[k]=buys[k]||{four:k,lignes:0,qte:0,ht:0};buys[k].lignes++;buys[k].qte+=+m.delta||0;buys[k].ht+=(+m.delta||0)*(+m.prixHT||0)});
  const conso={};S.inter.filter(i=>i.date>=f&&i.date<=t).forEach(i=>{const v=S.veh[i.vehiculeId]||{};const k=i.vehiculeId;conso[k]=conso[k]||{veh:i.vehicule||k,immat:v.immat||"",statut:(STATUTS[v.statut]||[""])[0],qte:0,pieces:0,mo:0,soc:0,prop:0,refa:0};const c=conso[k];const pc=(i.pieces||[]).reduce((s,p)=>s+(+p.qte||0)*(+p.prixHT||0),0);c.qte+=(i.pieces||[]).reduce((s,p)=>s+(+p.qte||0),0);c.pieces+=pc;c.mo+=+i.coutMO||0;const imp=i.imputation||defImput(v);const tot=pc+(+i.coutMO||0);if(imp==="proprietaire")c.prop+=tot;else if(imp==="refacturable")c.refa+=tot;else c.soc+=tot});
  const st={};S.moves.filter(m=>m.date<=t).sort((a,b)=>String(a.date).localeCompare(b.date)||String(a.createdAt).localeCompare(b.createdAt)).forEach(m=>{const s=st[m.pieceId]=st[m.pieceId]||{q:0,c:0};const d=+m.delta||0;if(m.motif==="ajustement de coût"){s.c=+m.nouveauCout||s.c}else if(d>0&&m.motif==="entrée"){const pu=+m.prixHT||0;s.c=(s.q>0?(s.q*s.c+d*pu)/(s.q+d):pu);s.q+=d}else{s.q+=d;if(d>0&&!s.c)s.c=+m.prixHT||0}});
  const stock=Object.entries(st).map(([id,s])=>{const p=S.parts[id]||{};return {id,des:p.designation||id,q:s.q,c:s.c,val:Math.max(0,s.q)*s.c}}).filter(x=>x.q!==0).sort((a,b)=>a.id.localeCompare(b.id));
  return {buys:Object.values(buys).sort((a,b)=>b.ht-a.ht),conso:Object.values(conso),stock};
}
function renderAnnual(){if(!$("#anYear").value)$("#anYear").value=new Date().getFullYear();const y=$("#anYear").value;const a=annual(y);
  const tb=a.buys.reduce((s,b)=>s+b.ht,0),ts=a.stock.reduce((s,x)=>s+x.val,0);
  $("#anTable").innerHTML=`<div class="strip"><div class="stat"><span class="v num">${eur(tb)}</span><span class="l">achats de pièces HT en ${esc(y)}</span></div><div class="stat"><span class="v num">${eur(a.conso.reduce((s,c)=>s+c.pieces,0))}</span><span class="l">pièces consommées HT</span></div><div class="stat"><span class="v num">${eur(ts)}</span><span class="l">valeur du stock au 31/12 (coût moyen pondéré)</span></div></div>
  ${a.buys.length?`<div class="tablebox"><table><thead><tr><th>Fournisseur</th><th class="n">Entrées</th><th class="n">Quantité</th><th class="n">Montant HT</th></tr></thead><tbody>${a.buys.map(b=>`<tr><td>${esc(b.four)}</td><td class="n">${b.lignes}</td><td class="n">${nf0.format(b.qte)}</td><td class="n">${eur(b.ht)}</td></tr>`).join("")}</tbody></table></div>`:`<div class="empty">Aucune entrée de stock enregistrée en ${esc(y)}.</div>`}`}
function annualCsv(){const y=$("#anYear").value||new Date().getFullYear();const a=annual(y);const rows=[["SOULTRACKS EXPEDITION","Rapport annuel atelier "+y],[],["1. Achats de pièces par fournisseur"],["Fournisseur","Nombre d'entrées","Quantité","Montant HT"],...a.buys.map(b=>[b.four,b.lignes,b.qte,dec(b.ht)]),[],["2. Pièces consommées par véhicule"],["Véhicule","Immatriculation","Propriétaire / statut","Pièces","Coût pièces HT","Main d'œuvre HT","Charge société","Charge du propriétaire","Refacturable"],...a.conso.map(c=>[c.veh,c.immat,c.statut,c.qte,dec(c.pieces),dec(c.mo),dec(c.soc),dec(c.prop),dec(c.refa)]),[],["3. Stock au 31/12/"+y+" (coût moyen pondéré)"],["Code","Désignation","Quantité","Coût moyen HT","Valeur HT"],...a.stock.map(x=>[x.id,x.des,x.q,dec(x.c),dec(x.val)]),["Total","","","",dec(a.stock.reduce((s,x)=>s+x.val,0))]];return {name:`rapport_annuel_atelier_${y}.csv`,data:csv(rows)}}

/* ---------- sauvegarde et restauration ---------- */
function buildBackup(){const out={format:"soultracks-carnet",version:2,date:new Date().toISOString(),collections:{}};
  for(const c of COLLS){out.collections[c]={};Object.entries(S.D[c]||{}).forEach(([id,d])=>{const o=Object.assign({},d);delete o._local;out.collections[c][id]=o})}
  return out}
function bkName(){return "SOULTRACKS_CARNET_SAUVEGARDE_"+new Date().toISOString().slice(0,16).replace(/[-:T]/g,"").replace(/^(\d{8})(\d{4})$/,"$1_$2")+".json"}
let bkPending=null;
async function readRestore(file){try{const j=JSON.parse(await file.text());if(j.format!=="soultracks-carnet"||!j.collections)throw 0;bkPending=j;
  const counts=COLLS.map(c=>`${c} : ${Object.keys(j.collections[c]||{}).length}`).join(" · ");
  $("#bkRestore").innerHTML=`<div class="note warn small">Fichier du ${esc(fdate(j.date))} : ${esc(counts)}. La restauration réécrit chaque fiche du fichier dans la base (les fiches absentes du fichier ne sont pas supprimées).</div><div class="row"><button class="btn primary" type="button" id="bkGo">Confirmer la restauration</button><button class="btn ghost" type="button" id="bkCancel">Annuler</button></div>`;
  $("#bkCancel").onclick=()=>{bkPending=null;$("#bkRestore").innerHTML=""};
  $("#bkGo").onclick=restore}catch(e){$("#bkRestore").innerHTML=`<div class="note bad small">Ce fichier n'est pas une sauvegarde du carnet Soultracks.</div>`}}
async function restore(){if(!bkPending||!writable()||!isGuide())return;const j=bkPending;let n=0;$("#bkGo").disabled=true;
  try{for(const c of ["parametres"].concat(COLLS.filter(c=>c!=="parametres"))){for(const [id,doc] of Object.entries(j.collections[c]||{})){await W.upsert(c,id,doc,{allowQte:true});n++;if(n%10===0)$("#bkStatus").textContent=`Restauration : ${n} fiches…`}}
    $("#bkStatus").textContent=`Restauration : ${n} fiches rangées dans la file d'envoi.`;toast("Restauration en cours d'envoi");bkPending=null;$("#bkRestore").innerHTML=""}catch(err){dbErr(err);$("#bkStatus").textContent=`Restauration interrompue après ${n} fiches.`}}

/* ---------- QR flashé ---------- */
let scanTarget=null;
function handleToken(tok){
  const t=parseToken(tok);if(!t){toast("Ce QR code n'appartient pas au carnet Soultracks.");return}
  const id=t.slice(2);
  if(t[0]==="v"){if(!S.veh[id]){toast("Véhicule inconnu : "+id);return}
    if(S.view==="intervention"||scanTarget==="veh"){const d=S.view==="intervention"?readForm():draft();d.veh=id;saveDraft(d);go("intervention");toast("Véhicule : "+(S.veh[id].nom||id))}
    else{S.fiche=id;go("fiche")}}
  else{if(!S.parts[id]){toast("Pièce inconnue : "+id);return}
    const d=draft();
    if(S.view==="intervention"||scanTarget==="part"||d.veh||!isGuide()){addPartToDraft(id);if(!d.veh)toast("Pièce ajoutée : flashe maintenant la moto (bouton « Flasher la moto »).")}
    else{go("stock");$("#stockSearch").value=id;renderStock();const r=document.getElementById("row-"+id);if(r)r.scrollIntoView({block:"center"})}}
  scanTarget=null;
}

function renderStatic(){
  $("#refIntervals").innerHTML=`<thead><tr><th>Élément</th><th>Intervalle</th></tr></thead><tbody>${INTERVALS.map(r=>`<tr><td>${esc(r[0])}</td><td>${esc(r[1])}</td></tr>`).join("")}</tbody>`;
  $("#refMemo").innerHTML=`<thead><tr><th>Paramètre</th><th>Valeur</th></tr></thead><tbody>${MEMO.map(r=>`<tr><td>${esc(r[0])}</td><td class="num">${esc(r[1])}</td></tr>`).join("")}</tbody>`;
  $("#refTorque").innerHTML=`<thead><tr><th class="n">N°</th><th>Point de serrage</th><th class="n">N·m</th><th>Loctite</th><th>Lubrifier</th><th>Marquer</th></tr></thead><tbody>${TORQUE.map(r=>`<tr><td class="n">${r[0]}</td><td>${esc(r[1])}</td><td class="n">${r[2]===""?"—":r[2]}</td><td>${r[3]?"oui":""}</td><td>${r[4]?"oui":""}</td><td>${r[5]?"oui":""}</td></tr>`).join("")}</tbody><tfoot><tr><td colspan="6" class="small muted">Couples standard : ${STD.map(s=>`${s[0]} (pas ${s[1]}) ${s[2]} N·m`).join(" · ")}</td></tr></tfoot>`;
}

function bindCarnet(){
  document.addEventListener("click",e=>{
    const el=e.target.closest("[data-fiche],[data-go],[data-new-iv],[data-confirm],[data-entree],[data-edit],[data-sortie],[data-label-veh],[data-rm],[data-q],[data-op]");if(!el)return;
    if(el.dataset.fiche){S.fiche=el.dataset.fiche;go("fiche")}
    else if(el.dataset.go)go(el.dataset.go);
    else if(el.dataset.newIv){const d=draft();d.veh=el.dataset.newIv;saveDraft(d);go("intervention")}
    else if(el.dataset.confirm)entreeForm(el.dataset.confirm);
    else if(el.dataset.entree)entreeForm(el.dataset.entree);
    else if(el.dataset.edit)partForm(S.parts[el.dataset.edit]);
    else if(el.dataset.sortie){addPartToDraft(el.dataset.sortie);if(!draft().veh)toast("Pièce ajoutée : choisis ou flashe maintenant la moto.")}
    else if(el.dataset.labelVeh){const v=S.veh[el.dataset.labelVeh];offer(`autocollant_VEH-${v.id}_50x50mm.svg`,vehSvg(v),"image/svg+xml")}
    else if(el.dataset.rm!=null){const d=readForm();d.parts.splice(+el.dataset.rm,1);saveDraft(d);renderInterForm()}
    else if(el.dataset.q){const d=readForm();const p=d.parts[+el.dataset.i];p.qte=Math.max(1,(+p.qte||1)+(+el.dataset.q));saveDraft(d);renderInterForm()}
    else if(el.dataset.op){const d=readForm();const i=d.ops.indexOf(el.dataset.op);if(i>=0)d.ops.splice(i,1);else d.ops.push(el.dataset.op);saveDraft(d);renderInterForm()}
  });
  document.addEventListener("change",e=>{
    if(e.target.dataset.qi!=null){const d=readForm();d.parts[+e.target.dataset.qi].qte=Math.max(1,Math.round(+e.target.value||1));saveDraft(d);renderInterForm()}
    if(e.target.dataset.sel){const id=e.target.dataset.sel;if(e.target.checked)S.sel.add(id);else S.sel.delete(id);renderLabels()}
    if(e.target.dataset.inv!=null){invCount[e.target.dataset.inv]=e.target.value;const a=e.target;renderStock();const n=document.querySelector(`[data-inv="${a.dataset.inv}"]`);if(n)n.focus()}
  });
  ["ivVeh","ivDate","ivKm","ivImp","ivBy","ivWho","ivMO","ivNote"].forEach(id=>$("#"+id).addEventListener("input",()=>{saveDraft(readForm());if(id==="ivVeh"||id==="ivMO")renderInterForm()}));
  $("#ivAddPart").addEventListener("change",e=>{if(e.target.value)addPartToDraft(e.target.value)});
  $("#ivForm").addEventListener("submit",saveIntervention);
  $("#ivReset").onclick=()=>{store("draft",null);renderInterForm();toast("Brouillon effacé")};
  $("#ivScanVeh").onclick=()=>{scanTarget="veh";App.scan()};
  $("#ivScanPart").onclick=()=>{scanTarget="part";App.scan()};
  $("#modeAtelier").addEventListener("change",e=>App.setAtelier(e.target.checked));
  $("#newPartBtn").onclick=()=>{if(writable()&&isGuide())partForm(null)};
  $("#stockSearch").addEventListener("input",renderStock);$("#stockFilter").addEventListener("change",renderStock);
  $("#selAllParts").onclick=()=>{partList().forEach(p=>S.sel.add(p.id));renderStock()};
  $("#dlLabelsPng").onclick=async()=>{const ids=[...S.sel].filter(id=>S.parts[id]);if(!ids.length){toast("Coche d'abord des pièces.");return}const b=await canvasBlob(sheetCanvas(ids.map(id=>["p",S.parts[id]])));offer(`etiquettes_pieces_DK-22211_${today()}.png`,b,"image/png")};
  $("#dlLabelsCsv").onclick=()=>{const ids=[...S.sel].filter(id=>S.parts[id]);if(!ids.length){toast("Coche d'abord des pièces.");return}offer(`etiquettes_ptouch_${today()}.csv`,"﻿"+[["Code","Designation_courte","Designation","QR"],...ids.map(id=>{const p=S.parts[id];return [p.id,shortText(p),p.designation,qrPayload("p-"+p.id)]})].map(r=>r.map(v=>'"'+String(v).replace(/"/g,'""')+'"').join(",")).join("\r\n"))};
  $("#newLocBtn").onclick=()=>{if(writable()&&isGuide())locForm()};
  $("#newTripBtn").onclick=()=>{if(writable()&&isGuide())tripForm()};
  $("#tripMonth").addEventListener("change",renderTrips);
  $("#dlTrips").onclick=()=>{const x=tripsCsv();offer(x.name,x.data)};
  $("#anYear").addEventListener("change",renderAnnual);
  $("#bkDl").onclick=()=>offer(bkName(),JSON.stringify(buildBackup(),null,1),"application/json");
  $("#bkRestoreBtn").onclick=()=>{if(!writable()||!isGuide()){toast("Réservé au guide");return}const f=$("#bkFile");f.value="";f.click()};
  $("#bkFile").addEventListener("change",e=>{const f=e.target.files&&e.target.files[0];if(f)readRestore(f)});
  $("#dlAnnual").onclick=()=>{const x=annualCsv();offer(x.name,x.data)};
  bindExport();
}

(self.ATELIER_MODULES=self.ATELIER_MODULES||[]).push({
  id:"carnet",
  views:["flotte","fiche","intervention","stock","locations","trajets","export","reference"],
  init(){renderStatic();bindCarnet()},
  render(v){
    if(v==="flotte")renderFleet();
    if(v==="fiche")renderFiche();
    if(v==="intervention")renderInterForm();
    if(v==="stock")renderStock();
    if(v==="locations")renderLocs();
    if(v==="export"){renderExport();renderAnnual()}
    if(v==="trajets")renderTrips();
  },
  onToken(tok){if(parseToken(tok)){handleToken(tok);return true}return false},
  load(data,queueOps){S.D=toMaps(data);(queueOps||[]).forEach(op=>applyOp(S.D,op));publishData(S.D)}
});
