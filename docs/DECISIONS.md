# Choix d'implémentation

Ce que le code ne dit pas de lui-même : pourquoi telle solution plutôt qu'une autre, et
quels pièges elle évite. Rangé par domaine, du plus structurant au plus local.

---

## Une PWA, pas une application native

Le sideload iOS sans compte Apple Developer (99 €/an) impose de rebrancher chaque iPhone à
un Mac toutes les semaines : le certificat expire au bout de sept jours. Rédhibitoire pour
des installations chez des tiers.

Une PWA installée sur l'écran d'accueil offre l'icône, le plein écran, le hors-ligne et la
persistance des données, sans renouvellement ni validation. Ce qu'on perd — Face ID,
notifications système, retour haptique — n'a aucun usage ici.

---

## Le moteur de calcul est isolé

`src/engine/` ne dépend ni de React, ni du DOM, ni de la base. C'est la seule partie qui
doit être irréprochable : un compteur qui compte faux ne sert à rien.

Conséquences pratiques : il se teste sans navigateur, et resterait portable tel quel vers
une version native.

**L'invariant central** — la somme des scores d'une donne vaut exactement zéro — est
vérifié sur 900 donnes générées aléatoirement, à 3, 4 et 5 joueurs, tous contrats et
annonces confondus. C'est ce test qui a le plus de valeur du projet.

### Les quarts de point sont conservés

La Pousse à ×1,5 sur une assiette entière produit des demis, et à trois défenseurs des
quarts. Les arrondir romprait l'invariant : la somme cesserait de valoir zéro.

Ils sont donc gardés, et c'est l'affichage qui s'adapte — partie entière en grand, décimale
en petit corps.

### Les scores sont figés à la validation

`Deal.scores` est calculé une fois et stocké. Changer un barème en cours de partie ne
réécrit donc pas l'histoire : seules les donnes suivantes suivent le nouveau barème.

---

## Couleurs : mesurer plutôt que choisir à l'œil

Trois fois dans ce projet une couleur choisie à l'œil s'est révélée trop proche d'une autre
à la mesure. Le protocole est désormais systématique.

**La palette des joueurs** vient d'un jeu catégoriel validé pour le daltonisme. *L'ordre des
teintes est le mécanisme de sécurité*, pas une question de goût : le permuter casse les
écarts entre teintes voisines. Elle a été revalidée contre les deux surfaces de
l'application (`scripts/validate_palette.js` de la compétence dataviz).

**L'accent de l'interface ne doit jamais se lire comme l'identité d'un joueur.** Chaque
candidat est mesuré en ΔE OKLab contre les huit teintes de joueur :

| Accent | Écart minimal | Verdict |
|---|---|---|
| Violet `#8b7cff` | ΔE 4,3 | Rejeté — confondu avec le joueur violet |
| Rouge `#e8564a` | ΔE 3,8 | Rejeté — confondu avec le joueur rouge |
| Lavande `#c4bcff` | ΔE 16,4 | Retenu un temps |
| **Corail `#ffab9d`** | **ΔE 16,1** | **Retenu** (mode sombre) |
| **Grenat `#a81f19`** | **ΔE 14,9** | **Retenu** (mode clair) |

**Un score positif se met en `--pos`, jamais en `--accent`.** En mode clair l'accent est un
grenat, à ΔE 28,5 du rouge des scores négatifs — mais à l'œil, deux rouges. L'écran de
vachette, qui ne parle que de qui gagne et qui perd, affichait ainsi `+120` et `−120` dans
la même teinte. Le couple `--pos` / `--neg` du tableau des scores est le bon, et son vert
reste à ΔE 11,1 du joueur vert.

Le rouge saturé de la marque (`--brand`) échappe à cette règle : il ne sert qu'au logo, où
rien ne peut le confondre avec un joueur.

**Les couleurs de rang** (or, argent, bronze) voisinent délibérément la palette : le rang
est *toujours* écrit en chiffre, la teinte ne fait que le doubler. Le bronze a tout de même
été écarté de l'orange, de ΔE 6,3 à 12.

---

## Synchronisation entre deux carnets

### Le tag identifie une personne, l'`id` identifie un enregistrement

Un joueur porte un UUID tiré localement. Deux personnes qui saisissent « Joachim » chacune
de leur côté obtiennent deux inconnus : aucun rapprochement n'est possible.

Le **tag** — six signes dictables, `K7M-2PQ` — est la clé de rapprochement. Il se modifie
depuis le carnet, ce qui est tout son intérêt : on recopie chez soi celui de l'autre.

Son alphabet exclut `I`, `L`, `O`, et donc aussi `0` et `1`. Un test a attrapé le `L` que
la première version avait laissé passer.

### La fusion n'écrase rien

Ce qui existe des deux côtés reste dans sa version **locale** ; ce qui n'existe que d'un
côté est ajouté. C'est le sens même d'une synchronisation entre deux personnes qui ont
chacune leur historique.

Quand un tag correspond, **toutes** les références de l'autre appareil sont réécrites vers
l'identifiant local : parties, donneurs, preneurs, appelés, poignées, misères, clés de
scores, points de vachette.

Les donnes d'une partie reçue sont **renumérotées par ordre de création** : deux personnes
ayant marqué la même partie en parallèle produiraient sinon deux donnes de même rang.

L'opération est **idempotente** — fusionner deux fois le même fichier n'ajoute rien.

### Les barèmes restent locaux

Ce sont des réglages d'appareil, pas de l'historique. Les écraser changerait le calcul des
donnes à venir sans que personne l'ait demandé.

---

## Service worker : la mise à jour n'arrive pas toute seule

L'enregistrement par défaut ne cherche une nouvelle version qu'à une **navigation**. Or une
application installée sur l'écran d'accueil iOS est *reprise*, pas rechargée : aucune
navigation ne survient jamais, et la version installée peut tenir indéfiniment.

`src/pwa.ts` ajoute donc trois déclencheurs : contrôle au retour au premier plan, contrôle
horaire, et rechargement dès qu'un nouveau service worker prend la main.

**Le piège du premier chargement** : `controllerchange` recouvre deux situations. À la
première visite il n'y a aucun contrôleur — la page vient du réseau, elle est déjà à jour,
la recharger n'apporte qu'un clignotement. Seul le *remplacement* d'un contrôleur existant
justifie un rechargement.

---

## Photos : du texte en base, jamais de Blob

Deux défauts distincts, deux fois le même coupable — un Blob a un cycle de vie, une chaîne
n'en a pas.

**D'abord `URL.createObjectURL`.** Une URL d'objet doit être révoquée au démontage. Chaque
lecture en base rend de nouveaux Blob : quand une liste se recharge, l'ancien Blob change
d'identité, l'effet se rejoue et révoque l'URL précédente. L'image qui la portait encore
reste vide. Symptôme : un portrait absent, qui revient après un aller-retour vers un autre
écran. Corrigé en convertissant à l'affichage en `data:` URL.

**Puis le Blob lui-même.** Le portrait disparaissait encore après un simple *Enregistrer*
sans modification, et ne revenait qu'au lancement suivant. Un Blob rendu par IndexedDB ne
porte pas ses octets : il pointe vers un fichier géré par la base. WebKit libère ce fichier
dès que l'enregistrement qui le référençait est réécrit — même si l'écriture repose
exactement le même Blob. Le portrait encore affiché tenait alors une référence morte.

Les photos sont donc **stockées en `data:` URL**, pas en Blob. Une chaîne survit à sa propre
réécriture, s'affiche sans conversion ni cache, et voyage telle quelle dans la sauvegarde,
qui l'employait déjà. Le surcoût du base64 est d'un tiers sur des vignettes de 256 px.

`preparePhoto` rend donc directement `canvas.toDataURL`, et les photos déjà en base sont
reprises **hors de la migration de schéma** : leur lecture passe par un `FileReader`, donc
par un tour de boucle d'événements, et une transaction de migration se referme dès qu'on lui
rend la main. Un drapeau en `settings` évite d'y revenir à chaque lancement.

> Le premier défaut ne s'est jamais reproduit sous Chrome, le second non plus : les deux
> tiennent à WebKit. Ce qui est vérifiable en test, c'est qu'aucun Blob ne subsiste en base
> — le mécanisme est retiré, pas contourné.

---

## Migrations IndexedDB

Une transaction de migration se referme dès qu'on lui rend la main. Des écritures
programmées dans un `.then` détaché peuvent arriver après sa fermeture — **silencieusement,
et sans seconde chance**, puisqu'une migration ne se rejoue jamais.

La migration v1 → v2 (attribution des tags) parcourt donc les joueurs au curseur, en
chaînant les promesses sans jamais rendre la main.

---

## Décisions d'interface

**Aucun preneur n'est présélectionné** à l'ouverture d'une donne, et aucun portrait n'est
ni retenu ni écarté tant que le choix n'est pas fait : rien ne doit ressembler à une
décision déjà prise. Tant qu'aucun preneur n'est désigné, le bouton reste inactif et la
répartition ne s'affiche pas — un tableau de zéros laisserait croire à un calcul.

Le type du brouillon autorise un preneur indéterminé, ce qu'une donne enregistrée ne peut
pas être. **La distinction est portée par les types**, pas par une convention.

**Le curseur est une barre de progression vers le contrat**, pas une frontière entre deux
camps. Le modèle « territoire » — pousser la ligne dans le camp adverse — était cohérent
mais contre-intuitif : on glisse à droite pour faire monter un score.

**La vachette se saisit en classement, pas en points.** Le barème ne dépend que de l'ordre :
compter les points de chacun était un détour pour retrouver ce que la table lit dans ses
plis.

**Du moins de points au plus de points**, et non l'inverse. C'est le sens du dépouillement,
et le premier nommé est alors celui qui gagne le plus : l'écran se lit comme un podium, du
vainqueur au dernier. Le `=` se pose **entre deux lignes** — une égalité relie deux joueurs,
ce n'est pas une propriété de l'un d'eux, et le trait qui traverse la jonction dit ce qu'elle
relie.

Rien n'est présélectionné, et **l'ordre de la table n'est pas proposé comme point de
départ** : ce serait un classement plausible que personne n'a donné — la même raison qui
interdit de présélectionner un preneur.

Le classement est stocké comme un **tableau de groupes** (`standing`), du moins au plus de
points : l'ordre et les égalités sont portés par la structure, sans convention de
numérotation à respecter. Les numéros affichés (1, 2, 2, 4) ne sont qu'un rendu.

### Trois formats, aucune conversion

| Champ | Sens | Écrit ? |
|---|---|---|
| `standing` | groupes, du **moins** au plus de points | oui |
| `ranks` | rangs, `1` = le **plus** de points | non, lu seulement |
| `points` | points ramassés par chacun | non, lu seulement |

Les deux formats abandonnés restent lus indéfiniment, et **rien n'est migré**. Deux raisons :
une donne validée ne se recalcule jamais, et surtout une fusion peut à tout moment ramener
une vachette d'un format ancien depuis un carnet resté en arrière — une migration au
démarrage ne couvrirait donc pas le cas.

Le champ a **changé de nom en changeant de convention** (`ranks` → `standing`) précisément
pour qu'une donne de l'un ne puisse pas se lire comme une donne de l'autre. Réutiliser le
nom en inversant le sens aurait retourné silencieusement les classements déjà enregistrés.

`vacheeGroups` ramène les trois formes à l'ordre du barème et **partitionne toujours la
table** : un joueur absent de la saisie est rattaché en queue plutôt qu'omis, sans quoi le
barème serait découpé de travers et la somme de la donne cesserait de valoir zéro.

**Le bilan d'un joueur vit sur sa fiche, pas dans l'écran Statistiques.** Ce sont deux
questions distinctes : là-bas on compare des joueurs entre eux, ici on regarde une personne.
La seconde n'avait pas de réponse.

Deux conventions y sont assumées plutôt que contournées : une **victoire compte pour chacun
des ex æquo** — départager arbitrairement serait pire que d'admettre le partage — et une
partie ouverte sans y jouer une donne **ne compte pas**, elle n'a pas eu lieu. Un taux de
réussite sans prise s'affiche `—` et non `0 %` : l'absence de donnée n'est pas un zéro.

La feuille surgissante est désormais **plafonnée et défilante** (`88dvh`) : une fiche porte
assez de contenu pour que ses boutons passent sous le bord d'un petit iPhone.

Sa courbe d'évolution réemploie `CumulativeChart` avec un seul joueur et un point par
partie. Elle n'apparaît qu'**à partir de deux parties** : un point unique trace une ligne
plate qui ne raconte rien et occupe la place d'une information. Et seules les parties où il
a joué figurent sur l'axe — celles des autres y créeraient des paliers qui ne sont pas les
siens.

**Supprimer une partie se glisse, et se trouve aussi sans le geste.** Le glissement vers la
gauche est celui des listes iOS, donc appris d'avance — mais un geste ne s'annonce pas : la
feuille de choix d'une partie terminée porte la même action, pour qui ne le connaît pas. La
version précédente s'en remettait à un `contextmenu`, que Safari sur iOS ne déclenche pas :
la suppression y était donc **inatteignable**.

Le composant porte `touch-action: pan-y` et non `none` : seule l'horizontale est prise en
charge, la page doit continuer de défiler sous le doigt. La direction se tranche au
huitième pixel, et un geste vertical rend la main pour de bon.

Deux pièges, tous deux trouvés en simulant un vrai doigt et non en relisant le code :

- Un glissement se termine par un `click` que le navigateur envoie quand même. Sans garde,
  refermer une rangée rouvrait la partie qu'on venait d'écarter — mais une garde qui ne
  s'arme que sur un drapeau **avale le premier appui sur *Supprimer***, c'est-à-dire
  exactement le geste qu'on vient de découvrir. Elle expire donc, et **n'entrave jamais le
  bouton découvert**.
- Refermer la rangée au moment d'ouvrir la confirmation oblige à tout recommencer si l'on
  renonce. Elle reste ouverte, et ne se referme qu'une fois la partie supprimée.

**Le glisser-déposer se prend à une poignée**, pas sur la ligne entière : la poignée porte
`touch-action: none`, sans quoi iOS interprète le geste comme un défilement. La restreindre
laisse le reste de l'écran défiler.

**La taille du cumul est déduite de la place mesurée** et de la longueur du nombre, pas
fixée à l'avance. C'est la longueur qui contraint, pas le nombre de joueurs : à quatre,
`150` tient en 35 px là où `−422,25` plafonne à 15.

**Le compte des tours de donne est tenu par l'application**, pas par la table. Une soirée
se termine proprement quand chacun a donné le même nombre de fois ; s'arrêter au milieu
d'un tour avantage ceux qui ont donné une fois de plus. C'est une convention de table, donc
elle est **signalée et non imposée** : *Terminer* prévient qu'il reste des donnes, et clôt
quand même si on le confirme.

Le calcul vit dans `src/engine/rounds.ts` plutôt que dans l'écran : c'est de l'arithmétique
de partie, et l'invariant qui compte — le reste annoncé solde toujours le tour — se teste
sans navigateur.

**Le rappel de sauvegarde s'éteint tout seul, et ne se congédie pas.** C'est le seul vrai
risque du projet : tout l'historique tient dans le stockage d'un navigateur, sur un
téléphone, et aucun serveur ne le rattraperait. Le rappel n'apparaît qu'au-delà de trois
parties terminées sans sauvegarde — assez haut pour ne pas harceler après une soirée — et
disparaît dès qu'un fichier est sorti.

Un partage annulé n'est pas une sauvegarde : `exportEverything` rend `false` sur
`AbortError`, et la date n'est posée qu'en cas de sortie effective. Une **restauration** la
pose aussi : l'appareil est alors la copie conforme d'un fichier qui existe. Une **fusion**
non — son résultat n'existe nulle part sous forme de fichier.

**L'accueil ne montre que trois parties**, celle en cours comprise — elle occupe l'une des
trois places, car elle en est une pour qui regarde l'écran, même si elle a sa propre carte.
Le reste tient derrière *Voir les N parties*, et les réglages derrière *Paramètres* : on
ouvre l'application pour jouer, pas pour consulter des archives ni changer un barème.

**Rouvrir une partie close clôt toute autre partie ouverte.** L'accueil suppose une seule
partie en cours ; sans cela, deux parties se disputeraient la même place et l'une
deviendrait inatteignable.

**Les statistiques ont quitté les Paramètres pour une carte d'accueil.** Rangées au même
rang que la Sauvegarde, elles n'appelaient personne : on n'ouvre pas un menu de réglages pour
le plaisir. La carte porte deux accroches vivantes — qui mène, qui monte — et c'est ce qui
donne envie d'entrer.

Son titre nomme la destination — *Statistiques* — plutôt que le sujet : ce sont les accroches
qui attirent l'œil, le titre n'a qu'à dire où l'on va. Deux au plus : une troisième en ferait un tableau de bord, et on
cesserait de la lire. Les *Paramètres* ne gardent que ce qui se règle vraiment — carnet,
barèmes, sauvegarde.

Une barre d'onglets permanente aurait été plus visible encore, mais elle aurait coûté la
barre d'action du bas, où vit *Nouvelle partie* — l'action pour laquelle on ouvre
l'application.

**Les hauts faits ont rejoint les statistiques** plutôt que de garder leur écran. Ils sont
une lecture de l'historique parmi d'autres ; deux entrées séparées pour la même matière
faisaient hésiter à chaque fois.

**Le mot « table » n'a qu'un sens dans l'application** : l'ordre des joueurs et la rotation
du donneur, dans l'écran de partie. La section d'ensemble des statistiques s'est d'abord
appelée *La table*, ce qui en faisait un second sens — et rendait le titre illisible. Elle
s'appelle *Les parties*, en parallèle des *Joueurs* et des *Hauts faits*. Pour la même
raison, l'échelle se choisit entre *cette partie* et *tout l'historique* : « toutes les
parties » juste au-dessus d'un onglet « Les parties » recréait la confusion d'un cran.

**Un conseil se lit comme une phrase, pas comme une alerte** : pas de fond coloré, un liseré
à gauche. Trois états seulement — vert pour un appui, rouge pour une faille, **gris pour un
constat**. Colorer le neutre avec l'accent le rendait, sur le thème clair où celui-ci est un
rouge sombre, indiscernable d'une fragilité : on s'inquiétait pour un simple fait.

La couleur ne porte jamais rien seule : la phrase énonce son chiffre et son effectif, et se
lit entière en gris.

**Les hauts faits ne sont pas stockés**, ils se recalculent depuis les donnes. Corriger une
donne retire donc le haut fait qu'elle avait fait décrocher — ce qui vaut mieux qu'un
tableau de chasse qui mentirait.

---

## Analyses et conseils

### Sous l'effectif, on se tait

C'est la règle qui gouverne `advice.ts`, et la seule qui compte. Un taux de réussite sur
trois prises n'est pas une tendance, c'est du hasard mis en forme ; l'affirmer à table ferait
perdre à l'application la seule chose qu'elle ait à vendre — sa justesse. Chaque règle porte
donc son seuil, exporté et testé, et **rien ne s'affiche en dessous**.

| Seuil | Valeur | Ce qu'il protège |
|---|---|---|
| `MIN_TAKES` | 12 | juger la façon de prendre |
| `MIN_TAKES_BY_CONTRACT` | 8 | juger le rendement d'un contrat |
| `MIN_TAKES_BY_OUDLERS` | 6 | tirer une règle d'un nombre de bouts |
| `MIN_FALLS` | 6 | parler de la façon de chuter |
| `MIN_DEFENSES` | 30 | comparer un défenseur à sa table |
| `MIN_DUEL_GAMES` | 5 | faire d'un face-à-face autre chose qu'une anecdote |
| `MIN_PARTNERSHIP_TAKES` | 6 | parler d'un attelage à cinq |
| `MIN_VACHETTES` | 6 | dire ce que la vachette coûte à quelqu'un |
| `NOTABLE_RATE` | 3 pts/donne | signaler un écart plutôt que du bruit |

`MIN_DEFENSES` est haut à dessein : le défenseur ne choisit ni sa main ni le contrat qu'il
subit, et il faut beaucoup de donnes pour que son apport émerge du bruit.

Le silence n'est pas une panne, et la fiche le dit en toutes lettres — sans quoi on
chercherait ce qui ne s'affiche pas.

**Les conseils citent l'effectif, pas un pourcentage.** « 2 prises sur 9 » se conteste,
« 22 % » se croit. Le second cache ce sur quoi il repose ; le premier l'expose.

### La réussite d'une prise se lit sur le contrat, jamais sur le score

Une misère encaissée le même tour peut rendre positif le score d'un preneur qui a chuté. Le
seuil, lui, ne ment pas. `playerStats` lisait le score et `insights` le contrat : la même
prise était **tenue dans la liste et chutée dans la fiche**, sur le même écran. Les deux
lisent désormais le contrat.

Cela fait entrer les barèmes dans l'analyse, sans rien contredire : `Deal.scores` reste figé
à sa validation, seul l'écart au seuil se recalcule à la lecture. Changer un seuil dans les
Règles maison change donc ce que l'analyse raconte, jamais les points déjà marqués.

### Rapporter avant de comparer

Deux nombres bruts ne se comparent presque jamais dans ce jeu :

- **Les prises se rapportent à la part équitable.** Dix prises en trente donnes à trois
  joueurs, c'est exactement sa part ; les mêmes dix en trente donnes à cinq, c'est le double.
  `appetite` divise les prises par celles qu'un partage égal aurait données, table par table
  — un joueur des soirées à trois et un joueur des soirées à cinq redeviennent comparables.
- **Les soirées se mesurent en points par donne.** Une partie de vingt-cinq donnes creuse
  mécaniquement des écarts qu'une partie de huit ne peut pas creuser ; une courbe de totaux
  ne mesurerait que la longueur des soirées.
- **Les joueurs se comparent sur les parties partagées.** Opposer le total de quelqu'un qui a
  joué trente soirées à celui de quelqu'un qui en a joué cinq ne dit rien. Le duel remet les
  deux sur le même terrain : mêmes parties, mêmes donnes, mêmes adversaires.

### Les vachettes sortent du taux de prise

Une vachette est une donne où *personne* n'a pris : elle ne mesure aucun appétit. Elle est
comptée dans les donnes jouées, exclue de celles où prendre était une option.

### Les analyses vivent dans `engine/`

Même raison qu'ailleurs : c'est ce qui les rend testables. Une règle de conseil écrite dans
un composant React ne se vérifie qu'à l'œil, sur des captures — or c'est précisément le genre
de code qui a besoin d'être confronté à des cas limites, effectifs minces compris.

---

## Ce qui a été mesuré plutôt que supposé

Les vérifications suivantes tournent contre le site **déployé**, pas seulement en local :

- la somme nulle sur 900 donnes générées ;
- l'aller-retour export → base effacée → restauration, photo comprise ;
- la convergence de deux appareils après un échange croisé, et l'idempotence de la fusion ;
- le sens du glissement du curseur, par un geste tactile réel ;
- la rotation du donneur après correction de l'ordre de table ;
- la mise à jour automatique, en servant une v1 puis une v2 derrière le service worker ;
- le comportement hors ligne, réseau coupé et page rechargée.
