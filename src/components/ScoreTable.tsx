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
  /** Joueur qui donne la prochaine donne : un liseré doré le signale. */
  nextDealerId: PlayerId
  /** Ouvre la saisie d'une donne avec ce joueur comme preneur. */
  onTake: (takerId: PlayerId) => void
  onOpenDeal: (deal: Deal) => void
}

/**
 * Le tableau de la partie : une colonne par joueur, une ligne par donne.
 *
 * L'en-tête est collant et porte les cumuls ainsi que le bouton « + » de chaque joueur —
 * prendre la donne et désigner le preneur sont le même geste.
 */
export function ScoreTable({
  players,
  deals,
  totals,
  nextDealerId,
  onTake,
  onOpenDeal,
}: ScoreTableProps) {
  const columns = `34px repeat(${players.length}, minmax(0, 1fr))`

  return (
    <div className="table">
      <div className="table__head" style={{ gridTemplateColumns: columns }}>
        <div className="table__gutter table__gutter--head" />
        {players.map((player) => {
          const total = totals[player.id] ?? 0
          return (
            <div key={player.id} className="table__player">
              {player.id === nextDealerId && (
                <span className="table__dealer">donne</span>
              )}
              <Avatar player={player} size={40} highlighted={player.id === nextDealerId} />
              <span className="table__name">{player.name}</span>
              <span
                className="table__total num serif"
                data-sign={total > 0 ? 'up' : total < 0 ? 'down' : undefined}
              >
                {formatPoints(total)}
              </span>
              <button
                type="button"
                className="table__take"
                onClick={() => onTake(player.id)}
                aria-label={`${player.name} prend`}
              >
                +
              </button>
            </div>
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
