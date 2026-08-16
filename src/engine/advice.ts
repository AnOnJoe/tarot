/**
 * Ce que l'historique permet de dire à un joueur — et rien de plus.
 *
 * La règle de ce module tient en une phrase : **sous l'effectif, on se tait.** Un taux de
 * réussite sur trois prises n'est pas une tendance, c'est du hasard mis en forme ; l'affirmer
 * à table ferait perdre à l'application la seule chose qu'elle ait à vendre, sa justesse.
 * Chaque conseil porte donc son seuil, exporté et testé, et cite l'effectif sur lequel il
 * repose plutôt qu'un pourcentage qui masquerait sa fragilité.
 *
 * Les nombres viennent de `insights.ts`. Ici on ne fait que décider de quoi mérite d'être dit.
 */

import {
  duels,
  defenderProfile,
  formProfile,
  partnerships,
  takerProfile,
  vacheeProfile,
  RECENT_GAMES,
  type Duel,
} from './insights'
import { CONTRACT_LABELS, DEFAULT_RULES, formatPoints, formatSigned } from './rules'
import type { Deal, Oudlers, PlayerId, RuleSet } from './types'

/**
 * Ce qu'une observation dit du joueur : un appui, une faille, ou un simple fait.
 *
 * La nuance n'est pas décorative — elle décide de la couleur à l'écran, et surtout du ton :
 * on n'annonce pas une force et une fragilité de la même façon à quelqu'un qui vient de
 * perdre sa soirée.
 */
export type AdviceTone = 'force' | 'fragilite' | 'constat'

export interface Advice {
  /** Identifiant de la règle, stable : sert de clé de rendu et de repère aux tests. */
  id: string
  playerId: PlayerId
  tone: AdviceTone
  text: string
}

// ---------------------------------------------------------------------------
// Seuils
// ---------------------------------------------------------------------------

/** Prises nécessaires avant de qualifier la façon de prendre de quelqu'un. */
export const MIN_TAKES = 12

/** Prises sous un même contrat avant d'en juger le rendement. */
export const MIN_TAKES_BY_CONTRACT = 8

/** Prises à un même nombre de bouts avant d'en tirer une règle. */
export const MIN_TAKES_BY_OUDLERS = 6

/** Chutes nécessaires avant de parler de la façon dont quelqu'un chute. */
export const MIN_FALLS = 6

/**
 * Donnes défendues avant de comparer un défenseur à sa table.
 *
 * Haut à dessein : le défenseur ne choisit ni sa main ni le contrat qu'il subit, et il faut
 * beaucoup de donnes pour que son apport émerge du bruit.
 */
export const MIN_DEFENSES = 30

/** Parties partagées avant de faire d'un face-à-face autre chose qu'une anecdote. */
export const MIN_DUEL_GAMES = 5

/** Prises d'un même attelage à 5 avant d'en parler. */
export const MIN_PARTNERSHIP_TAKES = 6

/** Vachettes jouées avant de dire ce qu'elles coûtent à quelqu'un. */
export const MIN_VACHETTES = 6

/**
 * Écart de points par donne à partir duquel une différence mérite d'être signalée.
 *
 * En dessous, deux joueurs ne se distinguent pas : sur une soirée de quinze donnes, trois
 * points par donne font quarante-cinq points d'écart — voilà qui se voit au tableau.
 */
export const NOTABLE_RATE = 3

// ---------------------------------------------------------------------------
// Formulation
// ---------------------------------------------------------------------------

function plural(count: number, one: string, many = `${one}s`): string {
  return count > 1 ? many : one
}

/** Arrondi d'affichage : un conseil qui annonce « 7,25 points » se croit plus précis qu'il n'est. */
function round(value: number): string {
  return formatPoints(Math.round(value * 10) / 10)
}

function signed(value: number): string {
  return formatSigned(Math.round(value * 10) / 10)
}

/** « 2 bouts », et « aucun bout » plutôt que « 0 bout ». */
function oudlerLabel(count: Oudlers): string {
  return count === 0 ? 'aucun bout' : `${count} ${plural(count, 'bout')}`
}

/** Options communes : les barèmes en vigueur, et de quoi nommer les autres joueurs. */
export interface AdviceOptions {
  rules?: RuleSet
  /** L'engine ignore le carnet : les noms lui sont fournis, à défaut il rend l'identifiant. */
  nameOf?: (id: PlayerId) => string
}

// ---------------------------------------------------------------------------
// Conseils d'un joueur
// ---------------------------------------------------------------------------

/**
 * Confronte un joueur à son historique.
 *
 * `playerIds` sert de table de référence : un défenseur ne se juge que comparé aux autres
 * défenseurs des mêmes soirées. Les conseils sortent dans l'ordre où ils comptent — celui
 * qui change une décision à table d'abord, la statistique de salon ensuite.
 */
export function playerAdvice(
  deals: Deal[],
  playerId: PlayerId,
  playerIds: PlayerId[],
  options: AdviceOptions = {},
): Advice[] {
  const rules = options.rules ?? DEFAULT_RULES
  const nameOf = options.nameOf ?? ((id: PlayerId) => id)
  const out: Advice[] = []
  const push = (id: string, tone: AdviceTone, text: string) =>
    out.push({ id, playerId, tone, text })

  const taker = takerProfile(deals, playerId, rules)
  const defender = defenderProfile(deals, playerId, rules)
  const form = formProfile(deals, playerId)

  // --- Les bouts. Le seul paramètre de la prise que le joueur connaît avant de s'engager,
  // et donc le seul sur lequel un conseil puisse porter à coup sûr.
  for (const line of taker.byOudlers) {
    if (line.oudlers > 1 || line.takes < MIN_TAKES_BY_OUDLERS) continue
    const rate = line.won / line.takes
    if (rate > 0.4) continue

    const above = taker.byOudlers.filter((other) => other.oudlers > line.oudlers)
    const takesAbove = above.reduce((sum, other) => sum + other.takes, 0)
    const wonAbove = above.reduce((sum, other) => sum + other.won, 0)
    if (takesAbove < MIN_TAKES_BY_OUDLERS || wonAbove / takesAbove < rate + 0.25) continue

    push(
      `oudlers-${line.oudlers}`,
      'fragilite',
      `Avec ${oudlerLabel(line.oudlers)}, tu tiens ${line.won} ${plural(line.won, 'prise')} sur ${line.takes} — il te faut ${rules.thresholds[line.oudlers]} points d'attaque. Au-delà, tu passes ${wonAbove} fois sur ${takesAbove}.`,
    )
  }

  // --- Le rendement des contrats. Un contrat n'est pas bon ou mauvais dans l'absolu : il
  // l'est comparé à ceux que le même joueur choisit sur les mêmes mains.
  const scored = taker.byContract.filter(
    (line) => line.takes >= MIN_TAKES_BY_CONTRACT && line.perTake !== null,
  )
  if (scored.length >= 2) {
    const ranked = [...scored].sort((a, b) => (b.perTake ?? 0) - (a.perTake ?? 0))
    const best = ranked[0]
    const worst = ranked[ranked.length - 1]
    if ((worst.perTake ?? 0) < 0 && (best.perTake ?? 0) > 0) {
      push(
        'contrat-deficitaire',
        'fragilite',
        `Ta ${CONTRACT_LABELS[worst.contract]} te coûte ${round(Math.abs(worst.perTake ?? 0))} points par prise sur ${worst.takes}, quand ta ${CONTRACT_LABELS[best.contract]} t'en rapporte ${round(best.perTake ?? 0)}.`,
      )
    }
  }

  // --- L'appétit. Prendre trop est la faute la plus coûteuse du tarot, et la plus invisible :
  // le joueur qui prend deux fois trop se souvient de ses réussites, jamais de sa fréquence.
  if (taker.takes >= MIN_TAKES && taker.appetite !== null) {
    const rate = taker.won / taker.takes
    if (taker.appetite >= 1.4 && rate < 0.55) {
      push(
        'appetit-excessif',
        'fragilite',
        `Tu prends ${round(taker.appetite)} fois ta part de la table et tu tiens ${taker.won} ${plural(taker.won, 'contrat')} sur ${taker.takes}. Prendre moins souvent, c'est chuter moins souvent.`,
      )
    } else if (taker.appetite >= 1.4) {
      push(
        'appetit-assume',
        'force',
        `Tu prends ${round(taker.appetite)} fois ta part de la table et tu tiens quand même ${taker.won} ${plural(taker.won, 'contrat')} sur ${taker.takes}.`,
      )
    } else if (taker.appetite <= 0.7 && rate >= 0.65) {
      push(
        'appetit-timide',
        'constat',
        `Tu ne prends que ${round(taker.appetite)} fois ta part, mais tu tiens ${taker.won} ${plural(taker.won, 'contrat')} sur ${taker.takes}. Il y a de la place pour prendre davantage.`,
      )
    }
  }

  // --- La façon de chuter. Manquer de sept points et manquer de trente ne se corrigent pas
  // du tout de la même manière : l'un est un pli, l'autre une prise à ne pas faire.
  const falls = taker.takes - taker.won
  if (falls >= MIN_FALLS && taker.marginLost !== null) {
    if (taker.marginLost <= 10) {
      push(
        'chute-courte',
        'constat',
        `Quand tu chutes, il te manque ${round(taker.marginLost)} points en moyenne sur ${falls} ${plural(falls, 'chute')} : un pli, pas un mauvais contrat.`,
      )
    } else if (taker.marginLost >= 25) {
      push(
        'chute-large',
        'fragilite',
        `Quand tu chutes, tu es à ${round(taker.marginLost)} points du compte sur ${falls} ${plural(falls, 'chute')}. Ces prises-là étaient perdues avant la première carte.`,
      )
    }
  }

  // --- La marge de réussite : un contrat tenu très largement était un contrat sous-vendu.
  if (taker.won >= MIN_TAKES_BY_CONTRACT && taker.marginWon !== null && taker.marginWon >= 20) {
    push(
      'marge-large',
      'constat',
      `Tes contrats tenus le sont avec ${round(taker.marginWon)} points d'avance sur ${taker.won} ${plural(taker.won, 'réussite')}. Le multiplicateur au-dessus paierait la même main plus cher.`,
    )
  }

  // --- La défense, mesurée contre les défenseurs des mêmes soirées.
  if (defender.defenses >= MIN_DEFENSES && defender.perDefense !== null) {
    const others = playerIds
      .filter((id) => id !== playerId)
      .map((id) => defenderProfile(deals, id, rules))
      .filter((profile) => profile.defenses >= MIN_DEFENSES && profile.perDefense !== null)

    if (others.length > 0) {
      const table =
        others.reduce((sum, profile) => sum + (profile.perDefense ?? 0), 0) / others.length
      const gap = defender.perDefense - table
      if (Math.abs(gap) >= NOTABLE_RATE) {
        push(
          gap > 0 ? 'defense-forte' : 'defense-faible',
          gap > 0 ? 'force' : 'fragilite',
          `En défense tu marques ${signed(defender.perDefense)} par donne sur ${defender.defenses}, contre ${signed(table)} pour le reste de la table.`,
        )
      }
    }
  }

  // --- La forme. Comparer le joueur d'aujourd'hui à celui de toujours, plutôt qu'aux autres.
  if (form.trend !== null && form.recentRate !== null && Math.abs(form.trend) >= NOTABLE_RATE) {
    push(
      form.trend > 0 ? 'forme-montante' : 'forme-descendante',
      form.trend > 0 ? 'force' : 'constat',
      `Sur tes ${RECENT_GAMES} dernières parties tu marques ${signed(form.recentRate)} par donne, contre ${signed(form.rate ?? 0)} sur l'ensemble.`,
    )
  }

  // --- La vachette : personne ne l'a choisie, et elle pèse pourtant lourd au tableau.
  const vachee = vacheeProfile(deals, playerId)
  if (vachee.deals >= MIN_VACHETTES && vachee.perDeal !== null && Math.abs(vachee.perDeal) >= 20) {
    push(
      vachee.perDeal > 0 ? 'vachette-favorable' : 'vachette-defavorable',
      vachee.perDeal > 0 ? 'force' : 'fragilite',
      `La vachette te ${vachee.perDeal > 0 ? 'rapporte' : 'coûte'} ${round(Math.abs(vachee.perDeal))} points en moyenne sur ${vachee.deals} ${plural(vachee.deals, 'donne')}.`,
    )
  }

  // --- Le face-à-face le plus fourni, quand il penche franchement d'un côté.
  const rivalry = bestDuel(deals, playerId, playerIds)
  if (rivalry) {
    const { duel, mine, theirs, other } = rivalry
    push(
      mine > theirs ? 'duel-favorable' : 'duel-defavorable',
      mine > theirs ? 'force' : 'constat',
      `Sur ${duel.games} parties partagées avec ${nameOf(other)}, tu finis devant ${mine} fois.`,
    )
  }

  return out
}

/**
 * Le duel le plus déséquilibré d'un joueur, parmi ceux qui ont l'effectif.
 *
 * « Déséquilibré » veut dire deux fois plus de parties d'un côté que de l'autre : en dessous,
 * l'écart tient dans la variance de n'importe quelle poignée de soirées.
 */
function bestDuel(
  deals: Deal[],
  playerId: PlayerId,
  playerIds: PlayerId[],
): { duel: Duel; mine: number; theirs: number; other: PlayerId } | null {
  const candidates = duels(deals, playerIds)
    .filter((duel) => (duel.a === playerId || duel.b === playerId) && duel.games >= MIN_DUEL_GAMES)
    .map((duel) => {
      const first = duel.a === playerId
      return {
        duel,
        mine: first ? duel.aheadA : duel.aheadB,
        theirs: first ? duel.aheadB : duel.aheadA,
        other: first ? duel.b : duel.a,
      }
    })
    .filter(({ mine, theirs }) => mine >= theirs * 2 || theirs >= mine * 2)

  if (candidates.length === 0) return null
  // Le plus tranché l'emporte, l'ancienneté du duel départage les ex æquo.
  return candidates.sort(
    (x, y) =>
      Math.abs(y.mine - y.theirs) - Math.abs(x.mine - x.theirs) || y.duel.games - x.duel.games,
  )[0]
}

// ---------------------------------------------------------------------------
// Conseils de table
// ---------------------------------------------------------------------------

/** Une observation qui ne vise personne en particulier, ou qui compare deux joueurs. */
export interface TableNote {
  id: string
  text: string
  /** Joueurs concernés, pour poser leurs portraits à côté. */
  playerIds: PlayerId[]
}

/**
 * Ce que l'historique dit de la table elle-même : ses attelages, ses régularités, ses duels.
 *
 * Les mêmes seuils qu'ailleurs s'appliquent — une paire qui a joué trois donnes ensemble
 * n'est pas un attelage.
 */
export function tableNotes(
  deals: Deal[],
  playerIds: PlayerId[],
  options: AdviceOptions = {},
): TableNote[] {
  const rules = options.rules ?? DEFAULT_RULES
  const nameOf = options.nameOf ?? ((id: PlayerId) => id)
  const notes: TableNote[] = []

  // Les attelages à 5, du plus éprouvé au moins éprouvé.
  for (const pair of partnerships(deals, rules)) {
    if (pair.takes < MIN_PARTNERSHIP_TAKES) continue
    const rate = pair.won / pair.takes
    if (rate < 0.7 && rate > 0.35) continue
    notes.push({
      id: `attelage-${pair.a}-${pair.b}`,
      text: `${nameOf(pair.a)} et ${nameOf(pair.b)} appelés ensemble : ${pair.won} ${plural(pair.won, 'contrat tenu', 'contrats tenus')} sur ${pair.takes}.`,
      playerIds: [pair.a, pair.b],
    })
    if (notes.length >= 2) break
  }

  // Le joueur le plus régulier, s'il se détache vraiment du suivant.
  const spreads = playerIds
    .map((id) => ({ id, spread: formProfile(deals, id).spread }))
    .filter((entry): entry is { id: PlayerId; spread: number } => entry.spread !== null)
    .sort((a, b) => a.spread - b.spread)

  if (spreads.length >= 2 && spreads[1].spread - spreads[0].spread >= NOTABLE_RATE / 2) {
    notes.push({
      id: 'regularite',
      text: `${nameOf(spreads[0].id)} est le plus régulier de la table : ${round(spreads[0].spread)} points de battement par donne, contre ${round(spreads[spreads.length - 1].spread)} pour le plus irrégulier.`,
      playerIds: [spreads[0].id],
    })
  }

  // Le duel le plus fourni de la table, quand il a de quoi être raconté.
  const [top] = duels(deals, playerIds).filter((duel) => duel.games >= MIN_DUEL_GAMES)
  if (top && top.aheadA !== top.aheadB) {
    const leader = top.aheadA > top.aheadB ? top.a : top.b
    const trailer = leader === top.a ? top.b : top.a
    const wins = Math.max(top.aheadA, top.aheadB)
    notes.push({
      id: 'duel',
      text: `${nameOf(leader)} finit devant ${nameOf(trailer)} dans ${wins} de leurs ${top.games} parties communes, ${signed(top.gapPerDeal * (leader === top.a ? 1 : -1))} par donne.`,
      playerIds: [leader, trailer],
    })
  }

  return notes
}

// ---------------------------------------------------------------------------
// Accroches de l'accueil
// ---------------------------------------------------------------------------

/** Une phrase courte pour la carte d'accueil : de quoi donner envie d'entrer. */
export interface Highlight {
  id: string
  /** Ce qu'on annonce, en gras sur la carte. */
  headline: string
  /** Le détail chiffré, en dessous. */
  detail: string
  playerId: PlayerId | null
}

/**
 * Les deux accroches de l'accueil.
 *
 * Elles doivent tenir sur deux lignes et changer d'une soirée à l'autre, sinon la carte
 * devient un meuble qu'on cesse de voir. D'où l'ordre de priorité : on annonce d'abord
 * l'état de la saison, puis le fait le plus vivant qu'on sache établir.
 */
export function tableHighlights(
  deals: Deal[],
  playerIds: PlayerId[],
  options: AdviceOptions = {},
): Highlight[] {
  const rules = options.rules ?? DEFAULT_RULES
  const nameOf = options.nameOf ?? ((id: PlayerId) => id)
  if (deals.length === 0 || playerIds.length === 0) return []

  const out: Highlight[] = []

  // Qui mène, tous historiques confondus.
  const totals = playerIds.map((id) => ({
    id,
    total: deals.reduce((sum, deal) => sum + (deal.scores[id] ?? 0), 0),
    games: formProfile(deals, id).games.length,
  }))
  const leader = [...totals].sort((a, b) => b.total - a.total)[0]
  if (leader && leader.games > 0) {
    out.push({
      id: 'leader',
      headline: `${nameOf(leader.id)} mène`,
      detail: `${signed(leader.total)} sur ${leader.games} ${plural(leader.games, 'partie')}`,
      playerId: leader.id,
    })
  }

  // Puis le fait du moment : une forme qui monte, à défaut un appétit qui se voit.
  const rising = playerIds
    .map((id) => ({ id, form: formProfile(deals, id) }))
    .filter((entry) => entry.form.trend !== null && entry.form.trend >= NOTABLE_RATE)
    .sort((a, b) => (b.form.trend ?? 0) - (a.form.trend ?? 0))[0]

  if (rising) {
    out.push({
      id: 'forme',
      headline: `${nameOf(rising.id)} monte`,
      detail: `${signed(rising.form.recentRate ?? 0)} par donne sur ${RECENT_GAMES} parties, contre ${signed(rising.form.rate ?? 0)} d'ordinaire`,
      playerId: rising.id,
    })
    return out
  }

  const boldest = playerIds
    .map((id) => takerProfile(deals, id, rules))
    .filter((profile) => profile.takes >= MIN_TAKES && profile.appetite !== null)
    .sort((a, b) => (b.appetite ?? 0) - (a.appetite ?? 0))[0]

  if (boldest && (boldest.appetite ?? 0) >= 1.3) {
    out.push({
      id: 'appetit',
      headline: `${nameOf(boldest.playerId)} prend le plus`,
      detail: `${boldest.takes} prises, ${boldest.won} ${plural(boldest.won, 'tenue')}`,
      playerId: boldest.playerId,
    })
  }

  return out
}
