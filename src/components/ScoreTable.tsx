import { formatPoints, formatSigned } from '../engine/rules'
import type { Deal, PlayerId } from '../engine/types'
import type { Player } from '../store/db'
import { Avatar } from './Avatar'
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
  /** Ouvre la saisie d'une donne avec ce joueur comme preneur. */
  onTake: (takerId: PlayerId) => void
  onOpenDeal: (deal: Deal) => void
}

/**
 * Le tableau de la partie : une colonne par joueur, une ligne par donne.
 *
 * La tuile entière d'un joueur est la cible tactile qui ouvre une donne dont il est
 * preneur — désigner qui a pris et saisir la donne sont le même geste.
 *
 * Gain et perte se lisent à la couleur du chiffre, pas à un aplat derrière : l'information
 * passe aussi bien et le tableau reste léger même sur vingt donnes.
 */
export function ScoreTable({
  players,
  deals,
  totals,
  nextDealerId,
  onTake,
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
        {players.map((player) => {
          const total = totals[player.id] ?? 0
          const isDealer = player.id === nextDealerId
          return (
            <button
              key={player.id}
              type="button"
              className="tile-btn table__tile"
              data-dealer={isDealer || undefined}
              onClick={() => onTake(player.id)}
            >
              {isDealer && <span className="table__badge">donne</span>}
              <Avatar player={player} size={34} />
              <span className="table__name">{player.name}</span>
              <span
                className="table__total num display"
                style={{ fontSize: totalSize }}
              >
                {formatPoints(total)}
              </span>
              <span className="sr-only">{player.name} prend</span>
            </button>
          )
        })}
      </div>

      <div className="table__body">
        {deals.map((deal) => (
          <button
            key={deal.id}
            type="button"
            className="table__row"
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
