/**
 * Où en est la table dans son tour de donne.
 *
 * Une soirée se termine proprement quand chacun a donné le même nombre de fois : le
 * donneur tourne, et s'arrêter au milieu d'un tour avantage ceux qui ont donné une fois de
 * plus. L'application connaît l'ordre et le nombre de donnes — elle est la mieux placée
 * pour tenir ce compte, que la table tient de tête et perd volontiers.
 */
export interface RoundProgress {
  /** Numéro du tour en cours, à partir de 1. Vaut 1 avant la première donne. */
  round: number
  /** Nombre de tours entièrement joués. */
  completed: number
  /** Donnes restantes pour que chacun ait donné autant de fois. */
  remaining: number
}

export function roundProgress(dealCount: number, playerCount: number): RoundProgress {
  // Une table sans joueur n'existe pas, mais un garde-fou vaut mieux qu'une division par
  // zéro dans un écran de jeu.
  if (playerCount <= 0) return { round: 1, completed: 0, remaining: 0 }

  const completed = Math.floor(dealCount / playerCount)
  const played = dealCount % playerCount
  return {
    round: completed + (played > 0 ? 1 : 0) || 1,
    completed,
    remaining: played === 0 ? 0 : playerCount - played,
  }
}
