import { useState, type ReactNode } from 'react'

/** Coquille d'un écran : barre de titre collante, corps défilant, barre d'action en bas. */
export function Screen({
  title,
  left,
  right,
  footer,
  children,
}: {
  title: string
  left?: ReactNode
  right?: ReactNode
  footer?: ReactNode
  children: ReactNode
}) {
  return (
    <div className="screen">
      <header className="topbar">
        <div>{left}</div>
        <h1 className="topbar__title">{title}</h1>
        <div className="topbar__action--end">{right}</div>
      </header>
      <div className="screen__body">{children}</div>
      {footer && <div className="footbar">{footer}</div>}
    </div>
  )
}

export function TopAction({
  onClick,
  children,
  disabled,
  align = 'start',
}: {
  onClick: () => void
  children: ReactNode
  disabled?: boolean
  align?: 'start' | 'end'
}) {
  return (
    <button
      type="button"
      className={`topbar__action${align === 'end' ? ' topbar__action--end' : ''}`}
      onClick={onClick}
      disabled={disabled}
    >
      {children}
    </button>
  )
}

/** Intitulé de section, en petites capitales. */
export function Eyebrow({ children }: { children: ReactNode }) {
  return <p className="eyebrow">{children}</p>
}

/** Bouton de choix unique dans une rangée de chips. */
export function Chip({
  selected,
  onClick,
  label,
  sub,
}: {
  selected: boolean
  onClick: () => void
  label: ReactNode
  sub?: ReactNode
}) {
  return (
    <button type="button" className="chip" aria-pressed={selected} onClick={onClick}>
      <span>{label}</span>
      {sub !== undefined && <span className="chip__sub">{sub}</span>}
    </button>
  )
}

export function Button({
  onClick,
  children,
  variant = 'default',
  disabled,
  type = 'button',
}: {
  onClick?: () => void
  children: ReactNode
  variant?: 'default' | 'primary' | 'ghost' | 'danger'
  disabled?: boolean
  type?: 'button' | 'submit'
}) {
  const suffix = variant === 'default' ? '' : ` btn--${variant}`
  return (
    <button type={type} className={`btn${suffix}`} onClick={onClick} disabled={disabled}>
      {children}
    </button>
  )
}

/**
 * Section repliable.
 *
 * Quand elle est fermée, `summary` rappelle ce qu'elle contient : replier ne doit pas
 * faire disparaître une annonce déjà saisie du champ de vision.
 */
export function Collapsible({
  title,
  summary,
  defaultOpen = false,
  children,
}: {
  title: string
  summary?: ReactNode
  defaultOpen?: boolean
  children: ReactNode
}) {
  const [open, setOpen] = useState(defaultOpen)

  return (
    <div className="collapse">
      <button
        type="button"
        className="collapse__head"
        aria-expanded={open}
        onClick={() => setOpen((current) => !current)}
      >
        <span className="collapse__title">{title}</span>
        {!open && summary && <span className="collapse__summary">{summary}</span>}
        <span className="collapse__chevron" aria-hidden="true">
          ›
        </span>
      </button>
      {open && <div className="collapse__body">{children}</div>}
    </div>
  )
}

export function EmptyState({ title, children }: { title: string; children?: ReactNode }) {
  return (
    <div className="empty">
      <p className="empty__title">{title}</p>
      {children}
    </div>
  )
}
