import { CONTRACT_LABELS, CONTRACT_ORDER, DEFAULT_RULES } from '../engine/rules'
import type { HandfulKind, Oudlers, RuleSet, SlamState } from '../engine/types'
import { NumberInput } from '../components/NumberInput'
import { Button, Eyebrow, Screen, TopAction } from '../components/ui'
import './rules.css'

interface RulesProps {
  rules: RuleSet
  onChange: (rules: RuleSet) => void
  onClose: () => void
}

const OUDLERS: Oudlers[] = [0, 1, 2, 3]
const HANDFULS: HandfulKind[] = ['simple', 'double', 'triple']
const SLAMS: Exclude<SlamState, 'aucun'>[] = [
  'annonceReussi',
  'nonAnnonceReussi',
  'annonceChute',
]

const SLAM_LABELS: Record<(typeof SLAMS)[number], string> = {
  annonceReussi: 'Annoncé et réussi',
  nonAnnonceReussi: 'Réussi sans annonce',
  annonceChute: 'Annoncé et chuté',
}

/**
 * Barèmes de la table. Les règles FFT servent de socle, les conventions maison — la
 * Pousse à ×1,5, la vachette, la misère — s'ajustent ici sans toucher au code.
 *
 * Un changement ne réécrit pas les donnes déjà enregistrées : leurs scores sont figés à
 * la validation. Seules les donnes suivantes suivent le nouveau barème.
 */
export function Rules({ rules, onChange, onClose }: RulesProps) {
  const patch = (changes: Partial<RuleSet>) => onChange({ ...rules, ...changes })

  return (
    <Screen
      title="Règles maison"
      left={<TopAction onClick={onClose}>Fermer</TopAction>}
      footer={
        <Button variant="ghost" onClick={() => onChange(DEFAULT_RULES)}>
          Rétablir les valeurs par défaut
        </Button>
      }
    >
      <p className="rules__note">
        Modifier un barème n'affecte que les donnes saisies ensuite : celles déjà
        enregistrées gardent les points calculés au moment de leur validation.
      </p>

      <Eyebrow>Multiplicateurs de contrat</Eyebrow>
      <div className="rules__list">
        {CONTRACT_ORDER.map((contract) => (
          <Row key={contract} label={CONTRACT_LABELS[contract]} prefix="×">
            <NumberField
              value={rules.multipliers[contract]}
              onChange={(value) =>
                patch({ multipliers: { ...rules.multipliers, [contract]: value } })
              }
            />
          </Row>
        ))}
      </div>

      <Eyebrow>Points à réaliser selon les bouts</Eyebrow>
      <div className="rules__list">
        {OUDLERS.map((oudlers) => (
          <Row key={oudlers} label={`${oudlers} bout${oudlers > 1 ? 's' : ''}`}>
            <NumberField
              value={rules.thresholds[oudlers]}
              onChange={(value) =>
                patch({ thresholds: { ...rules.thresholds, [oudlers]: value } })
              }
            />
          </Row>
        ))}
      </div>

      <Eyebrow>Socle et petit au bout</Eyebrow>
      <div className="rules__list">
        <Row label="Socle du contrat">
          <NumberField
            value={rules.baseValue}
            onChange={(value) => patch({ baseValue: value })}
          />
        </Row>
        <Row label="Petit au bout">
          <NumberField
            value={rules.petitAuBoutValue}
            onChange={(value) => patch({ petitAuBoutValue: value })}
          />
        </Row>
      </div>

      <Eyebrow>Poignées</Eyebrow>
      <div className="rules__list">
        {HANDFULS.map((kind) => (
          <Row key={kind} label={`Poignée ${kind}`}>
            <NumberField
              value={rules.handfulValues[kind]}
              onChange={(value) =>
                patch({ handfulValues: { ...rules.handfulValues, [kind]: value } })
              }
            />
          </Row>
        ))}
      </div>

      <Eyebrow>Chelem</Eyebrow>
      <div className="rules__list">
        {SLAMS.map((slam) => (
          <Row key={slam} label={SLAM_LABELS[slam]}>
            <NumberField
              value={rules.slamValues[slam]}
              onChange={(value) =>
                patch({ slamValues: { ...rules.slamValues, [slam]: value } })
              }
            />
          </Row>
        ))}
      </div>

      <Eyebrow>Misère</Eyebrow>
      <div className="rules__list">
        <Row label="Activer la misère">
          <Toggle
            checked={rules.miseryEnabled}
            onChange={(miseryEnabled) => patch({ miseryEnabled })}
          />
        </Row>
        <Row label="Versée par chaque adversaire">
          <NumberField
            value={rules.miseryValue}
            onChange={(value) => patch({ miseryValue: value })}
          />
        </Row>
      </div>
      <p className="hint">
        Convention de table : la misère ne figure pas dans les règles officielles de la FFT.
      </p>

      <Eyebrow>Vachette</Eyebrow>
      <div className="rules__list">
        <Row label="Activer la vachette">
          <Toggle
            checked={rules.vacheeEnabled}
            onChange={(vacheeEnabled) => patch({ vacheeEnabled })}
          />
        </Row>
        {([3, 4, 5] as const).map((count) => (
          <Row key={count} label={`Barème à ${count}`}>
            <span className="rules__scale num">{rules.vacheeScale[count].join(' · ')}</span>
          </Row>
        ))}
      </div>
      <p className="hint">
        Le barème se lit du joueur qui a le plus de points à celui qui en a le moins.
      </p>
    </Screen>
  )
}

function Row({
  label,
  prefix,
  children,
}: {
  label: string
  prefix?: string
  children: React.ReactNode
}) {
  return (
    <div className="rules__row">
      <span className="rules__label">{label}</span>
      {prefix && <span className="rules__prefix">{prefix}</span>}
      {children}
    </div>
  )
}

function NumberField({
  value,
  onChange,
}: {
  value: number
  onChange: (value: number) => void
}) {
  return <NumberInput className="rules__input num" value={value} onChange={onChange} />
}

function Toggle({
  checked,
  onChange,
}: {
  checked: boolean
  onChange: (checked: boolean) => void
}) {
  return (
    <button
      type="button"
      className="rules__toggle"
      role="switch"
      aria-checked={checked}
      onClick={() => onChange(!checked)}
    >
      <span className="rules__knob" />
    </button>
  )
}
