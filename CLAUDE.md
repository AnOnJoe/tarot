# Vachette — instructions de travail

Compteur de points de tarot, PWA installée sur les iPhone de la famille. Déployée sur
GitHub Pages à <https://anonjoe.github.io/tarot/>.

Lire [`README.md`](README.md) pour l'usage et les règles,
[`docs/DECISIONS.md`](docs/DECISIONS.md) pour les choix d'implémentation et leurs raisons.
**Y ajouter toute décision non évidente prise ensuite.**

---

## Commandes

```sh
npm test                      # 96 tests — moteur, hauts faits, tags, tours, fusion, sauvegarde
npx tsc -b tsconfig.json --noEmit
npm run build
npm run dev
node scripts/make-icons.mjs   # icônes + favicon, après tout changement de marque
```

`tsc -b` sans argument échoue si le répertoire courant a changé : toujours passer
`tsconfig.json`.

---

## Invariants à ne pas casser

1. **La somme des scores d'une donne vaut zéro.** Un test le vérifie sur 900 donnes
   générées. Toute modification du calcul doit le laisser passer.
2. **`src/engine/` ne dépend ni de React, ni du DOM, ni de la base.** C'est ce qui le rend
   testable et portable.
3. **`Deal.scores` est figé à la validation.** Ne jamais recalculer les donnes passées quand
   un barème change.
4. **Une seule partie ouverte à la fois** (`endedAt === null`). L'accueil en dépend.
5. **L'ordre de `Game.playerIds` commande la rotation du donneur.** Le modifier change qui
   donne ensuite.
6. **L'ordre des teintes de `--series-*` est un mécanisme de sécurité daltonisme.** Ne pas
   permuter sans revalider.

---

## Conventions

**Langue** — tout est en français : interface, commentaires, messages de commit, noms de
variables métier (`preneur`, `donne`, `vachette`). Les identifiants techniques restent en
anglais (`playerId`, `createdAt`).

**Commentaires** — expliquer *pourquoi*, jamais *quoi*. Un commentaire qui paraphrase le
code est du bruit ; un commentaire qui dit quel piège on évite vaut de l'or. Les blocs
`/** */` en tête de module ou de fonction portent l'intention.

**Couleurs** — toute nouvelle teinte d'interface se mesure en ΔE OKLab contre les huit
couleurs de joueur avant d'être retenue. Cf. `docs/DECISIONS.md` pour la méthode et les
valeurs déjà écartées.

**Pas de dépendance nouvelle sans raison forte.** Les graphiques sont en SVG écrit à la
main, les icônes générées en Node pur. L'application doit rester installable et hors ligne.

---

## Vérifier pour de vrai

Ce projet a une culture de vérification, à conserver : **tester le comportement, pas le
code relu**. Plusieurs bugs de cette base ont été trouvés ainsi, jamais par relecture.

- Le service worker ne s'installe qu'en HTTPS : **le hors-ligne ne se teste qu'une fois
  déployé**.
- Après un `git push`, attendre le workflow puis vérifier que le hash du bundle en ligne
  correspond au `dist/` local avant de conclure quoi que ce soit.
- Pour un geste (glissement, glisser-déposer), simuler un vrai pointeur — un `click` ne
  prouve rien.
- Playwright est disponible ; Chrome se trouve à
  `/Applications/Google Chrome.app/Contents/MacOS/Google Chrome`.
- `indexedDB.deleteDatabase` **bloque** tant qu'une page tient la base ouverte : passer par
  une page annexe du même domaine pour fabriquer un état de test.

---

## Pièges connus

- **iOS ne recharge pas une PWA installée**, il la reprend : d'où les contrôles de mise à
  jour explicites dans `src/pwa.ts`.
- **Une transaction de migration IndexedDB se referme** dès qu'on lui rend la main. Jamais
  d'écriture dans un `.then` détaché.
- **Aucun Blob en base.** Les photos sont stockées en `data:` URL. Un Blob rendu par
  IndexedDB pointe vers un fichier de la base que WebKit libère dès qu'on réécrit
  l'enregistrement — le portrait devenait illisible jusqu'au lancement suivant.
  `URL.createObjectURL` est proscrit pour la même famille de raisons.
- **`touch-action: none`** est indispensable sur toute poignée de glissement, et doit rester
  cantonnée à la poignée pour ne pas bloquer le défilement.
- **iOS zoome** sur tout champ dont le texte descend sous 16 px.
- **Le nom de l'app est Vachette, l'URL reste `/tarot/`.** La renommer casserait les
  installations existantes.

---

## Déploiement

`git push` sur `main` suffit : le workflow lance les tests, construit et met en ligne. **Les
tests bloquent le déploiement.**

Les actions vers l'extérieur — créer un dépôt, pousser, publier — se confirment avec
l'utilisateur avant d'être faites.
