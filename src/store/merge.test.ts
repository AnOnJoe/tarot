import { describe, expect, it } from 'vitest'
import { scoreDeal } from '../engine/score'
import type { ContractDeal, Deal, PlayerId } from '../engine/types'
import type { Game, Player } from './db'
import { mergeDatasets, type Dataset } from './merge'

function player(id: string, tag: string, name = id): Player {
  return { id, tag, name, photo: null, colorIndex: 0, createdAt: 1 }
}

function game(id: string, playerIds: PlayerId[], startedAt = 1000): Game {
  return { id, playerIds, firstDealerIndex: 0, startedAt, endedAt: null }
}

function deal(
  id: string,
  gameId: string,
  index: number,
  playerIds: PlayerId[],
  overrides: Partial<ContractDeal> = {},
  createdAt = index,
): Deal {
  const input: ContractDeal = {
    kind: 'contrat',
    contract: 'garde',
    takerId: playerIds[0],
    partnerId: null,
    oudlers: 2,
    attackPoints: 45,
    petitAuBout: null,
    handfuls: [],
    slam: 'aucun',
    miseries: [],
    ...overrides,
  }
  return {
    id,
    gameId,
    index,
    dealerId: playerIds[0],
    input,
    scores: scoreDeal(input, playerIds, undefined),
    createdAt,
  }
}

const empty: Dataset = { players: [], games: [], deals: [] }

describe('fusion de deux carnets', () => {
  it('ajoute intégralement un carnet inconnu', () => {
    const incoming: Dataset = {
      players: [player('p1', 'AAA-111'), player('p2', 'BBB-222')],
      games: [game('g1', ['p1', 'p2'])],
      deals: [deal('d1', 'g1', 0, ['p1', 'p2'])],
    }
    const { dataset, summary } = mergeDatasets(empty, incoming)
    expect(summary).toEqual({
      playersAdded: 2,
      playersMatched: 0,
      gamesAdded: 1,
      dealsAdded: 1,
    })
    expect(dataset.players).toHaveLength(2)
  })

  it('reconnaît un joueur par son tag malgré un identifiant différent', () => {
    const local: Dataset = { players: [player('local-jo', 'JOA-777', 'Joachim')], games: [], deals: [] }
    const incoming: Dataset = {
      players: [player('distant-jo', 'JOA-777', 'Joachim')],
      games: [],
      deals: [],
    }
    const { dataset, summary } = mergeDatasets(local, incoming)
    expect(summary.playersMatched).toBe(1)
    expect(summary.playersAdded).toBe(0)
    expect(dataset.players).toHaveLength(1)
    expect(dataset.players[0].id).toBe('local-jo')
  })

  it('réécrit toutes les références du joueur reconnu', () => {
    const local: Dataset = {
      players: [player('local-a', 'AAA-111'), player('local-b', 'BBB-222')],
      games: [],
      deals: [],
    }
    const incoming: Dataset = {
      players: [player('far-a', 'AAA-111'), player('far-b', 'BBB-222')],
      games: [game('g9', ['far-a', 'far-b'])],
      deals: [
        deal('d9', 'g9', 0, ['far-a', 'far-b'], {
          takerId: 'far-a',
          partnerId: 'far-b',
          handfuls: [{ playerId: 'far-b', kind: 'simple' }],
          miseries: [{ playerId: 'far-a', kind: 'atout' }],
        }),
      ],
    }

    const { dataset } = mergeDatasets(local, incoming)
    const merged = dataset.deals[0]
    const input = merged.input as ContractDeal

    expect(dataset.games[0].playerIds).toEqual(['local-a', 'local-b'])
    expect(merged.dealerId).toBe('local-a')
    expect(input.takerId).toBe('local-a')
    expect(input.partnerId).toBe('local-b')
    expect(input.handfuls[0].playerId).toBe('local-b')
    expect(input.miseries[0].playerId).toBe('local-a')
    // Les scores sont indexés par joueur : leurs clés doivent suivre aussi.
    expect(Object.keys(merged.scores).sort()).toEqual(['local-a', 'local-b'])
  })

  it('réécrit aussi le classement d’une vachette', () => {
    const local: Dataset = { players: [player('local-a', 'AAA-111')], games: [], deals: [] }
    const incoming: Dataset = {
      players: [player('far-a', 'AAA-111')],
      games: [game('g1', ['far-a'])],
      deals: [
        {
          id: 'v1',
          gameId: 'g1',
          index: 0,
          dealerId: 'far-a',
          input: { kind: 'vachette', standing: [['far-a']] },
          scores: { 'far-a': 0 },
          createdAt: 1,
        },
      ],
    }
    const { dataset } = mergeDatasets(local, incoming)
    const input = dataset.deals[0].input
    expect(input.kind).toBe('vachette')
    if (input.kind === 'vachette') expect(input.standing).toEqual([['local-a']])
  })

  /*
   * Un carnet resté sur une version antérieure envoie encore des vachettes en points : la
   * fusion doit les réécrire aussi, sans quoi la donne reçue désignerait un joueur inconnu.
   */
  it.each([
    ['en points', { kind: 'vachette' as const, points: { 'far-a': 30 } }],
    ['en rangs', { kind: 'vachette' as const, ranks: { 'far-a': 1 } }],
  ])('réécrit une vachette reçue à l’ancien format (%s)', (_label, vachette) => {
    const local: Dataset = { players: [player('local-a', 'AAA-111')], games: [], deals: [] }
    const incoming: Dataset = {
      players: [player('far-a', 'AAA-111')],
      games: [game('g1', ['far-a'])],
      deals: [
        {
          id: 'v1',
          gameId: 'g1',
          index: 0,
          dealerId: 'far-a',
          input: vachette,
          scores: { 'far-a': 0 },
          createdAt: 1,
        },
      ],
    }
    const { dataset } = mergeDatasets(local, incoming)
    const input = dataset.deals[0].input
    if (input.kind === 'vachette') {
      const rewritten = input.points ?? input.ranks
      expect(Object.keys(rewritten ?? {})).toEqual(['local-a'])
      // La forme reçue est conservée : la fusion réécrit des identifiants, pas des formats.
      expect(input.standing).toBeUndefined()
    }
  })

  it('n’écrase jamais une donnée locale déjà présente', () => {
    const localDeal = deal('d1', 'g1', 0, ['p1'], { attackPoints: 45 })
    const local: Dataset = {
      players: [player('p1', 'AAA-111', 'Nom local')],
      games: [game('g1', ['p1'])],
      deals: [localDeal],
    }
    const incoming: Dataset = {
      players: [player('p1', 'AAA-111', 'Nom distant')],
      games: [game('g1', ['p1'], 9999)],
      deals: [deal('d1', 'g1', 0, ['p1'], { attackPoints: 10 })],
    }
    const { dataset, summary } = mergeDatasets(local, incoming)
    expect(dataset.players[0].name).toBe('Nom local')
    expect(dataset.games[0].startedAt).toBe(1000)
    expect(dataset.deals[0].input).toEqual(localDeal.input)
    expect(summary).toEqual({
      playersAdded: 0,
      playersMatched: 1,
      gamesAdded: 0,
      dealsAdded: 0,
    })
  })

  it('réunit les donnes ajoutées de part et d’autre à une même partie', () => {
    const local: Dataset = {
      players: [player('p1', 'AAA-111')],
      games: [game('g1', ['p1'])],
      deals: [deal('d1', 'g1', 0, ['p1'], {}, 100)],
    }
    const incoming: Dataset = {
      players: [player('p1', 'AAA-111')],
      games: [game('g1', ['p1'])],
      deals: [deal('d2', 'g1', 1, ['p1'], {}, 200)],
    }
    const { dataset, summary } = mergeDatasets(local, incoming)
    expect(summary.dealsAdded).toBe(1)
    expect(dataset.deals).toHaveLength(2)
  })

  it('renumérote par ordre de création quand deux donnes portent le même rang', () => {
    // Deux personnes ont marqué la troisième donne chacune de leur côté.
    const local: Dataset = {
      players: [player('p1', 'AAA-111')],
      games: [game('g1', ['p1'])],
      deals: [deal('d1', 'g1', 0, ['p1'], {}, 100), deal('d2', 'g1', 1, ['p1'], {}, 200)],
    }
    const incoming: Dataset = {
      players: [player('p1', 'AAA-111')],
      games: [game('g1', ['p1'])],
      deals: [deal('d3', 'g1', 1, ['p1'], {}, 150)],
    }
    const { dataset } = mergeDatasets(local, incoming)
    const inGame = dataset.deals
      .filter((d) => d.gameId === 'g1')
      .sort((a, b) => a.index - b.index)
    expect(inGame.map((d) => d.id)).toEqual(['d1', 'd3', 'd2'])
    expect(inGame.map((d) => d.index)).toEqual([0, 1, 2])
  })

  it('laisse intactes les parties qui n’ont rien reçu', () => {
    const local: Dataset = {
      players: [player('p1', 'AAA-111')],
      games: [game('g1', ['p1']), game('g2', ['p1'])],
      // Rangs volontairement décalés : rien ne doit y toucher.
      deals: [deal('d1', 'g2', 5, ['p1'], {}, 100)],
    }
    const { dataset } = mergeDatasets(local, empty)
    expect(dataset.deals[0].index).toBe(5)
  })

  it('réattribue un identifiant technique déjà pris par une autre personne', () => {
    const local: Dataset = { players: [player('shared', 'AAA-111', 'Locale')], games: [], deals: [] }
    const incoming: Dataset = {
      players: [player('shared', 'ZZZ-999', 'Distante')],
      games: [game('g1', ['shared'])],
      deals: [deal('d1', 'g1', 0, ['shared'])],
    }
    const { dataset, summary } = mergeDatasets(local, incoming)
    expect(summary.playersAdded).toBe(1)
    const ids = dataset.players.map((p) => p.id)
    expect(new Set(ids).size).toBe(2)
    // La partie importée doit suivre le nouvel identifiant, pas l'ancien.
    expect(dataset.games[0].playerIds[0]).not.toBe('shared')
    expect(dataset.games[0].playerIds[0]).toBe(dataset.players[1].id)
  })

  it('est idempotente : fusionner deux fois ne duplique rien', () => {
    const incoming: Dataset = {
      players: [player('p1', 'AAA-111'), player('p2', 'BBB-222')],
      games: [game('g1', ['p1', 'p2'])],
      deals: [deal('d1', 'g1', 0, ['p1', 'p2'])],
    }
    const once = mergeDatasets(empty, incoming).dataset
    const twice = mergeDatasets(once, incoming)
    expect(twice.summary).toEqual({
      playersAdded: 0,
      playersMatched: 2,
      gamesAdded: 0,
      dealsAdded: 0,
    })
    expect(twice.dataset.players).toHaveLength(2)
    expect(twice.dataset.deals).toHaveLength(1)
  })
})
