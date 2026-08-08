import { formatPoints, formatSigned } from '../engine/rules'
import type { Deal, PlayerId } from '../engine/types'
import type { Player } from '../store/db'
import { Avatar } from './Avatar'
import { useAnimatedNumber } from './useAnimatedNumber'
import './scoretable.css'

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
  // Les quarts de point de la Pousse allongent les cumuls (« −422,25 » fait sept signes) :
  // la colonne rétrécit à cinq joueurs, la taille du chiffre suit plutôt que de déborder.
  const totalSize = players.length >= 5 ? 13.5 : 16

  return (
    <div className="table">
      <div className="table__players" style={{ gridTemplateColumns: columns }}>
        <span />
        {players.map((player) => (
          <PlayerTile
            key={player.id}
            player={player}
            total={totals[player.id] ?? 0}
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
  isDealer,
  totalSize,
}: {
  player: Player
  total: number
  isDealer: boolean
  totalSize: number
}) {
  const shown = useAnimatedNumber(total)

  return (
    <div className="table__tile" data-dealer={isDealer || undefined}>
      {isDealer && <span className="table__badge">donne</span>}
      <Avatar player={player} size={34} />
      <span className="table__name">{player.name}</span>
      <span className="table__total num display" style={{ fontSize: totalSize }}>
        {formatPoints(shown)}
      </span>
    </div>
  )
}
