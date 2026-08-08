import { DEFAULT_RULES } from '../engine/rules'
import { isValidTag, newTag } from '../engine/tag'
import type { Deal, RuleSet } from '../engine/types'
import type { Game, Player } from './db'

/** Version du format. À incrémenter si la forme du fichier change. */
export const BACKUP_VERSION = 3

/** Un joueur tel qu'il voyage dans le fichier — identique à celui de la base. */
export interface BackupPlayer {
  id: string
  /** Absent des sauvegardes d'avant les tags : un tag neuf est attribué à la lecture. */
  tag?: string
  name: string
  colorIndex: number
  createdAt: number
  /** Photo en `data:` URL, ou `null`. C'est ce qui rend la sauvegarde autonome. */
  photo: string | null
}

export interface Backup {
  application: 'tarot'
  version: number
  exportedAt: string
  players: BackupPlayer[]
  games: Game[]
  deals: Deal[]
  rules: RuleSet
}

/** Ce qu'une sauvegarde contient, pour l'annoncer avant de restaurer. */
export interface BackupSummary {
  players: number
  games: number
  deals: number
  photos: number
  exportedAt: string | null
}

export async function toBackupPlayers(players: Player[]): Promise<BackupPlayer[]> {
  return players.map(({ id, tag, name, colorIndex, createdAt, photo }) => ({
    id,
    tag,
    name,
    colorIndex,
    createdAt,
    photo,
  }))
}

export async function fromBackupPlayers(players: BackupPlayer[]): Promise<Player[]> {
  // Une sauvegarde antérieure aux tags n'en contient pas : on en attribue, en veillant à
  // ne pas en donner deux fois le même — la fusion s'en sert pour identifier les personnes.
  const taken = new Set(players.map((p) => p.tag).filter(Boolean) as string[])
  return players.map(({ id, tag, name, colorIndex, createdAt, photo }) => {
    let assigned = tag && isValidTag(tag) ? tag : newTag()
    while (!tag && taken.has(assigned)) assigned = newTag()
    taken.add(assigned)
    return {
      id,
      tag: assigned,
      name,
      colorIndex: colorIndex ?? 0,
      createdAt: createdAt ?? Date.now(),
      photo: photo ?? null,
    }
  })
}

/**
 * Lit et valide un fichier de sauvegarde.
 *
 * On refuse tôt et clairement plutôt que d'écrire à moitié : une restauration qui échoue
 * en cours de route laisserait la base dans un état incohérent.
 */
export function parseBackup(text: string): Backup {
  let raw: unknown
  try {
    raw = JSON.parse(text)
  } catch {
    throw new Error("Ce fichier n'est pas une sauvegarde Tarot.")
  }

  if (typeof raw !== 'object' || raw === null) {
    throw new Error("Ce fichier n'est pas une sauvegarde Tarot.")
  }

  const data = raw as Partial<Backup>
  if (data.application !== 'tarot') {
    throw new Error("Ce fichier ne vient pas de l'application Tarot.")
  }
  if (typeof data.version !== 'number' || data.version > BACKUP_VERSION) {
    throw new Error(
      'Cette sauvegarde vient d’une version plus récente de l’application. Mettez-la à jour puis réessayez.',
    )
  }
  if (!Array.isArray(data.players) || !Array.isArray(data.games) || !Array.isArray(data.deals)) {
    throw new Error('Cette sauvegarde est incomplète ou abîmée.')
  }

  return {
    application: 'tarot',
    version: data.version,
    exportedAt: typeof data.exportedAt === 'string' ? data.exportedAt : '',
    players: data.players,
    games: data.games,
    deals: data.deals,
    // Une sauvegarde d'avant l'écran Règles n'en contient pas : on retombe sur les barèmes
    // par défaut plutôt que de refuser le fichier.
    rules: data.rules ? { ...DEFAULT_RULES, ...data.rules } : DEFAULT_RULES,
  }
}

export function summarize(backup: Backup): BackupSummary {
  return {
    players: backup.players.length,
    games: backup.games.length,
    deals: backup.deals.length,
    photos: backup.players.filter((p) => p.photo).length,
    exportedAt: backup.exportedAt || null,
  }
}
