import { useState } from 'react'
import type { PlayerCount, PlayerId } from '../engine/types'
import { Avatar } from '../components/Avatar'
import { Button, Chip, Eyebrow, Screen, TopAction } from '../components/ui'
import { createPlayer, deletePlayer, type Player } from '../store/db'
import { usePlayers } from '../store/hooks'
import { preparePhoto } from '../store/photo'
import './newgame.css'

const COUNTS: PlayerCount[] = [3, 4, 5]

/** Joueur factice servant uniquement à prévisualiser la photo avant enregistrement. */
const PREVIEW_PLAYER: Player = {
  id: 'preview',
  name: '',
  photo: null,
  colorIndex: 0,
  createdAt: 0,
}

interface NewGameProps {
  onCancel: () => void
  onStart: (playerIds: PlayerId[], firstDealerIndex: number) => void
}

/**
 * Composition de la table : combien de joueurs, lesquels, et qui donne en premier.
 * L'ordre de sélection fixe l'ordre de la table, dont dépend la rotation du donneur.
 */
export function NewGame({ onCancel, onStart }: NewGameProps) {
  const { players, refresh } = usePlayers()
  const [count, setCount] = useState<PlayerCount>(4)
  const [selected, setSelected] = useState<PlayerId[]>([])
  const [firstDealer, setFirstDealer] = useState(0)
  const [newName, setNewName] = useState('')
  const [photo, setPhoto] = useState<Blob | null>(null)
  const [photoError, setPhotoError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  const toggle = (id: PlayerId) => {
    setSelected((current) => {
      if (current.includes(id)) return current.filter((p) => p !== id)
      if (current.length >= count) return current
      return [...current, id]
    })
  }

  const changeCount = (next: PlayerCount) => {
    setCount(next)
    setSelected((current) => current.slice(0, next))
    setFirstDealer((current) => Math.min(current, next - 1))
  }

  const addPlayer = async () => {
    if (!newName.trim() || busy) return
    setBusy(true)
    const player = await createPlayer(newName, photo)
    setNewName('')
    setPhoto(null)
    await refresh()
    setSelected((current) => (current.length < count ? [...current, player.id] : current))
    setBusy(false)
  }

  const pickPhoto = async (file: File | undefined) => {
    if (!file) return
    setPhotoError(null)
    try {
      setPhoto(await preparePhoto(file))
    } catch {
      // Format exotique, fichier tronqué, HEIC que le navigateur refuse de décoder : mieux
      // vaut le dire que laisser un emplacement vide sans explication.
      setPhoto(null)
      setPhotoError("Cette image n'a pas pu être lue. Essayez une autre photo.")
    }
  }

  const remove = async (player: Player) => {
    if (!confirm(`Retirer ${player.name} du carnet ? Les parties déjà jouées sont conservées.`))
      return
    await deletePlayer(player.id)
    setSelected((current) => current.filter((id) => id !== player.id))
    await refresh()
  }

  const ready = selected.length === count
  const ordered = selected
    .map((id) => players.find((p) => p.id === id))
    .filter((p): p is Player => !!p)

  return (
    <Screen
      title="Nouvelle partie"
      left={<TopAction onClick={onCancel}>Annuler</TopAction>}
      footer={
        <Button
          variant="primary"
          disabled={!ready}
          onClick={() => onStart(selected, firstDealer)}
        >
          {ready
            ? 'Commencer la partie'
            : `Encore ${count - selected.length} joueur${count - selected.length > 1 ? 's' : ''}`}
        </Button>
      }
    >
      <Eyebrow>Joueurs à table</Eyebrow>
      <div className="chips">
        {COUNTS.map((value) => (
          <Chip
            key={value}
            selected={count === value}
            onClick={() => changeCount(value)}
            label={value}
            sub="joueurs"
          />
        ))}
      </div>

      <Eyebrow>Carnet</Eyebrow>
      {players.length === 0 ? (
        <p className="hint">Aucun joueur enregistré. Ajoutez-les ci-dessous.</p>
      ) : (
        <div className="roster">
          {players.map((player) => {
            const rank = selected.indexOf(player.id)
            return (
              <button
                key={player.id}
                type="button"
                className="roster__item"
                aria-pressed={rank >= 0}
                onClick={() => toggle(player.id)}
                onContextMenu={(event) => {
                  event.preventDefault()
                  remove(player)
                }}
              >
                <Avatar player={player} size={54} highlighted={rank >= 0} dimmed={rank < 0} />
                {rank >= 0 && <span className="roster__rank num">{rank + 1}</span>}
                <span className="roster__name">{player.name}</span>
              </button>
            )
          })}
        </div>
      )}

      <Eyebrow>Ajouter un joueur</Eyebrow>
      <div className="addPlayer">
        <label className="addPlayer__photo">
          {photo ? (
            <Avatar player={{ ...PREVIEW_PLAYER, name: newName, photo }} size={54} />
          ) : (
            <span className="addPlayer__placeholder">Photo</span>
          )}
          <input
            type="file"
            accept="image/*"
            onChange={(event) => pickPhoto(event.target.files?.[0])}
          />
        </label>
        <input
          className="field"
          type="text"
          placeholder="Prénom"
          value={newName}
          onChange={(event) => setNewName(event.target.value)}
          onKeyDown={(event) => event.key === 'Enter' && addPlayer()}
        />
        <Button onClick={addPlayer} disabled={!newName.trim() || busy}>
          Ajouter
        </Button>
      </div>
      {photoError && <p className="addPlayer__error">{photoError}</p>}

      {ordered.length > 0 && (
        <>
          <Eyebrow>Qui donne en premier</Eyebrow>
          <div className="pickRow">
            {ordered.map((player, index) => (
              <button
                key={player.id}
                type="button"
                className="pick"
                aria-pressed={firstDealer === index}
                onClick={() => setFirstDealer(index)}
              >
                <Avatar
                  player={player}
                  size={46}
                  highlighted={firstDealer === index}
                  dimmed={firstDealer !== index}
                />
                <span className="pick__name">{player.name}</span>
              </button>
            ))}
          </div>
          <p className="hint">
            La donne tourne ensuite dans cet ordre, donne après donne.
          </p>
        </>
      )}
    </Screen>
  )
}
