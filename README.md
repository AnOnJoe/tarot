# Vachette

> Chacun pour soi.

Compteur de points du tarot, pour la table familiale. Remplace Tarомètre, devenu
inutilisable à cause de la publicité.

Le nom vient de la convention maison de la table : quand personne ne prend, on joue la
**vachette** plutôt que de redistribuer. La marque en reprend le geste — deux cartes
croisées qui dessinent un V.

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
| `src/engine/` | Calcul des points et hauts faits. TypeScript pur, sans React ni DOM, couvert par 89 tests |
| `src/store/` | Persistance IndexedDB (joueurs, parties, donnes, barèmes) et export |
| `src/screens/` | Les dix écrans de l'application |
| `src/components/` | Portraits, tableau de scores, curseur de points, graphiques SVG |
| `src/palette.ts` | Identité colorée des joueurs, validée pour le daltonisme |

L'accent de l'interface (corail sur sombre, grenat sur clair) est choisi pour rester à
distance mesurée de chaque couleur de joueur : une teinte d'interface ne doit jamais se
lire comme l'identité de quelqu'un à table. Le rouge saturé de la marque, lui, ne sert
qu'au logo.

Le moteur est isolé à dessein : c'est la seule partie qui doit être irréprochable, et il
resterait portable tel quel si une version native voyait le jour. Un test vérifie sur
900 donnes générées que **la somme des scores d'une donne vaut toujours zéro**.

### Tags de joueur

Un joueur porte un `id` — un UUID tiré localement — et un **tag** court et dictable de la
forme `K7M-2PQ`. Deux personnes qui saisissent « Joachim » chacune de leur côté obtiennent
deux UUID différents pour la même personne : le tag est ce qui permet de les reconnaître au
moment de fusionner deux carnets, et il se modifie depuis le **Carnet des joueurs**.

L'alphabet exclut `I`, `L`, `O` et donc aussi `0` et `1` : un tag se dicte au téléphone.

### Hauts faits

Onze exploits propres au tarot — chelem, garde contre tenue, contrat au point près, triple
poignée, remontada… Ils ne sont **pas stockés** : chacun se recalcule à partir des donnes.
Corriger une donne saisie de travers retire donc le haut fait qu'elle avait fait décrocher,
ce qui vaut mieux qu'un tableau de chasse qui mentirait.

## Déploiement

Chaque poussée sur `main` déclenche le workflow GitHub Actions : tests, build, mise en
ligne sur GitHub Pages. Les tests bloquent le déploiement — pas de points faux en
production.

## Ce que l'application ne fait pas

- **Pas de retour haptique** : Safari sur iOS n'implémente pas `navigator.vibrate`.
- **Pas de synchronisation automatique** entre appareils : sans serveur, elle passe par un
  fichier. L'écran **Sauvegarde** propose deux gestes distincts — **fusionner** le fichier
  de quelqu'un d'autre (rien n'est écrasé, l'opération est idempotente), ou **remplacer**
  entièrement le contenu local par une sauvegarde. Pour synchroniser à deux, chacun exporte
  et fusionne le fichier de l'autre.
- **Rien n'est envoyé sur Internet** : le fichier de sauvegarde part là où vous l'envoyez,
  et nulle part ailleurs.
