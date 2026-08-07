import { useEffect, useState } from 'react'
import { dealStats, playerStats } from '../engine/stats'
import type { Deal, PlayerId } from '../engine/types'
import { BalanceChart, DealSplitChart, TakeSuccessChart } from '../components/charts/BarCharts'
import { CumulativeChart } from '../components/charts/CumulativeChart'
import { Button, Chip, EmptyState, Screen, TopAction } from '../components/ui'
import {
  type Game,
  getPlayers,
  listAllDeals,
  listDeals,
  listPlayers,
  type Player,
} from '../store/db'
import { exportEverything } from '../store/export'

interface StatsProps {
  /** Partie à afficher d'emblée, quand on arrive depuis le tableau. */
  game?: Game
  onClose: () => void
}

type Scope = 'partie' | 'tout'

/**
 * Statistiques, à deux échelles : la partie en cours, ou l'ensemble des parties jouées.
 *
 * L'évolution du cumul n'a de sens que sur une partie — enchaîner deux soirées dans une
 * même courbe produirait une ligne qui ne raconte rien.
 */
export function Stats({ game, onClose }: StatsProps) {
  const [scope, setScope] = useState<Scope>(game ? 'partie' : 'tout')
  const [deals, setDeals] = useState<Deal[]>([])
  const [players, setPlayers] = useState<Player[]>([])
  const [playerIds, setPlayerIds] = useState<PlayerId[]>([])
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
        const [loadedDeals, loadedPlayers] = await Promise.all([
          listAllDeals(),
          listPlayers(),
        ])
        if (cancelled) return
        // On ne retient que les joueurs qui ont réellement marqué quelque part.
        const seen = new Set(loadedDeals.flatMap((deal) => Object.keys(deal.scores)))
        const active = loadedPlayers.filter((p) => seen.has(p.id))
        setDeals(loadedDeals)
        setPlayers(active)
        setPlayerIds(active.map((p) => p.id))
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

        {scope === 'partie' && <CumulativeChart players={players} deals={deals} />}
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
