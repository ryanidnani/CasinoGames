import { RANKS, SUITS, type PCard, type Suit } from './cards'

export type HandClass = { hi: number; lo: number; kind: 'pair' | 's' | 'o' }

export function classKey(hand: HandClass): string {
  const a = rankChar(hand.hi)
  const b = rankChar(hand.lo)
  if (hand.kind === 'pair') return `${a}${b}`
  return `${a}${b}${hand.kind}`
}

export function parseKey(key: string): HandClass {
  const hi = charRank(key[0]!)
  const lo = charRank(key[1]!)
  const kind = key.length === 2 ? 'pair' : key[2] === 's' ? 's' : 'o'
  return { hi, lo, kind }
}

const CHAR: Record<number, string> = {
  14: 'A',
  13: 'K',
  12: 'Q',
  11: 'J',
  10: 'T',
  9: '9',
  8: '8',
  7: '7',
  6: '6',
  5: '5',
  4: '4',
  3: '3',
  2: '2',
}

function rankChar(rank: number): string {
  return CHAR[rank] ?? '?'
}

function charRank(ch: string): number {
  const entry = Object.entries(CHAR).find(([, v]) => v === ch)
  return entry ? Number(entry[0]) : 0
}

export function expandClass(hand: HandClass, dead: readonly PCard[]): PCard[][] {
  const blocked = new Set(dead.map((c) => `${c.rank}${c.suit}`))
  const combos: PCard[][] = []
  if (hand.kind === 'pair') {
    for (let i = 0; i < SUITS.length; i++) {
      for (let j = i + 1; j < SUITS.length; j++) {
        const a = { rank: hand.hi, suit: SUITS[i]! }
        const b = { rank: hand.hi, suit: SUITS[j]! }
        if (!blocked.has(`${a.rank}${a.suit}`) && !blocked.has(`${b.rank}${b.suit}`)) combos.push([a, b])
      }
    }
    return combos
  }
  for (const s1 of SUITS) {
    for (const s2 of SUITS) {
      const suited = s1 === s2
      if (hand.kind === 's' && !suited) continue
      if (hand.kind === 'o' && suited) continue
      const a = { rank: hand.hi, suit: s1 }
      const b = { rank: hand.lo, suit: s2 as Suit }
      if (!blocked.has(`${a.rank}${a.suit}`) && !blocked.has(`${b.rank}${b.suit}`)) combos.push([a, b])
    }
  }
  return combos
}

export function expandRange(keys: readonly string[], dead: readonly PCard[]): PCard[][] {
  const combos: PCard[][] = []
  for (const key of keys) combos.push(...expandClass(parseKey(key), dead))
  return combos
}

function pairKeys(from: number, to: number): string[] {
  return RANKS.filter((r) => r <= from && r >= to).map((r) => `${rankChar(r)}${rankChar(r)}`)
}

function suitedKeys(hi: number, loFrom: number, loTo: number): string[] {
  return RANKS.filter((r) => r < hi && r <= loFrom && r >= loTo).map((r) => `${rankChar(hi)}${rankChar(r)}s`)
}

function offsuitKeys(hi: number, loFrom: number, loTo: number): string[] {
  return RANKS.filter((r) => r < hi && r <= loFrom && r >= loTo).map((r) => `${rankChar(hi)}${rankChar(r)}o`)
}

/** TT+, AJs+, KQs, AQo+. */
export function tightRange(): string[] {
  return [
    ...pairKeys(14, 10),
    ...suitedKeys(14, 13, 11),
    ...suitedKeys(13, 12, 12),
    ...offsuitKeys(14, 13, 12),
  ]
}

/**
 * The tight range, plus 77–99, suited aces, suited connectors down to 65s,
 * ATo, and KQo. Value hands and bluffs together.
 */
export function wideRange(): string[] {
  const keys = new Set<string>([
    ...tightRange(),
    ...pairKeys(9, 7),
    ...suitedKeys(14, 10, 2),
    ...suitedKeys(13, 11, 10),
    ...suitedKeys(12, 11, 10),
    ...suitedKeys(11, 10, 10),
    ...suitedKeys(10, 9, 9),
    ...suitedKeys(9, 8, 8),
    ...suitedKeys(8, 7, 7),
    ...suitedKeys(7, 6, 6),
    ...suitedKeys(6, 5, 5),
    ...offsuitKeys(14, 11, 10),
    ...offsuitKeys(13, 12, 12),
  ])
  return [...keys]
}

export function gridKeys(): { key: string; row: number; col: number; pair: boolean; suited: boolean }[] {
  const cells: { key: string; row: number; col: number; pair: boolean; suited: boolean }[] = []
  RANKS.forEach((rowRank, row) => {
    RANKS.forEach((colRank, col) => {
      if (row === col) cells.push({ key: `${rankChar(rowRank)}${rankChar(rowRank)}`, row, col, pair: true, suited: false })
      else if (row < col) cells.push({ key: `${rankChar(rowRank)}${rankChar(colRank)}s`, row, col, pair: false, suited: true })
      else cells.push({ key: `${rankChar(colRank)}${rankChar(rowRank)}o`, row, col, pair: false, suited: false })
    })
  })
  return cells
}
