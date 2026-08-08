import { useRef, useState } from 'react'
import { formatPoints } from '../../engine/rules'
import { cumulativeSeries } from '../../engine/score'
import type { Deal, PlayerId } from '../../engine/types'
import { seriesColor } from '../../palette'
import type { Player } from '../../store/db'
import './charts.css'

const W = 320
const H = 190
const PAD = { top: 14, right: 58, bottom: 22, left: 30 }
/** Au-delà, le libellé direct déborderait de la marge réservée à droite. */
const MAX_LABEL = 7

interface CumulativeChartProps {
  players: Player[]
  deals: Deal[]
}

/**
 * Évolution du cumul, donne après donne : c'est le graphique qui raconte la soirée.
 *
 * Chaque ligne porte le nom de son joueur en bout de course — l'identité ne repose donc
 * jamais sur la seule couleur. Un appui sur le tracé fait apparaître le curseur de lecture
 * avec les scores de la donne pointée.
 */
export function CumulativeChart({ players, deals }: CumulativeChartProps) {
  const svgRef = useRef<SVGSVGElement>(null)
  const [cursor, setCursor] = useState<number | null>(null)

  if (deals.length === 0) return null

  const playerIds = players.map((p) => p.id)
  // On part de zéro : la ligne démarre avant la première donne, à la marque du départ.
  const series = [{} as Record<PlayerId, number>, ...cumulativeSeries(deals, playerIds)]
  series[0] = Object.fromEntries(playerIds.map((id) => [id, 0]))

  const values = series.flatMap((point) => playerIds.map((id) => point[id] ?? 0))
  const min = Math.min(0, ...values)
  const max = Math.max(0, ...values)
  const span = max - min || 1

  const x = (index: number) =>
    PAD.left + (index / Math.max(1, series.length - 1)) * (W - PAD.left - PAD.right)
  const y = (value: number) =>
    PAD.top + (1 - (value - min) / span) * (H - PAD.top - PAD.bottom)

  const track = (event: React.PointerEvent<SVGSVGElement>) => {
    const svg = svgRef.current
    if (!svg) return
    const rect = svg.getBoundingClientRect()
    const ratio = (event.clientX - rect.left) / rect.width
    const index = Math.round(
      ((ratio * W - PAD.left) / (W - PAD.left - PAD.right)) * (series.length - 1),
    )
    setCursor(Math.min(series.length - 1, Math.max(0, index)))
  }

  const zeroY = y(0)
  const active = cursor === null ? null : series[cursor]

  return (
    <figure className="chart">
      <figcaption className="chart__caption">
        Cumul au fil des donnes
        {active && cursor !== null && (
          <span className="chart__readout num">
            {cursor === 0 ? 'départ' : `donne ${cursor}`}
          </span>
        )}
      </figcaption>

      <svg
        ref={svgRef}
        viewBox={`0 0 ${W} ${H}`}
        className="chart__svg"
        role="img"
        aria-label="Évolution du score cumulé de chaque joueur"
        onPointerDown={track}
        onPointerMove={(event) => cursor !== null && track(event)}
        onPointerUp={() => setCursor(null)}
        onPointerLeave={() => setCursor(null)}
      >
        {/* Le zéro est la seule référence qui compte : tout le reste est repère. */}
        <line
          x1={PAD.left}
          x2={W - PAD.right}
          y1={zeroY}
          y2={zeroY}
          className="chart__zero"
        />
        <text x={PAD.left - 5} y={zeroY + 3} className="chart__tick" textAnchor="end">
          0
        </text>
        <text x={PAD.left - 5} y={y(max) + 3} className="chart__tick" textAnchor="end">
          {formatPoints(Math.round(max))}
        </text>
        <text x={PAD.left - 5} y={y(min) + 3} className="chart__tick" textAnchor="end">
          {formatPoints(Math.round(min))}
        </text>

        {cursor !== null && (
          <line
            x1={x(cursor)}
            x2={x(cursor)}
            y1={PAD.top}
            y2={H - PAD.bottom}
            className="chart__crosshair"
          />
        )}

        {players.map((player) => {
          const path = series
            .map((point, index) => `${index === 0 ? 'M' : 'L'}${x(index)} ${y(point[player.id] ?? 0)}`)
            .join(' ')
          const last = series[series.length - 1][player.id] ?? 0
          return (
            <g key={player.id}>
              <path d={path} className="chart__line" stroke={seriesColor(player.colorIndex)} />
              {cursor !== null && (
                <circle
                  cx={x(cursor)}
                  cy={y(series[cursor][player.id] ?? 0)}
                  r={4}
                  fill={seriesColor(player.colorIndex)}
                  className="chart__dot"
                />
              )}
              {/* Libellé direct en bout de ligne : l'identité ne tient pas à la couleur seule. */}
              <text
                x={W - PAD.right + 5}
                y={y(last) + 3}
                className="chart__endLabel"
                fill={seriesColor(player.colorIndex)}
              >
                {player.name.length > MAX_LABEL
                  ? `${player.name.slice(0, MAX_LABEL - 1)}…`
                  : player.name}
              </text>
            </g>
          )
        })}
      </svg>

      {active && (
        <div className="chart__tooltip">
          {players.map((player) => (
            <span key={player.id} className="chart__tooltipRow">
              <span
                className="chart__swatch"
                style={{ background: seriesColor(player.colorIndex) }}
              />
              {player.name}
              <strong className="num">{formatPoints(active[player.id] ?? 0)}</strong>
            </span>
          ))}
        </div>
      )}
    </figure>
  )
}
