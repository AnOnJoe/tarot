import type { AchievementState } from '../engine/achievements'
import { Avatar } from './Avatar'
import { EmptyState } from './ui'
import type { Player } from '../store/db'
import './feats.css'

/**
 * Les hauts faits de la table, décrochés et à décrocher.
 *
 * Rien n'est stocké : chaque exploit se recalcule à partir des donnes. Corriger une donne
 * saisie de travers retire donc le haut fait qu'elle avait fait décrocher, ce qui vaut
 * mieux qu'un tableau de chasse qui mentirait.
 */
export function Feats({
  states,
  players,
  loading,
}: {
  states: AchievementState[]
  players: Player[]
  loading?: boolean
}) {
  const unlocked = states.filter((state) => state.total > 0)
  const locked = states.filter((state) => state.total === 0)

  return (
    <>
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
    </>
  )
}

function Feat({ state, players }: { state: AchievementState; players: Player[] }) {
  // Du plus assidu au moins assidu : la table voit tout de suite qui s'illustre.
  const holders = Object.entries(state.byPlayer)
    .sort((a, b) => b[1] - a[1])
    .map(([id, count]) => ({ player: players.find((p) => p.id === id), count }))
    .filter((entry): entry is { player: Player; count: number } => !!entry.player)

  return (
    <div className="feat" data-rare={state.def.rare || undefined}>
      <div className="feat__head">
        <p className="feat__title">{state.def.title}</p>
        {state.def.rare && <span className="feat__badge">rare</span>}
      </div>
      <p className="feat__hint">{state.def.hint}</p>
      <div className="feat__holders">
        {holders.map(({ player, count }) => (
          <span key={player.id} className="feat__holder">
            <Avatar player={player} size={26} />
            {player.name}
            {count > 1 && <strong className="num">×{count}</strong>}
          </span>
        ))}
      </div>
    </div>
  )
}
