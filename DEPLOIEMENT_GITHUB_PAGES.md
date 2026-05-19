# Déploiement GitHub Pages - Eden5 WebP

Les images cassées apparaissent quand le dossier `assets/` n'est pas réellement présent dans le dépôt GitHub.

## À mettre à la racine du dépôt

Il faut uploader **tout le contenu** de ce dossier, pas seulement les fichiers texte :

- `index.html`
- `manifest.webmanifest`
- `service-worker.js`
- `src/`
- `data/`
- `assets/`
- `audio/`
- `docs/`

## Test après déploiement

Ouvre :

`https://shmata22.github.io/Eden5/asset-check.html`

Puis clique sur **Tester**. Tous les fichiers doivent afficher `OK`.

## Cache mobile

Après remplacement :

1. Supprimer l'ancienne PWA installée.
2. Vider les données du site dans Chrome.
3. Recharger `https://shmata22.github.io/Eden5/`.

Cette version utilise uniquement des images `.webp` et aucun `.png`.
