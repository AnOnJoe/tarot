import { useEffect, useRef, useState } from 'react'

/**
 * Largeur d'un élément, suivie au fil des changements de mise en page.
 *
 * Mesurer plutôt que supposer : la largeur d'une colonne dépend de l'appareil, de
 * l'orientation et du nombre de joueurs. Coder une taille en dur revient à choisir un
 * téléphone et à laisser les autres déborder.
 */
export function useElementWidth<T extends HTMLElement>(): [
  React.RefObject<T | null>,
  number,
] {
  const ref = useRef<T>(null)
  const [width, setWidth] = useState(0)

  useEffect(() => {
    const element = ref.current
    if (!element) return
    setWidth(element.getBoundingClientRect().width)
    const observer = new ResizeObserver(([entry]) => {
      setWidth(entry.contentRect.width)
    })
    observer.observe(element)
    return () => observer.disconnect()
  }, [])

  return [ref, width]
}
