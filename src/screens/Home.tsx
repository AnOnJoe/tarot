import { useEffect, useState } from 'react'
import { formatPoints } from '../engine/rules'
import { cumulative } from '../engine/score'
import { Avatar } from '../components/Avatar'
import { Logo, TAGLINE } from '../components/Logo'
import { Button, Collapsible, EmptyState, Screen, Sheet } from '../components/ui'
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
  /** Consulter les statistiques d'une partie close, sans la rouvrir. */
  onOpenGameStats: (game: Game) => void
  /** Rouvrir une partie close : elle redevient la partie en cours. */
  onReopen: (game: Game) => void
  onNewGame: () => void
  onOpenStats: () => void
  onOpenAchievements: () => void
  onOpenRoster: () => void
  onOpenRules: () => void
  onOpenBackup: () => void
}

/**
 * Date et heure de création d'une partie.
 *
 * L'heure n'est pas décorative : deux parties du même soir se distinguent par elle, et une
 * fois deux carnets fusionnés, plusieurs parties d'une même journée se côtoient.
 */
const DATE_FORMAT = new Intl.DateTimeFormat('fr-FR', {
  day: 'numeric',
  month: 'long',
  year: 'numeric',
  hour: '2-digit',
  minute: '2-digit',
})

/** Forme courte, pour les lignes de liste. */
const SHORT_FORMAT = new Intl.DateTimeFormat('fr-FR', {
  day: 'numeric',
  month: 'short',
  hour: '2-digit',
  minute: '2-digit',
})

/**
 * Nombre de parties visibles d'emblée, celle en cours comprise.
 *
 * L'accueil sert à reprendre la soirée, pas à consulter les archives : au bout de quelques
 * mois la liste complète repousserait tout le reste hors de l'écran.
 */
const RECENT = 3

export function Home({
  onResume,
  onOpenGameStats,
  onReopen,
  onNewGame,
  onOpenStats,
  onOpenAchievements,
  onOpenRoster,
  onOpenRules,
  onOpenBackup,
}: HomeProps) {
  const [summaries, setSummaries] = useState<GameSummary[]>([])
  const [loading, setLoading] = useState(true)
  /** Partie close sur laquelle on vient d'appuyer, en attente d'un choix. */
  const [chosen, setChosen] = useState<GameSummary | null>(null)
  const [showAll, setShowAll] = useState(false)

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
  // La partie en cours occupe l'une des trois places : elle est une partie comme une autre
  // du point de vue de qui regarde l'écran, même si elle a sa propre carte.
  const shown = showAll ? past : past.slice(0, current ? RECENT - 1 : RECENT)
  const hidden = past.length - shown.length

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
        <p className="home__tagline">{TAGLINE}</p>
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
          <p className="eyebrow">
            {showAll || hidden === 0 ? 'Parties terminées' : 'Dernières parties'}
          </p>
          <div className="list">
            {shown.map((summary) => {
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
                  onClick={() => setChosen(summary)}
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
                      {SHORT_FORMAT.format(summary.game.startedAt)} · {summary.dealCount} donne
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
          {hidden > 0 && (
            <Button variant="ghost" onClick={() => setShowAll(true)}>
              Voir les {past.length} parties
            </Button>
          )}
          {showAll && past.length > RECENT && (
            <Button variant="ghost" onClick={() => setShowAll(false)}>
              N'afficher que les dernières
            </Button>
          )}
        </>
      )}

      {!loading && summaries.length === 0 && (
        <EmptyState title="Aucune partie">
          <p>Créez votre table, et le compteur s'occupe du reste.</p>
        </EmptyState>
      )}

      {chosen && (
        <Sheet
          title={
            chosen.players.length > 0
              ? `Partie du ${DATE_FORMAT.format(chosen.game.startedAt)}`
              : 'Partie terminée'
          }
          subtitle={
            current && current.game.id !== chosen.game.id
              ? `${chosen.dealCount} donne${chosen.dealCount > 1 ? 's' : ''}. La rouvrir clôturera la partie en cours.`
              : `${chosen.dealCount} donne${chosen.dealCount > 1 ? 's' : ''}.`
          }
          onDismiss={() => setChosen(null)}
        >
          <Button
            variant="primary"
            onClick={() => {
              onOpenGameStats(chosen.game)
              setChosen(null)
            }}
          >
            Voir les statistiques
          </Button>
          <Button
            onClick={() => {
              onReopen(chosen.game)
              setChosen(null)
            }}
          >
            Rouvrir la partie
          </Button>
          <Button variant="ghost" onClick={() => setChosen(null)}>
            Annuler
          </Button>
        </Sheet>
      )}

      {/* Replié : on ouvre l'application pour jouer, pas pour régler quelque chose. */}
      <Collapsible title="Paramètres">
        <div className="list">
          <button type="button" className="list__row" onClick={onOpenStats}>
            <span className="list__grow">Statistiques</span>
            <span className="list__meta">›</span>
          </button>
          <button type="button" className="list__row" onClick={onOpenAchievements}>
            <span className="list__grow">Hauts faits</span>
            <span className="list__meta">›</span>
          </button>
          <button type="button" className="list__row" onClick={onOpenRoster}>
            <span className="list__grow">Carnet des joueurs</span>
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
      </Collapsible>
    </Screen>
  )
}
