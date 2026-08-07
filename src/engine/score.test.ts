import { describe, expect, it } from 'vitest'
import { DEFAULT_RULES } from './rules'
import {
  contractBreakdown,
  cumulative,
  cumulativeSeries,
  maxHandful,
  scoreDeal,
  scoreVachette,
  vacheePointsRemaining,
} from './score'
import type { ContractDeal, Contract, Oudlers, PlayerId, SlamState } from './types'

const P3 = ['a', 'b', 'c']
const P4 = ['a', 'b', 'c', 'd']
const P5 = ['a', 'b', 'c', 'd', 'e']

function deal(overrides: Partial<ContractDeal> = {}): ContractDeal {
  return {
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
    ...overrides,
  }
}

function sum(scores: Record<PlayerId, number>): number {
  return Object.values(scores).reduce((total, value) => total + value, 0)
}

describe('seuils de réussite', () => {
  it.each([
    [0, 56],
    [1, 51],
    [2, 41],
    [3, 36],
  ])('avec %i bout(s), il faut %i points', (oudlers, threshold) => {
    expect(contractBreakdown(deal({ oudlers: oudlers as Oudlers })).threshold).toBe(threshold)
  })

  it('traite le contrat réalisé au point près comme une réussite', () => {
    const b = contractBreakdown(deal({ oudlers: 2, attackPoints: 41 }))
    expect(b.success).toBe(true)
    expect(b.diff).toBe(0)
    expect(b.base).toBe(25)
    expect(b.unit).toBe(50) // 25 × garde
  })

  it('traite un demi-point manquant comme une chute', () => {
    const b = contractBreakdown(deal({ oudlers: 2, attackPoints: 40.5 }))
    expect(b.success).toBe(false)
    expect(b.diff).toBe(-0.5)
    expect(b.base).toBe(-25.5)
  })
})

describe('multiplicateurs de contrat', () => {
  // Assiette constante de 29 points (2 bouts, 45 points réalisés) sur les cinq contrats.
  it.each<[Contract, number]>([
    ['petite', 29],
    ['pousse', 43.5],
    ['garde', 58],
    ['gardeSans', 116],
    ['gardeContre', 174],
  ])('%s vaut %d points', (contract, expected) => {
    expect(contractBreakdown(deal({ contract })).unit).toBe(expected)
  })

  it('la pousse produit des quarts de point sans perte à la table', () => {
    const scores = scoreDeal(
      deal({ contract: 'pousse', oudlers: 1, attackPoints: 51.5 }),
      P4,
    )
    expect(scores.a).toBe(114.75)
    expect(scores.b).toBe(-38.25)
    expect(sum(scores)).toBe(0)
  })
})

describe('petit au bout', () => {
  it("s'ajoute à l'assiette avant multiplication quand l'attaque le réalise", () => {
    const b = contractBreakdown(deal({ petitAuBout: 'attaque' }))
    expect(b.base).toBe(39)
    expect(b.unit).toBe(78)
  })

  it("se retranche quand la défense le réalise", () => {
    const b = contractBreakdown(deal({ petitAuBout: 'defense' }))
    expect(b.base).toBe(19)
    expect(b.unit).toBe(38)
  })

  it("adoucit une chute lorsque l'attaque le réalise malgré tout", () => {
    const b = contractBreakdown(deal({ attackPoints: 35, petitAuBout: 'attaque' }))
    expect(b.diff).toBe(-6)
    expect(b.base).toBe(-21) // -(25 + 6) + 10
    expect(b.unit).toBe(-42)
  })
})

describe('poignées', () => {
  it("s'ajoutent après multiplication", () => {
    const b = contractBreakdown(
      deal({ handfuls: [{ playerId: 'a', kind: 'simple' }] }),
    )
    expect(b.handful).toBe(20)
    expect(b.unit).toBe(78) // 29 × 2 + 20
  })

  it('reviennent au camp vainqueur même annoncées par le camp perdant', () => {
    const annoncéeParLaDéfense = deal({
      handfuls: [{ playerId: 'b', kind: 'double' }],
    })
    // L'attaque gagne : la poignée de la défense profite tout de même à l'attaque.
    expect(contractBreakdown(annoncéeParLaDéfense).handful).toBe(30)

    // L'attaque chute : la prime bascule du côté de la défense.
    const chute = contractBreakdown(
      deal({ attackPoints: 30, handfuls: [{ playerId: 'a', kind: 'double' }] }),
    )
    expect(chute.handful).toBe(-30)
    expect(chute.unit).toBe(-102) // -(25 + 11) × 2 - 30
  })

  it('cumule plusieurs poignées', () => {
    const b = contractBreakdown(
      deal({
        handfuls: [
          { playerId: 'a', kind: 'simple' },
          { playerId: 'c', kind: 'triple' },
        ],
      }),
    )
    expect(b.handful).toBe(60)
  })

  it('reconnaît la taille de poignée autorisée par le nombre d\'atouts', () => {
    expect(maxHandful(9, 4)).toBeNull()
    expect(maxHandful(10, 4)).toBe('simple')
    expect(maxHandful(13, 4)).toBe('double')
    expect(maxHandful(15, 4)).toBe('triple')
    expect(maxHandful(8, 5)).toBe('simple')
    expect(maxHandful(13, 3)).toBe('simple')
  })
})

describe('chelem', () => {
  it.each<[SlamState, number]>([
    ['aucun', 0],
    ['annonceReussi', 400],
    ['nonAnnonceReussi', 200],
    ['annonceChute', -200],
  ])('%s vaut %d points', (slam, expected) => {
    expect(contractBreakdown(deal({ slam })).slam).toBe(expected)
  })
})

describe('répartition entre joueurs', () => {
  it('à 4 joueurs, le preneur affronte trois défenseurs', () => {
    const scores = scoreDeal(deal(), P4)
    expect(scores).toEqual({ a: 174, b: -58, c: -58, d: -58 })
    expect(sum(scores)).toBe(0)
  })

  it('à 3 joueurs, le preneur affronte deux défenseurs', () => {
    const scores = scoreDeal(deal(), P3)
    expect(scores).toEqual({ a: 116, b: -58, c: -58 })
  })

  it("à 5 joueurs, l'appelé prend une part sur les trois du preneur", () => {
    const scores = scoreDeal(deal({ partnerId: 'b' }), P5)
    expect(scores).toEqual({ a: 116, b: 58, c: -58, d: -58, e: -58 })
    expect(sum(scores)).toBe(0)
  })

  it('à 5 joueurs, le preneur qui s\'appelle lui-même joue seul contre quatre', () => {
    const scores = scoreDeal(deal({ partnerId: null }), P5)
    expect(scores).toEqual({ a: 232, b: -58, c: -58, d: -58, e: -58 })
  })

  it('traite le preneur désigné comme son propre appelé comme un joueur seul', () => {
    expect(scoreDeal(deal({ partnerId: 'a' }), P5)).toEqual(
      scoreDeal(deal({ partnerId: null }), P5),
    )
  })

  it('inverse les rôles quand le preneur chute', () => {
    const scores = scoreDeal(deal({ attackPoints: 30 }), P4)
    expect(scores).toEqual({ a: -216, b: 72, c: 72, d: 72 })
  })
})

describe('misères', () => {
  it('font verser la prime par chacun des autres joueurs', () => {
    const scores = scoreDeal(
      deal({ miseries: [{ playerId: 'c', kind: 'atout' }] }),
      P4,
    )
    // Le preneur verse lui aussi la prime : 174 − 10.
    expect(scores).toEqual({ a: 164, b: -68, c: -28, d: -68 })
    expect(sum(scores)).toBe(0)
  })

  it('se cumulent et restent indépendantes du résultat de la donne', () => {
    const scores = scoreDeal(
      deal({
        miseries: [
          { playerId: 'b', kind: 'atout' },
          { playerId: 'b', kind: 'tete' },
        ],
      }),
      P4,
    )
    expect(scores.b).toBe(-58 + 60)
    expect(sum(scores)).toBe(0)
  })

  it('sont ignorées quand la règle est désactivée', () => {
    const rules = { ...DEFAULT_RULES, miseryEnabled: false }
    const scores = scoreDeal(
      deal({ miseries: [{ playerId: 'c', kind: 'atout' }] }),
      P4,
      rules,
    )
    expect(scores).toEqual({ a: 174, b: -58, c: -58, d: -58 })
  })
})

describe('vachette', () => {
  it('à 4 joueurs, celui qui ramasse le plus de points perd le plus', () => {
    const scores = scoreVachette(
      { kind: 'vachette', points: { a: 30, b: 25, c: 20, d: 16 } },
      P4,
    )
    expect(scores).toEqual({ a: -120, b: -60, c: 60, d: 120 })
    expect(sum(scores)).toBe(0)
  })

  it('à 3 joueurs, le joueur médian ne marque rien', () => {
    const scores = scoreVachette(
      { kind: 'vachette', points: { a: 40, b: 31, c: 20 } },
      P3,
    )
    expect(scores).toEqual({ a: -120, b: 0, c: 120 })
  })

  it('à 5 joueurs, le barème est symétrique', () => {
    const scores = scoreVachette(
      { kind: 'vachette', points: { a: 30, b: 25, c: 18, d: 12, e: 6 } },
      P5,
    )
    expect(scores).toEqual({ a: -120, b: -60, c: 0, d: 60, e: 120 })
  })

  it('partage la moyenne des rangs en cas d\'égalité', () => {
    const scores = scoreVachette(
      { kind: 'vachette', points: { a: 30, b: 30, c: 20, d: 11 } },
      P4,
    )
    expect(scores).toEqual({ a: -90, b: -90, c: 60, d: 120 })
    expect(sum(scores)).toBe(0)
  })

  it('annule la donne quand tout le monde est à égalité', () => {
    const scores = scoreVachette(
      { kind: 'vachette', points: { a: 22.75, b: 22.75, c: 22.75, d: 22.75 } },
      P4,
    )
    expect(scores).toEqual({ a: 0, b: 0, c: 0, d: 0 })
  })

  it('signale les points manquants dans une saisie incomplète', () => {
    expect(
      vacheePointsRemaining({ kind: 'vachette', points: { a: 30, b: 25 } }, P4),
    ).toBe(36)
    expect(
      vacheePointsRemaining(
        { kind: 'vachette', points: { a: 30, b: 25, c: 20, d: 16 } },
        P4,
      ),
    ).toBe(0)
  })
})

describe('cumuls', () => {
  const deals = [
    { scores: { a: 174, b: -58, c: -58, d: -58 } },
    { scores: { a: -120, b: -60, c: 60, d: 120 } },
  ]

  it('additionne les donnes', () => {
    expect(cumulative(deals, P4)).toEqual({ a: 54, b: -118, c: 2, d: 62 })
  })

  it('produit la série des états intermédiaires', () => {
    const series = cumulativeSeries(deals, P4)
    expect(series).toHaveLength(2)
    expect(series[0]).toEqual({ a: 174, b: -58, c: -58, d: -58 })
    expect(series[1]).toEqual({ a: 54, b: -118, c: 2, d: 62 })
  })

  it('ignore un joueur absent d\'une donne sans casser le cumul', () => {
    expect(cumulative([{ scores: { a: 10 } }], P4)).toEqual({ a: 10, b: 0, c: 0, d: 0 })
  })
})

describe('invariant : une donne ne crée ni ne détruit de points', () => {
  // Générateur déterministe : la suite de donnes testée est reproductible d'un run à l'autre.
  function makeRandom(seed: number): () => number {
    let state = seed
    return () => {
      state = (state * 1664525 + 1013904223) % 4294967296
      return state / 4294967296
    }
  }

  const contracts: Contract[] = ['petite', 'pousse', 'garde', 'gardeSans', 'gardeContre']
  const slams: SlamState[] = ['aucun', 'annonceReussi', 'nonAnnonceReussi', 'annonceChute']
  const sides = ['attaque', 'defense', null] as const

  it.each([[P3], [P4], [P5]])('sur 300 donnes à %s', (players) => {
    const random = makeRandom(20260807 + players.length)
    const pick = <T,>(items: readonly T[]): T =>
      items[Math.floor(random() * items.length)]

    for (let i = 0; i < 300; i++) {
      const taker = pick(players)
      const others = players.filter((id) => id !== taker)
      const input: ContractDeal = {
        kind: 'contrat',
        contract: pick(contracts),
        takerId: taker,
        partnerId: players.length === 5 && random() < 0.7 ? pick(others) : null,
        oudlers: Math.floor(random() * 4) as Oudlers,
        // Points par pas de 0,5, sur toute la plage jouable.
        attackPoints: Math.floor(random() * 183) / 2,
        petitAuBout: pick(sides),
        handfuls:
          random() < 0.3
            ? [{ playerId: pick(players), kind: pick(['simple', 'double', 'triple'] as const) }]
            : [],
        slam: random() < 0.15 ? pick(slams) : 'aucun',
        miseries:
          random() < 0.2 ? [{ playerId: pick(players), kind: pick(['atout', 'tete'] as const) }] : [],
      }

      const scores = scoreDeal(input, players)
      // Tolérance flottante : les quarts de point de la pousse se manipulent exactement,
      // mais le cumul de multiplications reste soumis à la représentation binaire.
      expect(Math.abs(sum(scores))).toBeLessThan(1e-9)
      expect(Object.keys(scores)).toHaveLength(players.length)
    }
  })

  it('vaut aussi pour la vachette, égalités comprises', () => {
    const random = makeRandom(42)
    for (let i = 0; i < 300; i++) {
      const players = [P3, P4, P5][Math.floor(random() * 3)]
      const points: Record<PlayerId, number> = {}
      // Peu de valeurs distinctes : les égalités sont volontairement fréquentes.
      for (const id of players) points[id] = Math.floor(random() * 4) * 10
      const scores = scoreVachette({ kind: 'vachette', points }, players)
      expect(Math.abs(sum(scores))).toBeLessThan(1e-9)
    }
  })
})
