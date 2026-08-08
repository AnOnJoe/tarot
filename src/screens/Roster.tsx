import { useEffect, useMemo, useState } from 'react'
import { CONTRACT_LABELS, formatPoints, formatSigned } from '../engine/rules'
import { playerRecord, playerStats } from '../engine/stats'
import { TAG_HINT, isValidTag, normalizeTag } from '../engine/tag'
import type { Contract, Deal } from '../engine/types'
import { Avatar } from '../components/Avatar'
import { Button, Eyebrow, Screen, Sheet, TopAction } from '../components/ui'
import {
  createPlayer,
  deletePlayer,
  listAllDeals,
  updatePlayer,
  type Player,
} from '../store/db'
import { usePlayers } from '../store/hooks'
import { preparePhoto } from '../store/photo'
import './roster.css'

interface RosterProps {
  onClose: () => void
}

/**
 * Carnet des joueurs : leur nom, leur photo et leur tag.
 *
 * Le tag est modifiable, et c'est tout l'intérêt : pour que deux appareils reconnaissent
 * la même personne au moment de fusionner, il faut pouvoir recopier chez l'un le tag que
 * l'autre a tiré.
 */
export function Roster({ onClose }: RosterProps) {
  const { players, refresh } = usePlayers()
  const [editing, setEditing] = useState<Player | null>(null)
  const [creating, setCreating] = useState(false)
  // Chargées une fois pour tout le carnet : ouvrir une fiche ne doit pas relire la base.
  const [deals, setDeals] = useState<Deal[]>([])

  useEffect(() => {
    listAllDeals().then(setDeals)
  }, [])

  return (
    <Screen
      title="Carnet"
      left={<TopAction onClick={onClose}>Fermer</TopAction>}
      footer={
        <Button variant="primary" onClick={() => setCreating(true)}>
          Ajouter un joueur
        </Button>
      }
    >
      <p className="roster__note">
        Le tag identifie une personne d'un appareil à l'autre. Pour synchroniser vos
        parties avec quelqu'un, donnez-vous le même tag pour la même personne.
      </p>

      <Eyebrow>{players.length > 1 ? `${players.length} joueurs` : 'Joueurs'}</Eyebrow>
      <div className="list">
        {players.map((player) => (
          <button
            key={player.id}
            type="button"
            className="list__row"
            onClick={() => setEditing(player)}
          >
            <Avatar player={player} size={40} />
            <span className="list__grow">
              <span className="list__title">{player.name}</span>
              <span className="list__meta num">{player.tag}</span>
            </span>
            <span className="list__meta">›</span>
          </button>
        ))}
      </div>

      {(editing || creating) && (
        <PlayerEditor
          player={editing}
          existing={players}
          deals={deals}
          onDone={async () => {
            setEditing(null)
            setCreating(false)
            await refresh()
          }}
          onCancel={() => {
            setEditing(null)
            setCreating(false)
          }}
        />
      )}
    </Screen>
  )
}

/** Fiche d'un joueur, en création ou en correction. */
function PlayerEditor({
  player,
  existing,
  deals,
  onDone,
  onCancel,
}: {
  player: Player | null
  existing: Player[]
  deals: Deal[]
  onDone: () => void
  onCancel: () => void
}) {
  const [name, setName] = useState(player?.name ?? '')
  const [tag, setTag] = useState(player?.tag ?? '')
  const [photo, setPhoto] = useState<string | null>(player?.photo ?? null)
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  const pickPhoto = async (file: File | undefined) => {
    if (!file) return
    setError(null)
    try {
      setPhoto(await preparePhoto(file))
    } catch {
      setError("Cette image n'a pas pu être lue. Essayez une autre photo.")
    }
  }

  const save = async () => {
    if (busy) return
    if (!name.trim()) {
      setError('Il faut un prénom.')
      return
    }

    if (player) {
      if (!isValidTag(tag)) {
        setError(`Tag incomplet. ${TAG_HINT}`)
        return
      }
      // Deux joueurs partageant un tag seraient fusionnés en un seul : on refuse tôt.
      if (existing.some((other) => other.id !== player.id && other.tag === tag)) {
        setError('Ce tag est déjà celui de quelqu’un d’autre dans ce carnet.')
        return
      }
    }

    setBusy(true)
    if (player) await updatePlayer({ ...player, name: name.trim(), tag, photo })
    else await createPlayer(name, photo)
    setBusy(false)
    onDone()
  }

  const remove = async () => {
    if (!player) return
    if (
      !confirm(
        `Retirer ${player.name} du carnet ? Les parties déjà jouées gardent ses scores.`,
      )
    ) {
      return
    }
    await deletePlayer(player.id)
    onDone()
  }

  return (
    <Sheet
      title={player ? player.name : 'Nouveau joueur'}
      subtitle={player ? undefined : 'Son tag sera tiré au hasard, et modifiable ensuite.'}
      onDismiss={onCancel}
    >
      <div className="editor">
        <label className="editor__photo">
          <Avatar
            player={{ ...(player ?? PLACEHOLDER), name: name || '?', photo }}
            size={64}
          />
          <input
            type="file"
            accept="image/*"
            onChange={(event) => pickPhoto(event.target.files?.[0])}
          />
          <span className="editor__photoHint">
            {photo ? 'Changer la photo' : 'Ajouter une photo'}
          </span>
        </label>

        <input
          className="field"
          type="text"
          placeholder="Prénom"
          value={name}
          onChange={(event) => setName(event.target.value)}
        />

        {player && (
          <>
            <input
              className="field num editor__tag"
              type="text"
              inputMode="text"
              autoCapitalize="characters"
              autoCorrect="off"
              spellCheck={false}
              placeholder="Tag"
              value={tag}
              onChange={(event) => setTag(normalizeTag(event.target.value))}
              aria-label="Tag du joueur"
            />
            <p className="hint">{TAG_HINT}</p>
          </>
        )}
      </div>

      {error && <p className="editor__error">{error}</p>}

      {player && <PlayerFigures player={player} deals={deals} />}

      <Button variant="primary" onClick={save} disabled={busy}>
        {player ? 'Enregistrer' : 'Ajouter'}
      </Button>
      {player && (
        <Button variant="danger" onClick={remove}>
          Retirer du carnet
        </Button>
      )}
      <Button variant="ghost" onClick={onCancel}>
        Annuler
      </Button>
    </Sheet>
  )
}

/**
 * Le bilan d'un joueur, toutes parties confondues.
 *
 * Sur sa fiche plutôt que dans l'écran Statistiques : là-bas on compare des joueurs entre
 * eux, ici on regarde une personne. Ce sont deux questions différentes, et la seconde
 * n'avait pas de réponse.
 */
function PlayerFigures({ player, deals }: { player: Player; deals: Deal[] }) {
  const { stats, record, favourite } = useMemo(() => {
    const [stats] = playerStats(deals, [player.id])
    const record = playerRecord(deals, player.id)
    const entries = Object.entries(stats.contracts) as [Contract, number][]
    const best = entries.reduce((a, b) => (b[1] > a[1] ? b : a), entries[0])
    return { stats, record, favourite: best && best[1] > 0 ? best : null }
  }, [deals, player.id])

  if (stats.dealsPlayed === 0) {
    return (
      <p className="figures__none">
        Aucune donne à son actif pour l'instant. Son bilan s'écrira tout seul.
      </p>
    )
  }

  return (
    <>
      <Eyebrow>Son bilan</Eyebrow>
      <div className="figures">
        <Figure value={record.gamesPlayed} label={record.gamesPlayed > 1 ? 'parties' : 'partie'} />
        <Figure
          value={record.gamesWon}
          label={record.gamesWon > 1 ? 'victoires' : 'victoire'}
        />
        <Figure value={stats.dealsPlayed} label="donnes" />
        <Figure value={formatSigned(stats.total)} label="points" />
        <Figure value={stats.takes} label={stats.takes > 1 ? 'prises' : 'prise'} />
        <Figure
          // Un taux sans prise ne veut rien dire : mieux vaut l'avouer qu'afficher 0 %.
          value={stats.takes > 0 ? `${Math.round((stats.takesWon / stats.takes) * 100)} %` : '—'}
          label="réussies"
        />
      </div>
      <p className="figures__note">
        <strong className="num">{formatSigned(stats.averageAttack)}</strong> par donne en
        attaque, <strong className="num">{formatSigned(stats.averageDefense)}</strong> en
        défense.
        {record.bestGame !== null && (
          <>
            {' '}
            Meilleure partie : <strong className="num">{formatPoints(record.bestGame)}</strong>.
          </>
        )}
        {favourite && (
          <>
            {' '}
            Contrat de prédilection : <strong>{CONTRACT_LABELS[favourite[0]]}</strong>.
          </>
        )}
      </p>
    </>
  )
}

function Figure({ value, label }: { value: number | string; label: string }) {
  return (
    <div className="figures__cell">
      <span className="figures__value num display">{value}</span>
      <span className="figures__label">{label}</span>
    </div>
  )
}

/** Sert uniquement à prévisualiser la photo d'un joueur pas encore créé. */
const PLACEHOLDER: Player = {
  id: 'placeholder',
  tag: 'AAA-222',
  name: '',
  photo: null,
  colorIndex: 0,
  createdAt: 0,
}
