import { useEffect, useState } from 'react'
import { CONTRACT_LABELS, formatPoints, formatSigned } from '../engine/rules'
import type { PlayerId } from '../engine/types'
import type { Player } from '../store/db'
import { Avatar } from './Avatar'
import { Confetti } from './Confetti'
import './dealreveal.css'

export interface RevealData {
  /** Intitulé du contrat joué, vachette comprise. */
  contract: keyof typeof CONTRACT_LABELS
  takerId: PlayerId | null
  /** Écart au contrat, signé. `null` pour une vachette, qui n'en a pas. */
  diff: number | null
  scores: Record<PlayerId, number>
  /** Exploits de la donne, à mettre en avant. */
  feats: string[]
  /** Meneur avant et après la donne, pour l'annonce du changement de tête. */
  previousLeaderId: PlayerId | null
  leaderId: PlayerId | null
}

interface DealRevealProps {
  data: RevealData
  players: Player[]
  onDone: () => void
}

/** Cadence de la mise en scène, en millisecondes. */
const BEAT = { verdict: 240, scores: 480, stagger: 110, leader: 1150, close: 3400 }

/**
 * Révélation d'une donne : le verdict, puis les points joueur par joueur, puis le meneur.
 *
 * L'intérêt n'est pas décoratif — c'est le moment où l'on découvre qui prend la tête, et
 * l'étaler de quelques centaines de millisecondes en fait un événement de table plutôt
 * qu'une ligne qui s'ajoute. Un appui n'importe où abrège tout, et l'écran se ferme seul.
 */
export function DealReveal({ data, players, onDone }: DealRevealProps) {
  const [step, setStep] = useState(0)

  useEffect(() => {
    const reduced = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches
    if (reduced) {
      setStep(3)
      const timer = setTimeout(onDone, 900)
      return () => clearTimeout(timer)
    }

    const timers = [
      setTimeout(() => setStep(1), BEAT.verdict),
      setTimeout(() => setStep(2), BEAT.scores),
      setTimeout(() => setStep(3), BEAT.leader),
      setTimeout(onDone, BEAT.close),
    ]
    return () => timers.forEach(clearTimeout)
  }, [onDone])

  const taker = players.find((p) => p.id === data.takerId)
  const leader = players.find((p) => p.id === data.leaderId)
  const leaderChanged =
    data.leaderId !== null && data.leaderId !== data.previousLeaderId

  /*
   * Les confettis saluent un renversement, pas une prise de tête initiale : à la première
   * donne le meneur passe forcément de personne à quelqu'un, et fêter cela banaliserait
   * l'effet dès le premier tour.
   */
  const leaderStolen = leaderChanged && data.previousLeaderId !== null
  const success = data.diff !== null && data.diff >= 0
  const hasFeat = data.feats.length > 0

  return (
    <div className="reveal" role="dialog" aria-label="Résultat de la donne" onClick={onDone}>
      {(leaderStolen || hasFeat) && step >= 3 && <Confetti count={hasFeat ? 110 : 70} />}

      <div className="reveal__card">
        <p className="reveal__contract">
          {CONTRACT_LABELS[data.contract]}
          {taker && <> · {taker.name}</>}
        </p>

        {data.diff !== null && (
          <p
            className="reveal__verdict display"
            data-success={success || undefined}
            data-shown={step >= 1 || undefined}
          >
            {data.diff === 0
              ? 'Au point près'
              : success
                ? `Réussi de ${formatPoints(data.diff)}`
                : `Chute de ${formatPoints(Math.abs(data.diff))}`}
          </p>
        )}

        {hasFeat && (
          <div className="reveal__feats" data-shown={step >= 1 || undefined}>
            {data.feats.map((feat) => (
              <span key={feat} className="reveal__feat">
                {feat}
              </span>
            ))}
          </div>
        )}

        <div className="reveal__scores">
          {players.map((player, index) => {
            const score = data.scores[player.id] ?? 0
            return (
              <div
                key={player.id}
                className="reveal__score"
                data-shown={step >= 2 || undefined}
                style={{ transitionDelay: `${index * BEAT.stagger}ms` }}
              >
                <Avatar player={player} size={30} />
                <span className="reveal__scoreName">{player.name}</span>
                <span
                  className="reveal__scoreValue num"
                  data-sign={score > 0 ? 'up' : score < 0 ? 'down' : undefined}
                >
                  {formatSigned(score)}
                </span>
              </div>
            )
          })}
        </div>

        <p className="reveal__leader" data-shown={step >= 3 || undefined}>
          {leader ? (
            leaderChanged ? (
              <>
                <strong>{leader.name}</strong> prend la tête
              </>
            ) : (
              <>
                <strong>{leader.name}</strong> reste en tête
              </>
            )
          ) : (
            'Tout le monde à égalité'
          )}
        </p>
      </div>

      <p className="reveal__hint">Touchez pour continuer</p>
    </div>
  )
}
