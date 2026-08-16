/**
 * Analyses de fond : ce que l'historique dit d'un joueur au-delà de son total.
 *
 * `stats.ts` compte — combien de prises, combien de points. Ce module **interprète** :
 * il rapporte les nombres à ce qu'ils devraient valoir (une prise à sa part équitable,
 * une soirée à sa longueur), pour que deux joueurs de parcours différents restent
 * comparables. Les conseils qui en découlent vivent dans `advice.ts`.
 *
 * Comme partout dans `engine/`, aucune dépendance à React, au DOM ni à la base : tout
 * entre par les donnes, tout sort en données.
 */

import { CONTRACT_ORDER, DEFAULT_RULES } from './rules'
import { contractBreakdown } from './score'
import type { Contract, ContractDeal, Deal, Oudlers, PlayerId, RuleSet } from './types'

/**
 * Tolérance des comparaisons de totaux.
 *
 * La Pousse à ×1,5 sur une assiette en demi-points produit des quarts, que l'addition
 * flottante rend parfois à 10⁻¹⁴ près. Sans tolérance, deux joueurs réellement à égalité
 * se retrouveraient départagés par du bruit binaire.
 */
const EPSILON = 1e-6

/** Les quatre nombres de bouts, dans l'ordre où on les lit. */
export const OUDLER_ORDER: Oudlers[] = [0, 1, 2, 3]

/** Donnes d'une même partie, à leur place dans le temps. */
export interface GameDeals {
  gameId: string
  /** Date de la première donne : l'engine n'a pas accès aux parties, seulement aux donnes. */
  startedAt: number
  deals: Deal[]
}

/**
 * Regroupe les donnes par partie, de la plus ancienne à la plus récente.
 *
 * L'ordre vient des donnes elles-mêmes plutôt que des enregistrements de partie : le
 * moteur reste ainsi ignorant du stockage, et une fusion de deux carnets se range toute
 * seule dans le bon ordre.
 */
export function byGame(deals: Deal[]): GameDeals[] {
  const groups = new Map<string, Deal[]>()
  for (const deal of deals) {
    const list = groups.get(deal.gameId)
    if (list) list.push(deal)
    else groups.set(deal.gameId, [deal])
  }

  return [...groups.entries()]
    .map(([gameId, list]) => ({
      gameId,
      startedAt: Math.min(...list.map((deal) => deal.createdAt)),
      deals: [...list].sort((a, b) => a.index - b.index),
    }))
    .sort((a, b) => a.startedAt - b.startedAt)
}

/** Les joueurs présents sur une donne : ceux qui y ont marqué quelque chose. */
function tableOf(deal: Deal): PlayerId[] {
  return Object.keys(deal.scores)
}

/** L'appelé d'une donne à 5, ou `null` — le preneur appelé lui-même n'en est pas un. */
function partnerOf(input: ContractDeal): PlayerId | null {
  return input.partnerId && input.partnerId !== input.takerId ? input.partnerId : null
}

/** Moyenne, ou `null` sur un effectif nul — préférée à un 0 qui se lirait comme une valeur. */
function mean(values: number[]): number | null {
  if (values.length === 0) return null
  return values.reduce((sum, v) => sum + v, 0) / values.length
}

// ---------------------------------------------------------------------------
// Profil de preneur
// ---------------------------------------------------------------------------

/** Ce que vaut un contrat entre les mains d'un joueur donné. */
export interface ContractLine {
  contract: Contract
  takes: number
  won: number
  /** Points marqués en moyenne par prise sous ce contrat, `null` s'il ne l'a jamais joué. */
  perTake: number | null
}

/** Ce que vaut une prise selon le nombre de bouts qu'elle avait en main. */
export interface OudlerLine {
  oudlers: Oudlers
  takes: number
  won: number
}

/**
 * Le joueur quand il prend.
 *
 * Le nombre brut de prises ne dit rien : dix prises en trente donnes à trois joueurs, c'est
 * exactement sa part ; les mêmes dix en trente donnes à cinq, c'est le double. D'où
 * `appetite`, qui rapporte les prises à celles qu'une table parfaitement partageuse lui
 * aurait données.
 */
export interface TakerProfile {
  playerId: PlayerId
  /** Donnes où le joueur figure, vachettes comprises. */
  deals: number
  /** Donnes où quelqu'un a pris : les seules où prendre était une option. */
  contractDeals: number
  takes: number
  /** Prises tenues, au sens du contrat réalisé — pas au sens du score, cf. le module. */
  won: number
  /** Prises qu'un partage parfaitement égal lui aurait attribuées. */
  expectedTakes: number
  /** `takes / expectedTakes` : 1 = sa part exacte, 2 = deux fois sa part. */
  appetite: number | null
  /** Points marqués en moyenne quand il prend. */
  perTake: number | null
  /** Points marqués en moyenne quand il subit une prise adverse. */
  perDefense: number | null
  /** Points au-dessus du seuil quand il tient son contrat. */
  marginWon: number | null
  /** Points manquants quand il chute, compté positivement. */
  marginLost: number | null
  byContract: ContractLine[]
  byOudlers: OudlerLine[]
}

/**
 * Dépouille les prises d'un joueur.
 *
 * **La réussite se lit sur le contrat, pas sur le score.** Une misère encaissée le même
 * tour peut rendre positif le score d'un preneur qui a chuté ; le contrat, lui, ne ment
 * pas. C'est aussi la raison pour laquelle les barèmes entrent ici : `Deal.scores` est
 * figé à la validation, mais l'écart au seuil se recalcule à la lecture — un seuil modifié
 * dans les Règles maison change donc l'analyse, jamais les points déjà marqués.
 */
export function takerProfile(
  deals: Deal[],
  playerId: PlayerId,
  rules: RuleSet = DEFAULT_RULES,
): TakerProfile {
  const contracts = new Map<Contract, { takes: number; won: number; points: number[] }>()
  const oudlers = new Map<Oudlers, { takes: number; won: number }>()
  const takePoints: number[] = []
  const defensePoints: number[] = []
  const marginsWon: number[] = []
  const marginsLost: number[] = []

  let dealCount = 0
  let contractDeals = 0
  let takes = 0
  let won = 0
  let expectedTakes = 0

  for (const deal of deals) {
    const score = deal.scores[playerId]
    if (score === undefined) continue
    dealCount++
    if (deal.input.kind === 'vachette') continue

    const input = deal.input
    contractDeals++
    // Sa part si les prises se répartissaient également autour de cette table-là.
    expectedTakes += 1 / tableOf(deal).length

    if (input.takerId !== playerId) {
      defensePoints.push(score)
      continue
    }

    const breakdown = contractBreakdown(input, rules)
    takes++
    takePoints.push(score)
    if (breakdown.success) {
      won++
      marginsWon.push(breakdown.diff)
    } else {
      marginsLost.push(Math.abs(breakdown.diff))
    }

    const line = contracts.get(input.contract) ?? { takes: 0, won: 0, points: [] }
    line.takes++
    if (breakdown.success) line.won++
    line.points.push(score)
    contracts.set(input.contract, line)

    const cell = oudlers.get(input.oudlers) ?? { takes: 0, won: 0 }
    cell.takes++
    if (breakdown.success) cell.won++
    oudlers.set(input.oudlers, cell)
  }

  return {
    playerId,
    deals: dealCount,
    contractDeals,
    takes,
    won,
    expectedTakes,
    appetite: expectedTakes > 0 ? takes / expectedTakes : null,
    perTake: mean(takePoints),
    perDefense: mean(defensePoints),
    marginWon: mean(marginsWon),
    marginLost: mean(marginsLost),
    byContract: CONTRACT_ORDER.map((contract) => {
      const line = contracts.get(contract)
      return {
        contract,
        takes: line?.takes ?? 0,
        won: line?.won ?? 0,
        perTake: line ? mean(line.points) : null,
      }
    }),
    byOudlers: OUDLER_ORDER.map((count) => {
      const cell = oudlers.get(count)
      return { oudlers: count, takes: cell?.takes ?? 0, won: cell?.won ?? 0 }
    }),
  }
}

// ---------------------------------------------------------------------------
// Profil de défenseur
// ---------------------------------------------------------------------------

/**
 * Le joueur quand il ne prend pas.
 *
 * Défendre est le rôle le plus fréquent — trois donnes sur quatre à quatre joueurs — et
 * c'est pourtant celui qu'on ne mesure jamais. `broken` compte les prises adverses tombées
 * pendant qu'il défendait : la part de mérite lui échappe en partie, mais sur cent donnes
 * l'écart entre deux joueurs cesse d'être du hasard.
 */
export interface DefenderProfile {
  playerId: PlayerId
  defenses: number
  /** Prises adverses tombées alors qu'il était en défense. */
  broken: number
  perDefense: number | null
  /** Donnes à 5 où le preneur l'a appelé. */
  calls: number
  callsWon: number
  perCall: number | null
}

export function defenderProfile(
  deals: Deal[],
  playerId: PlayerId,
  rules: RuleSet = DEFAULT_RULES,
): DefenderProfile {
  const defensePoints: number[] = []
  const callPoints: number[] = []
  let defenses = 0
  let broken = 0
  let calls = 0
  let callsWon = 0

  for (const deal of deals) {
    const score = deal.scores[playerId]
    if (score === undefined || deal.input.kind === 'vachette') continue

    const input = deal.input
    if (input.takerId === playerId) continue

    const breakdown = contractBreakdown(input, rules)

    if (partnerOf(input) === playerId) {
      calls++
      callPoints.push(score)
      if (breakdown.success) callsWon++
      continue
    }

    defenses++
    defensePoints.push(score)
    if (!breakdown.success) broken++
  }

  return {
    playerId,
    defenses,
    broken,
    perDefense: mean(defensePoints),
    calls,
    callsWon,
    perCall: mean(callPoints),
  }
}

// ---------------------------------------------------------------------------
// Vachette
// ---------------------------------------------------------------------------

/** Ce que la vachette rapporte, ou coûte, à un joueur. */
export interface VacheeProfile {
  playerId: PlayerId
  deals: number
  /** Points moyens par vachette : le barème étant symétrique, 0 est la place du milieu. */
  perDeal: number | null
}

export function vacheeProfile(deals: Deal[], playerId: PlayerId): VacheeProfile {
  const points: number[] = []
  for (const deal of deals) {
    if (deal.input.kind !== 'vachette') continue
    const score = deal.scores[playerId]
    if (score === undefined) continue
    points.push(score)
  }
  return { playerId, deals: points.length, perDeal: mean(points) }
}

// ---------------------------------------------------------------------------
// Forme et régularité
// ---------------------------------------------------------------------------

/** Une soirée, du point de vue d'un joueur. */
export interface GameLine {
  gameId: string
  startedAt: number
  total: number
  deals: number
  /**
   * Points par donne.
   *
   * La seule mesure comparable d'une soirée à l'autre : une partie de vingt-cinq donnes
   * creuse mécaniquement des écarts qu'une partie de huit ne peut pas creuser.
   */
  rate: number
  /** Rang final, numérotation sportive : après deux ex æquo au rang 2 vient le rang 4. */
  rank: number
  tableSize: number
}

/**
 * La trajectoire d'un joueur, soirée après soirée.
 *
 * `spread` est l'écart type de son rendement : bas, le joueur est une horloge ; haut, il
 * alterne les soirées fastes et les naufrages. Ce n'est ni une qualité ni un défaut — mais
 * c'est ce qui distingue deux joueurs de même moyenne.
 */
export interface FormProfile {
  playerId: PlayerId
  games: GameLine[]
  /** Points par donne sur l'ensemble de l'historique. */
  rate: number | null
  /** Points par donne sur les dernières parties, `null` faute de recul. */
  recentRate: number | null
  /** `recentRate − rate` : positif, le joueur monte. */
  trend: number | null
  /** Écart type des rendements par partie. */
  spread: number | null
  best: GameLine | null
  worst: GameLine | null
}

/**
 * Parties retenues pour juger la forme du moment.
 *
 * Trois soirées : assez pour qu'un coup de chance isolé ne fasse pas la tendance, assez peu
 * pour que la tendance dise encore quelque chose du joueur d'aujourd'hui.
 */
export const RECENT_GAMES = 3

/**
 * Parties nécessaires avant de parler de forme ou de régularité.
 *
 * En dessous, `trend` et `spread` restent `null` : comparer trois parties à trois parties
 * demande d'en avoir au moins le double.
 */
export const FORM_MIN_GAMES = RECENT_GAMES * 2

export function formProfile(deals: Deal[], playerId: PlayerId): FormProfile {
  const games: GameLine[] = []

  for (const group of byGame(deals)) {
    const totals = new Map<PlayerId, number>()
    let mine = 0
    let played = 0

    for (const deal of group.deals) {
      for (const [id, score] of Object.entries(deal.scores)) {
        totals.set(id, (totals.get(id) ?? 0) + score)
      }
      if (deal.scores[playerId] !== undefined) {
        mine += deal.scores[playerId]
        played++
      }
    }
    if (played === 0) continue

    // Rang sportif : le nombre de joueurs strictement devant, plus un.
    let ahead = 0
    for (const [id, total] of totals) {
      if (id !== playerId && total > mine + EPSILON) ahead++
    }

    games.push({
      gameId: group.gameId,
      startedAt: group.startedAt,
      total: mine,
      deals: played,
      rate: mine / played,
      rank: ahead + 1,
      tableSize: totals.size,
    })
  }

  const rates = games.map((game) => game.rate)
  const rate = mean(rates)
  const recentRate =
    games.length >= FORM_MIN_GAMES ? mean(rates.slice(-RECENT_GAMES)) : null

  let spread: number | null = null
  if (games.length >= FORM_MIN_GAMES && rate !== null) {
    const variance = mean(rates.map((r) => (r - rate) ** 2))
    spread = variance === null ? null : Math.sqrt(variance)
  }

  const ordered = [...games].sort((a, b) => b.total - a.total)

  return {
    playerId,
    games,
    rate,
    recentRate,
    trend: recentRate !== null && rate !== null ? recentRate - rate : null,
    spread,
    best: ordered[0] ?? null,
    worst: ordered.length > 1 ? ordered[ordered.length - 1] : null,
  }
}

// ---------------------------------------------------------------------------
// Duels et affinités
// ---------------------------------------------------------------------------

/**
 * Le face-à-face de deux joueurs, sur les seules parties qu'ils ont partagées.
 *
 * Comparer deux totaux d'historique n'a pas de sens quand l'un a joué trente soirées et
 * l'autre cinq. Le duel remet les deux sur le même terrain : mêmes parties, mêmes donnes,
 * mêmes adversaires.
 */
export interface Duel {
  a: PlayerId
  b: PlayerId
  /** Parties où les deux ont joué au moins une donne ensemble. */
  games: number
  /** Parties terminées devant l'autre — les égalités ne comptent pour personne. */
  aheadA: number
  aheadB: number
  /** Donnes jouées ensemble. */
  deals: number
  /** Avance moyenne de `a` sur `b`, par donne commune. */
  gapPerDeal: number
}

/**
 * Tous les duels de l'historique, du plus fréquenté au moins fréquenté.
 *
 * La paire est orientée par l'ordre de `playerIds` : `a` est le premier des deux dans cette
 * liste. Aucune paire n'est produite deux fois.
 */
export function duels(deals: Deal[], playerIds: PlayerId[]): Duel[] {
  const result: Duel[] = []
  const groups = byGame(deals)

  for (let i = 0; i < playerIds.length; i++) {
    for (let j = i + 1; j < playerIds.length; j++) {
      const a = playerIds[i]
      const b = playerIds[j]
      let games = 0
      let aheadA = 0
      let aheadB = 0
      let together = 0
      let gap = 0

      for (const group of groups) {
        let totalA = 0
        let totalB = 0
        let shared = 0
        for (const deal of group.deals) {
          const scoreA = deal.scores[a]
          const scoreB = deal.scores[b]
          if (scoreA === undefined || scoreB === undefined) continue
          totalA += scoreA
          totalB += scoreB
          shared++
        }
        if (shared === 0) continue

        games++
        together += shared
        gap += totalA - totalB
        if (totalA > totalB + EPSILON) aheadA++
        else if (totalB > totalA + EPSILON) aheadB++
      }

      if (games === 0) continue
      result.push({
        a,
        b,
        games,
        aheadA,
        aheadB,
        deals: together,
        gapPerDeal: gap / together,
      })
    }
  }

  return result.sort((x, y) => y.deals - x.deals)
}

/**
 * Une paire preneur/appelé, à 5 joueurs.
 *
 * La paire n'est pas orientée : qui a pris et qui a été appelé change à chaque donne, et
 * séparer les deux sens couperait en deux un effectif déjà mince.
 */
export interface Partnership {
  a: PlayerId
  b: PlayerId
  takes: number
  won: number
}

/** Les attelages de l'historique, du plus éprouvé au moins éprouvé. */
export function partnerships(
  deals: Deal[],
  rules: RuleSet = DEFAULT_RULES,
): Partnership[] {
  const pairs = new Map<string, Partnership>()

  for (const deal of deals) {
    if (deal.input.kind === 'vachette') continue
    const partner = partnerOf(deal.input)
    if (partner === null) continue

    // Clé triée : « Marc appelle Anne » et « Anne appelle Marc » sont le même attelage.
    const [a, b] = [deal.input.takerId, partner].sort()
    const key = `${a} ${b}`
    const entry = pairs.get(key) ?? { a, b, takes: 0, won: 0 }
    entry.takes++
    if (contractBreakdown(deal.input, rules).success) entry.won++
    pairs.set(key, entry)
  }

  return [...pairs.values()].sort((x, y) => y.takes - x.takes)
}
