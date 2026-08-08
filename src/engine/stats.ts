import type { Contract, Deal, PlayerId } from './types'

/** Ce qu'on sait d'un joueur une fois toutes les donnes dépouillées. */
export interface PlayerStats {
  playerId: PlayerId
  /** Somme de tous les points marqués, toutes parties confondues. */
  total: number
  dealsPlayed: number
  /** Donnes où ce joueur était preneur. */
  takes: number
  takesWon: number
  /** Contrats choisis quand il a pris. */
  contracts: Record<Contract, number>
  /** Points moyens par donne, selon qu'il attaquait ou défendait. */
  averageAttack: number
  averageDefense: number
}

/** Vue d'ensemble d'un jeu de donnes, indépendamment des joueurs. */
export interface DealStats {
  total: number
  attackWins: number
  defenseWins: number
  vachettes: number
  slams: number
  handfuls: number
  petitsAuBout: number
}

const EMPTY_CONTRACTS: Record<Contract, number> = {
  petite: 0,
  pousse: 0,
  garde: 0,
  gardeSans: 0,
  gardeContre: 0,
}

/**
 * Dépouille les donnes joueur par joueur.
 *
 * Une donne ne compte pour un joueur que s'il y figure : les parties d'une table à quatre
 * et celles d'une table à cinq se mélangent donc sans fausser les moyennes.
 */
export function playerStats(deals: Deal[], playerIds: PlayerId[]): PlayerStats[] {
  return playerIds.map((playerId) => {
    const contracts = { ...EMPTY_CONTRACTS }
    let total = 0
    let dealsPlayed = 0
    let takes = 0
    let takesWon = 0
    let attackSum = 0
    let attackCount = 0
    let defenseSum = 0
    let defenseCount = 0

    for (const deal of deals) {
      const score = deal.scores[playerId]
      if (score === undefined) continue
      total += score
      dealsPlayed++

      if (deal.input.kind === 'vachette') continue

      const isTaker = deal.input.takerId === playerId
      const isPartner =
        deal.input.partnerId === playerId && deal.input.partnerId !== deal.input.takerId

      if (isTaker) {
        takes++
        contracts[deal.input.contract]++
        if (score > 0) takesWon++
      }

      if (isTaker || isPartner) {
        attackSum += score
        attackCount++
      } else {
        defenseSum += score
        defenseCount++
      }
    }

    return {
      playerId,
      total,
      dealsPlayed,
      takes,
      takesWon,
      contracts,
      averageAttack: attackCount ? attackSum / attackCount : 0,
      averageDefense: defenseCount ? defenseSum / defenseCount : 0,
    }
  })
}

/** Le palmarès d'un joueur, partie par partie plutôt que donne par donne. */
export interface PlayerRecord {
  gamesPlayed: number
  /**
   * Parties terminées en tête, **égalités comprises** : à deux ex æquo, les deux comptent
   * une victoire. Départager arbitrairement serait pire que d'admettre le partage.
   */
  gamesWon: number
  /** Meilleur total sur une partie, ou `null` si le joueur n'en a jamais fini une. */
  bestGame: number | null
}

/**
 * Dépouille les donnes partie par partie pour un seul joueur.
 *
 * Une partie sans donne ne compte pas : elle a été ouverte, jamais jouée, et la faire
 * figurer au palmarès reviendrait à compter une soirée qui n'a pas eu lieu.
 */
export function playerRecord(deals: Deal[], playerId: PlayerId): PlayerRecord {
  const byGame = new Map<string, Deal[]>()
  for (const deal of deals) {
    const group = byGame.get(deal.gameId)
    if (group) group.push(deal)
    else byGame.set(deal.gameId, [deal])
  }

  let gamesPlayed = 0
  let gamesWon = 0
  let bestGame: number | null = null

  for (const group of byGame.values()) {
    const totals = new Map<PlayerId, number>()
    let present = false
    for (const deal of group) {
      for (const [id, score] of Object.entries(deal.scores)) {
        totals.set(id, (totals.get(id) ?? 0) + score)
      }
      if (deal.scores[playerId] !== undefined) present = true
    }
    if (!present) continue

    gamesPlayed++
    const mine = totals.get(playerId) ?? 0
    if (bestGame === null || mine > bestGame) bestGame = mine
    if (mine === Math.max(...totals.values())) gamesWon++
  }

  return { gamesPlayed, gamesWon, bestGame }
}

/** Compte les faits marquants de l'ensemble des donnes. */
export function dealStats(deals: Deal[]): DealStats {
  const stats: DealStats = {
    total: deals.length,
    attackWins: 0,
    defenseWins: 0,
    vachettes: 0,
    slams: 0,
    handfuls: 0,
    petitsAuBout: 0,
  }

  for (const deal of deals) {
    if (deal.input.kind === 'vachette') {
      stats.vachettes++
      continue
    }
    if ((deal.scores[deal.input.takerId] ?? 0) > 0) stats.attackWins++
    else stats.defenseWins++
    if (deal.input.slam !== 'aucun') stats.slams++
    stats.handfuls += deal.input.handfuls.length
    if (deal.input.petitAuBout !== null) stats.petitsAuBout++
  }

  return stats
}
