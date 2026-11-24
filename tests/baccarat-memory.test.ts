import { describe, expect, it } from 'vitest'
import { decisiveRate, emptyMemory, narrateMemory, observeShoe, readMemory, sidePrice, type MemoryResult, type NextCount } from '../src/baccarat/memory'

describe('baccarat shoe memory', () => {
  it('reads the next hand after a run, and a tie leaves the run in place', () => {
    const result = emptyMemory()
    observeShoe(result, ['banker', 'tie', 'banker', 'banker', 'player', 'player', 'banker'])

    expect(result.hands).toBe(7)
    expect(result.tie).toBe(1)
    expect(count(result.afterLast.banker)).toEqual({ banker: 2, player: 1, tie: 1 })
    expect(count(result.afterLast.player)).toEqual({ banker: 1, player: 1, tie: 0 })
    expect(count(row(result, 'banker', 1))).toEqual({ banker: 1, player: 0, tie: 1 })
    expect(count(row(result, 'banker', 2))).toEqual({ banker: 1, player: 0, tie: 0 })
    expect(count(row(result, 'banker', 3))).toEqual({ banker: 0, player: 1, tie: 0 })
    expect(count(row(result, 'player', 1))).toEqual({ banker: 0, player: 1, tie: 0 })
    expect(count(row(result, 'player', 2))).toEqual({ banker: 1, player: 0, tie: 0 })
    expect(sumRows(result, 'banker')).toEqual(count(result.afterLast.banker))
    expect(sumRows(result, 'player')).toEqual(count(result.afterLast.player))
  })

  it('starts a new shoe with no memory of the last one', () => {
    const result = emptyMemory()
    observeShoe(result, ['banker', 'banker'])
    const before = count(result.afterLast.banker)
    observeShoe(result, ['player'])
    expect(count(result.afterLast.banker)).toEqual(before)
    expect(count(result.afterLast.player)).toEqual({ banker: 0, player: 0, tie: 0 })
  })

  it('says a flat run sits inside the noise, and a large shift clears it', () => {
    const flat = filled(458, 446, 96)
    const flatText = narrateMemory(flat).join(' ')
    expect(flatText).toContain('After three Bankers')
    expect(flatText).toContain('inside the sampling noise')
    expect(flatText).toContain('no run with at least 200 hands')

    const shifted = filled(500, 500, 100)
    const hot = shifted.streaks.find((row) => row.side === 'banker' && row.length === 3)!
    hot.next = { banker: 200, player: 800, tie: 100 }
    const shiftedText = narrateMemory(shifted).join(' ')
    expect(shiftedText).toContain('toward Player')
    expect(shiftedText).toContain('clears the sampling noise')
    expect(shiftedText).not.toContain('no run with at least 200 hands')
  })

  it('keeps the next-hand rate near the shoe and prices Banker near the published edge', () => {
    const result = readMemory(800, 11)
    const decisive = result.banker + result.player
    const bankerRate = result.banker / decisive
    expect(result.shoes).toBe(800)
    expect(bankerRate).toBeGreaterThan(0.49)
    expect(bankerRate).toBeLessThan(0.525)
    expect(result.tie / result.hands).toBeGreaterThan(0.08)
    expect(result.tie / result.hands).toBeLessThan(0.11)

    const recorded =
      result.afterLast.banker.banker +
      result.afterLast.banker.player +
      result.afterLast.banker.tie +
      result.afterLast.player.banker +
      result.afterLast.player.player +
      result.afterLast.player.tie
    const openingTies = result.hands - result.shoes - recorded
    expect(openingTies).toBeGreaterThan(30)
    expect(openingTies).toBeLessThan(200)
    expect(sumRows(result, 'banker')).toEqual(count(result.afterLast.banker))
    expect(sumRows(result, 'player')).toEqual(count(result.afterLast.player))

    const afterOne = row(result, 'banker', 1)
    const n = afterOne.banker + afterOne.player
    expect(n).toBeGreaterThan(1000)
    expect(Math.abs(decisiveRate(afterOne, 'banker') - bankerRate)).toBeLessThan(0.03)

    const price = sidePrice({ banker: result.banker, player: result.player, tie: result.tie }, 'banker')
    expect(price.centsLost).toBeGreaterThan(0.5)
    expect(price.centsLost).toBeLessThan(1.8)
  })
})

function row(result: MemoryResult, side: 'banker' | 'player', length: number): NextCount {
  return result.streaks.find((item) => item.side === side && item.length === length)!.next
}

function count(next: NextCount): NextCount {
  return { banker: next.banker, player: next.player, tie: next.tie }
}

function sumRows(result: MemoryResult, side: 'banker' | 'player'): NextCount {
  const sum = { banker: 0, player: 0, tie: 0 }
  for (const item of result.streaks) {
    if (item.side !== side) continue
    sum.banker += item.next.banker
    sum.player += item.next.player
    sum.tie += item.next.tie
  }
  return sum
}

function filled(banker: number, player: number, tie: number): MemoryResult {
  const result = emptyMemory()
  result.shoes = 100
  result.banker = banker * 10
  result.player = player * 10
  result.tie = tie * 10
  result.hands = result.banker + result.player + result.tie
  for (const item of result.streaks) item.next = { banker, player, tie }
  return result
}
