import type { Rules } from './types'
import { isPair, totals } from './shoe'

/**
 * Multi-deck basic strategy (Wizard of Odds, 4–8 decks).
 * Surrender is considered first, then pairs, then doubles, then hit or stand.
 * H17 and no-double-after-split change the published close calls.
 */
export function basicAction(args: {
  cards: readonly number[]
  dealerUp: number
  rules: Rules
  canDouble: boolean
  canSplit: boolean
  canSurrender: boolean
}): 'H' | 'S' | 'D' | 'P' | 'R' {
  const { cards, dealerUp, rules } = args
  if (args.canSurrender && cards.length === 2 && shouldSurrender(cards, dealerUp, rules)) return 'R'
  if (args.canSplit && cards.length === 2 && isPair(cards) && shouldSplit(cards[0]!, dealerUp, rules)) return 'P'
  if (args.canDouble && cards.length === 2 && shouldDouble(cards, dealerUp, rules)) return 'D'
  return hitOrStand(cards, dealerUp)
}

function shouldSurrender(cards: readonly number[], dealerUp: number, rules: Rules): boolean {
  if (!rules.lateSurrender) return false
  const t = totals(cards)
  if (t.soft) return false
  if (isPair(cards) && cards[0] === 8) {
    return rules.hitSoft17 && dealerUp === 1
  }
  if (t.total === 16 && (dealerUp === 9 || dealerUp === 10 || dealerUp === 1)) return true
  if (t.total === 15 && dealerUp === 10) return true
  if (rules.hitSoft17 && t.total === 15 && dealerUp === 1) return true
  if (rules.hitSoft17 && t.total === 17 && dealerUp === 1) return true
  return false
}

function shouldSplit(rank: number, dealerUp: number, rules: Rules): boolean {
  switch (rank) {
    case 1:
    case 8:
      return true
    case 10:
    case 5:
      return false
    case 9:
      return dealerUp !== 7 && dealerUp !== 10 && dealerUp !== 1
    case 4:
      return rules.das && (dealerUp === 5 || dealerUp === 6)
    case 6:
      return rules.das ? dealerUp >= 2 && dealerUp <= 6 : dealerUp >= 3 && dealerUp <= 6
    case 2:
    case 3:
      return rules.das ? dealerUp >= 2 && dealerUp <= 7 : dealerUp >= 4 && dealerUp <= 7
    case 7:
      return dealerUp >= 2 && dealerUp <= 7
    default:
      return false
  }
}

function shouldDouble(cards: readonly number[], dealerUp: number, rules: Rules): boolean {
  const t = totals(cards)
  const u = dealerUp
  if (!t.soft) {
    if (t.total === 11) return u !== 1 || rules.hitSoft17
    if (t.total === 10) return u >= 2 && u <= 9
    if (t.total === 9) return u >= 3 && u <= 6
    return false
  }
  if (t.total === 19) return rules.hitSoft17 && u === 6
  if (t.total === 18) return (u >= 3 && u <= 6) || (rules.hitSoft17 && u === 2)
  if (t.total === 17) return u >= 3 && u <= 6
  if (t.total === 16 || t.total === 15) return u >= 4 && u <= 6
  if (t.total === 14 || t.total === 13) return u === 5 || u === 6
  return false
}

function hitOrStand(cards: readonly number[], dealerUp: number): 'H' | 'S' {
  const t = totals(cards)
  const u = dealerUp
  if (t.soft) {
    if (t.total <= 17) return 'H'
    if (t.total === 18) return u === 9 || u === 10 || u === 1 ? 'H' : 'S'
    return 'S'
  }
  if (t.total <= 11) return 'H'
  if (t.total === 12) return u >= 4 && u <= 6 ? 'S' : 'H'
  if (t.total <= 16) return u >= 2 && u <= 6 ? 'S' : 'H'
  return 'S'
}
