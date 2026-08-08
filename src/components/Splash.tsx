import { Logo } from './Logo'
import './splash.css'

/**
 * Écran de lancement.
 *
 * Il ne fait pas patienter : il occupe le temps que l'application met de toute façon à
 * lire ses barèmes et sa partie en cours dans la base. Sans lui, cet instant était un
 * écran vide. Un plancher de durée le rend simplement perceptible quand la lecture est
 * instantanée.
 */
export function Splash({ leaving }: { leaving: boolean }) {
  return (
    <div className="splash" data-leaving={leaving || undefined} aria-hidden="true">
      <Logo stacked />
      <p className="splash__tagline">Chacun pour soi</p>
    </div>
  )
}
