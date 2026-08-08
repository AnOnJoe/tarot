import { CONTRACT_LABELS, formatPoints } from '../engine/rules'
import type { Deal } from '../engine/types'
import {
  BACKUP_VERSION,
  fromBackupPlayers,
  parseBackup,
  summarize,
  toBackupPlayers,
  type Backup,
  type BackupSummary,
} from './backup'
import { listAllDeals, listGames, listPlayers, loadRules, replaceAll } from './db'

/**
 * Sauvegarde complète : joueurs, photos comprises, parties, donnes et barèmes.
 *
 * Les photos sont converties en texte pour tenir dans le JSON. Un carnet de huit joueurs
 * pèse ainsi quelques centaines de kilo-octets — négligeable, et le fichier reste seul
 * nécessaire pour tout retrouver.
 */
async function buildBackup(): Promise<Backup> {
  const [players, games, deals, rules] = await Promise.all([
    listPlayers(),
    listGames(),
    listAllDeals(),
    loadRules(),
  ])
  return {
    application: 'tarot',
    version: BACKUP_VERSION,
    exportedAt: new Date().toISOString(),
    players: await toBackupPlayers(players),
    games,
    deals,
    rules,
  }
}

/** Feuille de calcul du détail des donnes, une ligne par donne et par joueur. */
function toCsv(deals: Deal[], names: Map<string, string>): string {
  const rows = [['partie', 'donne', 'contrat', 'donneur', 'joueur', 'points'].join(';')]
  for (const deal of deals) {
    const contract =
      deal.input.kind === 'vachette' ? 'Vachette' : CONTRACT_LABELS[deal.input.contract]
    for (const [playerId, score] of Object.entries(deal.scores)) {
      rows.push(
        [
          deal.gameId,
          deal.index + 1,
          contract,
          names.get(deal.dealerId) ?? deal.dealerId,
          names.get(playerId) ?? playerId,
          formatPoints(score),
        ].join(';'),
      )
    }
  }
  return rows.join('\n')
}

/**
 * Propose le partage de la sauvegarde : le JSON, qui permet de tout restaurer, et un CSV
 * lisible dans un tableur.
 *
 * La feuille de partage iOS n'accepte des fichiers que si le navigateur le permet ; à
 * défaut on retombe sur un téléchargement, qui atterrit dans l'app Fichiers.
 */
export async function exportEverything(): Promise<void> {
  const data = await buildBackup()
  const names = new Map(data.players.map((p) => [p.id, p.name]))
  const stamp = data.exportedAt.slice(0, 10)

  const files = [
    new File([JSON.stringify(data)], `tarot-${stamp}.json`, { type: 'application/json' }),
    new File([toCsv(data.deals, names)], `tarot-${stamp}.csv`, { type: 'text/csv' }),
  ]

  if (navigator.canShare?.({ files })) {
    try {
      await navigator.share({ files, title: 'Sauvegarde Tarot' })
      return
    } catch (error) {
      // Partage refusé ou annulé : on bascule sur le téléchargement.
      if ((error as DOMException)?.name === 'AbortError') return
    }
  }

  for (const file of files) {
    const url = URL.createObjectURL(file)
    const link = document.createElement('a')
    link.href = url
    link.download = file.name
    link.click()
    URL.revokeObjectURL(url)
  }
}

/**
 * Restaure une sauvegarde, en remplaçant intégralement le contenu de l'appareil.
 *
 * Le remplacement plutôt que la fusion : deux appareils qui ont divergé n'ont pas de
 * réconciliation évidente, et une fusion silencieuse produirait des parties en double ou
 * des donnes orphelines. Restaurer, c'est revenir à l'état du fichier — ce que l'écran
 * annonce avant de le faire.
 */
export async function importBackup(file: File): Promise<BackupSummary> {
  const backup = parseBackup(await file.text())
  const players = await fromBackupPlayers(backup.players)
  await replaceAll({
    players,
    games: backup.games,
    deals: backup.deals,
    rules: backup.rules,
  })
  return summarize(backup)
}
