import { describe, expect, it } from 'vitest'
import { ACHIEVEMENTS, achievements, dealHighlights, unlockedIds } from './achievements'
import { scoreDeal } from './score'
import type { ContractDeal, Deal, DealInput, PlayerId } from './types'

const P4 = ['a', 'b', 'c', 'd']

let counter = 0

/** Construit une donne complète, scores compris, comme le ferait l'application. */
function makeDeal(input: Partial<ContractDeal>, gameId = 'g1', index = counter++): Deal {
  const full: ContractDeal = {
    kind: 'contrat',
    contract: 'garde',
    takerId: 'a',
    partnerId: null,
    oudlers: 2,
    attackPoints: 45,
    petitAuBout: null,
    handfuls: [],
    slam: 'aucun',
    miseries: [],
    ...input,
  }
  return {
    id: `d${index}-${gameId}`,
    gameId,
    index,
    dealerId: 'a',
    input: full,
    scores: scoreDeal(full, P4),
    createdAt: index,
  }
}

/** `standing` se lit du moins de points au plus de points. */
function vachette(standing: PlayerId[][], gameId = 'g1', index = counter++): Deal {
  const input: DealInput = { kind: 'vachette', standing }
  return {
    id: `v${index}`,
    gameId,
    index,
    dealerId: 'a',
    input,
    scores: scoreDeal(input, P4),
    createdAt: index,
  }
}

/** Occurrences d'un haut fait pour un joueur donné. */
function count(deals: Deal[], id: string, playerId: PlayerId): number {
  return achievements(deals).find((s) => s.def.id === id)?.byPlayer[playerId] ?? 0
}

describe('hauts faits', () => {
  it('distingue le chelem annoncé de la surprise', () => {
    const deals = [
      makeDeal({ slam: 'annonceReussi' }),
      makeDeal({ takerId: 'b', slam: 'nonAnnonceReussi' }),
      makeDeal({ takerId: 'c', slam: 'annonceChute' }),
    ]
    expect(count(deals, 'chelem', 'a')).toBe(1)
    expect(count(deals, 'chelemSurprise', 'b')).toBe(1)
    // Un chelem manqué n'est pas un haut fait.
    expect(count(deals, 'chelem', 'c')).toBe(0)
  })

  it('ne récompense la garde contre que si elle passe', () => {
    const deals = [
      makeDeal({ contract: 'gardeContre', attackPoints: 50 }),
      makeDeal({ takerId: 'b', contract: 'gardeContre', attackPoints: 30 }),
    ]
    expect(count(deals, 'gardeContre', 'a')).toBe(1)
    expect(count(deals, 'gardeContre', 'b')).toBe(0)
  })

  it('attribue la triple poignée à celui qui l’annonce, pas au preneur', () => {
    const deals = [makeDeal({ handfuls: [{ playerId: 'c', kind: 'triple' }] })]
    expect(count(deals, 'triplePoignee', 'c')).toBe(1)
    expect(count(deals, 'triplePoignee', 'a')).toBe(0)
  })

  it('reconnaît le contrat réalisé au point près', () => {
    const deals = [makeDeal({ oudlers: 2, attackPoints: 41 })]
    expect(count(deals, 'auPointPres', 'a')).toBe(1)
    // Un demi-point de plus n'est plus « au point près ».
    expect(count([makeDeal({ oudlers: 2, attackPoints: 41.5 })], 'auPointPres', 'a')).toBe(0)
  })

  it('compte la chute libre à partir de trente points', () => {
    expect(count([makeDeal({ oudlers: 2, attackPoints: 11 })], 'chuteLibre', 'a')).toBe(1)
    expect(count([makeDeal({ oudlers: 2, attackPoints: 12 })], 'chuteLibre', 'a')).toBe(0)
  })

  it('couronne le mieux classé d’une vachette', () => {
    const deals = [vachette([['d'], ['c'], ['b'], ['a']])]
    // Le barème donne +120 au joueur qui a le moins de points, ici « d ».
    expect(count(deals, 'vachetteReine', 'd')).toBe(1)
    expect(count(deals, 'vachetteReine', 'a')).toBe(0)
  })

  it('demande trois prises réussies d’affilée, une seule fois par partie', () => {
    const suite = [
      makeDeal({ attackPoints: 50 }),
      makeDeal({ attackPoints: 50 }),
      makeDeal({ attackPoints: 50 }),
      makeDeal({ attackPoints: 50 }),
    ]
    expect(count(suite, 'sansFaute', 'a')).toBe(1)
  })

  it('rompt la série sur une chute', () => {
    const deals = [
      makeDeal({ attackPoints: 50 }),
      makeDeal({ attackPoints: 20 }),
      makeDeal({ attackPoints: 50 }),
      makeDeal({ attackPoints: 50 }),
    ]
    expect(count(deals, 'sansFaute', 'a')).toBe(0)
  })

  it('ne fait pas courir une série d’une partie à l’autre', () => {
    const deals = [
      makeDeal({ attackPoints: 50 }, 'g1', 0),
      makeDeal({ attackPoints: 50 }, 'g1', 1),
      makeDeal({ attackPoints: 50 }, 'g2', 0),
      makeDeal({ attackPoints: 50 }, 'g2', 1),
    ]
    expect(count(deals, 'sansFaute', 'a')).toBe(0)
  })

  it('décerne la remontada au dernier de la mi-partie qui finit premier', () => {
    // b encaisse deux chutes, puis rafle tout : dernier à mi-course, premier au bout.
    const deals = [
      makeDeal({ takerId: 'b', attackPoints: 20 }, 'g1', 0),
      makeDeal({ takerId: 'b', attackPoints: 20 }, 'g1', 1),
      makeDeal({ takerId: 'b', contract: 'gardeContre', attackPoints: 85 }, 'g1', 2),
      makeDeal({ takerId: 'b', contract: 'gardeContre', attackPoints: 85 }, 'g1', 3),
    ]
    expect(count(deals, 'remontada', 'b')).toBe(1)
  })

  it('récompense le marathon à partir de vingt donnes, pour toute la table', () => {
    const deals = Array.from({ length: 20 }, (_, i) => makeDeal({}, 'gm', i))
    for (const id of P4) expect(count(deals, 'marathon', id)).toBe(1)
    expect(count(Array.from({ length: 19 }, (_, i) => makeDeal({}, 'gs', i)), 'marathon', 'a')).toBe(0)
  })

  it('rend tous les hauts faits, décrochés ou non', () => {
    const states = achievements([])
    expect(states).toHaveLength(ACHIEVEMENTS.length)
    expect(states.every((s) => s.total === 0)).toBe(true)
    expect(unlockedIds(states)).toEqual([])
  })

  it('liste les identifiants effectivement décrochés', () => {
    const states = achievements([makeDeal({ slam: 'annonceReussi' })])
    expect(unlockedIds(states)).toContain('chelem')
    expect(unlockedIds(states)).not.toContain('marathon')
  })
})

describe('faits marquants d’une donne', () => {
  it('annonce le chelem et la garde contre', () => {
    const deal = makeDeal({ contract: 'gardeContre', attackPoints: 91, slam: 'annonceReussi' })
    expect(dealHighlights(deal.input)).toEqual([
      'Chelem annoncé et réussi',
      'Garde contre tenue',
    ])
  })

  it('signale aussi les échecs spectaculaires', () => {
    expect(dealHighlights(makeDeal({ oudlers: 2, attackPoints: 5 }).input)).toContain(
      'Chute libre',
    )
    expect(dealHighlights(makeDeal({ slam: 'annonceChute' }).input)).toContain(
      'Chelem annoncé et manqué',
    )
  })

  it('ne trouve rien à dire d’une donne ordinaire', () => {
    expect(dealHighlights(makeDeal({}).input)).toEqual([])
  })

  it('reste muet sur une vachette', () => {
    expect(dealHighlights(vachette([['a'], ['b'], ['c'], ['d']]).input)).toEqual([])
  })
})
