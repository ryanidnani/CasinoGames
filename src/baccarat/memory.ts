import { pct } from '../lib/money'
import { mulberry32 } from '../lib/rng'
import { dealHand, openShoe, type Outcome, type Side } from './engine'

export type { Side }

export type NextCount = { banker: number; player: number; tie: number }

export type StreakRow = {
  side: Side
  /** 6 means six or more. */
  length: number
  next: NextCount
}

export type MemoryResult = {
  shoes: number
  hands: number
  banker: number
  player: number
  tie: number
  afterLast: Record<Side, NextCount>
  streaks: StreakRow[]
}

export type SidePrice = {
  centsLost: number
  bets: number
  profit: number
}

const LENGTHS = [1, 2, 3, 4, 5, 6]

export function emptyMemory(): MemoryResult {
  return {
    shoes: 0,
    hands: 0,
    banker: 0,
    player: 0,
    tie: 0,
    afterLast: { banker: emptyNext(), player: emptyNext() },
    streaks: (['banker', 'player'] as const).flatMap((side) =>
      LENGTHS.map((length) => ({ side, length, next: emptyNext() })),
    ),
  }
}

export function runLabel(side: Side, length: number): string {
  const name = side === 'banker' ? 'Banker' : 'Player'
  if (length >= 6) return `6 or more ${name}s`
  if (length === 1) return `1 ${name}`
  return `${length} ${name}s`
}

export function observeShoe(result: MemoryResult, outcomes: readonly Outcome[]): void {
  let side: Side | null = null
  let streak = 0
  for (const outcome of outcomes) {
    result.hands += 1
    if (outcome === 'banker') result.banker += 1
    else if (outcome === 'player') result.player += 1
    else result.tie += 1

    if (side) {
      const length = Math.min(streak, 6)
      const row = result.streaks.find((item) => item.side === side && item.length === length)
      add(row!.next, outcome)
      add(result.afterLast[side], outcome)
    }

    if (outcome === 'tie') continue
    if (side === outcome) streak += 1
    else {
      side = outcome
      streak = 1
    }
  }
}

export function readMemory(shoes: number, seed: number, decks = 8): MemoryResult {
  const rng = mulberry32(seed)
  const result = emptyMemory()
  for (let i = 0; i < shoes; i++) {
    observeShoe(result, dealShoe(decks, rng))
    result.shoes += 1
  }
  return result
}

export async function readMemoryAsync(
  shoes: number,
  seed: number,
  onProgress: (fraction: number) => void,
  cancelled: () => boolean,
  decks = 8,
): Promise<MemoryResult | null> {
  const rng = mulberry32(seed)
  const result = emptyMemory()
  for (let i = 0; i < shoes; i++) {
    if (cancelled()) return null
    observeShoe(result, dealShoe(decks, rng))
    result.shoes += 1
    if (i % 40 === 0) {
      onProgress(i / shoes)
      await new Promise((resolve) => setTimeout(resolve, 0))
    }
  }
  onProgress(1)
  return result
}

/** House take, in cents per dollar wagered. Ties are wagers that push. */
export function sidePrice(next: NextCount, side: Side): SidePrice {
  const bets = next.banker + next.player + next.tie
  const profit = side === 'banker' ? next.banker * 0.95 - next.player : next.player - next.banker
  return { bets, profit, centsLost: bets === 0 ? 0 : (-profit / bets) * 100 }
}

export function decisiveRate(next: NextCount, side: Side): number {
  const n = next.banker + next.player
  if (n === 0) return 0
  return side === 'banker' ? next.banker / n : next.player / n
}

export function narrateMemory(result: MemoryResult): string[] {
  const decisive = result.banker + result.player
  if (decisive === 0) return ['These shoes produced no decisive hands.']
  const bankerRate = result.banker / decisive
  const usual = sidePrice({ banker: result.banker, player: result.player, tie: result.tie }, 'banker')
  const lines = [
    `In ${result.shoes.toLocaleString('en-US')} shoes, Banker won ${pct(bankerRate)} of the hands that were not ties. A $1 Banker bet on every hand ${took(usual.centsLost)} per dollar.`,
  ]

  const focus = streak(result, 'banker', 3)
  const focusNext = focus?.next ?? emptyNext()
  const focusN = focusNext.banker + focusNext.player
  const focusRate = focusN === 0 ? 0 : focusNext.banker / focusN
  const focusGap = focusRate - bankerRate
  const focusPrice = sidePrice(focusNext, 'banker')
  if (focusN === 0) {
    lines.push('This sample never reached three Bankers in a row.')
  } else {
    lines.push(
      `After three Bankers, the next decisive hand was Banker ${pct(focusRate)} of the time, ${fromUsual(focusGap)} (${focusN.toLocaleString('en-US')} hands). A Banker bet on the hands that followed that run ${took(focusPrice.centsLost)} per dollar.`,
    )
    lines.push(noiseLine(focusRate, focusN, focusGap))
  }

  const widest = widestShift(result, bankerRate)
  if (widest && (widest.row.side !== 'banker' || widest.row.length !== 3) && notable(widest.rate, widest.n, widest.gap)) {
    const name = widest.row.side === 'banker' ? 'Banker' : 'Player'
    lines.push(
      `The widest shift was after ${runLabel(widest.row.side, widest.row.length)}: the next decisive hand was ${name} ${pct(widest.same)} of the time, ${fromUsual(widest.gap)}. That is about ${cents(Math.abs(widest.centsShift))} per dollar ${widest.centsShift > 0 ? 'toward a Banker bet' : 'against a Banker bet'}.`,
    )
  } else if (focusN > 0 && noRunClearsNoise(result, bankerRate)) {
    lines.push('From a single winner through six or more, no run with at least 200 hands cleared its own sampling noise.')
  }
  return lines
}

function noiseLine(rate: number, n: number, gap: number): string {
  if (n < 200) return 'That run showed up too rarely to read a rate from it.'
  const band = 2 * Math.sqrt((rate * (1 - rate)) / n)
  const bandText = `about ±${(band * 100).toFixed(1)} points`
  if (Math.abs(gap) <= band) {
    return `A gap of that size sits inside the sampling noise, ${bandText}. The run left the next hand near the usual rate.`
  }
  return `That gap clears the sampling noise, ${bandText}.`
}

function noRunClearsNoise(result: MemoryResult, bankerRate: number): boolean {
  let saw = false
  for (const row of result.streaks) {
    const n = row.next.banker + row.next.player
    if (n < 200) continue
    saw = true
    const rate = row.next.banker / n
    if (notable(rate, n, rate - bankerRate)) return false
  }
  return saw
}

function widestShift(result: MemoryResult, bankerRate: number): {
  row: StreakRow
  rate: number
  same: number
  n: number
  gap: number
  centsShift: number
} | null {
  const tieRate = result.hands === 0 ? 0 : result.tie / result.hands
  let best: ReturnType<typeof widestShift> = null
  for (const row of result.streaks) {
    const n = row.next.banker + row.next.player
    if (n < 200) continue
    const rate = row.next.banker / n
    const gap = rate - bankerRate
    const same = row.side === 'banker' ? rate : 1 - rate
    const centsShift = gap * (1 - tieRate) * 1.95 * 100
    if (!best || Math.abs(gap) > Math.abs(best.gap)) best = { row, rate, same, n, gap, centsShift }
  }
  return best
}

function notable(rate: number, n: number, gap: number): boolean {
  if (n < 200) return false
  const band = 2 * Math.sqrt((rate * (1 - rate)) / n)
  return Math.abs(gap) > band
}

function fromUsual(gap: number): string {
  const points = (Math.abs(gap) * 100).toFixed(1)
  if (Math.abs(gap) < 0.0005) return 'level with the usual Banker rate'
  return `${points} points ${gap > 0 ? 'toward Banker' : 'toward Player'}`
}

function cents(amount: number): string {
  return `${Math.abs(amount).toFixed(2)}¢`
}

function took(centsLost: number): string {
  return `${centsLost < -0.005 ? 'won' : 'lost'} ${cents(centsLost)}`
}

function streak(result: MemoryResult, side: Side, length: number): StreakRow | undefined {
  return result.streaks.find((row) => row.side === side && row.length === length)
}

function emptyNext(): NextCount {
  return { banker: 0, player: 0, tie: 0 }
}

function add(next: NextCount, outcome: Outcome): void {
  next[outcome] += 1
}

function dealShoe(decks: number, rng: () => number): Outcome[] {
  const shoe = openShoe(decks, rng)
  const out: Outcome[] = []
  let index = shoe.index
  while (shoe.cards.length - index >= 6) {
    const dealt = dealHand(shoe.cards, index)
    index = dealt.index
    out.push(dealt.winner)
  }
  return out
}
