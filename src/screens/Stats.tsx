import { useEffect, useMemo, useState } from 'react'
import { achievements, type AchievementState } from '../engine/achievements'
import { tableNotes } from '../engine/advice'
import { formatPoints, formatSigned } from '../engine/rules'
import { dealStats, playerStats, type PlayerStats } from '../engine/stats'
import type { Deal, PlayerId, RuleSet } from '../engine/types'
import { Avatar } from '../components/Avatar'
import { Confetti } from '../components/Confetti'
import { Feats } from '../components/Feats'
import { PlayerReport } from '../components/PlayerReport'
import { BalanceChart, DealSplitChart, TakeSuccessChart } from '../components/charts/BarCharts'
import { CumulativeChart } from '../components/charts/CumulativeChart'
import { Chip, EmptyState, Screen, TopAction } from '../components/ui'
import '../components/advice.css'
import './stats.css'
import {
  type Game,
  getPlayers,
  listAllDeals,
  listDeals,
  listGames,
  listPlayers,
  loadRules,
  type Player,
} from '../store/db'

interface StatsProps {
  /** Partie à afficher d'emblée, quand on arrive depuis le tableau. */
  game?: Game
  /** Vrai quand on arrive juste de « Terminer » : la partie mérite son épilogue. */
  celebrate?: boolean
  onClose: () => void
}

type Scope = 'partie' | 'tout'

/** Les trois façons de regarder l'historique : d'ensemble, joueur par joueur, en exploits. */
type Section = 'table' | 'joueurs' | 'faits'

/**
 * Le pôle d'analyse de l'application.
 *
 * Deux échelles — la partie en cours ou tout l'historique — et trois sections. La partie
 * n'ouvre que la première : sur une soirée, les analyses de fond n'ont pas l'effectif, et
 * `advice.ts` se tairait de toute façon.
 *
 * L'évolution du cumul se lit donne par donne sur une partie, et partie par partie au-delà :
 * enchaîner deux soirées dans une même courbe produirait une ligne qui ne raconte rien.
 */
export function Stats({ game, celebrate, onClose }: StatsProps) {
  const [scope, setScope] = useState<Scope>(game ? 'partie' : 'tout')
  const [section, setSection] = useState<Section>('table')
  /** Joueur dont on lit la fiche, ou `null` pour la liste. */
  const [focus, setFocus] = useState<PlayerId | null>(null)
  const [deals, setDeals] = useState<Deal[]>([])
  const [players, setPlayers] = useState<Player[]>([])
  const [playerIds, setPlayerIds] = useState<PlayerId[]>([])
  const [gameOrder, setGameOrder] = useState<Game[]>([])
  const [rules, setRules] = useState<RuleSet | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let cancelled = false

    const load = async () => {
      setLoading(true)
      const loadedRules = await loadRules()
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
      if (!cancelled) {
        setRules(loadedRules)
        setLoading(false)
      }
    }

    load()
    return () => {
      cancelled = true
    }
  }, [game, scope])

  const perPlayer = playerStats(deals, playerIds, rules ?? undefined)
  const focused = focus === null ? null : (players.find((p) => p.id === focus) ?? null)

  return (
    <Screen
      title={focused ? focused.name : 'Statistiques'}
      left={
        focused ? (
          <TopAction onClick={() => setFocus(null)}>Joueurs</TopAction>
        ) : (
          <TopAction onClick={onClose}>Fermer</TopAction>
        )
      }
    >
      {celebrate && !focused && <WinnerBanner players={players} stats={perPlayer} />}

      {/* La fiche d'un joueur occupe l'écran seule : y superposer les onglets inviterait à
          en sortir avant même de l'avoir lue. */}
      {focused && rules ? (
        <PlayerReport
          player={focused}
          players={players}
          deals={deals}
          playerIds={playerIds}
          rules={rules}
        />
      ) : (
        <>
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

          <div className="chips" style={{ marginTop: 10 }}>
            <Chip
              selected={section === 'table'}
              onClick={() => setSection('table')}
              label="La table"
            />
            <Chip
              selected={section === 'joueurs'}
              onClick={() => setSection('joueurs')}
              label="Les joueurs"
            />
            <Chip
              selected={section === 'faits'}
              onClick={() => setSection('faits')}
              label="Hauts faits"
            />
          </div>

          {!loading && deals.length === 0 ? (
            <EmptyState title="Rien à montrer">
              <p>Les statistiques apparaîtront après la première donne.</p>
            </EmptyState>
          ) : (
            <div style={{ marginTop: 18 }}>
              {section === 'table' && (
                <TableSection
                  scope={scope}
                  deals={deals}
                  players={players}
                  playerIds={playerIds}
                  perPlayer={perPlayer}
                  gameOrder={gameOrder}
                  rules={rules}
                />
              )}
              {section === 'joueurs' && (
                <PlayerList
                  players={players}
                  stats={perPlayer}
                  onSelect={(id) => setFocus(id)}
                />
              )}
              {section === 'faits' && (
                <FeatSection deals={deals} players={players} rules={rules} loading={loading} />
              )}
            </div>
          )}
        </>
      )}
    </Screen>
  )
}

/** L'historique vu d'ensemble : les courbes, les bilans, ce que la table a d'elle-même. */
function TableSection({
  scope,
  deals,
  players,
  playerIds,
  perPlayer,
  gameOrder,
  rules,
}: {
  scope: Scope
  deals: Deal[]
  players: Player[]
  playerIds: PlayerId[]
  perPlayer: PlayerStats[]
  gameOrder: Game[]
  rules: RuleSet | null
}) {
  /**
   * Une partie = un point sur l'axe. Les parties sans donne sont écartées : elles
   * créeraient un palier plat qui ne raconte rien.
   */
  const gameGroups = useMemo(() => {
    if (scope !== 'tout') return undefined
    const byGameId = new Map<string, Deal[]>()
    for (const deal of deals) {
      const list = byGameId.get(deal.gameId)
      if (list) list.push(deal)
      else byGameId.set(deal.gameId, [deal])
    }
    return gameOrder
      .map((game, index) => ({
        label: `partie ${index + 1}`,
        deals: byGameId.get(game.id) ?? [],
      }))
      .filter((group) => group.deals.length > 0)
  }, [deals, gameOrder, scope])

  const notes = useMemo(() => {
    if (scope !== 'tout' || !rules) return []
    const nameOf = (id: PlayerId) => players.find((p) => p.id === id)?.name ?? 'l’autre'
    return tableNotes(deals, playerIds, { rules, nameOf })
  }, [deals, playerIds, players, rules, scope])

  const overall = dealStats(deals)

  return (
    <>
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

      {notes.length > 0 && (
        <>
          <p className="eyebrow">Ce que dit l’historique</p>
          <div className="advices">
            {notes.map((note) => (
              <div key={note.id} className="advice advice--table">
                <div className="advice__faces">
                  {note.playerIds.map((id) => {
                    const player = players.find((p) => p.id === id)
                    return player ? <Avatar key={id} player={player} size={26} /> : null
                  })}
                </div>
                <p>{note.text}</p>
              </div>
            ))}
          </div>
          <p className="eyebrow">Les chiffres</p>
        </>
      )}

      <TakeSuccessChart players={players} stats={perPlayer} />
      <BalanceChart
        players={players}
        stats={perPlayer}
        caption={scope === 'partie' ? 'Bilan de la partie' : 'Bilan toutes parties'}
      />
      <DealSplitChart stats={overall} />
    </>
  )
}

/**
 * La liste des joueurs, ordonnée par total.
 *
 * Chaque rangée est une porte vers une fiche complète : la liste ne montre que ce qu'il faut
 * pour choisir laquelle ouvrir.
 */
function PlayerList({
  players,
  stats,
  onSelect,
}: {
  players: Player[]
  stats: PlayerStats[]
  onSelect: (id: PlayerId) => void
}) {
  const ordered = [...stats].sort((a, b) => b.total - a.total)

  return (
    <div className="list">
      {ordered.map((stat) => {
        const player = players.find((p) => p.id === stat.playerId)
        if (!player) return null
        return (
          <button
            key={stat.playerId}
            type="button"
            className="list__row"
            onClick={() => onSelect(stat.playerId)}
          >
            <Avatar player={player} size={38} />
            <span className="list__grow">
              <span className="list__title">{player.name}</span>
              <span className="list__meta num">
                {stat.dealsPlayed} donne{stat.dealsPlayed > 1 ? 's' : ''} · {stat.takesWon}/
                {stat.takes} prise{stat.takes > 1 ? 's' : ''}
              </span>
            </span>
            <span className="list__meta num">{formatSigned(stat.total)}</span>
            <span className="list__meta">›</span>
          </button>
        )
      })}
    </div>
  )
}

/** Les hauts faits, recalculés à la demande depuis les donnes de la portée courante. */
function FeatSection({
  deals,
  players,
  rules,
  loading,
}: {
  deals: Deal[]
  players: Player[]
  rules: RuleSet | null
  loading: boolean
}) {
  const states: AchievementState[] = useMemo(
    () => (rules ? achievements(deals, rules) : []),
    [deals, rules],
  )
  return <Feats states={states} players={players} loading={loading} />
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
