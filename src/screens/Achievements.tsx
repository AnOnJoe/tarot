import { useEffect, useState } from 'react'
import { achievements, type AchievementState } from '../engine/achievements'
import { Avatar } from '../components/Avatar'
import { EmptyState, Screen, TopAction } from '../components/ui'
import { listAllDeals, listPlayers, loadRules, type Player } from '../store/db'
import './achievements.css'

interface AchievementsProps {
  onClose: () => void
}

/**
 * Les hauts faits de la table, confrontés à tout l'historique.
 *
 * Rien n'est stocké : chaque exploit se recalcule à partir des donnes. Corriger une donne
 * saisie de travers retire donc le haut fait qu'elle avait fait décrocher, ce qui vaut
 * mieux qu'un tableau de chasse qui mentirait.
 */
export function Achievements({ onClose }: AchievementsProps) {
  const [states, setStates] = useState<AchievementState[]>([])
  const [players, setPlayers] = useState<Player[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    Promise.all([listAllDeals(), listPlayers(), loadRules()]).then(
      ([deals, loadedPlayers, rules]) => {
        setStates(achievements(deals, rules))
        setPlayers(loadedPlayers)
        setLoading(false)
      },
    )
  }, [])

  const unlocked = states.filter((s) => s.total > 0)
  const locked = states.filter((s) => s.total === 0)

  return (
    <Screen title="Hauts faits" left={<TopAction onClick={onClose}>Fermer</TopAction>}>
      {!loading && unlocked.length === 0 && (
        <EmptyState title="Rien encore">
          <p>
            Les hauts faits se débloquent en jouant. Chelem, garde contre, contrat au point
            près : ils célèbrent les coups que seul le tarot produit.
          </p>
        </EmptyState>
      )}

      {unlocked.length > 0 && (
        <>
          <p className="eyebrow">
            Décrochés · {unlocked.length} sur {states.length}
          </p>
          <div className="feats">
            {unlocked.map((state) => (
              <Feat key={state.def.id} state={state} players={players} />
            ))}
          </div>
        </>
      )}

      {locked.length > 0 && (
        <>
          <p className="eyebrow">À décrocher</p>
          <div className="feats">
            {locked.map((state) => (
              <div key={state.def.id} className="feat feat--locked">
                <p className="feat__title">{state.def.title}</p>
                <p className="feat__hint">{state.def.hint}</p>
              </div>
            ))}
          </div>
        </>
      )}
    </Screen>
  )
}

function Feat({ state, players }: { state: AchievementState; players: Player[] }) {
  // Du plus assidu au moins assidu : la table voit tout de suite qui s'illustre.
  const holders = Object.entries(state.byPlayer)
    .sort((a, b) => b[1] - a[1])
    .map(([id, count]) => ({ player: players.find((p) => p.id === id), count }))
    .filter((entry) => entry.player)

  return (
    <div className="feat" data-rare={state.def.rare || undefined}>
      <div className="feat__head">
        <p className="feat__title">{state.def.title}</p>
        {state.def.rare && <span className="feat__badge">rare</span>}
      </div>
      <p className="feat__hint">{state.def.hint}</p>
      <div className="feat__holders">
        {holders.map(({ player, count }) => (
          <span key={player!.id} className="feat__holder">
            <Avatar player={player} size={26} />
            {player!.name}
            {count > 1 && <strong className="num">×{count}</strong>}
          </span>
        ))}
      </div>
    </div>
  )
}
