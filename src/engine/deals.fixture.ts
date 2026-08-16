/**
 * Fabriques de donnes, pour les tests du moteur.
 *
 * Ce module n'est importé que par des fichiers de test — il vit dans `engine/` pour partager
 * leurs types plutôt que pour être embarqué : rien de l'application ne l'appelle, et le
 * bundle ne le contient pas.
 *
 * Les scores sont calculés par `scoreDeal`, comme à la validation d'une vraie donne. Le
 * paramètre `scores` permet malgré tout de les forger : certains cas n'existent que là où le
 * score et le contrat racontent deux histoires différentes.
 */

import { scoreDeal } from './score'
import type { Contract, Deal, Oudlers, PlayerId } from './types'

export interface ContractDealOptions {
  gameId?: string
  index?: number
  createdAt?: number
  table?: PlayerId[]
  taker?: PlayerId
  /** L'appelé à 5 joueurs. Égal au preneur, il joue seul contre quatre. */
  partner?: PlayerId | null
  contract?: Contract
  oudlers?: Oudlers
  attackPoints?: number
  scores?: Record<PlayerId, number>
}

export function contractDeal(options: ContractDealOptions = {}): Deal {
  const table = options.table ?? ['a', 'b', 'c', 'd']
  const index = options.index ?? 0
  const input = {
    kind: 'contrat' as const,
    contract: options.contract ?? 'garde',
    takerId: options.taker ?? table[0],
    partnerId: options.partner ?? null,
    oudlers: options.oudlers ?? 1,
    attackPoints: options.attackPoints ?? 60,
    petitAuBout: null,
    handfuls: [],
    slam: 'aucun' as const,
    miseries: [],
  }
  const gameId = options.gameId ?? 'g1'
  return {
    id: `${gameId}-${index}`,
    gameId,
    index,
    dealerId: table[0],
    input,
    scores: options.scores ?? scoreDeal(input, table),
    createdAt: options.createdAt ?? index,
  }
}

export interface VacheeDealOptions {
  gameId?: string
  index?: number
  createdAt?: number
  table?: PlayerId[]
  /** Du moins de points au plus de points, comme la table l'annonce. */
  standing: PlayerId[][]
}

export function vacheeDeal(options: VacheeDealOptions): Deal {
  const table = options.table ?? ['a', 'b', 'c', 'd']
  const index = options.index ?? 0
  const input = { kind: 'vachette' as const, standing: options.standing }
  const gameId = options.gameId ?? 'g1'
  return {
    id: `${gameId}-v${index}`,
    gameId,
    index,
    dealerId: table[0],
    input,
    scores: scoreDeal(input, table),
    createdAt: options.createdAt ?? index,
  }
}
