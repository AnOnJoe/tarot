/** Côté, en pixels, des photos stockées. Suffisant pour un avatar en Retina. */
const SIZE = 256

/**
 * Recadre une image en carré centré et la réduit à 256 px avant stockage.
 *
 * Les photos de l'iPhone pèsent plusieurs mégaoctets : les garder telles quelles
 * saturerait IndexedDB et ralentirait le rendu du tableau. Tout se passe dans le
 * navigateur, aucune image ne quitte l'appareil.
 *
 * Le résultat est une `data:` URL, et non un Blob : c'est la forme sous laquelle les
 * photos sont stockées. Cf. `Player.photo` pour la raison.
 */
export async function preparePhoto(file: File): Promise<string> {
  const bitmap = await createImageBitmap(file)
  const side = Math.min(bitmap.width, bitmap.height)
  const sx = (bitmap.width - side) / 2
  const sy = (bitmap.height - side) / 2

  const canvas = document.createElement('canvas')
  canvas.width = SIZE
  canvas.height = SIZE
  const context = canvas.getContext('2d')
  if (!context) throw new Error('Canvas indisponible')
  context.drawImage(bitmap, sx, sy, side, side, 0, 0, SIZE, SIZE)
  bitmap.close()

  return canvas.toDataURL('image/jpeg', 0.85)
}

/** Initiales affichées quand aucune photo n'a été choisie. */
export function initials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean)
  if (parts.length === 0) return '?'
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase()
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase()
}
