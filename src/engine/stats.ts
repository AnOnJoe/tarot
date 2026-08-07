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
