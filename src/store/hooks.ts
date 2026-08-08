import { useCallback, useEffect, useMemo, useState } from 'react'
import { cumulative, scoreDeal } from '../engine/score'
import type { Deal, DealInput, PlayerId, RuleSet } from '../engine/types'
import {
  type Game,
  type Player,
  deleteDeal,
  getPlayers,
  listDeals,
  listPlayers,
  loadRules,
  newId,
  putDeal,
  saveRules,
} from './db'

/** Barèmes de la table, chargés une fois et partagés par toute l'application. */
export function useRules(): [RuleSet | null, (rules: RuleSet) => Promise<void>] {
  const [rules, setRules] = useState<RuleSet | null>(null)

  useEffect(() => {
    loadRules().then(setRules)
  }, [])

  const update = useCallback(async (next: RuleSet) => {
    setRules(next)
    await saveRules(next)
  }, [])

  return [rules, update]
}

/** Carnet de joueurs, avec un rafraîchissement explicite après création ou édition. */
export function usePlayers(): {
  players: Player[]
  loading: boolean
  refresh: () => Promise<void>
} {
  const [players, setPlayers] = useState<Player[]>([])
  const [loading, setLoading] = useState(true)

  const refresh = useCallback(async () => {
    setPlayers(await listPlayers())
    setLoading(false)
  }, [])

  useEffect(() => {
    refresh()
  }, [refresh])

  return { players, loading, refresh }
}

export interface GameState {
  game: Game
  players: Player[]
  deals: Deal[]
  /** Cumul de chaque joueur après toutes les donnes enregistrées. */
  totals: Record<PlayerId, number>
  /** Joueur qui donne la prochaine donne. */
  nextDealerId: PlayerId
  loading: boolean
  addDeal: (input: DealInput) => Promise<void>
  editDeal: (dealId: string, input: DealInput) => Promise<void>
  removeDeal: (dealId: string) => Promise<void>
  reload: () => Promise<void>
}

/** Donneur d'une donne : la rotation suit l'ordre de la table, tour après tour. */
export function dealerFor(game: Game, dealIndex: number): PlayerId {
  const count = game.playerIds.length
  return game.playerIds[(game.firstDealerIndex + dealIndex) % count]
}

/**
 * État vivant d'une partie : joueurs, donnes, cumuls, et les opérations d'écriture.
 *
 * Les scores sont figés à l'enregistrement de chaque donne (ils sont stockés dans
 * `Deal.scores`), ce qui garantit qu'un changement de barème en cours de partie ne
 * réécrit pas l'histoire — seules les donnes saisies ensuite en tiennent compte.
 */
export function useGame(game: Game, rules: RuleSet | null): GameState {
  const [players, setPlayers] = useState<Player[]>([])
  const [deals, setDeals] = useState<Deal[]>([])
  const [loading, setLoading] = useState(true)

  const reload = useCallback(async () => {
    const [loadedPlayers, loadedDeals] = await Promise.all([
      getPlayers(game.playerIds),
      listDeals(game.id),
    ])
    // On conserve l'ordre de la table, pas l'ordre de lecture d'IndexedDB.
    const byId = new Map(loadedPlayers.map((p) => [p.id, p]))
    setPlayers(game.playerIds.map((id) => byId.get(id)).filter((p): p is Player => !!p))
    setDeals(loadedDeals)
    setLoading(false)
  }, [game.id, game.playerIds])

  useEffect(() => {
    reload()
  }, [reload])

  const addDeal = useCallback(
    async (input: DealInput) => {
      if (!rules) return
      const index = deals.length
      const deal: Deal = {
        id: newId(),
        gameId: game.id,
        index,
        dealerId: dealerFor(game, index),
        input,
        scores: scoreDeal(input, game.playerIds, rules),
        createdAt: Date.now(),
      }
      await putDeal(deal)
      await reload()
    },
    [deals.length, game, reload, rules],
  )

  const editDeal = useCallback(
    async (dealId: string, input: DealInput) => {
      if (!rules) return
      const existing = deals.find((d) => d.id === dealId)
      if (!existing) return
      await putDeal({
        ...existing,
        input,
        scores: scoreDeal(input, game.playerIds, rules),
      })
      await reload()
    },
    [deals, game.playerIds, reload, rules],
  )

  const removeDeal = useCallback(
    async (dealId: string) => {
      await deleteDeal(game.id, dealId)
      await reload()
    },
    [game.id, reload],
  )

  const totals = useMemo(
    () => cumulative(deals, game.playerIds),
    [deals, game.playerIds],
  )

  return {
    game,
    players,
    deals,
    totals,
    nextDealerId: dealerFor(game, deals.length),
    loading,
    addDeal,
    editDeal,
    removeDeal,
    reload,
  }
}

/*
 * Les photos sont stockées en `data:` URL et s'affichent donc directement (cf. `Avatar`).
 * Ni conversion ni cache : le hook qui s'en chargeait n'a plus lieu d'être.
 */
