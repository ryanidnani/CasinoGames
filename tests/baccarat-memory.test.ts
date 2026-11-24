import { describe, expect, it } from 'vitest'
import { binIndex, countMix, emptyStudy, narrateMix, observeShoe, readMix, share } from '../src/baccarat/memory'

describe('baccarat shoe percentages', () => {
  it('keeps the running mix and puts a hot opening in the top bin', () => {
    const study = emptyStudy(10)
    const hot = [...Array(10).fill('banker' as const), ...Array(20).fill('player' as const)]
    observeShoe(study, hot)
    expect(study.used).toBe(1)
    expect(share(study.bins[5]!.early, 'banker')).toBe(1)
    expect(share(study.bins[5]!.rest, 'player')).toBe(1)
    expect(study.bins[0]!.shoes).toBe(0)

    const mixed = countMix(['banker', 'banker', 'player', 'tie'])
    expect(share(mixed, 'banker')).toBe(0.5)
    expect(share(mixed, 'player')).toBe(0.25)
    expect(share(mixed, 'tie')).toBe(0.25)
    expect(binIndex(0.4)).toBe(1)
    expect(binIndex(0.6)).toBe(5)
    expect(binIndex(0.399)).toBe(0)
  })

  it('says a hot opening does not carry forward when the rest matches the shoe', () => {
    const study = emptyStudy(20)
    study.used = 100
    study.overall = { banker: 4590, player: 4460, tie: 950, hands: 10000 }
    const hot = study.bins[5]!
    hot.shoes = 40
    hot.early = { banker: 1300, player: 500, tie: 200, hands: 2000 }
    hot.rest = { banker: 1800, player: 1760, tie: 400, hands: 3960 }
    const text = narrateMix(study).join(' ')
    expect(text).toContain('60% banker or more')
    expect(text).toContain('did not carry forward')
    expect(text).toContain('Player')
    expect(text).toContain('Tie')
  })

  it('keeps the rest of a real shoe near the shoe’s own banker rate', () => {
    const study = readMix(500, 11, 20)
    expect(study.used).toBeGreaterThan(400)
    const usual = share(study.overall, 'banker')
    expect(usual).toBeGreaterThan(0.44)
    expect(usual).toBeLessThan(0.48)
    const middle = study.bins[2]!
    expect(middle.shoes).toBeGreaterThan(20)
    expect(Math.abs(share(middle.rest, 'banker') - usual)).toBeLessThan(0.04)
    const parts = share(study.overall, 'banker') + share(study.overall, 'player') + share(study.overall, 'tie')
    expect(parts).toBeCloseTo(1, 6)
  })
})