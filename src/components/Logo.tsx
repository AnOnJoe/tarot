import './logo.css'

/**
 * La marque : deux cartes croisées dessinant un V.
 *
 * Elle emploie le rouge saturé `--brand`, réservé au logo. L'accent de l'interface est un
 * corail plus clair, choisi pour ne se confondre ni avec ce rouge ni avec l'identité d'un
 * joueur — une marque n'est ni du chrome ni une donnée.
 *
 * Le liseré est peint à la couleur du fond plutôt qu'en trait : les deux cartes se
 * détachent ainsi l'une de l'autre sur n'importe quelle surface.
 */
export function LogoMark({ size = 28 }: { size?: number }) {
  return (
    <svg
      className="logoMark"
      width={size}
      height={size}
      viewBox="0 0 100 100"
      aria-hidden="true"
    >
      <g stroke="var(--bg)" strokeWidth="6">
        <rect
          x="26"
          y="21"
          width="28"
          height="52"
          rx="6"
          fill="var(--brand)"
          transform="rotate(-19 40 47)"
        />
        <rect
          x="46"
          y="21"
          width="28"
          height="52"
          rx="6"
          fill="var(--ink)"
          transform="rotate(19 60 47)"
        />
      </g>
    </svg>
  )
}

interface LogoProps {
  /** Version d'apparat : marque au-dessus du mot, pour l'écran de lancement. */
  stacked?: boolean
  markSize?: number
}

/** Marque et mot, la signature complète de l'application. */
export function Logo({ stacked = false, markSize }: LogoProps) {
  return (
    <span className={stacked ? 'logo logo--stacked' : 'logo'}>
      <LogoMark size={markSize ?? (stacked ? 108 : 30)} />
      <span className="logo__word">vachette</span>
    </span>
  )
}
