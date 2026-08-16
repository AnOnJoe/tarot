import { describe, expect, it } from 'vitest'
import { contractDeal, vacheeDeal } from './deals.fixture'
import {
  byGame,
  defenderProfile,
  duels,
  formProfile,
  partnerships,
  takerProfile,
  vacheeProfile,
} from './insights'
import type { Deal } from './types'

describe('byGame', () => {
  it('range les parties par leur première donne, pas par leur identifiant', () => {
    const deals = [
      contractDeal({ gameId: 'zz', index: 0, createdAt: 10 }),
      contractDeal({ gameId: 'aa', index: 0, createdAt: 50 }),
    ]
    expect(byGame(deals).map((group) => group.gameId)).toEqual(['zz', 'aa'])
  })

  it('remet les donnes d’une partie dans leur ordre de jeu', () => {
    const deals = [
      contractDeal({ index: 2, createdAt: 3 }),
      contractDeal({ index: 0, createdAt: 1 }),
      contractDeal({ index: 1, createdAt: 2 }),
    ]
    expect(byGame(deals)[0].deals.map((deal) => deal.index)).toEqual([0, 1, 2])
  })
})

describe('takerProfile', () => {
  it('rapporte les prises à la part qu’une table égale aurait donnée', () => {
    // Trois donnes à quatre joueurs : la part de chacun vaut 3 × 1/4, soit 0,75 prise.
    const deals = [
      contractDeal({ index: 0, taker: 'a' }),
      contractDeal({ index: 1, taker: 'a' }),
      contractDeal({ index: 2, taker: 'b' }),
    ]
    const profile = takerProfile(deals, 'a')
    expect(profile.expectedTakes).toBeCloseTo(0.75)
    expect(profile.takes).toBe(2)
    // Deux prises pour trois quarts de part : « a » prend 2,67 fois sa part.
    expect(profile.appetite).toBeCloseTo(2 / 0.75)
  })

  it('mêle sans fausser les tables de tailles différentes', () => {
    const deals = [
      contractDeal({ gameId: 'g1', index: 0, table: ['a', 'b', 'c'], taker: 'a' }),
      contractDeal({ gameId: 'g2', index: 0, table: ['a', 'b', 'c', 'd', 'e'], taker: 'a' }),
    ]
    // 1/3 à trois joueurs, 1/5 à cinq : la part dépend de la table de chaque donne.
    expect(takerProfile(deals, 'a').expectedTakes).toBeCloseTo(1 / 3 + 1 / 5)
  })

  it('exclut les vachettes des donnes où prendre était possible', () => {
    const deals = [
      contractDeal({ index: 0, taker: 'a' }),
      vacheeDeal({ index: 1, standing: [['a'], ['b'], ['c'], ['d']] }),
    ]
    const profile = takerProfile(deals, 'a')
    expect(profile.deals).toBe(2)
    expect(profile.contractDeals).toBe(1)
    expect(profile.expectedTakes).toBeCloseTo(0.25)
  })

  it('lit la réussite sur le contrat, jamais sur le score', () => {
    // Le contrat chute — 40 points pour un seuil de 51 — mais le score du preneur est
    // forgé positif, comme le ferait une misère encaissée le même tour.
    const deals = [
      contractDeal({
        taker: 'a',
        oudlers: 1,
        attackPoints: 40,
        scores: { a: 12, b: -4, c: -4, d: -4 },
      }),
    ]
    const profile = takerProfile(deals, 'a')
    expect(profile.takes).toBe(1)
    expect(profile.won).toBe(0)
    expect(profile.marginLost).toBe(11)
    expect(profile.perTake).toBe(12)
  })

  it('sépare les marges de réussite et de chute', () => {
    const deals = [
      contractDeal({ index: 0, taker: 'a', oudlers: 1, attackPoints: 61 }), // +10
      contractDeal({ index: 1, taker: 'a', oudlers: 1, attackPoints: 41 }), // −10
      contractDeal({ index: 2, taker: 'a', oudlers: 1, attackPoints: 71 }), // +20
    ]
    const profile = takerProfile(deals, 'a')
    expect(profile.marginWon).toBe(15)
    expect(profile.marginLost).toBe(10)
  })

  it('ventile les prises par contrat et par bouts', () => {
    const deals = [
      contractDeal({ index: 0, taker: 'a', contract: 'petite', oudlers: 0, attackPoints: 60 }),
      contractDeal({ index: 1, taker: 'a', contract: 'garde', oudlers: 2, attackPoints: 30 }),
      contractDeal({ index: 2, taker: 'a', contract: 'garde', oudlers: 2, attackPoints: 50 }),
    ]
    const profile = takerProfile(deals, 'a')
    const garde = profile.byContract.find((line) => line.contract === 'garde')
    expect(garde).toMatchObject({ takes: 2, won: 1 })
    expect(profile.byOudlers.find((line) => line.oudlers === 2)).toEqual({
      oudlers: 2,
      takes: 2,
      won: 1,
    })
    // Un contrat jamais joué figure quand même, à zéro : l'écran n'a pas à combler les trous.
    expect(profile.byContract.find((line) => line.contract === 'gardeContre')).toEqual({
      contract: 'gardeContre',
      takes: 0,
      won: 0,
      perTake: null,
    })
  })

  it('ignore les donnes où le joueur n’était pas à la table', () => {
    const deals = [contractDeal({ table: ['b', 'c', 'd'], taker: 'b' })]
    expect(takerProfile(deals, 'a')).toMatchObject({ deals: 0, appetite: null, perTake: null })
  })
})

describe('defenderProfile', () => {
  it('ne compte pas l’appelé parmi les défenseurs', () => {
    const table = ['a', 'b', 'c', 'd', 'e']
    const deals = [contractDeal({ table, taker: 'a', partner: 'b', attackPoints: 60 })]
    expect(defenderProfile(deals, 'b')).toMatchObject({ defenses: 0, calls: 1, callsWon: 1 })
    expect(defenderProfile(deals, 'c')).toMatchObject({ defenses: 1, calls: 0 })
  })

  it('compte l’appelé comme défenseur quand le preneur s’est appelé lui-même', () => {
    const table = ['a', 'b', 'c', 'd', 'e']
    const deals = [contractDeal({ table, taker: 'a', partner: 'a', attackPoints: 60 })]
    expect(defenderProfile(deals, 'b')).toMatchObject({ defenses: 1, calls: 0 })
  })

  it('compte les prises adverses tombées pendant qu’il défendait', () => {
    const deals = [
      contractDeal({ index: 0, taker: 'b', oudlers: 1, attackPoints: 60 }), // tenu
      contractDeal({ index: 1, taker: 'b', oudlers: 1, attackPoints: 40 }), // chuté
    ]
    expect(defenderProfile(deals, 'a')).toMatchObject({ defenses: 2, broken: 1 })
  })

  it('laisse les moyennes à null plutôt qu’à zéro sur un effectif vide', () => {
    expect(defenderProfile([], 'a')).toMatchObject({ perDefense: null, perCall: null })
  })
})

describe('formProfile', () => {
  /** Une partie d'une seule donne, où « a » marque `total` face à « b ». */
  function soiree(gameId: string, createdAt: number, total: number): Deal {
    return contractDeal({
      gameId,
      createdAt,
      table: ['a', 'b'],
      scores: { a: total, b: -total },
    })
  }

  it('mesure une soirée en points par donne, pas en points', () => {
    const deals = [
      contractDeal({ gameId: 'g1', index: 0, table: ['a', 'b'], scores: { a: 10, b: -10 } }),
      contractDeal({ gameId: 'g1', index: 1, table: ['a', 'b'], scores: { a: 30, b: -30 } }),
      contractDeal({ gameId: 'g2', index: 0, table: ['a', 'b'], scores: { a: 30, b: -30 } }),
    ]
    const form = formProfile(deals, 'a')
    // Quarante points en deux donnes vaut moins que trente en une seule.
    expect(form.games.map((game) => game.rate)).toEqual([20, 30])
    expect(form.rate).toBe(25)
  })

  it('se tait sur la tendance tant qu’il n’y a pas de quoi comparer', () => {
    const deals = [1, 2, 3, 4, 5].map((n) => soiree(`g${n}`, n, 10))
    const form = formProfile(deals, 'a')
    expect(form.games).toHaveLength(5)
    expect(form.trend).toBeNull()
    expect(form.spread).toBeNull()
  })

  it('compare les dernières parties à l’ensemble', () => {
    // Trois soirées à +10, puis trois à +40 : la moyenne est 25, la forme du moment 40.
    const deals = [10, 10, 10, 40, 40, 40].map((total, i) => soiree(`g${i}`, i, total))
    const form = formProfile(deals, 'a')
    expect(form.rate).toBe(25)
    expect(form.recentRate).toBe(40)
    expect(form.trend).toBe(15)
    expect(form.spread).toBeCloseTo(15)
  })

  it('numérote les rangs à la sportive', () => {
    const deals = [
      contractDeal({
        table: ['a', 'b', 'c', 'd'],
        scores: { a: 10, b: 10, c: 0, d: -20 },
      }),
    ]
    expect(formProfile(deals, 'a').games[0].rank).toBe(1)
    expect(formProfile(deals, 'b').games[0].rank).toBe(1)
    // Deux ex æquo en tête : le suivant est troisième, pas deuxième.
    expect(formProfile(deals, 'c').games[0].rank).toBe(3)
  })

  it('retient la meilleure et la pire soirée', () => {
    const deals = [soiree('g1', 1, 10), soiree('g2', 2, -30), soiree('g3', 3, 50)]
    const form = formProfile(deals, 'a')
    expect(form.best?.total).toBe(50)
    expect(form.worst?.total).toBe(-30)
  })

  it('ne rend pas une pire soirée quand il n’y en a qu’une', () => {
    const form = formProfile([soiree('g1', 1, 10)], 'a')
    expect(form.best?.total).toBe(10)
    expect(form.worst).toBeNull()
  })
})

describe('duels', () => {
  it('ne compte que les parties réellement partagées', () => {
    const deals = [
      contractDeal({ gameId: 'g1', table: ['a', 'b'], scores: { a: 30, b: -30 } }),
      contractDeal({ gameId: 'g2', createdAt: 5, table: ['a', 'c'], scores: { a: 90, c: -90 } }),
    ]
    const [duel] = duels(deals, ['a', 'b'])
    expect(duel).toMatchObject({ games: 1, deals: 1, aheadA: 1, aheadB: 0, gapPerDeal: 60 })
  })

  it('additionne les donnes avant de désigner qui finit devant', () => {
    const deals = [
      contractDeal({ gameId: 'g1', index: 0, table: ['a', 'b'], scores: { a: -50, b: 50 } }),
      contractDeal({ gameId: 'g1', index: 1, table: ['a', 'b'], scores: { a: 60, b: -60 } }),
    ]
    const [duel] = duels(deals, ['a', 'b'])
    expect(duel).toMatchObject({ games: 1, aheadA: 1, aheadB: 0 })
  })

  it('ne donne la partie à personne en cas d’égalité', () => {
    const deals = [contractDeal({ table: ['a', 'b'], scores: { a: 0, b: 0 } })]
    const [duel] = duels(deals, ['a', 'b'])
    expect(duel).toMatchObject({ aheadA: 0, aheadB: 0 })
  })

  it('ne produit chaque paire qu’une fois', () => {
    const deals = [contractDeal({ table: ['a', 'b', 'c'], scores: { a: 20, b: -10, c: -10 } })]
    expect(duels(deals, ['a', 'b', 'c'])).toHaveLength(3)
  })
})

describe('partnerships', () => {
  it('rassemble les deux sens d’un même attelage', () => {
    const table = ['a', 'b', 'c', 'd', 'e']
    const deals = [
      contractDeal({ index: 0, table, taker: 'a', partner: 'b', attackPoints: 60 }),
      contractDeal({ index: 1, table, taker: 'b', partner: 'a', attackPoints: 30 }),
    ]
    const pairs = partnerships(deals)
    expect(pairs).toHaveLength(1)
    expect(pairs[0]).toMatchObject({ takes: 2, won: 1 })
  })

  it('ignore le preneur qui s’est appelé lui-même', () => {
    const table = ['a', 'b', 'c', 'd', 'e']
    expect(partnerships([contractDeal({ table, taker: 'a', partner: 'a' })])).toEqual([])
  })
})

describe('vacheeProfile', () => {
  it('moyenne les points de vachette et ignore les contrats', () => {
    const deals = [
      vacheeDeal({ index: 0, standing: [['a'], ['b'], ['c'], ['d']] }),
      vacheeDeal({ index: 1, standing: [['d'], ['c'], ['b'], ['a']] }),
      contractDeal({ index: 2, taker: 'a' }),
    ]
    // Premier puis dernier : +120 et −120, soit une moyenne nulle sur deux vachettes.
    expect(vacheeProfile(deals, 'a')).toEqual({ playerId: 'a', deals: 2, perDeal: 0 })
  })
})
