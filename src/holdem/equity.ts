import { mulberry32, shufflePrefix } from '../lib/rng'
import { cardKey, compareHands, fullDeck, type PCard } from './cards'
import { expandRange } from './range'

export type Equity = {
  equity: number
  win: number
  tie: number
  lose: number
  combos: number
  trials: number
}

/** `pot` already includes their bet and does not include the call. */
export function requiredEquity(pot: number, bet: number): number {
  return bet / (pot + bet)
}

/** Expected profit of calling. Folding is worth 0. */
export function callEv(equity: number, pot: number, bet: number): number {
  return equity * pot - (1 - equity) * bet
}

export function betShape(potBeforeBet: number, bet: number): string {
  if (potBeforeBet <= 0) return 'a bet'
  const ratio = bet / potBeforeBet
  if (Math.abs(ratio - 0.5) < 0.02) return 'a half-pot bet'
  if (Math.abs(ratio - 1) < 0.02) return 'a pot-sized bet'
  if (Math.abs(ratio - 1 / 3) < 0.03) return 'a one-third-pot bet'
  return 'this bet'
}

export function priceCall(opts: {
  hero: readonly PCard[]
  board: readonly PCard[]
  range: readonly string[]
  /** Chips in the pot before they bet. */
  potBeforeBet: number
  bet: number
  trials?: number
  seed?: number
}): { equity: Equity; ev: number; required: number } {
  if (opts.bet <= 0 || opts.potBeforeBet < 0) {
    return { equity: estimateEquity({ ...opts, trials: 1 }), ev: 0, required: 0 }
  }
  const pot = opts.potBeforeBet + opts.bet
  const equity = estimateEquity(opts)
  return {
    equity,
    ev: callEv(equity.equity, pot, opts.bet),
    required: requiredEquity(pot, opts.bet),
  }
}

export function estimateEquity(opts: {
  hero: readonly PCard[]
  board: readonly PCard[]
  range: readonly string[]
  trials?: number
  seed?: number
}): Equity {
  const trials = opts.trials ?? 8000
  const dead = [...opts.hero, ...opts.board]
  const combos = expandRange(opts.range, dead).filter((combo) => {
    const keys = new Set(dead.map(cardKey))
    return !keys.has(cardKey(combo[0]!)) && !keys.has(cardKey(combo[1]!))
  })
  if (combos.length === 0 || opts.hero.length < 2) {
    return { equity: 0, win: 0, tie: 0, lose: 0, combos: combos.length, trials: 0 }
  }
  const deck = fullDeck().filter((card) => !dead.some((d) => d.rank === card.rank && d.suit === card.suit))
  const need = 5 - opts.board.length
  const rng = mulberry32(opts.seed ?? 1)
  let win = 0
  let tie = 0
  let lose = 0
  for (let i = 0; i < trials; i++) {
    const combo = combos[Math.floor(rng() * combos.length)]!
    const remaining = deck.filter((card) => !(card.rank === combo[0]!.rank && card.suit === combo[0]!.suit) && !(card.rank === combo[1]!.rank && card.suit === combo[1]!.suit))
    const drawn = need > 0 ? shufflePrefix(remaining, need, rng).slice(0, need) : []
    const board = [...opts.board, ...drawn]
    const cmp = compareHands(opts.hero, combo, board)
    if (cmp > 0) win += 1
    else if (cmp < 0) lose += 1
    else tie += 1
  }
  return {
    equity: (win + tie * 0.5) / trials,
    win: win / trials,
    tie: tie / trials,
    lose: lose / trials,
    combos: combos.length,
    trials,
  }
}
