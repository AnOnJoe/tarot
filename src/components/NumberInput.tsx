import { useState } from 'react'
import { formatPoints } from '../engine/rules'

interface NumberInputProps {
  value: number
  onChange: (value: number) => void
  className?: string
  ariaLabel?: string
}

/**
 * Champ numérique à la française.
 *
 * Le texte tapé est conservé tel quel tant que le champ a le focus : reformater à chaque
 * frappe rendrait « 22,5 » impossible à écrire, la virgule disparaissant dès sa saisie
 * puisque `Number('22,')` ne la retient pas. Au flou, on revient à la valeur formatée.
 */
export function NumberInput({ value, onChange, className, ariaLabel }: NumberInputProps) {
  const [draft, setDraft] = useState<string | null>(null)

  return (
    <input
      className={className}
      type="text"
      inputMode="decimal"
      value={draft ?? formatPoints(value)}
      aria-label={ariaLabel}
      onFocus={(event) => event.target.select()}
      onChange={(event) => {
        const text = event.target.value
        setDraft(text)
        const parsed = Number(text.replace(',', '.').replace('−', '-'))
        if (text.trim() !== '' && Number.isFinite(parsed)) onChange(parsed)
      }}
      onBlur={() => setDraft(null)}
    />
  )
}
