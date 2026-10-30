# Cosy Farm — prototype V1

Jeu de gestion d'élevage 3D, cozy et local : la qualité des mécaniques passe avant l'esthétique.

## Tester

La version de travail se trouve sur la branche `feat/first-playable-prototype`. Une action GitHub Pages tente de publier cette branche ; si Pages n'est pas activé pour le dépôt, il faut l'autoriser dans **Settings → Pages → GitHub Actions**. Il faut une connexion Internet pour charger Babylon.js au premier lancement.

## Fonctionnement

- Caméra 3D en hauteur : déplacer au doigt, pincer pour zoomer ; toucher les poules et bâtiments.
- Départ avec **280 pièces**, un terrain vide, et la boutique pour construire un enclos, un poulailler, une mangeoire et un abreuvoir.
- Acheter des poules de réforme, des jeunes poules ou des poussins ; chacune a son prénom, un trait de caractère, des besoins, une fiche personnelle et des notes.
- Caresses à gain journalier limité, nourriture, eau, nettoyage, soins vétérinaires.
- Appuyer sur **Nuit** pour faire avancer le calendrier ; 15 énergies au maximum et une recharge toutes les 10 minutes.
- Œufs cachés dans les nids (ouvrir le poulailler) ou dans l'herbe. Récolte manuelle, possibilité de marquer un œuf pour la couvaison future.
- Le **dimanche**, mini-marché avec visiteurs, prix et négociations.
- Sauvegarde automatique dans le navigateur (une seule ferme, pas encore de synchronisation ni export).

## À savoir

La 3D est volontairement représentée par des formes primitives. C'est une **première tranche jouable**, non la V1 finale : la vraie reproduction, l'éclosion, les tours, les espèces supplémentaires, les décès naturels optionnels, la progression des bâtiments et les graphismes détaillés ne sont pas implémentés. L'utilisation du stockage local signifie que vider les données Safari peut effacer la sauvegarde.

## Développement

Aucune installation nécessaire pour ouvrir `index.html` depuis un serveur statique. Le jeu utilise Babylon.js via CDN. Pour vérifier la simulation avec Node 22+ :

```bash
npm test
```

`src/sim.js` contient la logique du jeu ; `src/main.js` la scène Babylon.js et l'interface ; `tests/` les tests.

La branche de travail n'est pas fusionnée à `main` sans validation.
