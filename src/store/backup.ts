import { DEFAULT_RULES } from '../engine/rules'
import type { Deal, RuleSet } from '../engine/types'
import type { Game, Player } from './db'

/** Version du format. À incrémenter si la forme du fichier change. */
export const BACKUP_VERSION = 2

/** Un joueur tel qu'il voyage dans le fichier : la photo devient du texte. */
export interface BackupPlayer {
  id: string
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

/**
 * Convertit une photo en texte.
 *
 * Le JSON ne sait pas transporter de données binaires : sans cette conversion, les photos
 * seraient les seules choses que la sauvegarde laisserait derrière elle.
 */
function blobToDataUrl(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(String(reader.result))
    reader.onerror = () => reject(reader.error ?? new Error('Lecture impossible'))
    reader.readAsDataURL(blob)
  })
}

async function dataUrlToBlob(dataUrl: string): Promise<Blob> {
  const response = await fetch(dataUrl)
  return response.blob()
}

export async function toBackupPlayers(players: Player[]): Promise<BackupPlayer[]> {
  return Promise.all(
    players.map(async ({ id, name, colorIndex, createdAt, photo }) => ({
      id,
      name,
      colorIndex,
      createdAt,
      photo: photo ? await blobToDataUrl(photo) : null,
    })),
  )
}

export async function fromBackupPlayers(players: BackupPlayer[]): Promise<Player[]> {
  return Promise.all(
    players.map(async ({ id, name, colorIndex, createdAt, photo }) => ({
      id,
      name,
      colorIndex: colorIndex ?? 0,
      createdAt: createdAt ?? Date.now(),
      photo: photo ? await dataUrlToBlob(photo) : null,
    })),
  )
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
