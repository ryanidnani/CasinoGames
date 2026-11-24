export type Suit = 's' | 'h' | 'd' | 'c'
export type PCard = { rank: number; suit: Suit }

export const RANKS = [14, 13, 12, 11, 10, 9, 8, 7, 6, 5, 4, 3, 2] as const
export const SUITS: Suit[] = ['s', 'h', 'd', 'c']

const RANK_LABEL: Record<number, string> = {
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

const SUIT_GLYPH: Record<Suit, string> = { s: '♠', h: '♥', d: '♦', c: '♣' }

export function rankLabel(rank: number): string {
  return RANK_LABEL[rank] ?? '?'
}

export function cardKey(card: PCard): string {
  return `${card.rank}${card.suit}`
}

export function cardText(card: PCard): string {
  return `${rankLabel(card.rank)}${SUIT_GLYPH[card.suit]}`
}

export function fullDeck(): PCard[] {
  const cards: PCard[] = []
  for (const rank of RANKS) for (const suit of SUITS) cards.push({ rank, suit })
  return cards
}

export function sameCard(a: PCard, b: PCard): boolean {
  return a.rank === b.rank && a.suit === b.suit
}

/** Category in the high bits, then five rank slots. Higher is better. */
export function handScore(cards: readonly PCard[]): number {
  const flush = bestFlush(cards)
  if (flush) {
    const straight = bestStraight(flush.map((c) => c.rank))
    if (straight) return pack(8, [straight, 0, 0, 0, 0])
  }
  const counts = new Map<number, number>()
  for (const card of cards) counts.set(card.rank, (counts.get(card.rank) ?? 0) + 1)
  const groups = [...counts.entries()].sort((a, b) => b[1] - a[1] || b[0] - a[0])
  const quads = groups.find((g) => g[1] === 4)
  if (quads) {
    const kicker = groups.find((g) => g[0] !== quads[0])?.[0] ?? 0
    return pack(7, [quads[0], kicker, 0, 0, 0])
  }
  const trips = groups.filter((g) => g[1] === 3)
  const pairs = groups.filter((g) => g[1] === 2)
  if (trips.length >= 2) return pack(6, [trips[0]![0], trips[1]![0], 0, 0, 0])
  if (trips.length === 1 && pairs.length >= 1) return pack(6, [trips[0]![0], pairs[0]![0], 0, 0, 0])
  if (flush) {
    const ranks = flush.map((c) => c.rank).sort((a, b) => b - a).slice(0, 5)
    return pack(5, pad(ranks))
  }
  const straight = bestStraight(cards.map((c) => c.rank))
  if (straight) return pack(4, [straight, 0, 0, 0, 0])
  if (trips.length === 1) {
    const kickers = groups.filter((g) => g[0] !== trips[0]![0]).map((g) => g[0]).slice(0, 2)
    return pack(3, [trips[0]![0], ...pad(kickers).slice(0, 2), 0, 0])
  }
  if (pairs.length >= 2) {
    const kickers = groups.filter((g) => g[1] === 1 || (g[1] === 2 && g[0] !== pairs[0]![0] && g[0] !== pairs[1]![0]))
    const kicker = Math.max(kickers[0]?.[0] ?? 0, pairs[2]?.[0] ?? 0)
    return pack(2, [pairs[0]![0], pairs[1]![0], kicker, 0, 0])
  }
  if (pairs.length === 1) {
    const kickers = groups.filter((g) => g[0] !== pairs[0]![0]).map((g) => g[0]).slice(0, 3)
    return pack(1, [pairs[0]![0], ...pad(kickers)])
  }
  const high = [...counts.keys()].sort((a, b) => b - a).slice(0, 5)
  return pack(0, pad(high))
}

function bestFlush(cards: readonly PCard[]): PCard[] | null {
  for (const suit of SUITS) {
    const suited = cards.filter((c) => c.suit === suit).sort((a, b) => b.rank - a.rank)
    if (suited.length >= 5) return suited
  }
  return null
}

function bestStraight(ranks: readonly number[]): number | null {
  const unique = [...new Set(ranks)].sort((a, b) => b - a)
  if (unique.includes(14)) unique.push(1)
  let run = 1
  for (let i = 1; i < unique.length; i++) {
    if (unique[i] === unique[i - 1]! - 1) {
      run += 1
      if (run >= 5) return unique[i - 4]! === 1 ? 5 : unique[i - 4]!
    } else if (unique[i] !== unique[i - 1]) run = 1
  }
  return null
}

function pack(category: number, ranks: number[]): number {
  const r = pad(ranks)
  return (category << 20) | (r[0]! << 16) | (r[1]! << 12) | (r[2]! << 8) | (r[3]! << 4) | r[4]!
}

function pad(ranks: number[]): number[] {
  return [ranks[0] ?? 0, ranks[1] ?? 0, ranks[2] ?? 0, ranks[3] ?? 0, ranks[4] ?? 0]
}

export function compareHands(hero: readonly PCard[], villain: readonly PCard[], board: readonly PCard[]): -1 | 0 | 1 {
  const h = handScore([...hero, ...board])
  const v = handScore([...villain, ...board])
  if (h > v) return 1
  if (h < v) return -1
  return 0
}
