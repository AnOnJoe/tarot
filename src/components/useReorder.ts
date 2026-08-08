import {
  useRef,
  useState,
  type KeyboardEvent,
  type PointerEvent as ReactPointerEvent,
} from 'react'

export interface DragState {
  /** Index de la ligne saisie, dans l'ordre courant. */
  index: number
  /** Décalage vertical résiduel, en pixels, une fois les permutations appliquées. */
  offset: number
}

/** Ce qu'il faut poser sur la poignée d'une ligne pour la rendre déplaçable. */
export interface HandleProps {
  onPointerDown: (event: ReactPointerEvent<HTMLElement>) => void
  onPointerMove: (event: ReactPointerEvent<HTMLElement>) => void
  onPointerUp: () => void
  onPointerCancel: () => void
  onKeyDown: (event: KeyboardEvent<HTMLElement>) => void
}

/**
 * Glisser-déposer vertical pour une liste courte.
 *
 * Les permutations se font en cours de route, dès que le doigt franchit la moitié d'une
 * ligne : le doigt reste ainsi sur l'élément qu'il déplace, et l'ordre affiché est à tout
 * moment celui qu'on obtiendra en relâchant.
 *
 * En évènements pointeur plutôt qu'en glisser-déposer HTML5, que Safari mobile
 * n'implémente pas. La capture du pointeur garantit qu'un doigt sorti de la poignée
 * continue d'être suivi jusqu'au relâchement.
 */
export function useReorder<T>(
  items: T[],
  onChange: (items: T[]) => void,
): { drag: DragState | null; handleProps: (index: number) => HandleProps } {
  const [drag, setDrag] = useState<DragState | null>(null)
  // Ces valeurs changent à chaque déplacement du doigt : les garder en état provoquerait
  // un rendu par pixel parcouru.
  const origin = useRef(0)
  const rowHeight = useRef(56)
  const current = useRef(0)

  const move = (from: number, to: number) => {
    const next = [...items]
    const [moved] = next.splice(from, 1)
    next.splice(to, 0, moved)
    onChange(next)
  }

  const stop = () => setDrag(null)

  const handleProps = (index: number): HandleProps => ({
    onPointerDown(event) {
      event.preventDefault()
      const row = event.currentTarget.closest('[data-row]')
      if (row) rowHeight.current = row.getBoundingClientRect().height
      origin.current = event.clientY
      current.current = index
      setDrag({ index, offset: 0 })
      event.currentTarget.setPointerCapture(event.pointerId)
    },

    onPointerMove(event) {
      if (!drag) return
      const delta = event.clientY - origin.current
      const shift = Math.round(delta / rowHeight.current)
      const target = Math.min(items.length - 1, Math.max(0, current.current + shift))

      if (target === current.current) {
        setDrag({ index: current.current, offset: delta })
        return
      }

      move(current.current, target)
      // On recale l'origine sur la nouvelle position : le décalage résiduel repart de zéro
      // et la ligne ne « traîne » pas au fil des permutations successives.
      origin.current += (target - current.current) * rowHeight.current
      current.current = target
      setDrag({ index: target, offset: event.clientY - origin.current })
    },

    onPointerUp: stop,
    onPointerCancel: stop,

    onKeyDown(event) {
      // Le clavier garde un chemin d'accès : le glisser-déposer n'en est pas un.
      const delta = event.key === 'ArrowUp' ? -1 : event.key === 'ArrowDown' ? 1 : 0
      if (delta === 0) return
      event.preventDefault()
      const to = index + delta
      if (to < 0 || to >= items.length) return
      move(index, to)
    },
  })

  return { drag, handleProps }
}
