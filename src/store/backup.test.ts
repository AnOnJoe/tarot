import { describe, expect, it } from 'vitest'
import { DEFAULT_RULES } from '../engine/rules'
import { BACKUP_VERSION, parseBackup, summarize, type Backup } from './backup'

function validBackup(overrides: Partial<Backup> = {}): string {
  return JSON.stringify({
    application: 'tarot',
    version: BACKUP_VERSION,
    exportedAt: '2026-08-08T06:00:00.000Z',
    players: [
      { id: 'p1', name: 'Papa', colorIndex: 0, createdAt: 1, photo: 'data:image/jpeg;base64,AA' },
      { id: 'p2', name: 'Maman', colorIndex: 1, createdAt: 2, photo: null },
    ],
    games: [],
    deals: [],
    rules: DEFAULT_RULES,
    ...overrides,
  })
}

describe('lecture d’une sauvegarde', () => {
  it('accepte un fichier valide', () => {
    const backup = parseBackup(validBackup())
    expect(backup.players).toHaveLength(2)
    expect(backup.rules.multipliers.pousse).toBe(1.5)
  })

  it('refuse un fichier qui n’est pas du JSON', () => {
    expect(() => parseBackup('bonjour')).toThrow(/pas une sauvegarde/)
  })

  it('refuse le JSON d’une autre application', () => {
    expect(() => parseBackup(JSON.stringify({ application: 'autre', version: 1 }))).toThrow(
      /ne vient pas de l/,
    )
  })

  it('refuse une sauvegarde issue d’une version plus récente', () => {
    expect(() => parseBackup(validBackup({ version: BACKUP_VERSION + 1 }))).toThrow(
      /plus récente/,
    )
  })

  it('refuse une sauvegarde amputée d’une de ses tables', () => {
    expect(() => parseBackup(validBackup({ deals: undefined }))).toThrow(/incomplète/)
  })

  it('retombe sur les barèmes par défaut quand les règles manquent', () => {
    // Les sauvegardes d'avant l'écran Règles n'en contiennent pas : elles restent lisibles.
    const backup = parseBackup(validBackup({ rules: undefined }))
    expect(backup.rules).toEqual(DEFAULT_RULES)
  })

  it('complète des règles partielles avec les valeurs par défaut', () => {
    const partial = { baseValue: 30 } as Backup['rules']
    const backup = parseBackup(validBackup({ rules: partial }))
    expect(backup.rules.baseValue).toBe(30)
    expect(backup.rules.thresholds).toEqual(DEFAULT_RULES.thresholds)
  })

  it('résume ce que le fichier contient', () => {
    expect(summarize(parseBackup(validBackup()))).toEqual({
      players: 2,
      games: 0,
      deals: 0,
      photos: 1,
      exportedAt: '2026-08-08T06:00:00.000Z',
    })
  })

  it('accepte une sauvegarde plus ancienne que la version courante', () => {
    expect(() => parseBackup(validBackup({ version: 1 }))).not.toThrow()
  })
})
