import { describe, expect, it } from 'vitest'
import { playerRecord } from './stats'
import type { Deal } from './types'

/** Une donne réduite à ce que le palmarès regarde : sa partie et ses scores. */
function deal(gameId: string, index: number, scores: Record<string, number>): Deal {
  return {
    id: `${gameId}-${index}`,
    gameId,
    index,
    dealerId: 'a',
    input: {
      kind: 'contrat',
      contract: 'garde',
      takerId: 'a',
      partnerId: null,
      oudlers: 1,
      attackPoints: 55,
      petitAuBout: null,
      handfuls: [],
      slam: 'aucun',
      miseries: [],
    },
    scores,
    createdAt: index,
  }
}

describe('playerRecord', () => {
  it('ne compte rien quand le joueur n’a jamais marqué', () => {
    const deals = [deal('g1', 0, { b: 10, c: -10 })]
    expect(playerRecord(deals, 'a')).toEqual({
      gamesPlayed: 0,
      gamesWon: 0,
      bestGame: null,
    })
  })

  it('additionne les donnes d’une même partie avant de désigner le vainqueur', () => {
    // « a » perd la première donne mais l'emporte au cumul : c'est le total qui tranche.
    const deals = [
      deal('g1', 0, { a: -20, b: 20 }),
      deal('g1', 1, { a: 50, b: -50 }),
    ]
    expect(playerRecord(deals, 'a')).toEqual({
      gamesPlayed: 1,
      gamesWon: 1,
      bestGame: 30,
    })
    expect(playerRecord(deals, 'b')).toEqual({
      gamesPlayed: 1,
      gamesWon: 0,
      bestGame: -30,
    })
  })

  it('compte une victoire à chacun des ex æquo', () => {
    const deals = [deal('g1', 0, { a: 10, b: 10, c: -20 })]
    expect(playerRecord(deals, 'a').gamesWon).toBe(1)
    expect(playerRecord(deals, 'b').gamesWon).toBe(1)
    expect(playerRecord(deals, 'c').gamesWon).toBe(0)
  })

  it('sépare les parties', () => {
    const deals = [
      deal('g1', 0, { a: 30, b: -30 }),
      deal('g2', 0, { a: -40, b: 40 }),
      deal('g3', 0, { a: 5, b: -5 }),
    ]
    expect(playerRecord(deals, 'a')).toEqual({
      gamesPlayed: 3,
      gamesWon: 2,
      bestGame: 30,
    })
  })

  it('ignore les parties où le joueur n’était pas à la table', () => {
    const deals = [deal('g1', 0, { a: 10, b: -10 }), deal('g2', 0, { b: 10, c: -10 })]
    expect(playerRecord(deals, 'a').gamesPlayed).toBe(1)
  })

  it('retient le meilleur total, pas le dernier', () => {
    const deals = [
      deal('g1', 0, { a: 100, b: -100 }),
      deal('g2', 0, { a: 20, b: -20 }),
    ]
    expect(playerRecord(deals, 'a').bestGame).toBe(100)
  })
})
