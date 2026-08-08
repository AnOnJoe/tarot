import type { Deal, DealInput, PlayerId } from '../engine/types'
import type { Game, Player } from './db'

/** L'ensemble de ce que contient un appareil. */
export interface Dataset {
  players: Player[]
  games: Game[]
  deals: Deal[]
}

/** Ce que la fusion a effectivement changé, pour le raconter à l'écran. */
export interface MergeSummary {
  playersAdded: number
  /** Joueurs reconnus par leur tag et rattachés à ceux déjà présents. */
  playersMatched: number
  gamesAdded: number
  dealsAdded: number
}

export interface MergeResult {
  dataset: Dataset
  summary: MergeSummary
}

/** Réécrit les identifiants de joueur d'une entrée de donne. */
function remapInput(input: DealInput, map: Map<PlayerId, PlayerId>): DealInput {
  const id = (value: PlayerId) => map.get(value) ?? value

  if (input.kind === 'vachette') {
    const points: Record<PlayerId, number> = {}
    for (const [playerId, value] of Object.entries(input.points)) points[id(playerId)] = value
    return { ...input, points }
  }

  return {
    ...input,
    takerId: id(input.takerId),
    partnerId: input.partnerId === null ? null : id(input.partnerId),
    handfuls: input.handfuls.map((h) => ({ ...h, playerId: id(h.playerId) })),
    miseries: input.miseries.map((m) => ({ ...m, playerId: id(m.playerId) })),
  }
}

function remapDeal(deal: Deal, map: Map<PlayerId, PlayerId>): Deal {
  const id = (value: PlayerId) => map.get(value) ?? value
  const scores: Record<PlayerId, number> = {}
  for (const [playerId, value] of Object.entries(deal.scores)) scores[id(playerId)] = value
  return {
    ...deal,
    dealerId: id(deal.dealerId),
    input: remapInput(deal.input, map),
    scores,
  }
}

/**
 * Fusionne deux carnets sans rien perdre.
 *
 * Aucune donnée locale n'est écrasée : ce qui existe des deux côtés est conservé dans sa
 * version locale, ce qui n'existe que d'un côté est ajouté. C'est le sens même d'une
 * synchronisation entre deux personnes qui ont chacune leur historique.
 *
 * Les joueurs se reconnaissent à leur **tag**, pas à leur identifiant technique : deux
 * personnes ayant saisi « Joachim » chacune de leur côté ont deux UUID différents pour la
 * même personne. Quand un tag correspond, tout ce que l'autre appareil rattache à son UUID
 * est réécrit vers l'identifiant local.
 *
 * À l'intérieur d'une partie présente des deux côtés, les donnes sont réunies puis
 * renumérotées par ordre de création : deux personnes ayant marqué en parallèle
 * produiraient sinon deux donnes portant le même rang.
 */
export function mergeDatasets(local: Dataset, incoming: Dataset): MergeResult {
  const summary: MergeSummary = {
    playersAdded: 0,
    playersMatched: 0,
    gamesAdded: 0,
    dealsAdded: 0,
  }

  // ---------------------------------------------------------------- joueurs
  const byTag = new Map(local.players.map((player) => [player.tag, player]))
  const localIds = new Set(local.players.map((player) => player.id))
  const remap = new Map<PlayerId, PlayerId>()
  const players = [...local.players]

  for (const player of incoming.players) {
    const known = byTag.get(player.tag)
    if (known) {
      if (known.id !== player.id) remap.set(player.id, known.id)
      summary.playersMatched++
      continue
    }

    // Tag inconnu : c'est quelqu'un de nouveau. Un identifiant technique déjà pris par une
    // autre personne est réattribué — improbable avec des UUID, mais pas impossible après
    // plusieurs allers-retours.
    const id = localIds.has(player.id) ? crypto.randomUUID() : player.id
    if (id !== player.id) remap.set(player.id, id)
    const added = { ...player, id }
    players.push(added)
    localIds.add(id)
    byTag.set(added.tag, added)
    summary.playersAdded++
  }

  // ---------------------------------------------------------------- parties
  const games = [...local.games]
  const knownGames = new Set(local.games.map((game) => game.id))

  for (const game of incoming.games) {
    if (knownGames.has(game.id)) continue
    games.push({ ...game, playerIds: game.playerIds.map((id) => remap.get(id) ?? id) })
    knownGames.add(game.id)
    summary.gamesAdded++
  }

  // ----------------------------------------------------------------- donnes
  const deals = [...local.deals]
  const knownDeals = new Set(local.deals.map((deal) => deal.id))
  const touchedGames = new Set<string>()

  for (const deal of incoming.deals) {
    if (knownDeals.has(deal.id)) continue
    deals.push(remapDeal(deal, remap))
    knownDeals.add(deal.id)
    touchedGames.add(deal.gameId)
    summary.dealsAdded++
  }

  // Renumérotation des parties qui ont reçu des donnes, par ordre de création.
  const renumbered = deals.map((deal) => ({ ...deal }))
  for (const gameId of touchedGames) {
    const inGame = renumbered
      .filter((deal) => deal.gameId === gameId)
      .sort((a, b) => a.createdAt - b.createdAt || a.index - b.index)
    inGame.forEach((deal, index) => {
      deal.index = index
    })
  }

  return { dataset: { players, games, deals: renumbered }, summary }
}
