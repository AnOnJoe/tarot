/**
 * Génère les icônes de l'application : la marque Vachette, deux cartes croisées en V.
 *
 * Écrit en Node pur (zlib + CRC32) plutôt qu'avec une bibliothèque d'images : la marque
 * est une composition géométrique simple, et le projet n'a ainsi aucune dépendance de
 * build supplémentaire à installer sur une machine neuve.
 *
 *   node scripts/make-icons.mjs
 */

import { deflateSync } from 'node:zlib'
import { mkdirSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const OUT =
  process.env.ICON_OUT ?? join(dirname(fileURLToPath(import.meta.url)), '..', 'public', 'icons')

/** Fond de l'application, ivoire du carton, rouge saturé de la marque. */
const FOND = [11, 12, 14]
const IVOIRE = [247, 243, 230]
const ROUGE = [232, 86, 74]

/**
 * Géométrie de la marque, en fractions du côté. Source unique : le PNG comme le favicon
 * SVG s'en déduisent, ce qui les empêche de diverger comme ils l'ont fait une fois.
 */
const CARD = { w: 0.145, h: 0.245, radius: 0.05, gap: 0.015 }

/**
 * Les deux cartes croisées qui dessinent le V. Angles symétriques : c'est la symétrie qui
 * fait lire la lettre, les cartes prises séparément ne disent rien.
 */
const CARDS = [
  { cx: 0.42, cy: 0.5, angle: -0.33, fill: ROUGE },
  { cx: 0.58, cy: 0.5, angle: 0.33, fill: IVOIRE },
]

const hex = ([r, g, b]) =>
  `#${[r, g, b].map((v) => v.toString(16).padStart(2, '0')).join('')}`

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

/** Ramène un point dans le repère d'une carte inclinée : origine au centre, axes redressés. */
function toLocal(px, py, cx, cy, angle) {
  const cos = Math.cos(-angle)
  const sin = Math.sin(-angle)
  const dx = px - cx
  const dy = py - cy
  return [dx * cos - dy * sin, dx * sin + dy * cos]
}

/** Point dans un rectangle arrondi centré sur l'origine du repère local. */
function inRoundRect(lx, ly, halfW, halfH, radius) {
  const x = Math.abs(lx)
  const y = Math.abs(ly)
  if (x > halfW || y > halfH) return false
  const ix = Math.max(0, x - (halfW - radius))
  const iy = Math.max(0, y - (halfH - radius))
  return ix * ix + iy * iy <= radius * radius
}

/**
 * Dessine la marque sur le fond de l'application.
 *
 * `inset` réserve la zone de sécurité des icônes masquables, dont le système peut rogner
 * les bords pour les inscrire dans la forme de son choix.
 */
function draw(size, inset) {
  const SS = 4 // suréchantillonnage : les bords obliques restent nets
  const pixels = Buffer.alloc(size * size * 3)
  const scale = size * inset

  const halfW = CARD.w * scale
  const halfH = CARD.h * scale
  const radius = CARD.radius * scale
  const gap = CARD.gap * scale

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

          for (const card of CARDS) {
            const [lx, ly] = toLocal(px, py, card.cx * size, card.cy * size, card.angle)
            // Carte légèrement élargie, peinte au fond : elle creuse l'écart entre les
            // deux cartes sans dépendre d'un trait d'un pixel.
            if (inRoundRect(lx, ly, halfW + gap, halfH + gap, radius)) color = FOND
            if (inRoundRect(lx, ly, halfW, halfH, radius)) color = card.fill
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
  // Masquable : le motif tient dans les 78 % centraux, le système peut rogner le reste.
  ['icon-maskable-512.png', 512, 0.78],
  ['apple-touch-icon.png', 180, 1],
]

for (const [name, size, inset] of targets) {
  writeFileSync(join(OUT, name), draw(size, inset))
  console.log(`${name} — ${size}×${size}`)
}

/** Favicon des onglets de bureau, déduit de la même géométrie que le PNG. */
const S = 100
const card = (c) => {
  const [w, h] = [CARD.w * S, CARD.h * S]
  const [cx, cy] = [c.cx * S, c.cy * S]
  const deg = ((c.angle * 180) / Math.PI).toFixed(2)
  return `  <rect x="${(cx - w).toFixed(2)}" y="${(cy - h).toFixed(2)}" width="${(w * 2).toFixed(2)}" height="${(h * 2).toFixed(2)}"
        rx="${(CARD.radius * S).toFixed(2)}" fill="${hex(c.fill)}"
        stroke="${hex(FOND)}" stroke-width="${(CARD.gap * 2 * S).toFixed(2)}"
        transform="rotate(${deg} ${cx} ${cy})"/>`
}

const favicon = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${S} ${S}">
  <rect width="${S}" height="${S}" rx="18" fill="${hex(FOND)}"/>
${CARDS.map(card).join('\n')}
</svg>
`
writeFileSync(join(OUT, 'favicon.svg'), favicon)
console.log('favicon.svg')
