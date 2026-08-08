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

**En ligne : <https://anonjoe.github.io/tarot/>**

---

## Installer sur un iPhone

1. Ouvrir <https://anonjoe.github.io/tarot/> **dans Safari** — Chrome ne propose pas
   l'installation sur iOS.
2. Bouton Partager → **Ajouter à l'écran d'accueil**.
3. C'est tout. L'icône se comporte comme une application : plein écran, hors ligne, parties
   conservées.

Les mises à jour arrivent seules : l'application vérifie au retour au premier plan et se
recharge si une nouvelle version est en ligne.

> **Après une réinstallation**, les parties sont conservées — elles vivent dans le stockage
> du site, que la suppression de l'icône n'efface pas.

---

## Utiliser

### Une soirée type

1. **Nouvelle partie** — choisir 3, 4 ou 5 joueurs, les prendre dans le carnet, désigner
   qui donne en premier. L'ordre de sélection fixe l'ordre de la table.
2. À chaque main jouée, **Nouvelle donne** : le preneur, le contrat, ses bouts, le petit au
   bout, puis les points de l'attaque au curseur. Les annonces rares (poignée, chelem,
   misère) sont repliées sous *Autres annonces*.
3. La donne validée, un écran révèle le résultat puis **qui prend la tête**.
4. Au-dessus du tableau, le **tour de donne** : « encore 2 donnes pour que chacun ait donné
   autant ». S'arrêter au milieu d'un tour avantage ceux qui ont donné une fois de plus.
5. En fin de soirée, **Terminer** : l'épilogue affiche le vainqueur et son avance. Si le
   tour n'est pas bouclé, l'application le signale — sans l'interdire.

### Les écrans

| Écran | À quoi il sert |
|---|---|
| **Accueil** | Reprendre la partie en cours, revoir les trois dernières parties — *Voir les N parties* déplie l'historique complet, *Paramètres* le reste |
| **Nouvelle partie** | Composer la table et désigner le premier donneur |
| **Partie** | Le tableau des donnes, les cumuls, le rang de chacun |
| **Saisie d'une donne** | Preneur, contrat, bouts, annonces, curseur de points, détail du calcul |
| **Vachette** | Saisie du contrat maison : les points de chacun, qui doivent totaliser 91 |
| **Table** | Corriger l'ordre des joueurs en cours de partie et qui donne ensuite |
| **Statistiques** | Courbes d'évolution, réussite des prises, bilan, attaque contre défense |
| **Hauts faits** | Onze exploits propres au tarot, décrochés ou à décrocher |
| **Carnet des joueurs** | Modifier un nom, une photo, un tag ; **le bilan de chacun** ; retirer quelqu'un |
| **Règles maison** | Tous les barèmes, modifiables sans toucher au code |
| **Sauvegarde** | Exporter, fusionner avec quelqu'un, ou restaurer — avec la date de la dernière sauvegarde |

### Corriger une erreur

- **Une donne mal saisie** — la toucher dans le tableau pour la rouvrir, la corriger ou la
  supprimer. Les donnes suivantes sont renumérotées.
- **Un ordre de table faux** — l'entrée **Table**, en haut de l'écran de partie. L'ordre
  commande la rotation du donneur : s'être trompé en composant la table décale tous les
  donneurs suivants.
- **Une partie close par erreur** — la toucher à l'accueil, puis *Rouvrir la partie*.
- **Une partie à supprimer** — la **glisser vers la gauche** à l'accueil découvre
  *Supprimer* ; la même action figure dans la feuille qui s'ouvre en touchant une partie
  terminée. La partie en cours se supprime de la même façon. La suppression demande
  confirmation, annonce le nombre de donnes perdues, et **rien ne la rattrape** sinon une
  sauvegarde.

---

## Synchroniser à deux

Sans serveur, la synchronisation passe par un fichier. Chacun exporte le sien, l'autre le
fusionne — et l'opération se refait dans l'autre sens pour que les deux aient tout.

> **Exportez régulièrement.** Tout l'historique tient dans le stockage d'un navigateur, sur
> un téléphone : perdu, réinitialisé ou remplacé, il n'en resterait rien. L'accueil le
> rappelle au bout de trois parties terminées sans sauvegarde.

1. **Alignez les tags.** Dans le *Carnet des joueurs*, chaque personne porte un tag court
   de la forme `K7M-2PQ`. Pour que la même personne soit reconnue des deux côtés, recopiez
   chez l'un le tag que l'autre affiche. Sans cela, elle apparaîtra deux fois.
2. **Exportez** depuis *Sauvegarde*, et envoyez le fichier `vachette-….json`.
3. **Fusionnez** le fichier reçu : ce qui manque est ajouté, **rien n'est écrasé**.
   L'opération est idempotente — fusionner deux fois le même fichier n'ajoute rien.

> **Fusionner ≠ restaurer.** *Restaurer* remplace intégralement le contenu de l'appareil,
> c'est un retour en arrière. *Fusionner* n'ajoute que ce qui manque.

Les barèmes ne sont pas fusionnés : ce sont des réglages d'appareil, pas de l'historique.

---

## Le bilan d'un joueur

Sa fiche, dans le *Carnet des joueurs*, porte ce qu'il a fait depuis toujours : parties
jouées et gagnées, donnes, points cumulés, prises et taux de réussite, moyennes en attaque
et en défense, meilleure partie, contrat de prédilection.

Une **victoire** compte pour chacun des ex æquo : départager arbitrairement serait pire que
d'admettre le partage. Une partie ouverte sans y jouer une seule donne ne compte pas.

C'est une autre question que l'écran *Statistiques*, qui compare les joueurs entre eux.

---

## Règles implémentées

Règles FFT, amendées des conventions de la table. Tout est modifiable dans **Règles maison**.

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

La formule d'une donne :

```
écart = points de l'attaque − seuil selon les bouts
base  = ±(25 + |écart|) + petit au bout
part  = base × multiplicateur + poignée + chelem
```

Chaque défenseur perd une part, le preneur en gagne autant qu'il affronte d'adversaires.
**La somme des scores d'une donne vaut toujours zéro** — un test le vérifie sur 900 donnes
générées.

### La vachette

Contrat maison joué quand personne ne prend, au lieu de redistribuer. Chacun pour soi, et
**celui qui ramasse le plus de points perd le plus**. Barème par rang de points décroissant :

- 3 joueurs — `−120 / 0 / +120`
- 4 joueurs — `−120 / −60 / +60 / +120`
- 5 joueurs — `−120 / −60 / 0 / +60 / +120`

En cas d'égalité, les joueurs concernés se partagent la moyenne des rangs qu'ils occupent,
ce qui préserve la somme nulle.

### Points entiers, cumuls à décimales

La saisie se fait en **points entiers**. À quatre joueurs c'est exact : le preneur ramasse
le chien puis des plis de quatre cartes, soit toujours un compte pair. À trois et à cinq, un
demi-point peut survenir — la table l'arrondit.

Les **cumuls**, eux, gardent des décimales : la Pousse à ×1,5 sur une assiette entière donne
des demis, et à trois défenseurs des quarts. Ils sont conservés plutôt qu'arrondis, sans
quoi la somme d'une donne ne vaudrait plus zéro. Le tableau les affiche en petit corps pour
rendre sa taille à l'unité.

---

## Développement

```sh
npm install
npm run dev      # serveur local
npm test         # moteur de calcul et fusion — 102 tests
npm run build    # production
node scripts/make-icons.mjs   # régénère les icônes et le favicon
```

Le service worker ne s'installe qu'en HTTPS : **le comportement hors ligne ne se teste
réellement qu'une fois déployé.**

### Structure

| | |
|---|---|
| `src/engine/` | Calcul des points, hauts faits, tags, tours de donne. TypeScript pur, sans React ni DOM |
| `src/store/` | Persistance IndexedDB, sauvegarde, fusion de deux carnets |
| `src/screens/` | Les onze écrans |
| `src/components/` | Portraits, tableau, curseur, graphiques SVG, logo |
| `src/palette.ts` | Identité colorée des joueurs, validée pour le daltonisme |
| `src/pwa.ts` | Enregistrement du service worker et recherche de mise à jour |
| `scripts/make-icons.mjs` | Génère les PNG et le favicon, sans dépendance |

Le moteur est isolé à dessein : c'est la seule partie qui doit être irréprochable, et il
resterait portable tel quel si une version native voyait le jour.

### Déploiement

Chaque poussée sur `main` déclenche le workflow GitHub Actions : tests, build, mise en ligne
sur GitHub Pages. **Les tests bloquent le déploiement** — pas de points faux en production.

L'URL reste `/tarot/` bien que l'application s'appelle Vachette : la renommer casserait
toutes les installations déjà posées sur un écran d'accueil.

---

## Ce que l'application ne fait pas

- **Pas de retour haptique** — Safari sur iOS n'implémente pas `navigator.vibrate`.
- **Pas de synchronisation automatique** — sans serveur, elle passe par un fichier échangé
  à la main.
- **Rien n'est envoyé sur Internet.** Les photos ne quittent jamais l'appareil, sauf dans un
  fichier de sauvegarde que vous envoyez vous-même.

---

Les choix d'implémentation qui méritent une explication sont réunis dans
[`docs/DECISIONS.md`](docs/DECISIONS.md).
