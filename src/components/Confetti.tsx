import { useEffect, useRef } from 'react'

interface ConfettiProps {
  /** Nombre de confettis. Au-delà de 120 le rendu se charge sans gagner en effet. */
  count?: number
  duration?: number
}

/** Teintes des confettis : celles des enseignes et de l'accent de l'interface. */
const COLORS = ['#c4bcff', '#4a3fd6', '#c8322b', '#f7f3e6', '#4ade80']

/**
 * Pluie de confettis en canvas, tirée une fois puis effacée.
 *
 * En canvas plutôt qu'en DOM : cent éléments animés feraient recalculer la mise en page à
 * chaque image, là où un canvas ne coûte qu'un dessin. Ne se déclenche pas si le système
 * demande à réduire les animations.
 */
export function Confetti({ count = 90, duration = 2600 }: ConfettiProps) {
  const ref = useRef<HTMLCanvasElement>(null)

  useEffect(() => {
    const canvas = ref.current
    if (!canvas) return
    if (window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) return

    const context = canvas.getContext('2d')
    if (!context) return

    const dpr = Math.min(window.devicePixelRatio || 1, 2)
    const width = canvas.offsetWidth
    const height = canvas.offsetHeight
    canvas.width = width * dpr
    canvas.height = height * dpr
    context.scale(dpr, dpr)

    // Départ groupé depuis le haut, vitesses dispersées : la retombée s'étale d'elle-même.
    const pieces = Array.from({ length: count }, () => ({
      x: Math.random() * width,
      y: -20 - Math.random() * height * 0.5,
      vx: (Math.random() - 0.5) * 1.4,
      vy: 1.4 + Math.random() * 2.2,
      size: 4 + Math.random() * 5,
      spin: (Math.random() - 0.5) * 0.24,
      angle: Math.random() * Math.PI,
      color: COLORS[Math.floor(Math.random() * COLORS.length)],
    }))

    let raf = 0
    const start = performance.now()

    const frame = (now: number) => {
      const elapsed = now - start
      const progress = elapsed / duration
      if (progress >= 1) {
        context.clearRect(0, 0, width, height)
        return
      }

      context.clearRect(0, 0, width, height)
      // Fondu sur le dernier tiers : les confettis s'effacent au lieu de disparaître net.
      context.globalAlpha = progress < 0.66 ? 1 : 1 - (progress - 0.66) / 0.34

      for (const p of pieces) {
        p.x += p.vx
        p.y += p.vy
        p.angle += p.spin
        context.save()
        context.translate(p.x, p.y)
        context.rotate(p.angle)
        context.fillStyle = p.color
        context.fillRect(-p.size / 2, -p.size / 4, p.size, p.size / 2)
        context.restore()
      }

      raf = requestAnimationFrame(frame)
    }

    raf = requestAnimationFrame(frame)
    return () => cancelAnimationFrame(raf)
  }, [count, duration])

  return <canvas ref={ref} className="confetti" aria-hidden="true" />
}
