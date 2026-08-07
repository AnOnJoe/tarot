/**
 * Identité colorée des joueurs.
 *
 * Un joueur possède un numéro de slot, pas une couleur : c'est le thème qui décide du
 * pigment exact selon qu'on est sur le feutre sombre ou sur le papier clair. Le portrait
 * du joueur et sa courbe dans les statistiques portent ainsi toujours la même identité.
 *
 * Les huit teintes et leur ordre proviennent d'une palette catégorielle validée pour le
 * daltonisme ; l'ordre lui-même est le mécanisme de sécurité, il ne doit pas être permuté
 * sans revalidation (`scripts/validate_palette.js` de la compétence dataviz). Vérifiée
 * contre les deux surfaces de l'application : tous les seuils durs passent, avec un
 * avertissement de contraste levé par les libellés directs et le tableau des donnes.
 */

export const SERIES_SLOTS = 8

/** Couleur d'un joueur, résolue par le thème actif. */
export function seriesColor(colorIndex: number): string {
  return `var(--series-${(colorIndex % SERIES_SLOTS) + 1})`
}

/** Encre lisible sur cette couleur — au moins 4,3:1 sur chacun des huit slots. */
export function seriesInk(colorIndex: number): string {
  return `var(--series-${(colorIndex % SERIES_SLOTS) + 1}-ink)`
}
