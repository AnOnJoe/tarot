import { useEffect, useState } from 'react'
import { formatPoints } from '../engine/rules'
import { cumulative } from '../engine/score'
import { Avatar } from '../components/Avatar'
import { Logo } from '../components/Logo'
import { Button, EmptyState, Screen } from '../components/ui'
import {
  type Game,
  type Player,
  deleteGame,
  getPlayers,
  listDeals,
  listGames,
} from '../store/db'
import './home.css'

/** Une partie de la liste, enrichie de son classement final. */
interface GameSummary {
  game: Game
  players: Player[]
  totals: Record<string, number>
  dealCount: number
}

interface HomeProps {
  onResume: (game: Game) => void
  onNewGame: () => void
  onOpenStats: () => void
  onOpenAchievements: () => void
  onOpenRules: () => void
  onOpenBackup: () => void
}

const DATE_FORMAT = new Intl.DateTimeFormat('fr-FR', {
  day: 'numeric',
  month: 'long',
  year: 'numeric',
})

export function Home({
  onResume,
  onNewGame,
  onOpenStats,
  onOpenAchievements,
  onOpenRules,
  onOpenBackup,
}: HomeProps) {
  const [summaries, setSummaries] = useState<GameSummary[]>([])
  const [loading, setLoading] = useState(true)

  const load = async () => {
    const games = await listGames()
    const built = await Promise.all(
      games.map(async (game) => {
        const [players, deals] = await Promise.all([
          getPlayers(game.playerIds),
          listDeals(game.id),
        ])
        return {
          game,
          players,
          totals: cumulative(deals, game.playerIds),
          dealCount: deals.length,
        }
      }),
    )
    setSummaries(built)
    setLoading(false)
  }

  useEffect(() => {
    load()
  }, [])

  const remove = async (game: Game) => {
    if (!confirm('Supprimer cette partie et toutes ses donnes ?')) return
    await deleteGame(game.id)
    await load()
  }

  const current = summaries.find((s) => s.game.endedAt === null)
  const past = summaries.filter((s) => s.game.endedAt !== null)

  return (
    <Screen
      title=""
      footer={
        <Button variant="primary" onClick={onNewGame}>
          Nouvelle partie
        </Button>
      }
    >
      {/* L'accueil porte la signature à la place d'un titre : c'est la première chose
          qu'on voit en ouvrant, et le seul écran qui n'a rien à annoncer d'autre. */}
      <header className="home__brand">
        <Logo />
        <p className="home__tagline">Chacun pour soi</p>
      </header>

      {current && (
        <>
          <p className="eyebrow">Partie en cours</p>
          <button type="button" className="resume" onClick={() => onResume(current.game)}>
            <div className="resume__players">
              {current.players.map((player) => (
                <span key={player.id} className="resume__player">
                  <Avatar player={player} size={40} />
                  <span className="resume__score num display">
                    {formatPoints(current.totals[player.id] ?? 0)}
                  </span>
                </span>
              ))}
            </div>
            <span className="resume__meta">
              {current.dealCount} donne{current.dealCount > 1 ? 's' : ''} · reprendre
            </span>
          </button>
        </>
      )}

      {past.length > 0 && (
        <>
          <p className="eyebrow">Parties terminées</p>
          <div className="list">
            {past.map((summary) => {
              const winner = summary.players.reduce<Player | undefined>(
                (best, player) =>
                  !best || (summary.totals[player.id] ?? 0) > (summary.totals[best.id] ?? 0)
                    ? player
                    : best,
                undefined,
              )
              return (
                <button
                  key={summary.game.id}
                  type="button"
                  className="list__row"
                  onClick={() => onResume(summary.game)}
                  onContextMenu={(event) => {
                    event.preventDefault()
                    remove(summary.game)
                  }}
                >
                  {winner && <Avatar player={winner} size={34} />}
                  <span className="list__grow">
                    <span className="list__title">
                      {winner ? `${winner.name} l'emporte` : 'Partie'}
                    </span>
                    <span className="list__meta">
                      {DATE_FORMAT.format(summary.game.startedAt)} · {summary.dealCount} donne
                      {summary.dealCount > 1 ? 's' : ''}
                    </span>
                  </span>
                  <span className="list__meta num">
                    {winner ? formatPoints(summary.totals[winner.id] ?? 0) : ''}
                  </span>
                </button>
              )
            })}
          </div>
        </>
      )}

      {!loading && summaries.length === 0 && (
        <EmptyState title="Aucune partie">
          <p>Créez votre table, et le compteur s'occupe du reste.</p>
        </EmptyState>
      )}

      <p className="eyebrow">Réglages</p>
      <div className="list">
        <button type="button" className="list__row" onClick={onOpenStats}>
          <span className="list__grow">Statistiques</span>
          <span className="list__meta">›</span>
        </button>
        <button type="button" className="list__row" onClick={onOpenAchievements}>
          <span className="list__grow">Hauts faits</span>
          <span className="list__meta">›</span>
        </button>
        <button type="button" className="list__row" onClick={onOpenRules}>
          <span className="list__grow">Règles maison</span>
          <span className="list__meta">›</span>
        </button>
        <button type="button" className="list__row" onClick={onOpenBackup}>
          <span className="list__grow">Sauvegarde</span>
          <span className="list__meta">›</span>
        </button>
      </div>
    </Screen>
  )
}
