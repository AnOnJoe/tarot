import { openDB, type DBSchema, type IDBPDatabase } from 'idb'
import { DEFAULT_RULES } from '../engine/rules'
import { SERIES_SLOTS } from '../palette'
import type { Deal, PlayerId, RuleSet } from '../engine/types'

/** Un joueur du carnet, réutilisable d'une partie à l'autre. */
export interface Player {
  id: PlayerId
  name: string
  /** Photo recadrée, stockée en Blob sur l'appareil. Rien n'est envoyé sur le réseau. */
  photo: Blob | null
  /**
   * Slot de la palette (0 à 7). On stocke le rang, pas le pigment : le thème clair et le
   * thème sombre n'emploient pas les mêmes valeurs pour une même identité.
   */
  colorIndex: number
  createdAt: number
}

export interface Game {
  id: string
  playerIds: PlayerId[]
  /** Index dans `playerIds` du joueur qui a donné la première donne. */
  firstDealerIndex: number
  startedAt: number
  /** Renseigné quand la partie est close ; une seule partie ouverte à la fois. */
  endedAt: number | null
}

interface TarotDB extends DBSchema {
  players: { key: string; value: Player }
  games: { key: string; value: Game; indexes: { byStart: number } }
  deals: { key: string; value: Deal; indexes: { byGame: string } }
  settings: { key: string; value: unknown }
}

let dbPromise: Promise<IDBPDatabase<TarotDB>> | null = null

function db(): Promise<IDBPDatabase<TarotDB>> {
  dbPromise ??= openDB<TarotDB>('tarot', 1, {
    upgrade(database) {
      database.createObjectStore('players', { keyPath: 'id' })
      const games = database.createObjectStore('games', { keyPath: 'id' })
      games.createIndex('byStart', 'startedAt')
      const deals = database.createObjectStore('deals', { keyPath: 'id' })
      deals.createIndex('byGame', 'gameId')
      database.createObjectStore('settings')
    },
  })
  return dbPromise
}

/** Identifiant court et unique, suffisant pour un usage local mono-appareil. */
export function newId(): string {
  return crypto.randomUUID()
}

/* ------------------------------------------------------------------ joueurs */

export async function listPlayers(): Promise<Player[]> {
  const players = await (await db()).getAll('players')
  return players.sort((a, b) => a.name.localeCompare(b.name, 'fr'))
}

export async function getPlayers(ids: PlayerId[]): Promise<Player[]> {
  const database = await db()
  const found = await Promise.all(ids.map((id) => database.get('players', id)))
  return found.filter((p): p is Player => p !== undefined)
}

export async function createPlayer(name: string, photo: Blob | null): Promise<Player> {
  const existing = await listPlayers()
  // Le premier slot libre plutôt que le suivant : après une suppression, on réutilise la
  // couleur laissée vacante au lieu de faire dériver toute la palette.
  const taken = new Set(existing.map((p) => p.colorIndex))
  let colorIndex = 0
  while (colorIndex < SERIES_SLOTS && taken.has(colorIndex)) colorIndex++

  const player: Player = {
    id: newId(),
    name: name.trim(),
    photo,
    colorIndex: colorIndex % SERIES_SLOTS,
    createdAt: Date.now(),
  }
  await (await db()).put('players', player)
  return player
}

export async function updatePlayer(player: Player): Promise<void> {
  await (await db()).put('players', player)
}

/**
 * Supprime un joueur du carnet. Les parties déjà jouées conservent ses scores : elles
 * référencent son identifiant, et l'affichage retombe sur « Joueur supprimé ».
 */
export async function deletePlayer(id: PlayerId): Promise<void> {
  await (await db()).delete('players', id)
}

/* ------------------------------------------------------------------ parties */

export async function listGames(): Promise<Game[]> {
  const games = await (await db()).getAll('games')
  return games.sort((a, b) => b.startedAt - a.startedAt)
}

export async function getGame(id: string): Promise<Game | undefined> {
  return (await db()).get('games', id)
}

export async function createGame(
  playerIds: PlayerId[],
  firstDealerIndex: number,
): Promise<Game> {
  const game: Game = {
    id: newId(),
    playerIds,
    firstDealerIndex,
    startedAt: Date.now(),
    endedAt: null,
  }
  const database = await db()
  await database.put('games', game)
  await database.put('settings', game.id, 'currentGameId')
  return game
}

export async function endGame(id: string): Promise<void> {
  const database = await db()
  const game = await database.get('games', id)
  if (!game) return
  await database.put('games', { ...game, endedAt: Date.now() })
  const current = await database.get('settings', 'currentGameId')
  if (current === id) await database.delete('settings', 'currentGameId')
}

export async function deleteGame(id: string): Promise<void> {
  const database = await db()
  const tx = database.transaction(['games', 'deals', 'settings'], 'readwrite')
  const dealIds = await tx.objectStore('deals').index('byGame').getAllKeys(id)
  await Promise.all(dealIds.map((key) => tx.objectStore('deals').delete(key)))
  await tx.objectStore('games').delete(id)
  const current = await tx.objectStore('settings').get('currentGameId')
  if (current === id) await tx.objectStore('settings').delete('currentGameId')
  await tx.done
}

/** Partie à reprendre au lancement de l'application, s'il y en a une. */
export async function getCurrentGame(): Promise<Game | undefined> {
  const database = await db()
  const id = (await database.get('settings', 'currentGameId')) as string | undefined
  if (!id) return undefined
  const game = await database.get('games', id)
  return game?.endedAt === null ? game : undefined
}

/* ------------------------------------------------------------------- donnes */

export async function listDeals(gameId: string): Promise<Deal[]> {
  const deals = await (await db()).getAllFromIndex('deals', 'byGame', gameId)
  return deals.sort((a, b) => a.index - b.index)
}

export async function putDeal(deal: Deal): Promise<void> {
  await (await db()).put('deals', deal)
}

/**
 * Supprime une donne et renumérote les suivantes, pour que la rotation du donneur et
 * l'ordre du tableau restent cohérents.
 */
export async function deleteDeal(gameId: string, dealId: string): Promise<void> {
  const database = await db()
  await database.delete('deals', dealId)
  const remaining = await listDeals(gameId)
  const tx = database.transaction('deals', 'readwrite')
  await Promise.all(
    remaining.map((deal, index) =>
      deal.index === index ? undefined : tx.store.put({ ...deal, index }),
    ),
  )
  await tx.done
}

export async function listAllDeals(): Promise<Deal[]> {
  return (await db()).getAll('deals')
}

/* ------------------------------------------------------------------- règles */

export async function loadRules(): Promise<RuleSet> {
  const stored = (await (await db()).get('settings', 'rules')) as
    | Partial<RuleSet>
    | undefined
  // Fusion superficielle : un barème absent (règle ajoutée après coup) reprend sa valeur
  // par défaut plutôt que de rendre le moteur incalculable.
  return stored ? { ...DEFAULT_RULES, ...stored } : DEFAULT_RULES
}

export async function saveRules(rules: RuleSet): Promise<void> {
  await (await db()).put('settings', rules, 'rules')
}

export async function resetRules(): Promise<void> {
  await (await db()).delete('settings', 'rules')
}
