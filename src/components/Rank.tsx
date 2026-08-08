import './rank.css'

/**
 * Rang d'un joueur, entre deux brins de laurier.
 *
 * Le chiffre porte l'information, la couleur ne fait que la doubler : podium doré,
 * argenté, bronze, puis neutre. Un rang ne se lit jamais à la seule couleur — c'est ce qui
 * autorise ces teintes à voisiner celles des joueurs sans prêter à confusion.
 */
export function Rank({ rank }: { rank: number }) {
  return (
    <span className="rank" data-rank={rank <= 3 ? rank : undefined}>
      <Laurel />
      <span className="rank__value num">{rank}</span>
      <Laurel mirrored />
    </span>
  )
}

/** Un brin : une tige courbe et quatre feuilles, qui se resserrent vers la pointe. */
function Laurel({ mirrored = false }: { mirrored?: boolean }) {
  return (
    <svg
      className="rank__laurel"
      data-mirrored={mirrored || undefined}
      viewBox="0 0 12 22"
      aria-hidden="true"
    >
      <path
        d="M9.6 21 Q3.2 15.2 4.1 2.6"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.3"
        strokeLinecap="round"
      />
      <ellipse cx="7.9" cy="17.4" rx="2.7" ry="1.35" transform="rotate(-40 7.9 17.4)" />
      <ellipse cx="6" cy="13.3" rx="2.6" ry="1.3" transform="rotate(-29 6 13.3)" />
      <ellipse cx="4.8" cy="9.3" rx="2.4" ry="1.2" transform="rotate(-17 4.8 9.3)" />
      <ellipse cx="4.2" cy="5.5" rx="2.1" ry="1.05" transform="rotate(-7 4.2 5.5)" />
    </svg>
  )
}

/**
 * Rangs à partir des cumuls, du plus haut score au plus bas.
 *
 * Deux joueurs à égalité partagent le même rang, et le rang suivant saute d'autant : à
 * deux premiers ex æquo succède un troisième, pas un deuxième.
 *
 * Rend `null` tant que tout le monde est au même score — au début d'une partie, couronner
 * quatre premiers ne dirait rien.
 */
export function ranksOf(totals: number[]): number[] | null {
  const distinct = new Set(totals)
  if (distinct.size < 2) return null
  return totals.map((total) => 1 + totals.filter((other) => other > total).length)
}
