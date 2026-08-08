import { useEffect, useState } from 'react'
import { Button, Eyebrow, Screen, TopAction } from '../components/ui'
import type { BackupSummary } from '../store/backup'
import type { MergeSummary } from '../store/merge'
import { listAllDeals, listGames, listPlayers } from '../store/db'
import { exportEverything, importBackup, mergeBackup } from '../store/export'
import './backup.css'

interface BackupProps {
  onClose: () => void
  /** Les données ont changé sous les pieds de l'application : il faut tout relire. */
  onRestored: () => void
}

const DATE_FORMAT = new Intl.DateTimeFormat('fr-FR', {
  dateStyle: 'long',
  timeStyle: 'short',
})

/**
 * Sauvegarde et restauration.
 *
 * L'export ne sert à rien si l'on ne peut rien en refaire : les deux gestes vivent donc
 * sur le même écran, et ce que contient le fichier est annoncé avant de restaurer.
 */
export function Backup({ onClose, onRestored }: BackupProps) {
  const [counts, setCounts] = useState({ players: 0, games: 0, deals: 0, photos: 0 })
  const [busy, setBusy] = useState(false)
  const [restored, setRestored] = useState<BackupSummary | null>(null)
  const [merged, setMerged] = useState<MergeSummary | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    Promise.all([listPlayers(), listGames(), listAllDeals()]).then(
      ([players, games, deals]) => {
        setCounts({
          players: players.length,
          games: games.length,
          deals: deals.length,
          photos: players.filter((p) => p.photo).length,
        })
      },
    )
  }, [])

  /**
   * Fusion : on ajoute ce qui manque, sans rien remplacer. Aucune confirmation à
   * demander — rien de local ne peut être perdu.
   */
  const merge = async (file: File | undefined) => {
    if (!file || busy) return
    setError(null)
    setRestored(null)
    setMerged(null)
    setBusy(true)
    try {
      const summary = await mergeBackup(file)
      setMerged(summary)
      const [players, games, deals] = await Promise.all([
        listPlayers(),
        listGames(),
        listAllDeals(),
      ])
      setCounts({
        players: players.length,
        games: games.length,
        deals: deals.length,
        photos: players.filter((p) => p.photo).length,
      })
      onRestored()
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Fusion impossible.')
    } finally {
      setBusy(false)
    }
  }

  const restore = async (file: File | undefined) => {
    if (!file || busy) return
    setError(null)
    setRestored(null)
    setMerged(null)

    const warning =
      `Restaurer remplacera tout ce que contient cet appareil : ` +
      `${counts.players} joueur${counts.players > 1 ? 's' : ''}, ` +
      `${counts.games} partie${counts.games > 1 ? 's' : ''} et ` +
      `${counts.deals} donne${counts.deals > 1 ? 's' : ''}. Continuer ?`
    if (!confirm(warning)) return

    setBusy(true)
    try {
      const summary = await importBackup(file)
      setRestored(summary)
      // Les compteurs décrivent l'appareil : ils doivent refléter ce qui vient d'y entrer.
      setCounts({
        players: summary.players,
        games: summary.games,
        deals: summary.deals,
        photos: summary.photos,
      })
      onRestored()
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Restauration impossible.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <Screen title="Sauvegarde" left={<TopAction onClick={onClose}>Fermer</TopAction>}>
      <Eyebrow>Sur cet appareil</Eyebrow>
      <div className="backup__counts">
        <Count value={counts.players} label={counts.players > 1 ? 'joueurs' : 'joueur'} />
        <Count value={counts.photos} label={counts.photos > 1 ? 'photos' : 'photo'} />
        <Count value={counts.games} label={counts.games > 1 ? 'parties' : 'partie'} />
        <Count value={counts.deals} label={counts.deals > 1 ? 'donnes' : 'donne'} />
      </div>

      <Eyebrow>Exporter</Eyebrow>
      <p className="backup__note">
        Deux fichiers : un <strong>JSON</strong> qui contient tout — noms, photos, parties,
        donnes et barèmes — et qui seul permet de restaurer ; et un <strong>CSV</strong>{' '}
        lisible dans un tableur, pour consulter.
      </p>
      <div className="backup__action">
        <Button variant="primary" onClick={exportEverything}>
          Exporter la sauvegarde
        </Button>
      </div>

      <Eyebrow>Synchroniser avec quelqu'un</Eyebrow>
      <p className="backup__note">
        Fusionne le fichier de quelqu'un d'autre avec le vôtre : ce qui manque est ajouté,
        <strong> rien n'est remplacé</strong>. Faites-le dans les deux sens pour que chacun
        ait tout. Les joueurs se reconnaissent à leur <strong>tag</strong> — vérifiez dans
        le carnet que la même personne porte bien le même des deux côtés.
      </p>

      <label className="backup__action">
        <span className="btn btn--primary">{busy ? 'Fusion…' : 'Fusionner un fichier'}</span>
        <input
          type="file"
          accept="application/json,.json"
          disabled={busy}
          onChange={(event) => merge(event.target.files?.[0])}
        />
      </label>

      {merged && (
        <div className="backup__done">
          <p className="backup__doneTitle">Fusion terminée</p>
          <p>
            {merged.playersAdded} joueur{merged.playersAdded > 1 ? 's' : ''} ajouté
            {merged.playersAdded > 1 ? 's' : ''}, {merged.playersMatched} reconnu
            {merged.playersMatched > 1 ? 's' : ''} par leur tag. {merged.gamesAdded} partie
            {merged.gamesAdded > 1 ? 's' : ''} et {merged.dealsAdded} donne
            {merged.dealsAdded > 1 ? 's' : ''} ajoutée{merged.dealsAdded > 1 ? 's' : ''}.
          </p>
        </div>
      )}

      <Eyebrow>Restaurer</Eyebrow>
      <p className="backup__note">
        Choisissez un fichier <strong>tarot-….json</strong>. Son contenu remplacera
        entièrement celui de cet appareil : c'est un retour en arrière, pas une fusion.
      </p>

      <label className="backup__action">
        <span className="btn">{busy ? 'Restauration…' : 'Remplacer par un fichier'}</span>
        <input
          type="file"
          accept="application/json,.json"
          disabled={busy}
          onChange={(event) => restore(event.target.files?.[0])}
        />
      </label>

      {error && <p className="backup__error">{error}</p>}

      {restored && (
        <div className="backup__done">
          <p className="backup__doneTitle">Restauration terminée</p>
          <p>
            {restored.players} joueur{restored.players > 1 ? 's' : ''} ({restored.photos} avec
            photo), {restored.games} partie{restored.games > 1 ? 's' : ''} et {restored.deals}{' '}
            donne{restored.deals > 1 ? 's' : ''}.
          </p>
          {restored.exportedAt && (
            <p className="backup__doneDate">
              Sauvegarde du {DATE_FORMAT.format(new Date(restored.exportedAt))}
            </p>
          )}
        </div>
      )}

      <p className="hint">
        Rien n'est envoyé sur Internet : le fichier part là où vous l'envoyez, et nulle part
        ailleurs.
      </p>
    </Screen>
  )
}

function Count({ value, label }: { value: number; label: string }) {
  return (
    <div className="backup__count">
      <span className="backup__countValue num display">{value}</span>
      <span className="backup__countLabel">{label}</span>
    </div>
  )
}
