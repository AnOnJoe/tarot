import { useEffect, useRef, useState } from 'react'

/** Adoucissement : départ franc, arrivée posée. */
function easeOutCubic(t: number): number {
  return 1 - (1 - t) ** 3
}

/**
 * Fait défiler un nombre jusqu'à sa nouvelle valeur au lieu de le remplacer d'un coup.
 *
 * Voir les points grimper après une donne est ce qui donne sa saveur à un compteur — et
 * cela rend aussi le changement lisible : on voit *qui* a bougé, et de combien.
 *
 * Rend la valeur cible telle quelle si le système demande à réduire les animations, et au
 * premier rendu : une partie reprise ne doit pas rejouer tous ses cumuls.
 */
export function useAnimatedNumber(target: number, duration = 620): number {
  const [display, setDisplay] = useState(target)
  const fromRef = useRef(target)
  const frameRef = useRef(0)
  const firstRef = useRef(true)

  useEffect(() => {
    if (firstRef.current) {
      firstRef.current = false
      fromRef.current = target
      setDisplay(target)
      return
    }

    const reduced = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches
    if (reduced || duration <= 0) {
      fromRef.current = target
      setDisplay(target)
      return
    }

    const from = fromRef.current
    if (from === target) return

    const start = performance.now()
    const tick = (now: number) => {
      const progress = Math.min(1, (now - start) / duration)
      const current = from + (target - from) * easeOutCubic(progress)
      // Arrondi au quart de point : c'est la plus petite valeur que le jeu produise
      // (la Pousse à ×1,5 sur une assiette en demi-points).
      setDisplay(progress === 1 ? target : Math.round(current * 4) / 4)
      if (progress < 1) frameRef.current = requestAnimationFrame(tick)
      else fromRef.current = target
    }

    frameRef.current = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(frameRef.current)
  }, [target, duration])

  return display
}
