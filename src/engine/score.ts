import { DEFAULT_RULES, TOTAL_POINTS, takerShares } from './rules'
import type {
  ContractDeal,
  Deal,
  DealInput,
  PlayerCount,
  PlayerId,
  RuleSet,
  VacheeDeal,
} from './types'

/** Décomposition d'un contrat, pour le calcul comme pour l'affichage du détail. */
export interface ContractBreakdown {
  /** Points que l'attaque devait réaliser, selon ses bouts. */
  threshold: number
  /** Écart signé entre les points réalisés et le seuil. */
  diff: number
  success: boolean
  /** Contribution du petit au bout, signée côté attaque, avant multiplication. */
  petitAuBout: number
  /** Assiette : ±(socle + |écart|) + petit au bout. */
  base: number
  multiplier: number
  /** Prime de poignée, signée côté attaque, après multiplication. */
  handful: number
  /** Prime de chelem, signée côté attaque, après multiplication. */
  slam: number
  /** Montant d'une part, du point de vue de l'attaque. */
  unit: number
}

/**
 * Décompose un contrat selon la formule FFT :
 *
 *     unit = (±(25 + |écart|) + petit au bout) × multiplicateur + poignée + chelem
 *
 * Le petit au bout est intégré à l'assiette et subit donc le multiplicateur, tandis que
 * poignée et chelem s'ajoutent après. Les poignées reviennent au camp vainqueur, quel que
 * soit le camp qui les a annoncées.
 */
export function contractBreakdown(
  deal: ContractDeal,
  rules: RuleSet = DEFAULT_RULES,
): ContractBreakdown {
  const threshold = rules.thresholds[deal.oudlers]
  const diff = deal.attackPoints - threshold
  const success = diff >= 0

  const petitAuBout =
    deal.petitAuBout === 'attaque'
      ? rules.petitAuBoutValue
      : deal.petitAuBout === 'defense'
        ? -rules.petitAuBoutValue
        : 0

  const contractValue = success
    ? rules.baseValue + diff
    : -(rules.baseValue + Math.abs(diff))
  const base = contractValue + petitAuBout
  const multiplier = rules.multipliers[deal.contract]

  const handfulTotal = deal.handfuls.reduce(
    (sum, h) => sum + rules.handfulValues[h.kind],
    0,
  )
  const handful = success ? handfulTotal : -handfulTotal
  const slam = deal.slam === 'aucun' ? 0 : rules.slamValues[deal.slam]

  return {
    threshold,
    diff,
    success,
    petitAuBout,
    base,
    multiplier,
    handful,
    slam,
    unit: base * multiplier + handful + slam,
  }
}

/**
 * Répartit le montant d'un contrat entre les joueurs.
 *
 * Chaque défenseur perd une part, le preneur en gagne autant qu'il affronte d'adversaires,
 * et l'appelé (à 5) lui en prend une. La somme des scores vaut donc toujours zéro.
 */
function distributeContract(
  deal: ContractDeal,
  players: PlayerId[],
  rules: RuleSet,
): Record<PlayerId, number> {
  const { unit } = contractBreakdown(deal, rules)
  const count = players.length as PlayerCount
  const hasPartner = deal.partnerId !== null && deal.partnerId !== deal.takerId
  const shares = takerShares(count, hasPartner)

  const scores: Record<PlayerId, number> = {}
  for (const id of players) {
    if (id === deal.takerId) scores[id] = shares * unit
    else if (hasPartner && id === deal.partnerId) scores[id] = unit
    else scores[id] = -unit
  }
  return scores
}

/**
 * Applique les misères : le joueur qui annonce reçoit la prime de chacun des autres,
 * indépendamment du résultat de la donne. Convention de table, absente des règles FFT.
 */
function applyMiseries(
  scores: Record<PlayerId, number>,
  deal: ContractDeal,
  players: PlayerId[],
  rules: RuleSet,
): void {
  if (!rules.miseryEnabled) return
  for (const misery of deal.miseries) {
    if (!players.includes(misery.playerId)) continue
    for (const id of players) {
      if (id === misery.playerId) {
        scores[id] += rules.miseryValue * (players.length - 1)
      } else {
        scores[id] -= rules.miseryValue
      }
    }
  }
}

/**
 * Calcule une vachette : personne n'ayant pris, chacun joue pour soi et le classement des
 * points réalisés détermine le score. Celui qui en ramasse le plus perd le plus.
 *
 * En cas d'égalité, les joueurs concernés se partagent la moyenne des rangs qu'ils
 * occupent, ce qui préserve la somme nulle.
 */
export function scoreVachette(
  deal: VacheeDeal,
  players: PlayerId[],
  rules: RuleSet = DEFAULT_RULES,
): Record<PlayerId, number> {
  const count = players.length as PlayerCount
  const scale = rules.vacheeScale[count]
  if (!scale) throw new Error(`Aucun barème de vachette pour ${count} joueurs`)

  // Du plus de points au moins de points : le premier du classement encaisse le pire score.
  const ranked = [...players].sort(
    (a, b) => (deal.points[b] ?? 0) - (deal.points[a] ?? 0),
  )

  const scores: Record<PlayerId, number> = {}
  let i = 0
  while (i < ranked.length) {
    let j = i + 1
    while (j < ranked.length && (deal.points[ranked[j]] ?? 0) === (deal.points[ranked[i]] ?? 0)) {
      j++
    }
    const slice = scale.slice(i, j)
    const share = slice.reduce((sum, v) => sum + v, 0) / slice.length
    for (let k = i; k < j; k++) scores[ranked[k]] = share
    i = j
  }
  return scores
}

/**
 * Point d'entrée du moteur : rend les points gagnés ou perdus par chaque joueur sur une
 * donne. `players` doit contenir tous les joueurs de la table, dans l'ordre de jeu.
 */
export function scoreDeal(
  input: DealInput,
  players: PlayerId[],
  rules: RuleSet = DEFAULT_RULES,
): Record<PlayerId, number> {
  if (input.kind === 'vachette') return scoreVachette(input, players, rules)

  const scores = distributeContract(input, players, rules)
  applyMiseries(scores, input, players, rules)
  return scores
}

/** Cumul des scores au fil des donnes, dans l'ordre où elles ont été jouées. */
export function cumulative(
  deals: Pick<Deal, 'scores'>[],
  players: PlayerId[],
): Record<PlayerId, number> {
  const totals: Record<PlayerId, number> = {}
  for (const id of players) totals[id] = 0
  for (const deal of deals) {
    for (const id of players) totals[id] += deal.scores[id] ?? 0
  }
  return totals
}

/** Cumul après chaque donne — la série que trace la courbe d'évolution. */
export function cumulativeSeries(
  deals: Pick<Deal, 'scores'>[],
  players: PlayerId[],
): Record<PlayerId, number>[] {
  const running: Record<PlayerId, number> = {}
  for (const id of players) running[id] = 0
  return deals.map((deal) => {
    for (const id of players) running[id] += deal.scores[id] ?? 0
    return { ...running }
  })
}

/** Taille de poignée la plus élevée que ce nombre d'atouts autorise, ou `null`. */
export function maxHandful(
  trumps: number,
  playerCount: PlayerCount,
  rules: RuleSet = DEFAULT_RULES,
): 'simple' | 'double' | 'triple' | null {
  const thresholds = rules.handfulThresholds[playerCount]
  if (trumps >= thresholds.triple) return 'triple'
  if (trumps >= thresholds.double) return 'double'
  if (trumps >= thresholds.simple) return 'simple'
  return null
}

/** Vérifie qu'une saisie de vachette totalise bien les 91 points du jeu. */
export function vacheePointsRemaining(deal: VacheeDeal, players: PlayerId[]): number {
  const total = players.reduce((sum, id) => sum + (deal.points[id] ?? 0), 0)
  return TOTAL_POINTS - total
}
