import { describe, expect, it } from 'vitest'
import {
  MIN_DEFENSES,
  MIN_TAKES_BY_CONTRACT,
  MIN_TAKES_BY_OUDLERS,
  playerAdvice,
  tableHighlights,
  tableNotes,
} from './advice'
import { contractDeal, type ContractDealOptions } from './deals.fixture'
import type { Deal, PlayerId } from './types'

const TABLE: PlayerId[] = ['a', 'b', 'c', 'd']

/** Empile `count` donnes identiques, chacune à sa place dans la partie. */
function repeat(count: number, options: ContractDealOptions, from = 0): Deal[] {
  return Array.from({ length: count }, (_, i) =>
    contractDeal({ ...options, index: from + i, createdAt: from + i }),
  )
}

/** Les identifiants des conseils rendus, pour interroger le résultat sans lire les phrases. */
function ids(deals: Deal[], playerId: PlayerId = 'a'): string[] {
  return playerAdvice(deals, playerId, TABLE).map((advice) => advice.id)
}

describe('playerAdvice — le silence sous les seuils', () => {
  it('ne dit rien d’un historique vide', () => {
    expect(playerAdvice([], 'a', TABLE)).toEqual([])
  })

  it('ne dit rien de trois donnes', () => {
    expect(ids(repeat(3, { taker: 'a' }))).toEqual([])
  })

  it('se tait sur les bouts tant que l’effectif n’y est pas', () => {
    // Une prise de moins que le seuil, et le même désastre : rien ne sort.
    const juste = [
      ...repeat(MIN_TAKES_BY_OUDLERS - 1, { taker: 'a', oudlers: 0, attackPoints: 40 }),
      ...repeat(8, { taker: 'a', oudlers: 2, attackPoints: 60 }, 50),
    ]
    expect(ids(juste)).not.toContain('oudlers-0')

    const assez = [
      ...repeat(MIN_TAKES_BY_OUDLERS, { taker: 'a', oudlers: 0, attackPoints: 40 }),
      ...repeat(8, { taker: 'a', oudlers: 2, attackPoints: 60 }, 50),
    ]
    expect(ids(assez)).toContain('oudlers-0')
  })

  it('se tait sur un contrat tant qu’il n’a pas été assez joué', () => {
    const deficit = {
      taker: 'a',
      contract: 'petite',
      oudlers: 1,
      attackPoints: 41,
    } satisfies ContractDealOptions
    const rentable = {
      taker: 'a',
      contract: 'garde',
      oudlers: 1,
      attackPoints: 61,
    } satisfies ContractDealOptions

    const juste = [
      ...repeat(MIN_TAKES_BY_CONTRACT - 1, deficit),
      ...repeat(MIN_TAKES_BY_CONTRACT, rentable, 50),
    ]
    expect(ids(juste)).not.toContain('contrat-deficitaire')

    const assez = [
      ...repeat(MIN_TAKES_BY_CONTRACT, deficit),
      ...repeat(MIN_TAKES_BY_CONTRACT, rentable, 50),
    ]
    expect(ids(assez)).toContain('contrat-deficitaire')
  })
})

describe('playerAdvice — ce qu’il sait dire', () => {
  it('désigne le nombre de bouts qui ne passe pas, avec son seuil', () => {
    const deals = [
      ...repeat(8, { taker: 'a', oudlers: 0, attackPoints: 40 }),
      ...repeat(8, { taker: 'a', oudlers: 2, attackPoints: 60 }, 50),
    ]
    const advice = playerAdvice(deals, 'a', TABLE).find((a) => a.id === 'oudlers-0')
    expect(advice?.tone).toBe('fragilite')
    expect(advice?.text).toContain('aucun bout')
    expect(advice?.text).toContain('0 prise sur 8')
    // Le seuil vient des barèmes, pas d'une constante recopiée dans la phrase.
    expect(advice?.text).toContain('56 points')
  })

  it('oppose le contrat qui coûte à celui qui rapporte', () => {
    const deals = [
      ...repeat(8, { taker: 'a', contract: 'petite', oudlers: 1, attackPoints: 41 }),
      ...repeat(8, { taker: 'a', contract: 'garde', oudlers: 1, attackPoints: 61 }, 50),
    ]
    const advice = playerAdvice(deals, 'a', TABLE).find((a) => a.id === 'contrat-deficitaire')
    expect(advice?.text).toContain('Petite')
    expect(advice?.text).toContain('Garde')
  })

  it('signale celui qui prend bien au-delà de sa part et le paie', () => {
    const deals = [
      ...repeat(12, { taker: 'a', oudlers: 1, attackPoints: 41 }),
      ...repeat(8, { taker: 'b', oudlers: 1, attackPoints: 61 }, 50),
    ]
    const advice = playerAdvice(deals, 'a', TABLE).find((a) => a.id === 'appetit-excessif')
    expect(advice?.tone).toBe('fragilite')
    // Vingt donnes à quatre : sa part vaut cinq prises, il en a pris douze.
    expect(advice?.text).toContain('2,4 fois')
  })

  it('distingue la chute d’un pli de la chute d’un contrat mal pris', () => {
    const courte = repeat(6, { taker: 'a', oudlers: 1, attackPoints: 46 })
    expect(ids(courte)).toContain('chute-courte')

    const large = repeat(6, { taker: 'a', oudlers: 1, attackPoints: 20 })
    expect(ids(large)).toContain('chute-large')
  })

  it('compare un défenseur aux défenseurs des mêmes soirées', () => {
    // « a » marque douze points par donne défendue, « c » et « d » rien.
    const deals = repeat(MIN_DEFENSES, {
      taker: 'b',
      scores: { a: 12, b: -12, c: 0, d: 0 },
    })
    const advice = playerAdvice(deals, 'a', TABLE).find((a) => a.id === 'defense-forte')
    expect(advice?.tone).toBe('force')
    expect(advice?.text).toContain('+12')

    // Sous le seuil, la même situation ne dit plus rien.
    const court = repeat(MIN_DEFENSES - 1, {
      taker: 'b',
      scores: { a: 12, b: -12, c: 0, d: 0 },
    })
    expect(ids(court)).not.toContain('defense-forte')
  })

  it('nomme l’adversaire du duel quand on lui donne de quoi', () => {
    // Six soirées à deux, toutes gagnées par « a » : le duel penche franchement.
    const deals = Array.from({ length: 6 }, (_, i) =>
      contractDeal({
        gameId: `g${i}`,
        createdAt: i,
        table: ['a', 'b'],
        scores: { a: 20, b: -20 },
      }),
    )
    const advice = playerAdvice(deals, 'a', ['a', 'b'], {
      nameOf: (id) => (id === 'b' ? 'Anne' : 'Marc'),
    }).find((a) => a.id === 'duel-favorable')
    expect(advice?.text).toContain('Anne')
    expect(advice?.text).toContain('6 parties')
  })

  it('mesure la forme du moment contre la moyenne de toujours', () => {
    const deals = [10, 10, 10, 60, 60, 60].map((total, i) =>
      contractDeal({
        gameId: `g${i}`,
        createdAt: i,
        table: ['a', 'b'],
        scores: { a: total, b: -total },
      }),
    )
    const advice = playerAdvice(deals, 'a', ['a', 'b']).find((a) => a.id === 'forme-montante')
    expect(advice?.tone).toBe('force')
    expect(advice?.text).toContain('+60')
  })
})

describe('tableNotes', () => {
  it('ne raconte un attelage qu’une fois l’effectif atteint', () => {
    const table: PlayerId[] = ['a', 'b', 'c', 'd', 'e']
    const trop_peu = repeat(3, { table, taker: 'a', partner: 'b', attackPoints: 60 })
    expect(tableNotes(trop_peu, table).map((n) => n.id)).toEqual([])

    const assez = repeat(6, { table, taker: 'a', partner: 'b', attackPoints: 60 })
    const note = tableNotes(assez, table, { nameOf: (id) => id.toUpperCase() })[0]
    expect(note.id).toBe('attelage-a-b')
    expect(note.text).toContain('A et B')
    expect(note.playerIds).toEqual(['a', 'b'])
  })

  it('raconte le duel le plus fourni de la table', () => {
    const deals = Array.from({ length: 6 }, (_, i) =>
      contractDeal({
        gameId: `g${i}`,
        createdAt: i,
        table: ['a', 'b'],
        scores: { a: i < 5 ? 20 : -20, b: i < 5 ? -20 : 20 },
      }),
    )
    const note = tableNotes(deals, ['a', 'b']).find((n) => n.id === 'duel')
    expect(note?.text).toContain('5 de leurs 6 parties')
  })
})

describe('tableHighlights', () => {
  it('ne fabrique rien à partir de rien', () => {
    expect(tableHighlights([], TABLE)).toEqual([])
    expect(tableHighlights(repeat(1, { taker: 'a' }), [])).toEqual([])
  })

  it('annonce d’abord qui mène', () => {
    const deals = repeat(4, { taker: 'a', oudlers: 1, attackPoints: 61 })
    const [first] = tableHighlights(deals, TABLE, { nameOf: () => 'Marc' })
    expect(first.id).toBe('leader')
    expect(first.headline).toBe('Marc mène')
    expect(first.playerId).toBe('a')
  })

  it('ajoute la forme du moment quand elle se détache', () => {
    const deals = [10, 10, 10, 60, 60, 60].map((total, i) =>
      contractDeal({
        gameId: `g${i}`,
        createdAt: i,
        table: ['a', 'b'],
        scores: { a: total, b: -total },
      }),
    )
    const highlights = tableHighlights(deals, ['a', 'b'])
    expect(highlights.map((h) => h.id)).toEqual(['leader', 'forme'])
  })

  it('ne rend jamais plus de deux accroches', () => {
    const deals = [10, 10, 10, 60, 60, 60].flatMap((total, i) =>
      repeat(
        12,
        { gameId: `g${i}`, taker: 'a', scores: { a: total, b: -total } },
        i * 100,
      ).map((deal) => ({ ...deal, createdAt: i * 100 + deal.index })),
    )
    expect(tableHighlights(deals, ['a', 'b']).length).toBeLessThanOrEqual(2)
  })
})
