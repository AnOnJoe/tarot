import type { Contract, ContractOrVachette, PlayerCount, RuleSet } from './types'

/** Total des points en jeu dans une donne de tarot. */
export const TOTAL_POINTS = 91

/**
 * Barèmes par défaut : règles FFT, amendées des deux conventions maison de la table
 * (la Pousse à ×1,5 et la Vachette). Tout reste modifiable depuis l'écran Règles.
 */
export const DEFAULT_RULES: RuleSet = {
  multipliers: {
    petite: 1,
    pousse: 1.5,
    garde: 2,
    gardeSans: 4,
    gardeContre: 6,
  },
  thresholds: { 0: 56, 1: 51, 2: 41, 3: 36 },
  baseValue: 25,
  petitAuBoutValue: 10,
  handfulValues: { simple: 20, double: 30, triple: 40 },
  handfulThresholds: {
    3: { simple: 13, double: 15, triple: 18 },
    4: { simple: 10, double: 13, triple: 15 },
    5: { simple: 8, double: 10, triple: 13 },
  },
  slamValues: {
    annonceReussi: 400,
    nonAnnonceReussi: 200,
    annonceChute: -200,
  },
  miseryEnabled: true,
  miseryValue: 10,
  vacheeEnabled: true,
  vacheeScale: {
    3: [-120, 0, 120],
    4: [-120, -60, 60, 120],
    5: [-120, -60, 0, 60, 120],
  },
}

export const CONTRACT_LABELS: Record<ContractOrVachette, string> = {
  petite: 'Petite',
  pousse: 'Pousse',
  garde: 'Garde',
  gardeSans: 'Garde Sans',
  gardeContre: 'Garde Contre',
  vachette: 'Vachette',
}

export const CONTRACT_ORDER: Contract[] = [
  'petite',
  'pousse',
  'garde',
  'gardeSans',
  'gardeContre',
]

/**
 * Nombre de parts revenant au preneur.
 *
 * Chaque défenseur perd une part ; le preneur en gagne autant qu'il y a de défenseurs.
 * À 5 joueurs, l'appelé prend une des parts du preneur — sauf si le preneur s'est appelé
 * lui-même, auquel cas il affronte quatre défenseurs et empoche les quatre parts.
 */
export function takerShares(playerCount: PlayerCount, hasPartner: boolean): number {
  if (playerCount === 5) return hasPartner ? 2 : 4
  return playerCount - 1
}

/**
 * Formate un score sans rien perdre : la Pousse à ×1,5 appliquée à une assiette en
 * demi-points produit des quarts de point (25,5 × 1,5 = 38,25). On les affiche tels
 * quels — c'est le prix de la somme nulle exacte à la table.
 */
export function formatPoints(value: number): string {
  const rounded = Math.round(value * 100) / 100
  const text = Number.isInteger(rounded) ? String(rounded) : String(rounded).replace('.', ',')
  // Signe moins typographique : à la même chasse que le plus, les colonnes s'alignent.
  return text.replace('-', '−')
}

/**
 * Sépare la partie entière de la décimale.
 *
 * Les quarts de point de la Pousse allongent les cumuls de trois signes, au point de
 * réduire le chiffre à rien dans une colonne étroite. Les afficher en deux corps rend sa
 * taille à ce qui compte — l'unité — sans rien retrancher de la valeur.
 */
export function splitPoints(value: number): { integer: string; fraction: string | null } {
  const text = formatPoints(value)
  const comma = text.indexOf(',')
  return comma === -1
    ? { integer: text, fraction: null }
    : { integer: text.slice(0, comma), fraction: text.slice(comma) }
}

/** Formate un score signé, pour les colonnes de résultat. */
export function formatSigned(value: number): string {
  if (value > 0) return `+${formatPoints(value)}`
  return formatPoints(value)
}
