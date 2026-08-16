import { useEffect, useMemo, useState } from 'react'
import { tableHighlights, type Highlight } from '../engine/advice'
import { formatPoints } from '../engine/rules'
import { cumulative } from '../engine/score'
import type { Deal, PlayerId, RuleSet } from '../engine/types'
import { Avatar } from '../components/Avatar'
import { Logo, TAGLINE } from '../components/Logo'
import { SwipeToDelete } from '../components/SwipeToDelete'
import { Button, Collapsible, EmptyState, Screen, Sheet } from '../components/ui'
import {
  type Game,
  type Player,
  deleteGame,
  getLastBackupAt,
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
  /** Barèmes en vigueur : les accroches recalculent des écarts au seuil pour les établir. */
  rules: RuleSet
  onResume: (game: Game) => void
  /** Consulter les statistiques d'une partie close, sans la rouvrir. */
  onOpenGameStats: (game: Game) => void
  /** Rouvrir une partie close : elle redevient la partie en cours. */
  onReopen: (game: Game) => void
  onNewGame: () => void
  onOpenStats: () => void
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

/**
 * Parties terminées depuis la dernière sauvegarde au-delà desquelles on le rappelle.
 *
 * Assez haut pour ne pas harceler après une soirée, assez bas pour qu'une saison de jeu ne
 * repose jamais sur le seul stockage d'un téléphone.
 */
const BACKUP_NAG = 3

export function Home({
  rules,
  onResume,
  onOpenGameStats,
  onReopen,
  onNewGame,
  onOpenStats,
  onOpenRoster,
  onOpenRules,
  onOpenBackup,
}: HomeProps) {
  const [summaries, setSummaries] = useState<GameSummary[]>([])
  const [loading, setLoading] = useState(true)
  /** Partie close sur laquelle on vient d'appuyer, en attente d'un choix. */
  const [chosen, setChosen] = useState<GameSummary | null>(null)
  const [showAll, setShowAll] = useState(false)
  /** Parties terminées qui n'existent dans aucun fichier de sauvegarde. */
  const [unsaved, setUnsaved] = useState(0)
  /** Partie dont le glissement est ouvert : une seule à la fois, comme dans iOS. */
  const [swiped, setSwiped] = useState<string | null>(null)
  /** Toutes les donnes, réunies de partie en partie pour nourrir la carte des statistiques. */
  const [allDeals, setAllDeals] = useState<Deal[]>([])

  const load = async () => {
    const [games, lastBackupAt] = await Promise.all([listGames(), getLastBackupAt()])
    setUnsaved(
      games.filter((game) => game.endedAt !== null && game.endedAt > (lastBackupAt ?? 0))
        .length,
    )
    const built = await Promise.all(
      games.map(async (game) => {
        const [players, deals] = await Promise.all([
          getPlayers(game.playerIds),
          listDeals(game.id),
        ])
        return {
          game,
          players,
          deals,
          totals: cumulative(deals, game.playerIds),
          dealCount: deals.length,
        }
      }),
    )
    // Les donnes sont déjà là, partie par partie : les recharger d'un bloc pour la carte
    // serait un second parcours complet de la base à chaque retour à l'accueil.
    setAllDeals(built.flatMap((summary) => summary.deals))
    setSummaries(built.map(({ deals: _deals, ...summary }) => summary))
    setLoading(false)
  }

  useEffect(() => {
    load()
  }, [])

  /**
   * Suppression définitive d'une partie.
   *
   * Le décompte figure dans la question : « supprimer cette partie » se confirme à la
   * légère, « supprimer 14 donnes » beaucoup moins. Rien ne la récupère ensuite, sinon une
   * sauvegarde.
   */
  const remove = async (summary: GameSummary) => {
    const donnes = `${summary.dealCount} donne${summary.dealCount > 1 ? 's' : ''}`
    const quoi =
      summary.game.endedAt === null
        ? `Supprimer la partie en cours et ses ${donnes} ?`
        : `Supprimer la partie du ${SHORT_FORMAT.format(summary.game.startedAt)} et ses ${donnes} ?`
    if (!confirm(`${quoi} C'est définitif.`)) return
    await deleteGame(summary.game.id)
    setSwiped(null)
    await load()
  }

  const current = summaries.find((s) => s.game.endedAt === null)
  const past = summaries.filter((s) => s.game.endedAt !== null)
  // La partie en cours occupe l'une des trois places : elle est une partie comme une autre
  // du point de vue de qui regarde l'écran, même si elle a sa propre carte.
  const shown = showAll ? past : past.slice(0, current ? RECENT - 1 : RECENT)
  const hidden = past.length - shown.length

  /** Le carnet reconstitué depuis les parties : l'accueil n'a pas à le relire. */
  const roster = useMemo(() => {
    const byId = new Map<PlayerId, Player>()
    for (const summary of summaries) {
      for (const player of summary.players) byId.set(player.id, player)
    }
    return byId
  }, [summaries])

  const highlights = useMemo(() => {
    const seen = new Set(allDeals.flatMap((deal) => Object.keys(deal.scores)))
    return tableHighlights(
      allDeals,
      [...roster.keys()].filter((id) => seen.has(id)),
      { rules, nameOf: (id) => roster.get(id)?.name ?? 'quelqu’un' },
    )
  }, [allDeals, roster, rules])

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
          <SwipeToDelete
            open={swiped === current.game.id}
            onOpenChange={(open) => setSwiped(open ? current.game.id : null)}
            onDelete={() => remove(current)}
            label="Supprimer la partie en cours"
          >
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
          </SwipeToDelete>
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
                <SwipeToDelete
                  key={summary.game.id}
                  open={swiped === summary.game.id}
                  onOpenChange={(open) => setSwiped(open ? summary.game.id : null)}
                  onDelete={() => remove(summary)}
                  label={`Supprimer la partie du ${SHORT_FORMAT.format(summary.game.startedAt)}`}
                >
                  <button
                    type="button"
                    className="list__row"
                    onClick={() => setChosen(summary)}
                  >
                    {winner && <Avatar player={winner} size={34} />}
                    <span className="list__grow">
                      <span className="list__title">
                        {winner ? `${winner.name} l'emporte` : 'Partie'}
                      </span>
                      <span className="list__meta">
                        {SHORT_FORMAT.format(summary.game.startedAt)} · {summary.dealCount}{' '}
                        donne{summary.dealCount > 1 ? 's' : ''}
                      </span>
                    </span>
                    <span className="list__meta num">
                      {winner ? formatPoints(summary.totals[winner.id] ?? 0) : ''}
                    </span>
                  </button>
                </SwipeToDelete>
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

      {/* Elle porte ce que l'historique a de plus vivant à dire au moment où l'on ouvre
          l'application : c'est ce qui donne envie d'y entrer, là où la même entrée rangée
          sous « Paramètres » n'appelait personne. Le titre nomme la destination, les deux
          accroches font le travail d'attirer l'œil. */}
      {allDeals.length > 0 && (
        <>
          <p className="eyebrow">Statistiques</p>
          <button type="button" className="pulse" onClick={onOpenStats}>
            {highlights.length > 0 ? (
              highlights.map((highlight) => (
                <PulseRow
                  key={highlight.id}
                  highlight={highlight}
                  player={highlight.playerId ? roster.get(highlight.playerId) : undefined}
                />
              ))
            ) : (
              <span className="pulse__row">
                <span className="pulse__text">
                  <strong className="pulse__headline">Les statistiques</strong>
                  <span className="pulse__detail">
                    courbes, prises, bilans et hauts faits
                  </span>
                </span>
              </span>
            )}
            <span className="pulse__more">Tout voir ›</span>
          </button>
        </>
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
          {/* Le glissement ne s'annonce pas : qui ne le connaît pas trouve la suppression
              ici, où il vient déjà choisir quoi faire de la partie. */}
          <Button
            variant="danger"
            onClick={() => {
              const target = chosen
              setChosen(null)
              remove(target)
            }}
          >
            Supprimer la partie
          </Button>
          <Button variant="ghost" onClick={() => setChosen(null)}>
            Annuler
          </Button>
        </Sheet>
      )}

      {/* Le seul vrai risque du projet : tout tient dans le stockage d'un navigateur, sur
          un téléphone. Le rappel s'éteint de lui-même dès qu'un fichier est sorti. */}
      {unsaved >= BACKUP_NAG && (
        <div className="notice">
          <p className="notice__text">
            <strong>
              {unsaved} parties ne sont sauvegardées que sur ce téléphone.
            </strong>{' '}
            Perdu ou réinitialisé, il n'en resterait rien.
          </p>
          <Button onClick={onOpenBackup}>Exporter une sauvegarde</Button>
        </div>
      )}

      {/* Replié, et réduit à ce qui se règle vraiment : on ouvre l'application pour jouer,
          et les statistiques ont désormais leur carte plus haut. */}
      <Collapsible title="Paramètres">
        <div className="list">
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

/**
 * Une accroche de la carte de la table.
 *
 * Le portrait vaut mieux qu'un puce : il rattache l'annonce à quelqu'un du premier coup
 * d'œil, et c'est la même identité colorée que dans les courbes.
 */
function PulseRow({ highlight, player }: { highlight: Highlight; player?: Player }) {
  return (
    <span className="pulse__row">
      {player && <Avatar player={player} size={34} />}
      <span className="pulse__text">
        <strong className="pulse__headline">{highlight.headline}</strong>
        <span className="pulse__detail num">{highlight.detail}</span>
      </span>
    </span>
  )
}
