import { useState } from 'react'
import type { PlayerId } from '../engine/types'
import { Avatar } from '../components/Avatar'
import { Button, Eyebrow, Screen, TopAction } from '../components/ui'
import type { Player } from '../store/db'
import './seating.css'

interface SeatingProps {
  players: Player[]
  /** Nombre de donnes déjà jouées, pour calculer qui doit donner ensuite. */
  dealCount: number
  /** Donneur de la prochaine donne, tel qu'il découle de l'ordre actuel. */
  currentNextDealerId: PlayerId
  onCancel: () => void
  onSave: (playerIds: PlayerId[], firstDealerIndex: number) => void
}

/**
 * Correction de l'ordre à table.
 *
 * L'ordre ne se contente pas de ranger les colonnes : c'est lui qui fait tourner la donne.
 * S'être trompé en composant la table décale donc tous les donneurs suivants, d'où la
 * possibilité de rectifier sans perdre la partie en cours.
 *
 * Des flèches plutôt qu'un glisser-déposer : à quatre ou cinq lignes, déplacer au doigt
 * dans une liste courte rate sa cible plus souvent qu'il ne l'atteint.
 */
export function Seating({
  players,
  dealCount,
  currentNextDealerId,
  onCancel,
  onSave,
}: SeatingProps) {
  const [order, setOrder] = useState<Player[]>(players)
  const [nextDealerId, setNextDealerId] = useState<PlayerId>(currentNextDealerId)

  const move = (index: number, delta: number) => {
    const target = index + delta
    if (target < 0 || target >= order.length) return
    const next = [...order]
    ;[next[index], next[target]] = [next[target], next[index]]
    setOrder(next)
  }

  const save = () => {
    const playerIds = order.map((p) => p.id)
    const nextIndex = playerIds.indexOf(nextDealerId)
    // On remonte de la prochaine donne jusqu'à la première : c'est `firstDealerIndex` qui
    // est stocké, mais c'est le prochain donneur que l'on désigne ici.
    const count = playerIds.length
    const firstDealerIndex = ((nextIndex - dealCount) % count + count) % count
    onSave(playerIds, firstDealerIndex)
  }

  return (
    <Screen
      title="Ordre à table"
      left={<TopAction onClick={onCancel}>Annuler</TopAction>}
      footer={
        <Button variant="primary" onClick={save}>
          Enregistrer
        </Button>
      }
    >
      <p className="seating__note">
        L'ordre fait tourner la donne. Les donnes déjà jouées gardent le donneur enregistré
        au moment de leur validation — corriger l'ordre ne réécrit pas la partie, il règle
        la suite.
      </p>

      <Eyebrow>Ordre de la table</Eyebrow>
      <div className="seating__list">
        {order.map((player, index) => (
          <div key={player.id} className="seating__row">
            <span className="seating__rank num">{index + 1}</span>
            <Avatar player={player} size={38} />
            <span className="seating__name">{player.name}</span>
            <button
              type="button"
              className="seating__move"
              onClick={() => move(index, -1)}
              disabled={index === 0}
              aria-label={`Monter ${player.name}`}
            >
              ↑
            </button>
            <button
              type="button"
              className="seating__move"
              onClick={() => move(index, 1)}
              disabled={index === order.length - 1}
              aria-label={`Descendre ${player.name}`}
            >
              ↓
            </button>
          </div>
        ))}
      </div>

      <Eyebrow>Qui donne la prochaine donne</Eyebrow>
      <div className="pickRow">
        {order.map((player) => (
          <button
            key={player.id}
            type="button"
            className="pick"
            aria-pressed={player.id === nextDealerId}
            onClick={() => setNextDealerId(player.id)}
          >
            <Avatar
              player={player}
              size={46}
              highlighted={player.id === nextDealerId}
              dimmed={player.id !== nextDealerId}
            />
            <span className="pick__name">{player.name}</span>
          </button>
        ))}
      </div>
      <p className="hint">
        La donne tournera ensuite dans l'ordre ci-dessus, donne après donne.
      </p>
    </Screen>
  )
}
