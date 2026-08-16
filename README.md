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
| **Accueil** | Reprendre la partie en cours, revoir les trois dernières parties, et la **carte des statistiques** — deux accroches sur ce que l'historique a de plus vivant à dire |
| **Nouvelle partie** | Composer la table et désigner le premier donneur |
| **Partie** | Le tableau des donnes, les cumuls, le rang de chacun |
| **Saisie d'une donne** | Preneur, contrat, bouts, annonces, curseur de points, détail du calcul |
| **Vachette** | Saisie du contrat maison : le **classement**, du moins de points au plus de points, ex æquo compris |
| **Table** | Corriger l'ordre des joueurs en cours de partie et qui donne ensuite |
| **Statistiques** | Trois sections : *les parties* (courbes, bilans, ce que l'historique dit de vous), *les joueurs* (la fiche d'analyse de chacun), *les hauts faits* |
| **Carnet des joueurs** | Modifier un nom, une photo, un tag ; le bilan de chacun ; retirer quelqu'un |
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
et en défense, meilleure partie, contrat de prédilection — et sa **courbe d'évolution de
partie en partie**, à partir de deux parties jouées.

Une **victoire** compte pour chacun des ex æquo : départager arbitrairement serait pire que
d'admettre le partage. Une partie ouverte sans y jouer une seule donne ne compte pas.

C'est une autre question que l'écran *Statistiques*, qui compare les joueurs entre eux.

---

## Ce que les statistiques savent dire

L'écran *Statistiques* s'ouvre depuis sa **carte à l'accueil**. Trois sections.

### Les parties

Les courbes d'évolution, la réussite des prises, le bilan de chacun, l'attaque contre la
défense — et, sous *ce que dit l'historique*, les observations qui portent sur la tablée
elle-même : les attelages à cinq qui gagnent ensemble, le joueur le plus régulier, le duel
le plus fourni.

> Cette section ne s'appelle pas *la table* : l'écran de partie emploie déjà ce mot pour
> l'ordre des joueurs et la rotation du donneur.

Depuis une partie, une seconde rangée choisit l'échelle — *cette partie* ou *tout
l'historique*.

### Les joueurs

La fiche d'analyse de chacun. En tête, **ce que l'historique dit de lui** ; puis les chiffres
qui le justifient.

**Quand il prend**

| | |
|---|---|
| Appétit | Ses prises rapportées à celles qu'un partage égal lui aurait données. `1×` est sa part exacte ; `2×` veut dire qu'il prend deux fois trop |
| Réussite selon les bouts | Le seul paramètre qu'il connaît **avant** de s'engager, avec le seuil à atteindre |
| Rendement par contrat | Ce que chaque contrat lui rapporte, en points par prise et non en total |
| Marges | De combien il tient quand il tient, de combien il manque quand il chute |

**Quand il ne prend pas** — ses points par donne défendue, les prises adverses tombées
pendant qu'il défendait, son apport comme appelé à cinq, ce que la vachette lui coûte.

**Sa trajectoire** — ses points par donne soirée après soirée, sa meilleure et sa pire, et
son *battement* : bas, c'est une horloge ; haut, il alterne les soirées fastes et les
naufrages. Ni une qualité ni un défaut, mais ce qui distingue deux joueurs de même moyenne.

### Les hauts faits

Onze exploits propres au tarot, décrochés ou à décrocher.

### Les conseils se taisent plutôt que d'inventer

Chaque analyse porte un effectif minimal, et **rien ne s'affiche en dessous** : un taux de
réussite sur trois prises n'est pas une tendance, c'est du hasard mis en forme. Douze prises
pour juger une façon de prendre, huit pour un contrat, trente donnes défendues pour comparer
un défenseur à sa table. Les seuils exacts sont dans
[`docs/DECISIONS.md`](docs/DECISIONS.md).

Un conseil cite toujours son effectif — « tu tiens 2 prises sur 9 », jamais « 22 % » : le
second cache ce sur quoi il repose. Sur une soirée seule, la fiche ne dit donc rien, et le
dit.

Une prise est **tenue au sens du contrat**, pas au sens du score : une misère encaissée le
même tour peut rendre positif le score d'un preneur qui a chuté.

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
**celui qui ramasse le moins de points gagne le plus**. Barème par place :

- 3 joueurs — `+120 / 0 / −120`
- 4 joueurs — `+120 / +60 / −60 / −120`
- 5 joueurs — `+120 / +60 / 0 / −60 / −120`

**Seul l'ordre compte, pas les points.** On touche les joueurs **du moins de points au plus
de points** — l'écran se lit alors comme un podium, du vainqueur au dernier. Le `=` posé
**entre deux joueurs** les met à égalité. Compter les points de chacun n'était qu'un détour
pour retrouver un ordre que la table lit dans ses plis.

Les ex æquo se partagent la moyenne des places qu'ils occupent, ce qui préserve la somme
nulle : deux ex æquo aux places 2 et 3 à quatre joueurs marquent donc `0` chacun.

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
npm test         # moteur de calcul, analyses et fusion — 154 tests
npm run build    # production
node scripts/make-icons.mjs   # régénère les icônes et le favicon
```

Le service worker ne s'installe qu'en HTTPS : **le comportement hors ligne ne se teste
réellement qu'une fois déployé.**

### Structure

| | |
|---|---|
| `src/engine/` | Calcul des points, analyses, conseils, hauts faits, tags, tours de donne. TypeScript pur, sans React ni DOM |
| `src/store/` | Persistance IndexedDB, sauvegarde, fusion de deux carnets |
| `src/screens/` | Les dix écrans |
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
