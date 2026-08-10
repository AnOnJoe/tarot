import { Fragment, useMemo, useState } from 'react'
import { formatSigned } from '../engine/rules'
import { ranksFromGroups, scoreVachette, vacheeGroups } from '../engine/score'
import type { PlayerId, RuleSet, VacheeDeal } from '../engine/types'
import { Avatar } from '../components/Avatar'
import { Button, Eyebrow, Screen, TopAction } from '../components/ui'
import type { Player } from '../store/db'
import './vachette.css'

interface VachetteProps {
  players: Player[]
  rules: RuleSet
  dealNumber: number
  initial?: VacheeDeal
  onCancel: () => void
  onSubmit: (deal: VacheeDeal) => void
  onDelete?: () => void
}

/**
 * Classement en cours de construction, **du moins de points au plus de points**.
 *
 * `tied[i]` dit que le joueur en position `i` est à égalité avec celui qui le précède —
 * c'est la seule information que l'ordre seul ne sait pas porter.
 */
interface Draft {
  order: PlayerId[]
  tied: boolean[]
}

/** Groupes d'ex æquo décrits par le brouillon, dans son ordre : du moins au plus de points. */
function standingOf(draft: Draft): PlayerId[][] {
  const groups: PlayerId[][] = []
  draft.order.forEach((id, index) => {
    if (index > 0 && draft.tied[index]) groups[groups.length - 1].push(id)
    else groups.push([id])
  })
  return groups
}

/** Relit une donne enregistrée pour la rouvrir dans l'écran de classement. */
function draftFrom(deal: VacheeDeal, players: Player[]): Draft {
  // `vacheeGroups` rend l'ordre du barème — du plus au moins de points : on le retourne.
  const groups = [
    ...vacheeGroups(
      deal,
      players.map((p) => p.id),
    ),
  ].reverse()

  const order: PlayerId[] = []
  const tied: boolean[] = []
  for (const group of groups) {
    group.forEach((id, index) => {
      order.push(id)
      tied.push(index > 0)
    })
  }
  return { order, tied }
}

/**
 * Saisie d'une vachette : personne n'a pris, et **seul le classement compte**.
 *
 * On touche les joueurs du **moins** de points au plus de points : c'est dans ce sens que la
 * table dépouille, et le premier nommé est aussi celui qui gagne le plus — l'écran se lit
 * alors comme un podium, du vainqueur au dernier.
 *
 * Rien n'est présélectionné, et l'ordre de la table n'est pas proposé comme point de
 * départ : ce serait un classement plausible que personne n'a donné.
 */
export function Vachette({
  players,
  rules,
  dealNumber,
  initial,
  onCancel,
  onSubmit,
  onDelete,
}: VachetteProps) {
  const [draft, setDraft] = useState<Draft>(() =>
    initial ? draftFrom(initial, players) : { order: [], tied: [] },
  )

  const remaining = players.filter((p) => !draft.order.includes(p.id))
  const complete = remaining.length === 0
  const standing = standingOf(draft)
  const ranks = ranksFromGroups(standing)

  const scores = useMemo(
    () =>
      complete
        ? scoreVachette(
            { kind: 'vachette', standing },
            players.map((p) => p.id),
            rules,
          )
        : {},
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [complete, draft, players, rules],
  )

  const place = (id: PlayerId) =>
    setDraft((current) => ({
      order: [...current.order, id],
      tied: [...current.tied, false],
    }))

  /** Retire un joueur du classement : il retourne dans la réserve, l'ordre se resserre. */
  const unplace = (index: number) =>
    setDraft((current) => ({
      order: current.order.filter((_, i) => i !== index),
      tied: current.tied
        .filter((_, i) => i !== index)
        // Le premier ne peut être à égalité avec personne.
        .map((value, i) => (i === 0 ? false : value)),
    }))

  const toggleTie = (index: number) =>
    setDraft((current) => ({
      ...current,
      tied: current.tied.map((value, i) => (i === index ? !value : value)),
    }))

  return (
    <Screen
      title={`Vachette · donne ${dealNumber}`}
      left={<TopAction onClick={onCancel}>Annuler</TopAction>}
      right={
        onDelete && (
          <TopAction onClick={onDelete} align="end">
            Supprimer
          </TopAction>
        )
      }
      footer={
        <Button
          variant="primary"
          onClick={() => onSubmit({ kind: 'vachette', standing })}
          disabled={!complete}
        >
          {complete
            ? 'Valider la vachette'
            : `Encore ${remaining.length} joueur${remaining.length > 1 ? 's' : ''} à classer`}
        </Button>
      }
    >
      <p className="vachette__intro">
        Chacun pour soi : celui qui ramasse le moins de points gagne le plus. Touchez les
        joueurs <strong>du moins de points au plus de points</strong>. Les points exacts
        n'entrent pas dans le calcul — seul l'ordre compte.
      </p>

      {remaining.length > 0 && (
        <>
          <Eyebrow>
            {draft.order.length === 0 ? 'Qui a le moins de points ?' : 'Puis ?'}
          </Eyebrow>
          <div className="vachette__pool">
            {remaining.map((player) => (
              <button
                key={player.id}
                type="button"
                className="vachette__pick"
                onClick={() => place(player.id)}
              >
                <Avatar player={player} size={44} />
                <span className="vachette__pickName">{player.name}</span>
              </button>
            ))}
          </div>
        </>
      )}

      {draft.order.length > 0 && (
        <>
          <Eyebrow>Classement</Eyebrow>
          <div className="vachette__list">
            {draft.order.map((id, index) => {
              const player = players.find((p) => p.id === id)
              if (!player) return null
              const score = scores[id] ?? 0
              const previous = players.find((p) => p.id === draft.order[index - 1])
              return (
                <Fragment key={id}>
                  {/* Le signe se pose *entre* deux joueurs : c'est une jonction, pas une
                      propriété de la ligne du dessous. */}
                  {index > 0 && (
                    <div
                      className="vachette__between"
                      data-tied={draft.tied[index] || undefined}
                    >
                      <button
                        type="button"
                        className="vachette__tie"
                        aria-pressed={draft.tied[index]}
                        aria-label={`Mettre ${previous?.name ?? 'le précédent'} et ${player.name} à égalité`}
                        onClick={() => toggleTie(index)}
                      >
                        =
                      </button>
                    </div>
                  )}

                  <div className="vachette__row">
                    <span className="vachette__rank num" aria-label={`Rang ${ranks[id]}`}>
                      {ranks[id]}
                    </span>
                    <Avatar player={player} size={36} />
                    <span className="vachette__name">{player.name}</span>

                    <span
                      className="vachette__score num"
                      data-sign={score > 0 ? 'up' : score < 0 ? 'down' : undefined}
                    >
                      {complete ? formatSigned(score) : '—'}
                    </span>

                    <button
                      type="button"
                      className="vachette__remove"
                      aria-label={`Retirer ${player.name} du classement`}
                      onClick={() => unplace(index)}
                    >
                      ×
                    </button>
                  </div>
                </Fragment>
              )
            })}
          </div>
          <p className="hint">
            Le <strong>=</strong> entre deux joueurs les met à égalité ; les ex æquo se
            partagent alors leurs deux places du barème.
          </p>
        </>
      )}
    </Screen>
  )
}
