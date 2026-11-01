# 🐔 Cosy Farm

Jeu de gestion 3D « cozy » centré sur l'élevage de poules, conçu pour **iPhone / Safari**.
Version de test : une seule ferme, sauvegarde locale automatique, aucun serveur, aucun achat réel.

## Jouer
- **Test en ligne** : voir l'URL GitHub Pages dans la description de la PR (ou `https://<compte>.github.io/Cosy-farm/`).
- **En local** : `npm install && npm run dev` puis ouvrir l'adresse affichée sur le téléphone (même Wi-Fi).

## Boucle de jeu
1. **Construire** (Boutique 🛒) : enclos, poulailler, mangeoire, abreuvoir — placement libre, déplaçables.
2. **Adopter** des poules : réforme (économique), jeunes poules, poussins (grandissent).
3. **Entretenir** (Ferme 🌾) : graines, eau, litière ; caresser et soigner (🐔 → fiche de la poule).
4. **Passer la nuit** 🌙 (1 énergie, max 15, +1 / 10 min réelles, y compris appli fermée) : besoins, âge, ponte secrète.
5. **Récolter** : toucher le poulailler → vue des nids → toucher chaque œuf. Œufs égarés dans l'herbe si nids sales ou surpeuplement.
6. **Vendre** au marché du dimanche 🧺 : prix libre, clients simulés, négociation.

Caméra : glisser = déplacer, pincer = zoomer, toucher = sélectionner.

## Développement
```
npm install
npm run dev        # serveur local
npm test           # tests de la simulation (node:test)
npm run build      # build de production dans dist/
npm run e2e        # parcours complet en navigateur (iPhone émulé), captures dans e2e/shots/
```
Architecture :
- `src/sim/` — simulation pure (sans DOM), déterministe, état 100 % sérialisable (graine aléatoire incluse). Ponte, besoins, maladies, marché, couvaison/généalogie (prévues pour les coqs).
- `src/game/` — rendu Three.js (monde, vue des nids, modèles primitifs) et panneaux d'interface.
- `src/main.js` — liaison entre interface, rendu et simulation.
- `tests/` — tests unitaires de la simulation ; `e2e/` — test Playwright.

## Hors périmètre de cette version
Reproduction complète (coq, couvaison avec éclosion jouable), apprentissage de tours, potager, autres espèces, décorations, direction artistique définitive.
