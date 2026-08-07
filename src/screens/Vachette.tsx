import { useMemo, useState } from 'react'
import { TOTAL_POINTS, formatPoints, formatSigned } from '../engine/rules'
import { scoreVachette, vacheePointsRemaining } from '../engine/score'
import type { PlayerId, RuleSet, VacheeDeal } from '../engine/types'
import { Avatar } from '../components/Avatar'
import { NumberInput } from '../components/NumberInput'
import { Button, Eyebrow, Screen, TopAction } from '../components/ui'
import type { Player } from '../store/db'
import './vachette.css'

interface VachetteProps {
  players: Player[]
  rules: RuleSet
  dealNumber: number
  initial?: VacheeDeal
  onCancel: () => void
  onSubmit: (deal: VacheeDeal) => void
  onDelete?: () => void
}

export function emptyVachette(players: Player[]): VacheeDeal {
  const points: Record<PlayerId, number> = {}
  for (const player of players) points[player.id] = 0
  return { kind: 'vachette', points }
}

/**
 * Saisie d'une vachette : personne n'a pris, chacun compte ses propres points et le
 * classement fait le score. On saisit les plis de chacun, le total devant tomber sur 91.
 */
export function Vachette({
  players,
  rules,
  dealNumber,
  initial,
  onCancel,
  onSubmit,
  onDelete,
}: VachetteProps) {
  const [deal, setDeal] = useState<VacheeDeal>(initial ?? emptyVachette(players))

  const playerIds = players.map((p) => p.id)
  const remaining = vacheePointsRemaining(deal, playerIds)
  const balanced = Math.abs(remaining) < 1e-9

  const scores = useMemo(
    () => scoreVachette(deal, playerIds, rules),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [deal, players, rules],
  )

  const setPoints = (id: PlayerId, value: number) => {
    setDeal((current) => ({ ...current, points: { ...current.points, [id]: value } }))
  }

  return (
    <Screen
      title={`Vachette · donne ${dealNumber}`}
      left={<TopAction onClick={onCancel}>Annuler</TopAction>}
      right={
        onDelete && (
          <TopAction onClick={onDelete} align="end">
            Supprimer
          </TopAction>
        )
      }
      footer={
        <Button variant="primary" onClick={() => onSubmit(deal)} disabled={!balanced}>
          {balanced
            ? 'Valider la vachette'
            : remaining > 0
              ? `Il manque ${formatPoints(remaining)} points`
              : `${formatPoints(-remaining)} points en trop`}
        </Button>
      }
    >
      <p className="vachette__intro">
        Chacun pour soi : celui qui ramasse le plus de points perd le plus. Les
        {` ${TOTAL_POINTS} `}
        points du jeu doivent être répartis entre les {players.length} joueurs.
      </p>

      <Eyebrow>Points ramassés</Eyebrow>
      <div className="vachette__list">
        {players.map((player) => (
          <label key={player.id} className="vachette__row">
            <Avatar player={player} size={38} />
            <span className="vachette__name">{player.name}</span>
            <NumberInput
              className="vachette__input num"
              value={deal.points[player.id] ?? 0}
              onChange={(points) => setPoints(player.id, points)}
              ariaLabel={`Points de ${player.name}`}
            />
            <span
              className="vachette__score num"
              data-sign={
                (scores[player.id] ?? 0) > 0
                  ? 'up'
                  : (scores[player.id] ?? 0) < 0
                    ? 'down'
                    : undefined
              }
            >
              {balanced ? formatSigned(scores[player.id] ?? 0) : '—'}
            </span>
          </label>
        ))}
      </div>

      <div className="vachette__remaining" data-balanced={balanced || undefined}>
        <span>Total réparti</span>
        <span className="num">
          {formatPoints(TOTAL_POINTS - remaining)} / {TOTAL_POINTS}
        </span>
      </div>
    </Screen>
  )
}
