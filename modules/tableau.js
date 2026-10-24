/* Atelier Soultracks · module « Tableau de bord » (profil guide) · PRÉVU, PAS ENCORE CONSTRUIT.
   Cahier : claude/SOULTRACKS_OUTILS_INTERNES_CAHIER_2026-10-20.md, § 2 (après le carnet).
   Branchement : chaque rangée lira, par la passerelle (action « tableau.pull », guide seulement),
   sa Google Sheets du Drive soultracks.admin, remplie par les agents ; la rangée « Flotte et stock »
   lira directement la base du carnet. Rien d'autre à changer dans l'appli que ce fichier. */
"use strict";
const TB_RANGEES=[
  ["Trésorerie et comptes","Solde Qonto, entrées et sorties du mois, factures en attente, alertes","SOULTRACKS_TB_TRESORERIE"],
  ["Raids et remplissage","Prochains départs, places (4 minimum, 6 maximum), alertes à 45 et 30 jours","SOULTRACKS_TB_RAIDS"],
  ["Rentabilité","Marge prévue et réelle par raid, seuil 30 %","SOULTRACKS_TB_RENTABILITE"],
  ["Pilotes et prospects","Devis en cours, validités, relances (prénom + initiale)","SOULTRACKS_TB_PILOTES"],
  ["Flotte et stock","État des véhicules, prochains entretiens, pièces sous le seuil","base du carnet"],
  ["Communication","Publications, résultats Meta et YouTube, Search Console","SOULTRACKS_TB_COMMUNICATION"],
  ["Équipe d'agents","Tournée du matin, questions en attente de ton oui","SOULTRACKS_TB_EQUIPE"],
  ["Administratif","Échéances (TVA, assurances, Kbis), documents à signer","SOULTRACKS_TB_ADMINISTRATIF"]
];
(self.ATELIER_MODULES=self.ATELIER_MODULES||[]).push({
  id:"tableau",
  views:["tableau"],
  render(){
    $("#v-tableau").innerHTML=`<div class="head"><div><h2>Tableau de bord</h2><p>Toute l'entreprise sur un écran, réservé au guide. En préparation : il se construit rangée par rangée, juste après le carnet d'entretien.</p></div></div>
      <div class="grid">${TB_RANGEES.map(r=>`<div class="card"><div class="vtop"><div class="vcode">${esc(r[0])}</div><span class="pill">bientôt</span></div><div class="small muted">${esc(r[1])}</div><div class="small">Source : ${esc(r[2])}</div></div>`).join("")}</div>`;
  }
});
