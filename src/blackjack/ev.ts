import { mulberry32, shufflePrefix } from '../lib/rng'
import type { ActionName, Rules } from './types'
import { basicAction, offersFreeDouble } from './strategy'
import { totals } from './shoe'

export const TRIALS = 4000

/**
 * Expected profit of each legal action, in units of the original bet.
 * The dealer has already peeked: when the upcard is an ace or a ten,
 * hole cards that would make a blackjack are rejected.
 * Later choices inside a trial follow basic strategy for these rules.
 * A paid split's profit includes the matched second bet. A paid double can return ±2.
 * A free double returns +2 or −1. A free split's second hand returns +1 or 0.
 * `risk` and `win` are the current hand's stake and win, in original-bet units.
 */
export function priceActions(opts: {
  shoe: readonly number[]
  player: readonly number[]
  dealerUp: number
  rules: Rules
  actions: readonly ActionName[]
  trials?: number
  seed?: number
  risk?: number
  win?: number
}): Record<ActionName, number> {
  const trials = opts.trials ?? TRIALS
  const rng = mulberry32(opts.seed ?? 0x5eed)
  const sums: Record<ActionName, number> = { H: 0, S: 0, D: 0, P: 0, R: 0 }
  const simulated = opts.actions.filter((a) => a !== 'R')
  for (let i = 0; i < trials; i++) {
    const deck = conditionedDeck(opts.shoe, opts.dealerUp, rng)
    for (const action of simulated) {
      sums[action] += play(deck, action, opts.player, opts.dealerUp, opts.rules, opts.risk ?? 1, opts.win ?? 1)
    }
  }
  const ev = {} as Record<ActionName, number>
  for (const action of opts.actions) {
    ev[action] = action === 'R' ? -0.5 : sums[action] / trials
  }
  return ev
}

export function insurancePrice(unseen: readonly number[], bet: number): { p: number; evDollars: number } {
  const tens = unseen.filter((r) => r === 10).length
  const p = unseen.length === 0 ? 0 : tens / unseen.length
  const stake = bet / 2
  const evDollars = stake * (3 * p - 1)
  return { p, evDollars }
}

export function naturalPrice(unseen: readonly number[], dealerUp: number, bet: number, pays: number): number {
  if (dealerUp !== 1 && dealerUp !== 10) return bet * pays
  const need = dealerUp === 1 ? 10 : 1
  const p = unseen.length === 0 ? 0 : unseen.filter((r) => r === need).length / unseen.length
  return bet * pays * (1 - p)
}

function conditionedDeck(shoe: readonly number[], dealerUp: number, rng: () => number): number[] {
  const bjHole = (hole: number) => (dealerUp === 1 && hole === 10) || (dealerUp === 10 && hole === 1)
  for (let attempt = 0; attempt < 40; attempt++) {
    const deck = shufflePrefix(shoe, 24, rng)
    if (!bjHole(deck[0] ?? 0)) return deck
  }
  const deck = shufflePrefix(shoe, 24, rng)
  if (bjHole(deck[0] ?? 0)) {
    const swap = deck.findIndex((c, i) => i > 0 && !bjHole(c))
    if (swap > 0) {
      const hole = deck[0]!
      deck[0] = deck[swap]!
      deck[swap] = hole
    }
  }
  return deck
}

type SimHand = { cards: number[]; risk: number; win: number; done: boolean; aceSplit: boolean }

function play(
  deck: readonly number[],
  action: ActionName,
  initial: readonly number[],
  dealerUp: number,
  rules: Rules,
  risk: number,
  win: number,
): number {
  let qi = 1
  const draw = () => {
    const card = deck[qi] ?? deck[deck.length - 1] ?? 10
    qi += 1
    return card
  }
  const hole = deck[0] ?? 10
  if (action === 'R') return -0.5 * risk

  const hands: SimHand[] = []
  if (action === 'P') {
    const a = initial[0] ?? 0
    const b = initial[1] ?? 0
    const free = rules.freeBet && a !== 10
    hands.push(splitHand(a, draw(), risk, win, a === 1))
    hands.push(splitHand(b, draw(), free ? 0 : 1, 1, b === 1))
  } else if (action === 'D') {
    const free = offersFreeDouble(initial, rules)
    hands.push({
      cards: [...initial, draw()],
      risk: free ? risk : risk + 1,
      win: win + 1,
      done: true,
      aceSplit: false,
    })
  } else if (action === 'S') {
    hands.push({ cards: [...initial], risk, win, done: true, aceSplit: false })
  } else {
    const cards = [...initial, draw()]
    hands.push({ cards, risk, win, done: totals(cards).total >= 21, aceSplit: false })
  }

  let guard = 0
  while (hands.some((h) => !h.done) && guard++ < 48) {
    const hand = hands.find((h) => !h.done)!
    if (totals(hand.cards).total >= 21) {
      hand.done = true
      continue
    }
    if (hand.aceSplit && !(hand.cards.length === 2 && hand.cards[0] === 1 && hand.cards[1] === 1 && hands.length < 4)) {
      hand.done = true
      continue
    }
    const splitting = hand.cards.length === 2 && hand.cards[0] === hand.cards[1] && hands.length < 4
    const act = basicAction({
      cards: hand.cards,
      dealerUp,
      rules,
      canDouble: rules.das && hand.cards.length === 2 && !hand.aceSplit,
      canSplit: splitting,
      canSurrender: false,
    })
    if (act === 'S' || act === 'R') {
      hand.done = true
      continue
    }
    if (act === 'D') {
      const free = offersFreeDouble(hand.cards, rules)
      hand.cards.push(draw())
      if (!free) hand.risk += 1
      hand.win += 1
      hand.done = true
      continue
    }
    if (act === 'P') {
      const rank = hand.cards[0]!
      const free = rules.freeBet && rank !== 10
      const aces = rank === 1
      const kept = splitHand(rank, draw(), hand.risk, hand.win, aces)
      hand.cards = kept.cards
      hand.done = kept.done
      hand.aceSplit = kept.aceSplit
      hands.push(splitHand(rank, draw(), free ? 0 : 1, 1, aces))
      continue
    }
    hand.cards.push(draw())
    if (totals(hand.cards).total >= 21) hand.done = true
  }

  const dealer = dealerTotal(dealerUp, hole, draw, rules.hitSoft17)
  let profit = 0
  for (const hand of hands) profit += settle(hand.cards, dealer, hand.risk, hand.win, rules)
  return profit
}

function splitHand(rank: number, card: number, risk: number, win: number, aces: boolean): SimHand {
  const cards = [rank, card]
  const resplit = aces && card === 1
  return {
    cards,
    risk,
    win,
    done: totals(cards).total >= 21 || (aces && !resplit),
    aceSplit: aces,
  }
}

function dealerTotal(up: number, hole: number, draw: () => number, hitSoft17: boolean): number {
  const cards = [up, hole]
  let t = totals(cards)
  let guard = 0
  while ((t.total < 17 || (t.total === 17 && t.soft && hitSoft17)) && guard++ < 12) {
    cards.push(draw())
    t = totals(cards)
  }
  return t.total
}

function settle(cards: readonly number[], dealer: number, risk: number, win: number, rules: Rules): number {
  const total = totals(cards).total
  if (total > 21) return rules.noBust ? 0 : -risk
  if (rules.freeBet && dealer === 22) return 0
  if (dealer > 21 || total > dealer) return win
  if (total < dealer) return -risk
  return 0
}
