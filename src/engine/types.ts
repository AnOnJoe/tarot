/**
 * Types du moteur de calcul.
 *
 * Ce module est volontairement dépourvu de toute dépendance (React, DOM, stockage) :
 * il ne décrit que des données de jeu et reste portable tel quel vers une autre plateforme.
 */

export type PlayerId = string

/** Nombre de joueurs autour de la table. */
export type PlayerCount = 3 | 4 | 5

/**
 * Contrats jouables. `vachette` est une convention maison : personne ne prend, on joue
 * chacun pour soi plutôt que de redistribuer, et le calcul ne suit pas la formule du
 * contrat classique (cf. `scoreVachette`).
 */
export type Contract = 'petite' | 'pousse' | 'garde' | 'gardeSans' | 'gardeContre'
export type ContractOrVachette = Contract | 'vachette'

/** Nombre de bouts (oudlers) dans le jeu du preneur en fin de donne. */
export type Oudlers = 0 | 1 | 2 | 3

/** Camp qui a réalisé le petit au bout, s'il a été réalisé. */
export type Side = 'attaque' | 'defense'

export type HandfulKind = 'simple' | 'double' | 'triple'

/** Poignée annoncée : par qui, et de quelle taille. */
export interface Handful {
  playerId: PlayerId
  kind: HandfulKind
}

/** État du chelem sur la donne. */
export type SlamState =
  | 'aucun'
  | 'annonceReussi'
  | 'nonAnnonceReussi'
  | 'annonceChute'

export type MiseryKind = 'atout' | 'tete'

/** Misère annoncée par un joueur (convention maison, hors règles FFT). */
export interface Misery {
  playerId: PlayerId
  kind: MiseryKind
}

/** Une donne jouée avec un contrat classique. */
export interface ContractDeal {
  kind: 'contrat'
  contract: Contract
  /** Le preneur. */
  takerId: PlayerId
  /**
   * À 5 joueurs uniquement : le joueur détenteur du roi appelé.
   * `null` quand le preneur s'est appelé lui-même et joue donc seul contre quatre.
   */
  partnerId: PlayerId | null
  oudlers: Oudlers
  /** Points réalisés par l'attaque, de 0 à 91, par pas de 0,5. */
  attackPoints: number
  /** Camp ayant mené le petit au dernier pli, ou `null`. */
  petitAuBout: Side | null
  handfuls: Handful[]
  slam: SlamState
  miseries: Misery[]
}

/**
 * Une donne jouée en vachette : chacun pour soi, et **seul l'ordre compte**.
 *
 * Le barème ne dépend que du classement : compter les points de chacun était un détour
 * pour retrouver un ordre que la table connaît déjà en regardant ses plis.
 */
export interface VacheeDeal {
  kind: 'vachette'
  /**
   * Rang de chacun. **1 = celui qui a ramassé le plus de points**, donc le plus grand
   * perdant. Les ex æquo portent le même rang.
   *
   * Seul l'ordre des valeurs importe, pas leur numérotation : `1,2,2,4` et `1,2,2,3`
   * décrivent le même classement.
   */
  ranks?: Record<PlayerId, number>
  /**
   * Points ramassés, tels que les versions antérieures les saisissaient.
   *
   * Encore lu — les donnes déjà enregistrées n'ont que cela, et une donne validée ne se
   * recalcule jamais — mais plus jamais écrit.
   */
  points?: Record<PlayerId, number>
}

export type DealInput = ContractDeal | VacheeDeal

/** Une donne telle que stockée : l'entrée de jeu, plus son identité et son contexte. */
export interface Deal {
  id: string
  gameId: string
  /** Index de la donne dans la partie, à partir de 0. */
  index: number
  dealerId: PlayerId
  input: DealInput
  /** Points attribués à chaque joueur, tels que calculés au moment de la validation. */
  scores: Record<PlayerId, number>
  createdAt: number
}

/**
 * Barèmes de la table. Tout est donnée : le calcul ne code en dur aucune valeur, ce qui
 * permet à l'écran « Règles maison » de tout ajuster sans toucher au moteur.
 */
export interface RuleSet {
  /** Multiplicateur appliqué à l'assiette du contrat. */
  multipliers: Record<Contract, number>
  /** Points à réaliser par l'attaque selon son nombre de bouts. */
  thresholds: Record<Oudlers, number>
  /** Socle du contrat, ajouté à l'écart (25 en FFT). */
  baseValue: number
  /** Valeur du petit au bout, appliquée avant multiplication. */
  petitAuBoutValue: number
  /** Primes de poignée, ajoutées après multiplication, au camp vainqueur. */
  handfulValues: Record<HandfulKind, number>
  /** Nombre d'atouts requis par taille de poignée, selon le nombre de joueurs. */
  handfulThresholds: Record<PlayerCount, Record<HandfulKind, number>>
  /** Primes de chelem, ajoutées après multiplication. */
  slamValues: Record<Exclude<SlamState, 'aucun'>, number>
  /** Misère activée, et montant versé par chacun des autres joueurs. */
  miseryEnabled: boolean
  miseryValue: number
  /** Vachette activée, et barème par rang (du plus de points au moins de points). */
  vacheeEnabled: boolean
  vacheeScale: Record<PlayerCount, number[]>
}
