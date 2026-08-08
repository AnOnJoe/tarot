import { useState } from 'react'
import { TOTAL_POINTS, formatPoints } from '../engine/rules'
import type { Player } from '../store/db'
import { Avatar } from './Avatar'
import './pointslider.css'

interface PointSliderProps {
  /** Points réalisés par l'attaque, de 0 à 91 par pas de 0,5. */
  value: number
  onChange: (value: number) => void
  /** Points que l'attaque doit atteindre, selon ses bouts. */
  threshold: number
  taker: Player | undefined
  defenders: Player[]
}

/**
 * Le curseur de la donne : une barre de progression de l'attaque vers son contrat.
 *
 * Glisser vers la droite augmente les points du preneur, et le pouce se rapproche de son
 * portrait, à droite. L'encoche marque le contrat à réaliser et se déplace avec le nombre
 * de bouts : la franchir, c'est réussir. Le bouton « + » se trouve du côté du preneur, le
 * « − » du côté de la défense.
 */
export function PointSlider({
  value,
  onChange,
  threshold,
  taker,
  defenders,
}: PointSliderProps) {
  const [dragging, setDragging] = useState(false)

  const defensePoints = TOTAL_POINTS - value
  const diff = value - threshold
  const success = diff >= 0

  // Progression de l'attaque, mesurée depuis la gauche.
  const progress = value / TOTAL_POINTS
  const thresholdRatio = threshold / TOTAL_POINTS

  const step = (delta: number) => {
    const next = Math.min(TOTAL_POINTS, Math.max(0, value + delta))
    onChange(Math.round(next * 2) / 2)
  }

  return (
    <div className="slider" data-success={success || undefined}>
      <div className="slider__camps">
        <div className="slider__camp">
          <div className="slider__stack">
            {defenders.map((player) => (
              <Avatar key={player.id} player={player} size={30} />
            ))}
          </div>
          <div>
            <div className="slider__campLabel">Défense</div>
            <div className="slider__campPoints num display">
              {formatPoints(defensePoints)}
            </div>
          </div>
        </div>

        <div className="slider__camp slider__camp--right">
          <div>
            <div className="slider__campLabel">Attaque</div>
            <div className="slider__campPoints num display">{formatPoints(value)}</div>
          </div>
          <Avatar player={taker} size={38} highlighted />
        </div>
      </div>

      <div className="slider__row">
        <button
          type="button"
          className="slider__step"
          onClick={() => step(-0.5)}
          aria-label="Retirer un demi-point à l'attaque"
        >
          −
        </button>

        <div className="slider__track" data-dragging={dragging || undefined}>
          {/* Points marqués par l'attaque, du bord gauche jusqu'au pouce. */}
          <div className="slider__fill" style={{ width: `${progress * 100}%` }} />
          <div
            className="slider__notch"
            style={{
              left: `calc(var(--thumb) / 2 + (100% - var(--thumb)) * ${thresholdRatio})`,
            }}
          >
            <span className="slider__notchLabel num">{threshold}</span>
          </div>
          <input
            className="slider__input"
            type="range"
            min={0}
            max={TOTAL_POINTS}
            step={0.5}
            value={value}
            onChange={(event) => onChange(Number(event.target.value))}
            onPointerDown={() => setDragging(true)}
            onPointerUp={() => setDragging(false)}
            onPointerCancel={() => setDragging(false)}
            aria-label="Points réalisés par l'attaque"
            aria-valuetext={`${formatPoints(value)} points sur ${threshold} à réaliser`}
          />
        </div>

        <button
          type="button"
          className="slider__step"
          onClick={() => step(0.5)}
          aria-label="Ajouter un demi-point à l'attaque"
        >
          +
        </button>
      </div>

      <p className="slider__verdict">
        {diff === 0 ? (
          // Le contrat tombe pile : « réussi de 0 points » se lirait comme un échec.
          <>
            Contrat réussi <strong>au point près</strong>
          </>
        ) : (
          <>
            {success ? 'Contrat réussi de ' : 'Chute de '}
            <strong className="num">{formatPoints(Math.abs(diff))}</strong>
            {Math.abs(diff) <= 1 ? ' point' : ' points'}
          </>
        )}
      </p>
    </div>
  )
}
