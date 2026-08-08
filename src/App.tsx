import { useEffect, useState } from 'react'
import type { PlayerId } from './engine/types'
import { Game } from './screens/Game'
import { Home } from './screens/Home'
import { NewGame } from './screens/NewGame'
import { Rules } from './screens/Rules'
import { Stats } from './screens/Stats'
import { createGame, endGame, getCurrentGame, type Game as GameRecord } from './store/db'
import { useRules } from './store/hooks'

/**
 * Navigation de l'application : une pile d'écrans plein cadre, sans routeur.
 *
 * Cinq écrans et aucune URL à partager ne justifient pas une dépendance de routage —
 * un état suffit, et la partie en cours est reprise au lancement.
 */
type View =
  | { name: 'accueil' }
  | { name: 'nouvelle' }
  | { name: 'partie'; game: GameRecord }
  /** `back` distingue le retour au tableau du retour à l'accueil après une partie close. */
  | { name: 'stats'; game?: GameRecord; back: 'accueil' | 'partie'; celebrate?: boolean }
  | { name: 'regles' }

export function App() {
  const [rules, setRules] = useRules()
  const [view, setView] = useState<View>({ name: 'accueil' })
  const [restored, setRestored] = useState(false)

  // Reprise de la partie ouverte : rouvrir l'app doit ramener là où on en était.
  useEffect(() => {
    getCurrentGame().then((game) => {
      if (game) setView({ name: 'partie', game })
      setRestored(true)
    })
  }, [])

  if (!rules || !restored) return null

  switch (view.name) {
    case 'nouvelle':
      return (
        <NewGame
          onCancel={() => setView({ name: 'accueil' })}
          onStart={async (playerIds: PlayerId[], firstDealerIndex: number) => {
            const game = await createGame(playerIds, firstDealerIndex)
            setView({ name: 'partie', game })
          }}
        />
      )

    case 'partie':
      return (
        <Game
          game={view.game}
          rules={rules}
          onExit={() => setView({ name: 'accueil' })}
          onOpenStats={() => setView({ name: 'stats', game: view.game, back: 'partie' })}
          onEnd={async () => {
            await endGame(view.game.id)
            setView({ name: 'stats', game: view.game, back: 'accueil', celebrate: true })
          }}
        />
      )

    case 'stats':
      return (
        <Stats
          game={view.game}
          celebrate={view.celebrate}
          onClose={() =>
            setView(
              view.back === 'partie' && view.game
                ? { name: 'partie', game: view.game }
                : { name: 'accueil' },
            )
          }
        />
      )

    case 'regles':
      return <Rules rules={rules} onChange={setRules} onClose={() => setView({ name: 'accueil' })} />

    default:
      return (
        <Home
          onResume={(game) => setView({ name: 'partie', game })}
          onNewGame={() => setView({ name: 'nouvelle' })}
          onOpenStats={() => setView({ name: 'stats', back: 'accueil' })}
          onOpenRules={() => setView({ name: 'regles' })}
        />
      )
  }
}
