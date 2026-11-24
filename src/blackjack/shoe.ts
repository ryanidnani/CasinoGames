import { shuffle } from '../lib/rng'
import type { Card, Suit } from './types'

const SUITS: Suit[] = ['S', 'H', 'D', 'C']

export function allCards(): Card[] {
  const cards: Card[] = []
  for (const suit of SUITS) {
    for (let rank = 1; rank <= 13; rank++) cards.push({ rank, suit })
  }
  return cards
}

export function bjRank(rank: number): number {
  if (rank === 1) return 1
  return Math.min(rank, 10)
}

export function makeShoe(decks: number, rng: () => number): Card[] {
  const cards: Card[] = []
  for (let d = 0; d < decks; d++) {
    for (const suit of SUITS) {
      for (let rank = 1; rank <= 13; rank++) cards.push({ rank, suit })
    }
  }
  return shuffle(cards, rng)
}

export function popCard(shoe: Card[], decks: number, rng: () => number): { card: Card; shoe: Card[] } {
  let next = shoe
  if (next.length === 0) next = makeShoe(decks, rng)
  const card = next[next.length - 1]!
  return { card, shoe: next.slice(0, -1) }
}

export type Total = { total: number; soft: boolean }

export function totals(ranks: readonly number[]): Total {
  let sum = 0
  let aces = 0
  for (const rank of ranks) {
    if (rank === 1) {
      aces += 1
      sum += 11
    } else {
      sum += rank
    }
  }
  while (sum > 21 && aces > 0) {
    sum -= 10
    aces -= 1
  }
  return { total: sum, soft: aces > 0 }
}

export function isPair(ranks: readonly number[]): boolean {
  return ranks.length === 2 && ranks[0] === ranks[1]
}

export function isBlackjack(ranks: readonly number[]): boolean {
  return ranks.length === 2 && totals(ranks).total === 21
}

const RANK_NAME = ['', 'Ace', '2', '3', '4', '5', '6', '7', '8', '9', '10', 'Jack', 'Queen', 'King']
const RANK_SHORT = ['', 'A', '2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K']
const SUIT_GLYPH: Record<Suit, string> = { S: '♠', H: '♥', D: '♦', C: '♣' }

export function rankLabel(rank: number): string {
  return RANK_SHORT[rank] ?? '?'
}

export function cardText(card: Card): string {
  return `${rankLabel(card.rank)}${SUIT_GLYPH[card.suit]}`
}

export function upLabel(rank: number): string {
  if (rank === 1) return 'Ace'
  return RANK_NAME[rank] ?? String(rank)
}

export function handLabel(ranks: readonly number[]): string {
  if (isPair(ranks)) {
    if (ranks[0] === 1) return 'Pair of aces'
    if (ranks[0] === 10) return 'Pair of 10s'
    return `Pair of ${ranks[0]}s`
  }
  const t = totals(ranks)
  return `${t.soft ? 'Soft' : 'Hard'} ${t.total}`
}

export function spotName(ranks: readonly number[], dealerUp: number): string {
  return `${handLabel(ranks)} vs ${upLabel(dealerUp)}`
}
