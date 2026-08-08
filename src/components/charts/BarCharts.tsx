import { CONTRACT_LABELS } from '../../engine/rules'
import { formatPoints, formatSigned } from '../../engine/rules'
import type { DealStats, PlayerStats } from '../../engine/stats'
import type { PlayerId } from '../../engine/types'
import { seriesColor } from '../../palette'
import type { Player } from '../../store/db'
import './charts.css'

function byId(players: Player[]): Map<PlayerId, Player> {
  return new Map(players.map((p) => [p.id, p]))
}

/**
 * Réussite des prises, joueur par joueur.
 *
 * La barre porte le taux, le libellé porte l'effectif : sans lui, « 100 % » sur une seule
 * prise se lirait comme un exploit.
 */
export function TakeSuccessChart({
  players,
  stats,
}: {
  players: Player[]
  stats: PlayerStats[]
}) {
  const lookup = byId(players)
  const takers = stats.filter((s) => s.takes > 0)
  if (takers.length === 0) return null

  return (
    <figure className="chart">
      <figcaption className="chart__caption">Prises réussies</figcaption>
      <div className="bars">
        {takers.map((stat) => {
          const player = lookup.get(stat.playerId)
          const rate = stat.takesWon / stat.takes
          const favourite = (Object.entries(stat.contracts) as [string, number][])
            .filter(([, count]) => count > 0)
            .sort((a, b) => b[1] - a[1])[0]
          return (
            <div key={stat.playerId} className="bars__row">
              <span className="bars__label">{player?.name ?? '—'}</span>
              <span className="bars__track">
                <span
                  className="bars__fill"
                  style={{
                    width: `${Math.max(rate * 100, 1.5)}%`,
                    background: player ? seriesColor(player.colorIndex) : 'var(--ink-faint)',
                  }}
                />
              </span>
              <span className="bars__value num">
                {stat.takesWon}/{stat.takes}
              </span>
              <span className="bars__note">
                {favourite
                  ? CONTRACT_LABELS[favourite[0] as keyof typeof CONTRACT_LABELS]
                  : ''}
              </span>
            </div>
          )
        })}
      </div>
    </figure>
  )
}

/**
 * Bilan de chaque joueur, en points cumulés.
 *
 * Les barres partent d'un axe zéro central : le signe se lit au côté, pas à la couleur,
 * qui reste celle du joueur pour rester cohérente avec son portrait.
 */
export function BalanceChart({
  players,
  stats,
  caption,
}: {
  players: Player[]
  stats: PlayerStats[]
  caption: string
}) {
  const lookup = byId(players)
  const scale = Math.max(1, ...stats.map((s) => Math.abs(s.total)))
  const ordered = [...stats].sort((a, b) => b.total - a.total)

  return (
    <figure className="chart">
      <figcaption className="chart__caption">{caption}</figcaption>
      <div className="diverging">
        {ordered.map((stat) => {
          const player = lookup.get(stat.playerId)
          const ratio = Math.abs(stat.total) / scale
          const positive = stat.total >= 0
          return (
            <div key={stat.playerId} className="diverging__row">
              <span className="diverging__label">{player?.name ?? '—'}</span>
              <span className="diverging__axis">
                <span
                  className="diverging__bar"
                  data-side={positive ? 'right' : 'left'}
                  style={{
                    width: `${ratio * 50}%`,
                    background: player ? seriesColor(player.colorIndex) : 'var(--ink-faint)',
                  }}
                />
              </span>
              <span className="diverging__value num">{formatSigned(stat.total)}</span>
              <span className="diverging__note num">
                att. {formatSigned(Math.round(stat.averageAttack))} · déf.{' '}
                {formatSigned(Math.round(stat.averageDefense))}
              </span>
            </div>
          )
        })}
      </div>
    </figure>
  )
}

/**
 * Qui l'emporte, de l'attaque ou de la défense — et à quelle fréquence surviennent les
 * évènements rares. Ces derniers sont des compteurs, pas des parts : un camembert à 2 %
 * ne dirait rien, un chiffre le dit.
 */
export function DealSplitChart({ stats }: { stats: DealStats }) {
  const decided = stats.attackWins + stats.defenseWins
  if (stats.total === 0) return null
  const attackShare = decided ? (stats.attackWins / decided) * 100 : 0

  return (
    <figure className="chart">
      <figcaption className="chart__caption">Attaque contre défense</figcaption>

      {decided > 0 && (
        <>
          <div className="split">
            <span className="split__part" style={{ width: `${attackShare}%` }} />
            <span className="split__part split__part--defense" />
          </div>
          <div className="split__legend">
            <span>
              <span className="chart__swatch" style={{ background: 'var(--series-1)' }} />
              Attaque <strong className="num">{stats.attackWins}</strong>
            </span>
            <span>
              <span className="chart__swatch" style={{ background: 'var(--series-2)' }} />
              Défense <strong className="num">{stats.defenseWins}</strong>
            </span>
          </div>
        </>
      )}

      <div className="tiles">
        <Tile value={stats.total} label={stats.total > 1 ? 'donnes' : 'donne'} />
        <Tile value={stats.vachettes} label="vachettes" />
        <Tile value={stats.handfuls} label="poignées" />
        <Tile value={stats.petitsAuBout} label="petits au bout" />
        <Tile value={stats.slams} label="chelems" />
      </div>
    </figure>
  )
}

function Tile({ value, label }: { value: number; label: string }) {
  return (
    <div className="tile">
      <span className="tile__value num display">{formatPoints(value)}</span>
      <span className="tile__label">{label}</span>
    </div>
  )
}
