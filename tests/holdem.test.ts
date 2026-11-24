import { describe, expect, it } from 'vitest'
import { handScore } from '../src/holdem/cards'
import { callEv, estimateEquity, requiredEquity } from '../src/holdem/equity'
import { expandRange, gridKeys, tightRange, wideRange } from '../src/holdem/range'

const c = (rank: number, suit: 's' | 'h' | 'd' | 'c') => ({ rank, suit })

describe('hand scores', () => {
  it('ranks royal flush above quads, a wheel as a five-high straight, and kickers', () => {
    const royal = handScore([c(14, 'h'), c(13, 'h'), c(12, 'h'), c(11, 'h'), c(10, 'h'), c(2, 'c'), c(3, 'd')])
    const quads = handScore([c(14, 's'), c(14, 'h'), c(14, 'd'), c(14, 'c'), c(13, 's'), c(2, 'd'), c(3, 'c')])
    const wheel = handScore([c(14, 's'), c(5, 'h'), c(4, 'd'), c(3, 'c'), c(2, 's')])
    const six = handScore([c(6, 's'), c(5, 'h'), c(4, 'd'), c(3, 'c'), c(2, 's')])
    const acesKing = handScore([c(14, 's'), c(14, 'h'), c(13, 'd'), c(8, 'c'), c(2, 's')])
    const acesQueen = handScore([c(14, 's'), c(14, 'h'), c(12, 'd'), c(8, 'c'), c(2, 's')])
    expect(royal).toBeGreaterThan(quads)
    expect(six).toBeGreaterThan(wheel)
    expect(acesKing).toBeGreaterThan(acesQueen)
  })

  it('lets the board play as a tie', () => {
    const board = [c(14, 'h'), c(13, 'h'), c(12, 'h'), c(11, 'h'), c(10, 'h')]
    expect(handScore([...board, c(2, 'c'), c(3, 'd')])).toBe(handScore([...board, c(4, 'c'), c(5, 'd')]))
  })
})

describe('pot odds', () => {
  it('prices a half-pot bet at 25 percent', () => {
    const pot = 100 + 50
    expect(requiredEquity(pot, 50)).toBeCloseTo(0.25, 5)
    expect(callEv(0.25, pot, 50)).toBeCloseTo(0, 5)
    expect(callEv(0.35, pot, 50)).toBeCloseTo(20, 5)
  })
})

describe('equity', () => {
  it('gives aces about an 82 percent edge over kings', () => {
    const eq = estimateEquity({
      hero: [c(14, 's'), c(14, 'h')],
      board: [],
      range: ['KK'],
      trials: 4000,
      seed: 3,
    })
    expect(eq.combos).toBe(6)
    expect(eq.equity).toBeGreaterThan(0.78)
    expect(eq.equity).toBeLessThan(0.86)
  })

  it('gives a flush draw more equity against a wide range than a tight one', () => {
    const hero = [c(14, 'h'), c(13, 'h')]
    const board = [c(12, 'h'), c(7, 'h'), c(2, 'c')]
    const tight = estimateEquity({ hero, board, range: tightRange(), trials: 4000, seed: 5 })
    const wide = estimateEquity({ hero, board, range: wideRange(), trials: 4000, seed: 5 })
    expect(tight.combos).toBeGreaterThan(20)
    expect(wide.combos).toBeGreaterThan(tight.combos)
    expect(wide.equity).toBeGreaterThan(tight.equity + 0.03)
  })
})

describe('ranges', () => {
  it('builds a 13 by 13 grid and expands suited combos to four', () => {
    expect(gridKeys()).toHaveLength(169)
    expect(expandRange(['AKs'], [])).toHaveLength(4)
    expect(expandRange(['AKo'], [])).toHaveLength(12)
    expect(tightRange()).toContain('AKs')
    expect(tightRange()).toContain('AKo')
    expect(wideRange()).toContain('65s')
    expect(wideRange()).toContain('A5s')
  })
})
