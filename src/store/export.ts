import { CONTRACT_LABELS, formatPoints } from '../engine/rules'
import type { Deal } from '../engine/types'
import { listAllDeals, listGames, listPlayers, loadRules } from './db'

/** Sauvegarde complète : joueurs, parties, donnes et barèmes, sans les photos. */
async function buildExport() {
  const [players, games, deals, rules] = await Promise.all([
    listPlayers(),
    listGames(),
    listAllDeals(),
    loadRules(),
  ])
  return {
    application: 'tarot',
    version: 1,
    exportedAt: new Date().toISOString(),
    // Les photos sont des Blobs : on les laisse de côté pour garder un fichier lisible.
    players: players.map(({ id, name, colorIndex, createdAt }) => ({
      id,
      name,
      colorIndex,
      createdAt,
    })),
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
 * Propose le partage de la sauvegarde.
 *
 * La feuille de partage iOS n'accepte des fichiers que si le navigateur le permet ; à
 * défaut on retombe sur un téléchargement, qui atterrit dans l'app Fichiers.
 */
export async function exportEverything(): Promise<void> {
  const data = await buildExport()
  const names = new Map(data.players.map((p) => [p.id, p.name]))
  const stamp = new Date().toISOString().slice(0, 10)

  const files = [
    new File([JSON.stringify(data, null, 2)], `tarot-${stamp}.json`, {
      type: 'application/json',
    }),
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
