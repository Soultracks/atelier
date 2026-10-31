/* Réglage du déploiement : adresse de la passerelle Apps Script (« …/exec »), posée par Claude au déploiement.
   Vide = appli en démonstration hors ligne, rien n'est envoyé. */
self.CARNET_CONFIG = {
  gateway: "https://script.google.com/macros/s/AKfycbwxqtRlE1GSoZ9bHepmZHlKYOchVzqUG3XmVqd_Yj0W8KzZXFqvOCcT0LC5n7UbphlNCA/exec",
  // Modules de l'appli. « tableau » : tableau de bord du profil guide (true = actif).
  modules: {carnet: true, tableau: true}
};
