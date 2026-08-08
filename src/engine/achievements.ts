import { contractBreakdown } from './score'
import type { Deal, DealInput, PlayerId, RuleSet } from './types'
import { DEFAULT_RULES } from './rules'

/** Un haut fait, et ce qu'il faut accomplir pour le décrocher. */
export interface AchievementDef {
  id: string
  title: string
  hint: string
  /** Les exploits rares méritent d'être mis en avant au moment où ils tombent. */
  rare: boolean
}

/** Un haut fait, confronté à l'historique. */
export interface AchievementState {
  def: AchievementDef
  /** Nombre de fois décroché, par joueur. */
  byPlayer: Record<PlayerId, number>
  total: number
}

/**
 * Les hauts faits sont propres au tarot : ils célèbrent des coups que seul ce jeu produit,
 * pas des paliers arbitraires du genre « jouez cent parties ».
 */
export const ACHIEVEMENTS: AchievementDef[] = [
  {
    id: 'chelem',
    title: 'Chelem annoncé',
    hint: "Annoncer le chelem et le réussir.",
    rare: true,
  },
  {
    id: 'chelemSurprise',
    title: 'Chelem sans le dire',
    hint: 'Réussir tous les plis sans avoir annoncé le chelem.',
    rare: true,
  },
  {
    id: 'gardeContre',
    title: 'Garde contre',
    hint: 'Prendre garde contre et tenir le contrat.',
    rare: true,
  },
  {
    id: 'triplePoignee',
    title: 'Triple poignée',
    hint: "Annoncer une triple poignée.",
    rare: true,
  },
  {
    id: 'auPointPres',
    title: 'Au point près',
    hint: 'Réaliser exactement son contrat, ni plus ni moins.',
    rare: true,
  },
  {
    id: 'petitAuBout',
    title: 'Petit au bout',
    hint: 'Mener le petit au dernier pli en attaque.',
    rare: false,
  },
  {
    id: 'vachetteReine',
    title: 'Reine de la vachette',
    hint: 'Finir en tête d’une vachette.',
    rare: false,
  },
  {
    id: 'sansFaute',
    title: 'Trois sur trois',
    hint: 'Réussir trois prises d’affilée dans une même partie.',
    rare: false,
  },
  {
    id: 'remontada',
    title: 'Remontada',
    hint: 'Être dernier à mi-partie et finir premier.',
    rare: true,
  },
  {
    id: 'chuteLibre',
    title: 'Chute libre',
    hint: 'Chuter de trente points ou plus.',
    rare: false,
  },
  {
    id: 'marathon',
    title: 'Marathon',
    hint: 'Aller au bout d’une partie de vingt donnes.',
    rare: false,
  },
]

/** Ajoute une occurrence à un joueur, en créant l'entrée au besoin. */
function award(
  tally: Record<string, Record<PlayerId, number>>,
  id: string,
  playerId: PlayerId,
): void {
  const byPlayer = (tally[id] ??= {})
  byPlayer[playerId] = (byPlayer[playerId] ?? 0) + 1
}

/** Classement d'un jeu de donnes, du meilleur score au moins bon. */
function standings(deals: Deal[], playerIds: PlayerId[]): PlayerId[] {
  const totals: Record<PlayerId, number> = {}
  for (const id of playerIds) totals[id] = 0
  for (const deal of deals) {
    for (const id of playerIds) totals[id] += deal.scores[id] ?? 0
  }
  return [...playerIds].sort((a, b) => totals[b] - totals[a])
}

/**
 * Confronte l'historique aux hauts faits.
 *
 * Les donnes sont regroupées par partie : « trois prises d'affilée » ou « remontada »
 * n'ont de sens qu'à l'intérieur d'une même soirée, pas à travers l'historique entier.
 */
export function achievements(
  deals: Deal[],
  rules: RuleSet = DEFAULT_RULES,
): AchievementState[] {
  const tally: Record<string, Record<PlayerId, number>> = {}

  const byGame = new Map<string, Deal[]>()
  for (const deal of deals) {
    const list = byGame.get(deal.gameId)
    if (list) list.push(deal)
    else byGame.set(deal.gameId, [deal])
  }

  for (const gameDeals of byGame.values()) {
    const ordered = [...gameDeals].sort((a, b) => a.index - b.index)
    const playerIds = [...new Set(ordered.flatMap((d) => Object.keys(d.scores)))]

    // Prises réussies consécutives, par joueur, à l'intérieur de la partie.
    const streak: Record<PlayerId, number> = {}
    const streakAwarded = new Set<PlayerId>()

    for (const deal of ordered) {
      if (deal.input.kind === 'vachette') {
        // Le barème est symétrique : le mieux classé est celui qui marque le plus.
        let best: PlayerId | null = null
        for (const [id, score] of Object.entries(deal.scores)) {
          if (best === null || score > deal.scores[best]) best = id
        }
        if (best !== null && (deal.scores[best] ?? 0) > 0) award(tally, 'vachetteReine', best)
        continue
      }

      const input = deal.input
      const taker = input.takerId
      const breakdown = contractBreakdown(input, rules)

      if (input.slam === 'annonceReussi') award(tally, 'chelem', taker)
      if (input.slam === 'nonAnnonceReussi') award(tally, 'chelemSurprise', taker)
      if (input.contract === 'gardeContre' && breakdown.success) {
        award(tally, 'gardeContre', taker)
      }
      if (breakdown.success && breakdown.diff === 0) award(tally, 'auPointPres', taker)
      if (input.petitAuBout === 'attaque') award(tally, 'petitAuBout', taker)
      if (!breakdown.success && Math.abs(breakdown.diff) >= 30) {
        award(tally, 'chuteLibre', taker)
      }
      for (const handful of input.handfuls) {
        if (handful.kind === 'triple') award(tally, 'triplePoignee', handful.playerId)
      }

      // Une seule récompense par partie et par joueur : la série n'est pas une rente.
      streak[taker] = breakdown.success ? (streak[taker] ?? 0) + 1 : 0
      if (streak[taker] >= 3 && !streakAwarded.has(taker)) {
        award(tally, 'sansFaute', taker)
        streakAwarded.add(taker)
      }
    }

    if (ordered.length >= 20) {
      for (const id of playerIds) award(tally, 'marathon', id)
    }

    // Remontada : dernier à mi-parcours, premier à l'arrivée.
    if (ordered.length >= 4) {
      const half = standings(ordered.slice(0, Math.floor(ordered.length / 2)), playerIds)
      const final = standings(ordered, playerIds)
      if (half.length > 1 && half[half.length - 1] === final[0]) {
        award(tally, 'remontada', final[0])
      }
    }
  }

  return ACHIEVEMENTS.map((def) => {
    const byPlayer = tally[def.id] ?? {}
    return {
      def,
      byPlayer,
      total: Object.values(byPlayer).reduce((sum, n) => sum + n, 0),
    }
  })
}

/** Identifiants décrochés au moins une fois — de quoi repérer les nouveaux. */
export function unlockedIds(states: AchievementState[]): string[] {
  return states.filter((state) => state.total > 0).map((state) => state.def.id)
}

/**
 * Faits d'armes d'une donne isolée, pour l'annonce qui suit sa validation.
 * Rendus dans l'ordre où on aimerait les entendre à table.
 */
export function dealHighlights(
  input: DealInput,
  rules: RuleSet = DEFAULT_RULES,
): string[] {
  if (input.kind === 'vachette') return []
  const breakdown = contractBreakdown(input, rules)
  const feats: string[] = []

  if (input.slam === 'annonceReussi') feats.push('Chelem annoncé et réussi')
  else if (input.slam === 'nonAnnonceReussi') feats.push('Chelem sans annonce')
  else if (input.slam === 'annonceChute') feats.push('Chelem annoncé et manqué')

  if (input.contract === 'gardeContre' && breakdown.success) feats.push('Garde contre tenue')
  if (input.handfuls.some((h) => h.kind === 'triple')) feats.push('Triple poignée')
  if (breakdown.success && breakdown.diff === 0) feats.push('Contrat au point près')
  if (!breakdown.success && Math.abs(breakdown.diff) >= 30) feats.push('Chute libre')

  return feats
}
