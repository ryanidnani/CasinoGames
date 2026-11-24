import { describe, expect, it } from 'vitest'
import { bankerDraws, betProfit, dealHand, freshShoe, handValue } from '../src/baccarat/engine'
import { defaultConfig, narrate, playSession, runSimulation } from '../src/baccarat/simulate'
import { mulberry32, shuffle } from '../src/lib/rng'

describe('baccarat drawing rules', () => {
  it('follows the banker tableau', () => {
    for (let total = 0; total <= 7; total++) {
      expect(bankerDraws(total, null)).toBe(total <= 5)
      for (let third = 0; third <= 9; third++) {
        let expected = false
        if (total <= 2) expected = true
        else if (total === 3) expected = third !== 8
        else if (total === 4) expected = third >= 2 && third <= 7
        else if (total === 5) expected = third >= 4 && third <= 7
        else if (total === 6) expected = third === 6 || third === 7
        expect(bankerDraws(total, third)).toBe(expected)
      }
    }
    expect(bankerDraws(8, 5)).toBe(false)
  })

  it('deals a natural without extra cards and a third card when the player stands under 6', () => {
    const natural = dealHand([4, 4, 2, 3, 9], 0)
    expect(natural.player).toEqual([4, 4])
    expect(natural.banker).toEqual([2, 3])
    expect(natural.winner).toBe('player')

    const draw = dealHand([1, 1, 1, 2, 8, 7], 0)
    expect(draw.player).toEqual([1, 1, 8])
    expect(handValue(draw.player)).toBe(0)
    expect(draw.banker).toEqual([1, 2])
    expect(draw.winner).toBe('banker')
  })

  it('pays banker wins with commission and pushes ties', () => {
    expect(betProfit('banker', 25, 'banker', 0.05)).toBe(23.75)
    expect(betProfit('banker', 25, 'player', 0.05)).toBe(-25)
    expect(betProfit('player', 25, 'tie', 0.05)).toBe(0)
    expect(betProfit('player', 25, 'player', 0.05)).toBe(25)
  })
})

describe('baccarat frequencies', () => {
  it('matches the published 8-deck odds closely enough to trust the shoe', () => {
    const rng = mulberry32(11)
    let shoe = shuffle(freshShoe(8), rng)
    let index = 0
    let banker = 0
    let player = 0
    let tie = 0
    let bankerProfit = 0
    const hands = 120_000
    for (let i = 0; i < hands; i++) {
      if (shoe.length - index < 6) {
        shoe = shuffle(freshShoe(8), rng)
        index = 0
      }
      const dealt = dealHand(shoe, index)
      index = dealt.index
      if (dealt.winner === 'banker') banker += 1
      else if (dealt.winner === 'player') player += 1
      else tie += 1
      bankerProfit += betProfit('banker', 1, dealt.winner, 0.05)
    }
    expect(banker / hands).toBeGreaterThan(0.45)
    expect(banker / hands).toBeLessThan(0.468)
    expect(player / hands).toBeGreaterThan(0.438)
    expect(player / hands).toBeLessThan(0.455)
    expect(tie / hands).toBeGreaterThan(0.088)
    expect(tie / hands).toBeLessThan(0.103)
    const edge = -bankerProfit / hands
    expect(edge).toBeGreaterThan(0.006)
    expect(edge).toBeLessThan(0.016)
  })
})

describe('betting systems on a fixed shoe', () => {
  it('ends a flat session at the target and a losing run at the stop', () => {
    const config = {
      ...defaultConfig(),
      bankroll: 100,
      base: 25,
      target: 40,
      stop: 40,
      tableMin: 25,
      tableMax: 200,
      commission: 0.05,
    }
    const wins = playSession(['banker', 'banker', 'player'], config, 'flat')
    expect(wins.reason).toBe('target')
    expect(wins.pnl).toBe(47.5)
    expect(wins.hands).toBe(2)

    const losses = playSession(['player', 'player', 'player'], config, 'flat')
    expect(losses.reason).toBe('stop')
    expect(losses.pnl).toBe(-50)
  })

  it('clips a martingale at the table maximum and still compares systems on one stream', () => {
    const config = {
      ...defaultConfig(),
      bankroll: 500,
      base: 25,
      target: 100,
      stop: 200,
      tableMax: 100,
      sessions: 40,
      maxHands: 80,
      seed: 3,
    }
    const losses = Array.from({ length: 12 }, () => 'player' as const)
    const clipped = playSession(losses, config, 'martingale')
    expect(clipped.clipped).toBeGreaterThan(0)
    expect(clipped.reason).toBe('stop')

    const result = runSimulation(config)
    for (const system of result.systems) {
      const reasons = system.reasons.target + system.reasons.stop + system.reasons.broke + system.reasons.cap
      expect(reasons).toBe(config.sessions)
    }
    const text = narrate(result).join(' ')
    expect(text).toContain('Flat')
    expect(text).toContain('Martingale')
    expect(text).toContain('Follow the shoe')
  })
})
