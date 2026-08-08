import { useEffect, useMemo, useState } from 'react'
import { formatPoints, formatSigned } from '../engine/rules'
import { dealStats, playerStats, type PlayerStats } from '../engine/stats'
import type { Deal, PlayerId } from '../engine/types'
import { Avatar } from '../components/Avatar'
import { Confetti } from '../components/Confetti'
import { BalanceChart, DealSplitChart, TakeSuccessChart } from '../components/charts/BarCharts'
import { CumulativeChart } from '../components/charts/CumulativeChart'
import { Button, Chip, EmptyState, Screen, TopAction } from '../components/ui'
import './stats.css'
import {
  type Game,
  getPlayers,
  listAllDeals,
  listDeals,
  listGames,
  listPlayers,
  type Player,
} from '../store/db'
import { exportEverything } from '../store/export'

interface StatsProps {
  /** Partie à afficher d'emblée, quand on arrive depuis le tableau. */
  game?: Game
  /** Vrai quand on arrive juste de « Terminer » : la partie mérite son épilogue. */
  celebrate?: boolean
  onClose: () => void
}

type Scope = 'partie' | 'tout'

/**
 * Statistiques, à deux échelles : la partie en cours, ou l'ensemble des parties jouées.
 *
 * L'évolution du cumul n'a de sens que sur une partie — enchaîner deux soirées dans une
 * même courbe produirait une ligne qui ne raconte rien.
 */
export function Stats({ game, celebrate, onClose }: StatsProps) {
  const [scope, setScope] = useState<Scope>(game ? 'partie' : 'tout')
  const [deals, setDeals] = useState<Deal[]>([])
  const [players, setPlayers] = useState<Player[]>([])
  const [playerIds, setPlayerIds] = useState<PlayerId[]>([])
  const [gameOrder, setGameOrder] = useState<Game[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let cancelled = false

    const load = async () => {
      setLoading(true)
      if (scope === 'partie' && game) {
        const [loadedDeals, loadedPlayers] = await Promise.all([
          listDeals(game.id),
          getPlayers(game.playerIds),
        ])
        if (cancelled) return
        const byId = new Map(loadedPlayers.map((p) => [p.id, p]))
        setDeals(loadedDeals)
        setPlayers(game.playerIds.map((id) => byId.get(id)).filter((p): p is Player => !!p))
        setPlayerIds(game.playerIds)
      } else {
        const [loadedDeals, loadedPlayers, loadedGames] = await Promise.all([
          listAllDeals(),
          listPlayers(),
          listGames(),
        ])
        if (cancelled) return
        // On ne retient que les joueurs qui ont réellement marqué quelque part.
        const seen = new Set(loadedDeals.flatMap((deal) => Object.keys(deal.scores)))
        const active = loadedPlayers.filter((p) => seen.has(p.id))
        setDeals(loadedDeals)
        setPlayers(active)
        setPlayerIds(active.map((p) => p.id))
        // De la plus ancienne à la plus récente : l'axe du temps se lit vers la droite.
        setGameOrder([...loadedGames].sort((a, b) => a.startedAt - b.startedAt))
      }
      if (!cancelled) setLoading(false)
    }

    load()
    return () => {
      cancelled = true
    }
  }, [game, scope])

  const perPlayer = playerStats(deals, playerIds)
  const overall = dealStats(deals)

  /**
   * Une partie = un point sur l'axe. Les parties sans donne sont écartées : elles
   * créeraient un palier plat qui ne raconte rien.
   */
  const gameGroups = useMemo(() => {
    if (scope !== 'tout') return undefined
    const byGame = new Map<string, Deal[]>()
    for (const deal of deals) {
      const list = byGame.get(deal.gameId)
      if (list) list.push(deal)
      else byGame.set(deal.gameId, [deal])
    }
    return gameOrder
      .map((game, index) => ({
        label: `partie ${index + 1}`,
        deals: byGame.get(game.id) ?? [],
      }))
      .filter((group) => group.deals.length > 0)
  }, [deals, gameOrder, scope])

  return (
    <Screen
      title="Statistiques"
      left={<TopAction onClick={onClose}>Fermer</TopAction>}
      footer={
        <Button variant="ghost" onClick={exportEverything}>
          Exporter les parties
        </Button>
      }
    >
      {celebrate && <WinnerBanner players={players} stats={perPlayer} />}

      {game && (
        <div className="chips" style={{ marginTop: 18 }}>
          <Chip
            selected={scope === 'partie'}
            onClick={() => setScope('partie')}
            label="Cette partie"
          />
          <Chip
            selected={scope === 'tout'}
            onClick={() => setScope('tout')}
            label="Toutes les parties"
          />
        </div>
      )}

      <div style={{ marginTop: 18 }}>
        {!loading && deals.length === 0 && (
          <EmptyState title="Rien à montrer">
            <p>Les statistiques apparaîtront après la première donne.</p>
          </EmptyState>
        )}

        {scope === 'partie' ? (
          <CumulativeChart players={players} deals={deals} />
        ) : (
          // Au-delà d'une partie, enchaîner toutes les donnes produirait une ligne
          // illisible : on agrège par partie, un point par soirée.
          gameGroups &&
          gameGroups.length > 1 && (
            <CumulativeChart
              players={players}
              deals={deals}
              groups={gameGroups}
              caption="Évolution de partie en partie"
              unitLabel="partie"
            />
          )
        )}
        <TakeSuccessChart players={players} stats={perPlayer} />
        <BalanceChart
          players={players}
          stats={perPlayer}
          caption={scope === 'partie' ? 'Bilan de la partie' : 'Bilan toutes parties'}
        />
        <DealSplitChart stats={overall} />
      </div>
    </Screen>
  )
}

/**
 * Épilogue de la partie : qui l'emporte, et de combien sur le suivant.
 *
 * L'écart au deuxième dit tout ce que le classement seul ne dit pas — une victoire d'un
 * point et une démonstration ne se racontent pas de la même façon.
 */
function WinnerBanner({
  players,
  stats,
}: {
  players: Player[]
  stats: PlayerStats[]
}) {
  const ranked = [...stats].sort((a, b) => b.total - a.total)
  const winner = ranked[0]
  if (!winner || ranked.length < 2) return null

  const player = players.find((p) => p.id === winner.playerId)
  if (!player) return null

  const lead = winner.total - ranked[1].total

  return (
    <div className="winner">
      <Confetti />
      <span className="winner__label">Partie terminée</span>
      <Avatar player={player} size={72} highlighted />
      <p className="winner__name">{player.name} l'emporte</p>
      <p className="winner__score num display">{formatSigned(winner.total)}</p>
      <p className="winner__lead">
        {lead === 0 ? (
          'à égalité en tête'
        ) : (
          <>
            <strong className="num">{formatPoints(lead)}</strong> points devant{' '}
            {players.find((p) => p.id === ranked[1].playerId)?.name ?? 'le suivant'}
          </>
        )}
      </p>
    </div>
  )
}
