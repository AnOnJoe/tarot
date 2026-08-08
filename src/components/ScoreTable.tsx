import { formatSigned, splitPoints } from '../engine/rules'
import type { Deal, PlayerId } from '../engine/types'
import type { Player } from '../store/db'
import { Avatar } from './Avatar'
import { Rank, ranksOf } from './Rank'
import { useAnimatedNumber } from './useAnimatedNumber'
import { useElementWidth } from './useElementWidth'
import './scoretable.css'

/** Gouttière des numéros de donne, écart entre colonnes et marge interne d'une tuile,
 *  en pixels — doivent suivre scoretable.css. */
const GUTTER = 26
const COLUMN_GAP = 7
const TILE_PADDING = 12

/** Chasse d'un chiffre, en fraction de la taille de police, et corps de la décimale
 *  relativement à celui de l'unité — doivent suivre scoretable.css. */
const GLYPH_WIDTH = 0.6
const FRACTION_RATIO = 0.58

/** Abréviations tenant dans la gouttière du tableau. */
const SHORT_CONTRACT: Record<string, string> = {
  petite: 'Pte',
  pousse: 'Psh',
  garde: 'Gde',
  gardeSans: 'G.S',
  gardeContre: 'G.C',
  vachette: 'Vch',
}

interface ScoreTableProps {
  players: Player[]
  deals: Deal[]
  totals: Record<PlayerId, number>
  /** Joueur qui donne la prochaine donne. */
  nextDealerId: PlayerId
  onOpenDeal: (deal: Deal) => void
}

/**
 * Le tableau de la partie : une colonne par joueur, une ligne par donne.
 *
 * Les tuiles de joueurs ne sont pas cliquables : ouvrir une donne passe uniquement par le
 * bouton « Nouvelle donne ». Un portrait qui déclenche une saisie invite à désigner le
 * preneur d'un geste réflexe, et donc à se tromper.
 *
 * Gain et perte se lisent à la couleur du chiffre, pas à un aplat derrière : l'information
 * passe aussi bien et le tableau reste léger même sur vingt donnes.
 */
export function ScoreTable({
  players,
  deals,
  totals,
  nextDealerId,
  onOpenDeal,
}: ScoreTableProps) {
  const columns = `26px repeat(${players.length}, minmax(0, 1fr))`
  const [headRef, headWidth] = useElementWidth<HTMLDivElement>()

  const totals_ = players.map((p) => totals[p.id] ?? 0)
  const ranks = ranksOf(totals_)

  /*
   * Taille du cumul, déduite de la place réelle plutôt que fixée à l'avance.
   *
   * C'est la longueur du nombre qui contraint, pas le nombre de joueurs : à quatre, « 150 »
   * tiendrait en 35 px là où « −422,25 » plafonne à 15. La décimale comptant pour un peu
   * plus de la moitié d'un chiffre entier, elle pèse d'autant moins dans le calcul. Une
   * valeur unique pour toutes les colonnes, sans quoi les chiffres ne s'aligneraient plus.
   */
  const widest = Math.max(
    1,
    ...totals_.map((total) => {
      const { integer, fraction } = splitPoints(total)
      return integer.length + (fraction?.length ?? 0) * FRACTION_RATIO
    }),
  )
  const column = (headWidth - GUTTER - players.length * COLUMN_GAP) / players.length
  const totalSize = headWidth
    ? Math.max(13, Math.min(32, (column - TILE_PADDING) / (widest * GLYPH_WIDTH)))
    : 16

  return (
    <div className="table">
      <div ref={headRef} className="table__players" style={{ gridTemplateColumns: columns }}>
        <span />
        {players.map((player, index) => (
          <PlayerTile
            key={player.id}
            player={player}
            total={totals_[index]}
            rank={ranks?.[index]}
            isDealer={player.id === nextDealerId}
            totalSize={totalSize}
          />
        ))}
      </div>

      <div className="table__body">
        {deals.map((deal, index) => (
          <button
            key={deal.id}
            type="button"
            // La dernière ligne apparaît en fondu : on voit la donne rejoindre le tableau.
            className="table__row"
            data-latest={index === deals.length - 1 || undefined}
            style={{ gridTemplateColumns: columns }}
            onClick={() => onOpenDeal(deal)}
          >
            <span className="table__gutter">
              <span className="table__index num">{deal.index + 1}</span>
              <span className="table__contract">
                {SHORT_CONTRACT[
                  deal.input.kind === 'vachette' ? 'vachette' : deal.input.contract
                ]}
              </span>
            </span>
            {players.map((player) => {
              const score = deal.scores[player.id] ?? 0
              return (
                <span
                  key={player.id}
                  className="table__cell num"
                  data-result={score > 0 ? 'win' : score < 0 ? 'loss' : undefined}
                >
                  {formatSigned(score)}
                </span>
              )
            })}
          </button>
        ))}
      </div>
    </div>
  )
}

/**
 * Tuile d'un joueur. Le cumul défile jusqu'à sa nouvelle valeur après chaque donne :
 * on voit d'un coup d'œil qui a bougé, et dans quel sens.
 */
function PlayerTile({
  player,
  total,
  rank,
  isDealer,
  totalSize,
}: {
  player: Player
  total: number
  rank?: number
  isDealer: boolean
  totalSize: number
}) {
  const shown = useAnimatedNumber(total)
  const { integer, fraction } = splitPoints(shown)

  return (
    <div className="table__tile" data-dealer={isDealer || undefined}>
      {isDealer && <span className="table__badge">donne</span>}
      <Avatar player={player} size={34} />
      <span className="table__name">{player.name}</span>
      <span className="table__total num display" style={{ fontSize: totalSize }}>
        {integer}
        {fraction && <span className="table__frac">{fraction}</span>}
      </span>
      {rank !== undefined && <Rank rank={rank} />}
    </div>
  )
}
