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

const OUT =
  process.env.ICON_OUT ?? join(dirname(fileURLToPath(import.meta.url)), '..', 'public', 'icons')

/** Emblème de la carte visible : `enseignes`, `pique` ou `etoile`. */
const EMBLEM = process.env.ICON_EMBLEM ?? 'enseignes'

/**
 * Géométrie de l'icône, en fractions du côté. Source unique : le PNG comme le favicon SVG
 * s'en déduisent, ce qui les empêche de diverger comme ils l'ont fait une première fois.
 * Les demi-dimensions sont communes aux deux cartes.
 */
const CARD = {
  w: 0.145,
  h: 0.235,
  radius: 0.045,
  gap: 0.013,
  frameInset: 0.022,
  frameWidth: 0.011,
}

const hex = ([r, g, b]) =>
  `#${[r, g, b].map((v) => v.toString(16).padStart(2, '0')).join('')}`

/*
 * Le fond reprend celui de l'application ; les cartes empruntent leurs couleurs au jeu
 * lui-même — l'ivoire du carton, le rouge des enseignes — et l'indigo reste dans la
 * famille de l'accent de l'interface.
 */
const FOND = [11, 12, 14]
const IVOIRE = [247, 243, 230]
const INDIGO = [74, 63, 214]
const ROUGE = [200, 50, 43]
const NOIR = [26, 26, 32]
const LISERE = [150, 140, 240]

/** Les deux cartes de l'éventail, avec leurs couleurs. */
const CARDS = [
  // Le dos de la carte cachée.
  { cx: 0.395, cy: 0.5, angle: -0.4, fill: INDIGO, frame: LISERE },
  // La carte retournée, face visible.
  { cx: 0.58, cy: 0.505, angle: 0.19, fill: IVOIRE, frame: ROUGE, emblem: true },
]

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
 * Sommets d'une étoile à cinq branches, pointe en haut.
 *
 * Le rapport creux/pointe de 0,382 est celui du pentagramme régulier : c'est lui qui donne
 * à l'étoile ses branches franches plutôt que des pétales.
 */
function starPolygon(outer) {
  const inner = outer * 0.382
  const points = []
  for (let i = 0; i < 10; i++) {
    const radius = i % 2 === 0 ? outer : inner
    const angle = -Math.PI / 2 + (i * Math.PI) / 5
    points.push([Math.cos(angle) * radius, Math.sin(angle) * radius])
  }
  return points
}

/** Appartenance à un polygone, règle pair-impair. Arêtes droites, contrairement à une
 *  frontière calculée en polaire. */
function inPolygon(lx, ly, points) {
  let inside = false
  for (let i = 0, j = points.length - 1; i < points.length; j = i++) {
    const [xi, yi] = points[i]
    const [xj, yj] = points[j]
    if (yi > ly !== yj > ly && lx < ((xj - xi) * (ly - yi)) / (yj - yi) + xi) {
      inside = !inside
    }
  }
  return inside
}

const inDisc = (lx, ly, cx, cy, r) => (lx - cx) ** 2 + (ly - cy) ** 2 <= r * r

/**
 * Les quatre enseignes françaises, dessinées analytiquement.
 *
 * Chacune se ramène à des disques et des polygones : le pique est un cœur retourné, le
 * trèfle trois disques, le carreau un losange. `s` est le demi-côté de l'enseigne.
 */
function inPique(lx, ly, s) {
  if (inPolygon(lx, ly, [[0, -s], [-0.92 * s, 0.18 * s], [0.92 * s, 0.18 * s]])) return true
  if (inDisc(lx, ly, -0.46 * s, 0.16 * s, 0.46 * s)) return true
  if (inDisc(lx, ly, 0.46 * s, 0.16 * s, 0.46 * s)) return true
  // Le pied, évasé vers le bas.
  return inPolygon(lx, ly, [
    [-0.1 * s, 0.2 * s],
    [0.1 * s, 0.2 * s],
    [0.34 * s, 0.86 * s],
    [-0.34 * s, 0.86 * s],
  ])
}

function inCoeur(lx, ly, s) {
  if (inPolygon(lx, ly, [[0, s], [-0.92 * s, -0.18 * s], [0.92 * s, -0.18 * s]])) return true
  return (
    inDisc(lx, ly, -0.46 * s, -0.16 * s, 0.46 * s) ||
    inDisc(lx, ly, 0.46 * s, -0.16 * s, 0.46 * s)
  )
}

function inCarreau(lx, ly, s) {
  return Math.abs(lx) / (0.72 * s) + Math.abs(ly) / s <= 1
}

function inTrefle(lx, ly, s) {
  if (inDisc(lx, ly, 0, -0.42 * s, 0.42 * s)) return true
  if (inDisc(lx, ly, -0.44 * s, 0.22 * s, 0.42 * s)) return true
  if (inDisc(lx, ly, 0.44 * s, 0.22 * s, 0.42 * s)) return true
  return inPolygon(lx, ly, [
    [-0.1 * s, 0.2 * s],
    [0.1 * s, 0.2 * s],
    [0.32 * s, 0.9 * s],
    [-0.32 * s, 0.9 * s],
  ])
}

/**
 * Les quatre enseignes disposées en carré. Chacune rend sa propre couleur : dans un jeu
 * français, pique et trèfle sont noirs, cœur et carreau rouges.
 */
function enseigneAt(lx, ly, s) {
  const d = s * 0.62
  const p = s * 0.42
  if (inPique(lx + d, ly + d, p)) return NOIR
  if (inCoeur(lx - d, ly + d, p)) return ROUGE
  if (inCarreau(lx + d, ly - d, p)) return ROUGE
  if (inTrefle(lx - d, ly - d, p)) return NOIR
  return null
}

/**
 * Dessine l'icône : deux cartes de tarot en éventail sur le fond de l'application.
 *
 * Celle de derrière montre son dos, indigo à filet ; celle de devant est retournée et
 * porte l'étoile de l'Excuse en rouge, dans son cadre. Un seul emblème, franc : à 60 px
 * sur l'écran d'accueil, tout motif plus fin se referme en bouillie.
 *
 * `inset` réserve la zone de sécurité des icônes masquables, dont le système peut rogner
 * les bords pour les inscrire dans la forme de son choix.
 */
function draw(size, inset) {
  const SS = 4 // suréchantillonnage : les bords obliques restent nets
  const pixels = Buffer.alloc(size * size * 3)
  const scale = size * inset

  // Calculée une fois : le même emblème sert à tous les pixels.
  const half = CARD.w * scale
  const star = starPolygon(half * 0.66)
  // Rend la couleur de l'emblème sous le point, ou `null` s'il n'y en a pas.
  const emblemAt = {
    etoile: (lx, ly) => (inPolygon(lx, ly, star) ? ROUGE : null),
    enseignes: (lx, ly) => enseigneAt(lx, ly, half * 0.74),
    pique: (lx, ly) => (inPique(lx, ly, half * 0.6) ? NOIR : null),
  }[EMBLEM]

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
            const halfW = CARD.w * scale
            const halfH = CARD.h * scale
            const radius = CARD.radius * scale

            // Carte légèrement élargie, peinte au fond : elle creuse l'écart entre les
            // deux cartes sans dépendre d'un trait d'un pixel.
            const gap = CARD.gap * scale
            if (inRoundRect(lx, ly, halfW + gap, halfH + gap, radius)) color = FOND
            if (!inRoundRect(lx, ly, halfW, halfH, radius)) continue
            color = card.fill

            // Filet intérieur : la bordure imprimée du carton.
            const inset1 = CARD.frameInset * scale
            const inset2 = inset1 + CARD.frameWidth * scale
            if (
              inRoundRect(lx, ly, halfW - inset1, halfH - inset1, radius * 0.7) &&
              !inRoundRect(lx, ly, halfW - inset2, halfH - inset2, radius * 0.6)
            ) {
              color = card.frame
            }

            if (card.emblem) {
              const ink = emblemAt(lx, ly)
              if (ink) color = ink
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

/*
 * Favicon des onglets de bureau, déduit de la même géométrie que le PNG. Il s'affiche à
 * 16 px : les quatre enseignes y seraient illisibles, on s'en tient aux deux cartes et à
 * leur cadre imprimé, qui tiennent encore à cette taille.
 */
const S = 100
const card = (c) => {
  const [w, h] = [CARD.w * S, CARD.h * S]
  const [cx, cy] = [c.cx * S, c.cy * S]
  const deg = (c.angle * 180) / Math.PI
  const rot = `rotate(${deg.toFixed(2)} ${cx} ${cy})`
  const inset = (CARD.frameInset + CARD.frameWidth / 2) * S
  return `  <g transform="${rot}">
    <rect x="${(cx - w).toFixed(2)}" y="${(cy - h).toFixed(2)}" width="${(w * 2).toFixed(2)}" height="${(h * 2).toFixed(2)}"
          rx="${(CARD.radius * S).toFixed(2)}" fill="${hex(c.fill)}"
          stroke="${hex(FOND)}" stroke-width="${(CARD.gap * 2 * S).toFixed(2)}"/>
    <rect x="${(cx - w + inset).toFixed(2)}" y="${(cy - h + inset).toFixed(2)}"
          width="${(w * 2 - inset * 2).toFixed(2)}" height="${(h * 2 - inset * 2).toFixed(2)}"
          rx="${(CARD.radius * 0.7 * S).toFixed(2)}" fill="none"
          stroke="${hex(c.frame)}" stroke-width="${(CARD.frameWidth * S).toFixed(2)}"/>
  </g>`
}

const favicon = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${S} ${S}">
  <rect width="${S}" height="${S}" rx="18" fill="${hex(FOND)}"/>
${CARDS.map(card).join('\n')}
</svg>
`
writeFileSync(join(OUT, 'favicon.svg'), favicon)
console.log('favicon.svg')
