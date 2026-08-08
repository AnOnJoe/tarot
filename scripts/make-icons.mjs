/**
 * Génère les icônes PNG de l'application.
 *
 * Écrit en Node pur (zlib + CRC32) plutôt qu'avec une bibliothèque d'images : l'icône est
 * une composition géométrique simple, et le projet n'a ainsi aucune dépendance de build
 * supplémentaire à installer sur une machine neuve.
 *
 *   node scripts/make-icons.mjs
 */

import { deflateSync } from 'node:zlib'
import { mkdirSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const OUT = join(dirname(fileURLToPath(import.meta.url)), '..', 'public', 'icons')

// Alignés sur les jetons du thème Ardoise (--bg, --ink, --accent).
const FOND = [11, 12, 14]
const CARTE = [244, 245, 247]
const ACCENT = [196, 188, 255]

/** Table CRC32, pour les sommes de contrôle exigées par le format PNG. */
const CRC_TABLE = Array.from({ length: 256 }, (_, n) => {
  let c = n
  for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1
  return c >>> 0
})

function crc32(buffer) {
  let c = 0xffffffff
  for (const byte of buffer) c = CRC_TABLE[(c ^ byte) & 0xff] ^ (c >>> 8)
  return (c ^ 0xffffffff) >>> 0
}

function chunk(type, data) {
  const length = Buffer.alloc(4)
  length.writeUInt32BE(data.length)
  const body = Buffer.concat([Buffer.from(type, 'ascii'), data])
  const crc = Buffer.alloc(4)
  crc.writeUInt32BE(crc32(body))
  return Buffer.concat([length, body, crc])
}

function encodePng(size, pixels) {
  const header = Buffer.alloc(13)
  header.writeUInt32BE(size, 0)
  header.writeUInt32BE(size, 4)
  header[8] = 8 // 8 bits par canal
  header[9] = 2 // couleur vraie, sans alpha
  // Une ligne PNG est précédée de son octet de filtre ; on n'en utilise aucun.
  const raw = Buffer.alloc(size * (size * 3 + 1))
  for (let y = 0; y < size; y++) {
    const rowStart = y * (size * 3 + 1)
    raw[rowStart] = 0
    pixels.copy(raw, rowStart + 1, y * size * 3, (y + 1) * size * 3)
  }
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk('IHDR', header),
    chunk('IDAT', deflateSync(raw, { level: 9 })),
    chunk('IEND', Buffer.alloc(0)),
  ])
}

/** Un point est-il dans un rectangle arrondi tourné d'un angle donné, centré en (cx, cy) ? */
function inCard(px, py, cx, cy, halfW, halfH, angle, radius) {
  const cos = Math.cos(-angle)
  const sin = Math.sin(-angle)
  const dx = px - cx
  const dy = py - cy
  const x = Math.abs(dx * cos - dy * sin)
  const y = Math.abs(dx * sin + dy * cos)
  if (x > halfW || y > halfH) return false
  const ix = Math.max(0, x - (halfW - radius))
  const iy = Math.max(0, y - (halfH - radius))
  return ix * ix + iy * iy <= radius * radius
}

/**
 * Dessine l'icône : deux cartes en éventail, l'une accent et l'autre claire, sur le fond
 * de l'application.
 *
 * `inset` réserve la zone de sécurité des icônes masquables, dont le système peut rogner
 * les bords pour les inscrire dans la forme de son choix.
 */
function draw(size, inset) {
  const SS = 4 // suréchantillonnage : les bords obliques restent nets
  const pixels = Buffer.alloc(size * size * 3)
  const scale = size * inset

  // Éventail suffisamment ouvert, et deux teintes distinctes plutôt qu'un filet : à 60 px
  // sur l'écran d'accueil, un liseré d'un pixel disparaît, un contraste de valeur non.
  const cards = [
    { cx: 0.4, cy: 0.5, angle: -0.42, w: 0.14, h: 0.23, fill: ACCENT },
    { cx: 0.575, cy: 0.505, angle: 0.2, w: 0.14, h: 0.23, fill: CARTE },
  ]

  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      let r = 0
      let g = 0
      let b = 0
      for (let sy = 0; sy < SS; sy++) {
        for (let sx = 0; sx < SS; sx++) {
          const px = x + (sx + 0.5) / SS
          const py = y + (sy + 0.5) / SS
          let color = FOND
          for (const card of cards) {
            const cx = card.cx * size
            const cy = card.cy * size
            // Carte légèrement élargie, peinte au fond : elle creuse l'écart entre les
            // deux cartes sans dépendre d'un trait d'un pixel.
            const gap = 0.012 * scale
            if (
              inCard(px, py, cx, cy, card.w * scale + gap, card.h * scale + gap, card.angle, 0.05 * scale)
            ) {
              color = FOND
            }
            if (
              inCard(px, py, cx, cy, card.w * scale, card.h * scale, card.angle, 0.045 * scale)
            ) {
              color = card.fill
            }
          }
          r += color[0]
          g += color[1]
          b += color[2]
        }
      }
      const n = SS * SS
      const offset = (y * size + x) * 3
      pixels[offset] = Math.round(r / n)
      pixels[offset + 1] = Math.round(g / n)
      pixels[offset + 2] = Math.round(b / n)
    }
  }
  return encodePng(size, pixels)
}

mkdirSync(OUT, { recursive: true })

const targets = [
  ['icon-192.png', 192, 1],
  ['icon-512.png', 512, 1],
  // Masquable : le motif tient dans les 80 % centraux, le système peut rogner le reste.
  ['icon-maskable-512.png', 512, 0.78],
  ['apple-touch-icon.png', 180, 1],
]

for (const [name, size, inset] of targets) {
  writeFileSync(join(OUT, name), draw(size, inset))
  console.log(`${name} — ${size}×${size}`)
}

// Favicon vectoriel pour les onglets de bureau, même composition.
const favicon = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100">
  <rect width="100" height="100" rx="18" fill="#0b0c0e"/>
  <g stroke="#0b0c0e" stroke-width="4">
    <rect x="34" y="29" width="30" height="48" rx="5" fill="#c4bcff"
          transform="rotate(-16 50 53)"/>
    <rect x="36" y="26" width="30" height="48" rx="5" fill="#f4f5f7"
          transform="rotate(7.5 50 50)"/>
  </g>
</svg>
`
writeFileSync(join(OUT, 'favicon.svg'), favicon)
console.log('favicon.svg')
