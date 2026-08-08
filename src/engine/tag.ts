/**
 * Identifiant court d'un joueur, lisible et dictable.
 *
 * L'identifiant technique d'un joueur est un UUID, propre à l'appareil qui l'a créé : deux
 * personnes qui saisissent « Joachim » chacune de leur côté obtiennent deux inconnus. Le
 * tag est ce qui permet de les reconnaître comme une seule et même personne au moment de
 * fusionner deux carnets.
 *
 * Il doit donc pouvoir se lire à voix haute et se retaper sans faute — d'où un alphabet
 * amputé des caractères qui se confondent (0 et O, 1 et I et L), et un groupement en deux
 * blocs de trois.
 */

/** Ni I, ni L, ni O : chacun se confond avec 1 ou 0, qui en sont absents pour la même raison. */
const ALPHABET = '23456789ABCDEFGHJKMNPQRSTUVWXYZ'
const LENGTH = 6

/**
 * Un tag neuf, tiré au hasard. 31⁶ combinaisons, soit près de 900 millions : les
 * collisions sont négligeables pour un carnet de famille.
 *
 * Les octets qui ne tombent pas sur un multiple exact de l'alphabet sont rejetés plutôt
 * que repliés par un modulo, qui rendrait les premières lettres légèrement plus fréquentes.
 */
export function newTag(): string {
  const limit = 256 - (256 % ALPHABET.length)
  const chars: string[] = []
  while (chars.length < LENGTH) {
    for (const byte of crypto.getRandomValues(new Uint8Array(LENGTH))) {
      if (byte >= limit) continue
      chars.push(ALPHABET[byte % ALPHABET.length])
      if (chars.length === LENGTH) break
    }
  }
  return formatTag(chars.join(''))
}

/** `K7M2PQ` → `K7M-2PQ`. */
function formatTag(raw: string): string {
  return `${raw.slice(0, 3)}-${raw.slice(3)}`
}

/**
 * Ramène une saisie quelconque à la forme canonique.
 *
 * Tolérante à dessein : un tag se transmet à l'oral ou par message, et revient en
 * minuscules, sans tiret, entouré d'espaces. Les signes hors alphabet sont écartés plutôt
 * que devinés : « O » et « 0 » en sont tous deux absents, il n'existe aucune correction
 * qui ne serait pas une supposition.
 */
export function normalizeTag(input: string): string {
  const cleaned = [...input.toUpperCase()]
    .filter((char) => ALPHABET.includes(char))
    .join('')
    .slice(0, LENGTH)
  return cleaned.length === LENGTH ? formatTag(cleaned) : cleaned
}

/** Un tag est valide s'il fait six signes de l'alphabet, tirets exclus. */
export function isValidTag(tag: string): boolean {
  const raw = tag.replace(/-/g, '')
  return raw.length === LENGTH && [...raw].every((char) => ALPHABET.includes(char))
}

/** Ce que l'alphabet exclut, pour l'expliquer à l'écran. */
export const TAG_HINT =
  'Six signes. Ni O ni 0, ni I ni 1 ni L : trop faciles à confondre en les dictant.'
