# EdenSchool Eden5

PWA éducative CM2, installable, construite avec les images validées comme templates visuels réels.

## Lancer en local

```bash
python3 -m http.server 8080
```

Puis ouvrir : `http://localhost:8080/`

Ne pas ouvrir `index.html` directement en fichier local : les `fetch()` JSON et le service worker doivent passer par un serveur HTTP.

## Déploiement GitHub Pages

1. Copier tout le contenu du dossier `Eden5/` à la racine du repository.
2. Commit + push sur la branche utilisée par GitHub Pages.
3. Dans GitHub : Settings → Pages → Deploy from branch.
4. Choisir la branche et `/root`.

Les chemins sont relatifs, donc compatibles avec `https://utilisateur.github.io/repo/`.

## Structure

```txt
assets/
  templates/        images complètes des pages validées
  ui/               fonds, bottombar, spritesheets originales
  avatars/          50 avatars extraits proprement avec alpha
  badges/           35 badges extraits proprement avec alpha
  icons/            icônes PWA
audio/
  sfx/              sons courts distincts par action
  music/            boucle d'ambiance
data/
  classes/cm2/      manifest + JSON par matière
  atlases/          métadonnées de découpe avatars/badges
src/
  app.js            logique applicative
  styles.css        responsive + overlays
  services/         stub Firebase Realtime Database
```

## Ajouter une leçon / mission

Modifier le fichier de matière :

```txt
data/classes/cm2/maths.json
```

Ajouter un objet dans `missions[]` avec :

- `id`
- `title`
- `subtitle`
- `estimatedTime`
- `difficulty`
- `lesson.content`
- `lesson.remember`
- `quiz[]`
- `exercises[]`
- `reward.xp`
- `reward.badge`

Le schéma complet est dans :

```txt
docs/content-schema.json
```

## Sauvegarde

Eden5 utilise `localStorage` :

```txt
edenschool.eden5.state
```

Un stub Firebase Realtime Database est présent dans :

```txt
src/services/firebaseRealtimeDatabase.stub.js
```

## Code parent

```txt
52635
```

## Notes d'intégration visuelle

- Les pages principales utilisent les mockups fournis en image de fond/template.
- Les contenus dynamiques sont superposés en HTML/CSS.
- Les avatars et badges ne sont pas découpés par grille brute : ils sont extraits par composant alpha puis exportés en PNG transparent.
