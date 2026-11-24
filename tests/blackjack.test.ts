import { describe, expect, it } from 'vitest'
import { insurancePrice, naturalPrice, priceActions } from '../src/blackjack/ev'
import { basicAction } from '../src/blackjack/strategy'
import { act, chooseInsurance, createTable, deal } from '../src/blackjack/table'
import { DEFAULT_RULES, type Card, type Rules } from '../src/blackjack/types'
import { mulberry32 } from '../src/lib/rng'

const rules: Rules = { ...DEFAULT_RULES }

function fullShoe(decks: number, remove: number[]): number[] {
  const bag: number[] = []
  for (let rank = 1; rank <= 9; rank++) {
    for (let i = 0; i < 4 * decks; i++) bag.push(rank)
  }
  for (let i = 0; i < 16 * decks; i++) bag.push(10)
  for (const rank of remove) {
    const at = bag.indexOf(rank)
    if (at >= 0) bag.splice(at, 1)
  }
  return bag
}

function card(rank: number, suit: Card['suit'] = 'S'): Card {
  return { rank, suit }
}

describe('basic strategy', () => {
  const open = { canDouble: true, canSplit: true, canSurrender: true }
  it('surrenders 16 vs 10, hits it when surrender is off, and splits 8s', () => {
    expect(basicAction({ cards: [10, 6], dealerUp: 10, rules, ...open })).toBe('R')
    expect(basicAction({ cards: [10, 6], dealerUp: 10, rules, ...open, canSurrender: false })).toBe('H')
    expect(basicAction({ cards: [8, 8], dealerUp: 10, rules, ...open })).toBe('P')
    expect(basicAction({ cards: [5, 6], dealerUp: 6, rules, ...open })).toBe('D')
    expect(basicAction({ cards: [5, 6], dealerUp: 1, rules, ...open })).toBe('H')
    expect(basicAction({ cards: [5, 6], dealerUp: 1, rules: { ...rules, hitSoft17: true }, ...open })).toBe('D')
    expect(basicAction({ cards: [1, 7], dealerUp: 2, rules, ...open })).toBe('S')
    expect(basicAction({ cards: [1, 7], dealerUp: 2, rules: { ...rules, hitSoft17: true }, ...open })).toBe('D')
    expect(basicAction({ cards: [10, 10], dealerUp: 6, rules, ...open })).toBe('S')
    expect(basicAction({ cards: [9, 9], dealerUp: 7, rules, ...open })).toBe('S')
    expect(basicAction({ cards: [2, 2], dealerUp: 2, rules: { ...rules, das: false }, ...open })).toBe('H')
  })
})

describe('expected value', () => {
  it('prices a pat 20 far above hitting, and prices surrender best on 16 vs 10', () => {
    const twenty = priceActions({
      shoe: fullShoe(6, [10, 10, 6]),
      player: [10, 10],
      dealerUp: 6,
      rules,
      actions: ['H', 'S'],
      trials: 1500,
      seed: 4,
    })
    expect(twenty.S - twenty.H).toBeGreaterThan(0.45)

    const sixteen = priceActions({
      shoe: fullShoe(6, [10, 6, 10]),
      player: [10, 6],
      dealerUp: 10,
      rules,
      actions: ['H', 'S', 'D', 'R'],
      trials: 4000,
      seed: 9,
    })
    expect(sixteen.R).toBe(-0.5)
    expect(sixteen.R).toBeGreaterThan(sixteen.H)
    expect(sixteen.R).toBeGreaterThan(sixteen.S)
    expect(sixteen.D).toBeLessThan(sixteen.H)
  })

  it('prices insurance below zero on a fresh ace-up shoe', () => {
    const unseen = fullShoe(6, [9, 8, 1])
    const price = insurancePrice(unseen, 10)
    expect(price.p).toBeLessThan(1 / 3)
    expect(price.evDollars).toBeLessThan(0)
    const natural = naturalPrice(fullShoe(6, [1, 10, 9]), 9, 25, 1.5)
    expect(natural).toBe(37.5)
  })
})

describe('a dealt hand', () => {
  const rng = () => 0

  function withShoe(cards: Card[], bet = 25) {
    const table = createTable(rules, 1000, bet, mulberry32(1))
    return { ...table, shoe: cards }
  }

  it('pays 3 to 2 on a blackjack and leaves the price on the ticket', () => {
    const pad = Array.from({ length: 48 }, () => card(2, 'D'))
    const shoe = [...pad, card(6, 'H'), card(13, 'S'), card(10, 'C'), card(1, 'S')]
    const done = deal(withShoe(shoe), rules, rng)
    expect(done.phase).toBe('result')
    expect(done.handNet).toBe(37.5)
    expect(done.verdict).toContain('Blackjack')
    expect(done.ticket?.rows[0]?.onBet).toBeCloseTo(37.5, 5)
  })

  it('calls out a correct stand that still loses', () => {
    const pad = Array.from({ length: 48 }, () => card(2, 'D'))
    // p1 10, up Ace, p2 6, hole King — 16 vs ace, dealer blackjack. Decline insurance.
    const shoe = [...pad, card(13, 'H'), card(6, 'C'), card(1, 'S'), card(10, 'D')]
    let table = deal(withShoe(shoe), rules, rng)
    expect(table.phase).toBe('insurance')
    table = chooseInsurance(table, false, rules, rng)
    expect(table.phase).toBe('result')
    expect(table.handNet).toBe(-25)
    expect(table.verdict).toBe('Best decision. The hand still lost.')
  })

  it('hits soft 17 only when the rules say so', () => {
    const pad = Array.from({ length: 48 }, () => card(3, 'D'))
    // p1 10, up Ace, p2 7, hole 6, next draw 2.
    const shoe = [...pad, card(2, 'C'), card(6, 'H'), card(7, 'S'), card(1, 'D'), card(10, 'S')]
    const dealt = deal(withShoe(shoe), rules, rng)
    const stood = act(chooseInsurance(dealt, false, rules, rng), 'S', rules, rng, 20, 1)
    expect(stood.handNet).toBe(0)

    const hitRules = { ...rules, hitSoft17: true }
    const dealtH = deal(withShoe(shoe), hitRules, rng)
    const stoodH = act(chooseInsurance(dealtH, false, hitRules, rng), 'S', hitRules, rng, 20, 1)
    expect(stoodH.handNet).toBe(-25)
    expect(stoodH.dealer).toHaveLength(3)
  })

  it('splits a pair into two hands and pays a double that makes 21', () => {
    const pad = Array.from({ length: 48 }, () => card(3, 'D'))
    const splitShoe = [...pad, card(5, 'C'), card(10, 'H'), card(9, 'D'), card(8, 'S'), card(6, 'C'), card(8, 'H')]
    const split = act(deal(withShoe(splitShoe), rules, rng), 'P', rules, rng, 15, 3)
    expect(split.hands).toHaveLength(2)
    expect(split.bankroll).toBe(950)
    expect(split.phase).toBe('play')

    const doubleShoe = [...pad, card(10, 'H'), card(10, 'D'), card(6, 'C'), card(6, 'S'), card(5, 'H')]
    const doubled = act(deal(withShoe(doubleShoe), rules, rng), 'D', rules, rng, 15, 4)
    expect(doubled.phase).toBe('result')
    expect(doubled.handNet).toBe(50)
  })

  it('refunds half the bet on surrender', () => {
    const pad = Array.from({ length: 48 }, () => card(2, 'D'))
    const shoe = [...pad, card(9, 'H'), card(6, 'C'), card(10, 'S'), card(10, 'D')]
    const dealt = deal(withShoe(shoe), rules, rng)
    expect(dealt.phase).toBe('play')
    const done = act(dealt, 'R', rules, rng, 20, 2)
    expect(done.handNet).toBe(-12.5)
    expect(done.ticket?.title).toMatch(/surrendered hard 16/i)
  })
})
