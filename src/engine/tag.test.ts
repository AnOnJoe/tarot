import { describe, expect, it } from 'vitest'
import { isValidTag, newTag, normalizeTag } from './tag'

describe('tag de joueur', () => {
  it('produit six signes groupés par trois', () => {
    // Classe écrite en toutes lettres : une plage comme `A-N` avait justement laissé
    // passer le L que l'alphabet doit exclure.
    expect(newTag()).toMatch(
      /^[23456789ABCDEFGHJKMNPQRSTUVWXYZ]{3}-[23456789ABCDEFGHJKMNPQRSTUVWXYZ]{3}$/,
    )
  })

  it('n’emploie jamais les signes qui se confondent en les dictant', () => {
    const tirage = Array.from({ length: 400 }, newTag).join('')
    for (const interdit of ['O', '0', 'I', '1', 'L']) {
      expect(tirage).not.toContain(interdit)
    }
  })

  it('se valide lui-même', () => {
    for (let i = 0; i < 50; i++) expect(isValidTag(newTag())).toBe(true)
  })

  it('accepte une saisie relâchée', () => {
    expect(normalizeTag('k7m2pq')).toBe('K7M-2PQ')
    expect(normalizeTag('K7M-2PQ')).toBe('K7M-2PQ')
    expect(normalizeTag('  k7m 2pq  ')).toBe('K7M-2PQ')
  })

  it('écarte les signes hors alphabet plutôt que de les deviner', () => {
    // « O » et « 0 » sont tous deux absents : aucune correction ne serait autre chose
    // qu'une supposition, on les retire.
    expect(normalizeTag('K7MO2PQ')).toBe('K7M-2PQ')
    expect(normalizeTag('K7M-2P!Q')).toBe('K7M-2PQ')
  })

  it('rend une saisie incomplète telle quelle, sans tiret', () => {
    expect(normalizeTag('K7M')).toBe('K7M')
    expect(isValidTag('K7M')).toBe(false)
  })

  it('tronque au-delà de six signes', () => {
    expect(normalizeTag('K7M2PQXYZ')).toBe('K7M-2PQ')
  })

  it('refuse un tag qui contient un signe exclu', () => {
    expect(isValidTag('K7M-2PO')).toBe(false)
    expect(isValidTag('K7M-2P1')).toBe(false)
  })
})
