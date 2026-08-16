import type { FormProfile, TakerProfile } from '../../engine/insights'
import { CONTRACT_LABELS, formatPoints, formatSigned } from '../../engine/rules'
import type { RuleSet } from '../../engine/types'
import './charts.css'

/**
 * Réussite des prises selon les bouts en main.
 *
 * Le seul paramètre que le preneur connaît avant de s'engager, donc le seul dont la lecture
 * change quelque chose à la prochaine donne. Le seuil accompagne chaque ligne : « 2 sur 9 »
 * ne dit rien tant qu'on ne rappelle pas qu'il fallait 56 points.
 */
export function OudlerChart({
  profile,
  rules,
  color,
}: {
  profile: TakerProfile
  rules: RuleSet
  color: string
}) {
  const lines = profile.byOudlers.filter((line) => line.takes > 0)
  if (lines.length === 0) return null

  return (
    <figure className="chart">
      <figcaption className="chart__caption">Réussite selon les bouts</figcaption>
      <div className="bars">
        {lines.map((line) => (
          <div key={line.oudlers} className="bars__row">
            <span className="bars__label">
              {line.oudlers} bout{line.oudlers > 1 ? 's' : ''}
            </span>
            <span className="bars__track">
              <span
                className="bars__fill"
                style={{
                  width: `${Math.max((line.won / line.takes) * 100, 1.5)}%`,
                  background: color,
                }}
              />
            </span>
            <span className="bars__value num">
              {line.won}/{line.takes}
            </span>
            <span className="bars__note num">
              il fallait {rules.thresholds[line.oudlers]} points
            </span>
          </div>
        ))}
      </div>
    </figure>
  )
}

/**
 * Ce que chaque contrat rapporte à ce joueur-là.
 *
 * En points par prise, et non en total : un contrat joué deux fois ne doit pas paraître
 * anodin à côté d'un contrat joué trente fois. L'effectif figure en note, faute de quoi une
 * Garde Contre unique et réussie passerait pour la meilleure idée de sa vie.
 */
export function ContractYieldChart({
  profile,
  color,
}: {
  profile: TakerProfile
  color: string
}) {
  const lines = profile.byContract.filter((line) => line.takes > 0)
  if (lines.length === 0) return null
  const scale = Math.max(1, ...lines.map((line) => Math.abs(line.perTake ?? 0)))

  return (
    <figure className="chart">
      <figcaption className="chart__caption">Rendement par contrat</figcaption>
      <div className="diverging">
        {lines.map((line) => {
          const value = line.perTake ?? 0
          return (
            <div key={line.contract} className="diverging__row">
              <span className="diverging__label">{CONTRACT_LABELS[line.contract]}</span>
              <span className="diverging__axis">
                <span
                  className="diverging__bar"
                  data-side={value >= 0 ? 'right' : 'left'}
                  style={{ width: `${(Math.abs(value) / scale) * 50}%`, background: color }}
                />
              </span>
              <span className="diverging__value num">{formatSigned(Math.round(value))}</span>
              <span className="diverging__note num">
                {line.takes} prise{line.takes > 1 ? 's' : ''}, {line.won} tenue
                {line.won > 1 ? 's' : ''}
              </span>
            </div>
          )
        })}
      </div>
    </figure>
  )
}

/**
 * L'appétit : les prises rapportées à ce qu'un partage égal aurait donné.
 *
 * Un repère marque la part exacte. Comparer des nombres bruts de prises n'aurait aucun sens
 * entre un joueur des soirées à trois et un joueur des soirées à cinq — la part, elle, se
 * compare toujours.
 */
export function AppetiteGauge({
  profile,
  color,
}: {
  profile: TakerProfile
  color: string
}) {
  if (profile.appetite === null || profile.contractDeals === 0) return null
  // Deux parts d'amplitude au minimum, et toujours un peu d'air au-delà de la valeur : une
  // barre qui touche le bout se lit comme un maximum atteint, ce qui n'existe pas ici.
  const scale = Math.max(2, profile.appetite) * 1.12

  return (
    <figure className="chart">
      <figcaption className="chart__caption">
        Appétit de prise
        <span className="chart__readout num">{formatPoints(Math.round(profile.appetite * 10) / 10)}× sa part</span>
      </figcaption>
      <div className="gauge">
        <span
          className="gauge__fill"
          style={{ width: `${(profile.appetite / scale) * 100}%`, background: color }}
        />
        <span className="gauge__mark" style={{ left: `${(1 / scale) * 100}%` }} />
      </div>
      <p className="gauge__legend">
        {profile.takes} prise{profile.takes > 1 ? 's' : ''} sur {profile.contractDeals} donne
        {profile.contractDeals > 1 ? 's' : ''} où quelqu’un a pris — un partage égal lui en
        aurait donné{' '}
        <strong className="num">{formatPoints(Math.round(profile.expectedTakes))}</strong>.
      </p>
    </figure>
  )
}

const FORM_W = 320
const FORM_H = 84
const FORM_PAD = 10

/**
 * La trajectoire d'un joueur, soirée après soirée, en points par donne.
 *
 * Les points par donne et non les totaux : une partie de vingt-cinq donnes creuse
 * mécaniquement des écarts qu'une partie de huit ne peut pas creuser, et la courbe des
 * totaux ne mesurerait alors que la longueur des soirées.
 */
export function FormChart({ profile, color }: { profile: FormProfile; color: string }) {
  const rates = profile.games.map((game) => game.rate)
  if (rates.length < 2) return null

  const min = Math.min(0, ...rates)
  const max = Math.max(0, ...rates)
  const span = max - min || 1

  const x = (index: number) =>
    FORM_PAD + (index / (rates.length - 1)) * (FORM_W - FORM_PAD * 2)
  const y = (value: number) =>
    FORM_PAD + (1 - (value - min) / span) * (FORM_H - FORM_PAD * 2)

  const path = rates
    .map((rate, index) => `${index === 0 ? 'M' : 'L'}${x(index)} ${y(rate)}`)
    .join(' ')

  return (
    <figure className="chart">
      <figcaption className="chart__caption">
        Points par donne
        <span className="chart__readout num">
          {formatSigned(Math.round((profile.rate ?? 0) * 10) / 10)} en moyenne
        </span>
      </figcaption>
      <svg
        viewBox={`0 0 ${FORM_W} ${FORM_H}`}
        className="chart__svg"
        role="img"
        aria-label={`Points par donne sur ${rates.length} parties`}
      >
        <line
          x1={FORM_PAD}
          x2={FORM_W - FORM_PAD}
          y1={y(0)}
          y2={y(0)}
          className="chart__zero"
        />
        <path d={path} className="chart__line" stroke={color} />
        {/* Seule la dernière soirée porte un point : c'est celle qu'on cherche du regard. */}
        <circle
          cx={x(rates.length - 1)}
          cy={y(rates[rates.length - 1])}
          r={4}
          fill={color}
          className="chart__dot"
        />
      </svg>
    </figure>
  )
}
