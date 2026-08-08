import { seriesColor, seriesInk } from '../palette'
import type { Player } from '../store/db'
import { initials } from '../store/photo'
import './avatar.css'

interface AvatarProps {
  player: Player | undefined
  size?: number
  /** Cercle doré : le preneur d'une donne, le joueur sélectionné. */
  highlighted?: boolean
  /** Grisé : joueur non retenu dans la sélection en cours. */
  dimmed?: boolean
}

/**
 * Portrait d'un joueur : sa photo si elle existe, sinon ses initiales sur sa couleur.
 * Les deux rendus partagent exactement la même empreinte pour que les alignements de
 * colonnes tiennent, photo ou pas.
 */
export function Avatar({ player, size = 44, highlighted, dimmed }: AvatarProps) {
  const url = player?.photo ?? null

  return (
    <span
      className="avatar"
      data-highlighted={highlighted || undefined}
      data-dimmed={dimmed || undefined}
      style={{
        width: size,
        height: size,
        background: url
          ? undefined
          : player
            ? seriesColor(player.colorIndex)
            : 'var(--surface-2)',
        color: player ? seriesInk(player.colorIndex) : 'var(--ink-soft)',
        fontSize: Math.round(size * 0.36),
      }}
      aria-hidden="true"
    >
      {url ? (
        <img src={url} alt="" className="avatar__photo" />
      ) : (
        initials(player?.name ?? '?')
      )}
    </span>
  )
}
