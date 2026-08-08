import { describe, expect, it } from 'vitest'
import { roundProgress } from './rounds'

describe('roundProgress', () => {
  it('annonce le premier tour avant toute donne', () => {
    expect(roundProgress(0, 4)).toEqual({ round: 1, completed: 0, remaining: 0 })
  })

  it('compte les donnes restantes du tour en cours', () => {
    expect(roundProgress(1, 4)).toEqual({ round: 1, completed: 0, remaining: 3 })
    expect(roundProgress(3, 4)).toEqual({ round: 1, completed: 0, remaining: 1 })
  })

  it('clôt le tour quand chacun a donné', () => {
    expect(roundProgress(4, 4)).toEqual({ round: 1, completed: 1, remaining: 0 })
    expect(roundProgress(8, 4)).toEqual({ round: 2, completed: 2, remaining: 0 })
  })

  it('ouvre le tour suivant à la donne d’après', () => {
    expect(roundProgress(5, 4)).toEqual({ round: 2, completed: 1, remaining: 3 })
  })

  it('suit le nombre de joueurs', () => {
    expect(roundProgress(3, 3)).toEqual({ round: 1, completed: 1, remaining: 0 })
    expect(roundProgress(3, 5)).toEqual({ round: 1, completed: 0, remaining: 2 })
  })

  /*
   * L'invariant qui compte : tant qu'il reste des donnes à jouer, la table n'est pas à
   * égalité de donneurs ; et le total joué plus le reste est toujours un multiple du
   * nombre de joueurs.
   */
  it('ne propose jamais un reste qui ne solde pas le tour', () => {
    for (const count of [3, 4, 5]) {
      for (let deals = 0; deals < 40; deals++) {
        const { remaining } = roundProgress(deals, count)
        expect(remaining).toBeGreaterThanOrEqual(0)
        expect(remaining).toBeLessThan(count)
        expect((deals + remaining) % count).toBe(0)
      }
    }
  })

  it('résiste à une table vide', () => {
    expect(roundProgress(5, 0)).toEqual({ round: 1, completed: 0, remaining: 0 })
  })
})
