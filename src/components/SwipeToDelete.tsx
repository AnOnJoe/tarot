import { useRef, useState, type PointerEvent, type ReactNode } from 'react'
import './swipe.css'

/** Largeur découverte par le glissement, en pixels. */
const REVEAL = 96

/** Déplacement horizontal à partir duquel on considère que le geste est un glissement. */
const SLOP = 8

interface SwipeToDeleteProps {
  /** Le glissement est ouvert. Piloté par le parent : une seule rangée ouverte à la fois. */
  open: boolean
  onOpenChange: (open: boolean) => void
  onDelete: () => void
  /** Lu par les technologies d'assistance, qui atteignent le bouton sans le geste. */
  label: string
  children: ReactNode
}

/**
 * Découvre une action de suppression en glissant une rangée vers la gauche.
 *
 * Le geste est celui des listes iOS, donc appris d'avance. Il ne remplace pas un chemin
 * visible — la feuille de choix porte la même action — parce qu'un geste ne s'annonce pas :
 * qui ne le connaît pas ne le trouvera jamais.
 *
 * `touch-action: pan-y` plutôt que `none` : on ne prend en charge que l'horizontale, et la
 * page doit continuer de défiler sous le doigt. C'est aussi ce qui permet de renoncer au
 * glissement dès que le doigt part vers le bas.
 */
export function SwipeToDelete({
  open,
  onOpenChange,
  onDelete,
  label,
  children,
}: SwipeToDeleteProps) {
  const [offset, setOffset] = useState<number | null>(null)
  const start = useRef<{ x: number; y: number } | null>(null)
  /** `null` tant que la direction du geste n'est pas tranchée. */
  const horizontal = useRef<boolean | null>(null)
  /**
   * Instant de fin du dernier glissement.
   *
   * Un glissement se termine par un `click` que le navigateur envoie quand même : sans
   * garde, refermer une rangée rouvrirait la partie qu'on venait d'écarter. Mais la garde
   * doit **expirer** : un drapeau qu'on ne lèverait qu'au clic suivant avalerait le premier
   * appui sur « Supprimer », c'est-à-dire précisément le geste qu'on vient de découvrir.
   */
  const swipedAt = useRef(0)

  const down = (event: PointerEvent) => {
    if (event.pointerType === 'mouse' && event.button !== 0) return
    start.current = { x: event.clientX, y: event.clientY }
    horizontal.current = null
  }

  const move = (event: PointerEvent) => {
    if (!start.current) return
    const dx = event.clientX - start.current.x
    const dy = event.clientY - start.current.y

    if (horizontal.current === null) {
      if (Math.abs(dx) < SLOP && Math.abs(dy) < SLOP) return
      horizontal.current = Math.abs(dx) > Math.abs(dy)
      // Geste vertical : c'est un défilement, on rend la main pour de bon.
      if (!horizontal.current) {
        start.current = null
        return
      }
      event.currentTarget.setPointerCapture(event.pointerId)
    }

    const base = open ? REVEAL : 0
    setOffset(Math.max(0, Math.min(REVEAL, base - dx)))
  }

  const up = (event: PointerEvent) => {
    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId)
    }
    if (horizontal.current && offset !== null) {
      swipedAt.current = performance.now()
      onOpenChange(offset > REVEAL / 2)
    }
    start.current = null
    horizontal.current = null
    setOffset(null)
  }

  const shown = offset ?? (open ? REVEAL : 0)

  return (
    <div
      className="swipe"
      onPointerDown={down}
      onPointerMove={move}
      onPointerUp={up}
      onPointerCancel={up}
      onClickCapture={(event) => {
        /*
         * Le bouton découvert n'est jamais concerné : le `click` parasite est celui de la
         * rangée qu'on vient de faire coulisser, jamais celui de l'action qu'elle
         * découvre. Sans cette exemption, un appui vif sur « Supprimer » — juste après le
         * glissement, donc le geste le plus naturel — serait avalé.
         */
        if ((event.target as HTMLElement).closest('.swipe__delete')) return
        // Le `click` d'un glissement suit son `pointerup` immédiatement ; au-delà, c'est
        // un appui délibéré.
        if (performance.now() - swipedAt.current > 400) return
        swipedAt.current = 0
        event.preventDefault()
        event.stopPropagation()
      }}
    >
      <button
        type="button"
        className="swipe__delete"
        style={{ width: REVEAL }}
        aria-label={label}
        // La rangée ne se referme pas ici : si la confirmation est refusée, elle doit
        // rester ouverte, sinon renoncer coûte un second glissement.
        onClick={onDelete}
      >
        Supprimer
      </button>
      <div
        className="swipe__content"
        style={{
          transform: `translateX(${-shown}px)`,
          // Pas de transition pendant le geste : le contenu doit coller au doigt.
          transition: offset === null ? 'transform 220ms cubic-bezier(0.2, 0, 0.2, 1)' : 'none',
        }}
      >
        {children}
      </div>
    </div>
  )
}
