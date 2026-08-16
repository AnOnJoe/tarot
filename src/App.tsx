import { useEffect, useState } from 'react'
import type { PlayerId } from './engine/types'
import { Splash } from './components/Splash'
import { Backup } from './screens/Backup'
import { Game } from './screens/Game'
import { Home } from './screens/Home'
import { NewGame } from './screens/NewGame'
import { Roster } from './screens/Roster'
import { Rules } from './screens/Rules'
import { Stats } from './screens/Stats'
import {
  createGame,
  endGame,
  getCurrentGame,
  reopenGame,
  type Game as GameRecord,
} from './store/db'
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
  | { name: 'carnet' }
  | { name: 'sauvegarde' }

/** Durée minimale d'affichage de la marque au lancement, en millisecondes. */
const SPLASH_FLOOR = 620

export function App() {
  const [rules, setRules] = useRules()
  const [view, setView] = useState<View>({ name: 'accueil' })
  /** La reprise de la partie ouverte a été tentée : on peut afficher. */
  const [ready, setReady] = useState(false)
  /** Une sauvegarde vient d'être restaurée : l'état en mémoire est périmé. */
  const [justRestored, setJustRestored] = useState(false)
  const [splash, setSplash] = useState<'visible' | 'leaving' | 'gone'>('visible')

  // Reprise de la partie ouverte : rouvrir l'app doit ramener là où on en était.
  useEffect(() => {
    getCurrentGame().then((game) => {
      if (game) setView({ name: 'partie', game })
      setReady(true)
    })
  }, [])

  // L'écran de lancement couvre le chargement réel ; le plancher le rend perceptible
  // quand la base répond en quelques millisecondes.
  useEffect(() => {
    if (!rules || !ready) return
    const leave = setTimeout(() => setSplash('leaving'), SPLASH_FLOOR)
    const done = setTimeout(() => setSplash('gone'), SPLASH_FLOOR + 300)
    return () => {
      clearTimeout(leave)
      clearTimeout(done)
    }
  }, [rules, ready])

  if (!rules || !ready) return <Splash leaving={false} />

  return (
    <>
      {renderScreen()}
      {splash !== 'gone' && <Splash leaving={splash === 'leaving'} />}
    </>
  )

  function renderScreen() {
    if (!rules) return null
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
            onGameUpdated={(game) => setView({ name: 'partie', game })}
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

      case 'carnet':
        return <Roster rules={rules} onClose={() => setView({ name: 'accueil' })} />

      case 'sauvegarde':
        return (
          <Backup
            onRestored={() => setJustRestored(true)}
            onClose={() => {
              // Après une restauration, barèmes, carnet et parties ont tous changé sous
              // l'application : un rechargement complet évite d'en oublier un.
              if (justRestored) window.location.reload()
              else setView({ name: 'accueil' })
            }}
          />
        )

      default:
        return (
          <Home
            rules={rules}
            onResume={(game) => setView({ name: 'partie', game })}
            onOpenGameStats={(game) => setView({ name: 'stats', game, back: 'accueil' })}
            onReopen={async (game) => {
              const reopened = await reopenGame(game.id)
              if (reopened) setView({ name: 'partie', game: reopened })
            }}
            onNewGame={() => setView({ name: 'nouvelle' })}
            onOpenStats={() => setView({ name: 'stats', back: 'accueil' })}
            onOpenRoster={() => setView({ name: 'carnet' })}
            onOpenRules={() => setView({ name: 'regles' })}
            onOpenBackup={() => setView({ name: 'sauvegarde' })}
          />
        )
    }
  }
}
