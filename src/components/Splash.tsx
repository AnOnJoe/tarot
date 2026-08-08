import { Logo, TAGLINE } from './Logo'
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
      <p className="splash__tagline">{TAGLINE}</p>
      {/* La devise garde sa place ici, où il y a de l'air : elle donne le ton sans se
          substituer à ce que l'application annonce d'elle-même. */}
      <p className="splash__motto">Chacun pour soi</p>
    </div>
  )
}
