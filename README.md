# Tarot — compteur de points

Application de comptage des points du tarot, pour la table familiale. Remplace Tarомètre,
devenu inutilisable à cause de la publicité.

C'est une **PWA** : elle s'installe sur l'écran d'accueil d'un iPhone depuis Safari, tourne
entièrement hors ligne, ne collecte rien, n'affiche aucune publicité, et se met à jour chez
tout le monde à chaque `git push`.

## Installer sur un iPhone

1. Ouvrir <https://anonjoe.github.io/tarot/> **dans Safari** (Chrome ne propose pas
   l'installation sur iOS).
2. Bouton Partager → **Ajouter à l'écran d'accueil**.
3. C'est tout. L'icône se comporte comme une application : plein écran, hors ligne,
   parties conservées.

## Règles implémentées

Règles FFT, amendées des conventions de la table. Tout est modifiable dans l'écran
**Règles maison** sans toucher au code.

| | |
|---|---|
| Tables | 3, 4 et 5 joueurs |
| Contrats | Petite ×1 · **Pousse ×1,5** · Garde ×2 · Garde Sans ×4 · Garde Contre ×6 |
| Seuils | 56 / 51 / 41 / 36 points selon 0 / 1 / 2 / 3 bouts |
| Petit au bout | ±10, intégré à l'assiette **avant** multiplication |
| Poignées | 20 / 30 / 40, après multiplication, au camp vainqueur |
| Chelem | +400 annoncé réussi · +200 non annoncé · −200 annoncé chuté |
| Misère | 10 points versés par chaque adversaire (convention, hors FFT) |
| Répartition à 5 | Preneur 2 parts, appelé 1, défenseurs −1 ; preneur seul → 4 parts |

### La vachette

Contrat maison joué quand personne ne prend, au lieu de redistribuer. Chacun pour soi, et
**celui qui ramasse le plus de points perd le plus**. Barème par rang de points décroissant :

- 3 joueurs — `−120 / 0 / +120`
- 4 joueurs — `−120 / −60 / +60 / +120`
- 5 joueurs — `−120 / −60 / 0 / +60 / +120`

En cas d'égalité, les joueurs concernés se partagent la moyenne des rangs qu'ils occupent,
ce qui préserve la somme nulle.

### À propos des quarts de point

La Pousse à ×1,5 appliquée à une assiette en demi-points produit des quarts de point
(25,5 × 1,5 = 38,25). Ils sont conservés tels quels plutôt qu'arrondis : c'est ce qui
garantit que la somme des scores d'une donne vaut exactement zéro.

## Développement

```sh
npm install
npm run dev      # serveur local
npm test         # moteur de calcul
npm run build    # production
node scripts/make-icons.mjs   # régénère les icônes
```

Le service worker ne s'installe qu'en HTTPS : le comportement hors ligne ne se teste
réellement qu'une fois déployé.

### Structure

| | |
|---|---|
| `src/engine/` | Calcul des points. TypeScript pur, sans React ni DOM, couvert par 45 tests |
| `src/store/` | Persistance IndexedDB (joueurs, parties, donnes, barèmes) et export |
| `src/screens/` | Les six écrans de l'application |
| `src/components/` | Portraits, tableau de scores, curseur de points, graphiques SVG |
| `src/palette.ts` | Identité colorée des joueurs, validée pour le daltonisme |

Le moteur est isolé à dessein : c'est la seule partie qui doit être irréprochable, et il
resterait portable tel quel si une version native voyait le jour. Un test vérifie sur
900 donnes générées que **la somme des scores d'une donne vaut toujours zéro**.

## Déploiement

Chaque poussée sur `main` déclenche le workflow GitHub Actions : tests, build, mise en
ligne sur GitHub Pages. Les tests bloquent le déploiement — pas de points faux en
production.

## Ce que l'application ne fait pas

- **Pas de retour haptique** : Safari sur iOS n'implémente pas `navigator.vibrate`.
- **Pas de synchronisation** entre appareils. Chaque iPhone garde ses propres parties ;
  l'export JSON/CSV tient lieu de sauvegarde.
- **Pas de photos dans l'export** : elles restent sur l'appareil, jamais envoyées nulle part.
