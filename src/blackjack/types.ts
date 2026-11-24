export type ActionName = 'H' | 'S' | 'D' | 'P' | 'R'

export type Rules = {
  decks: number
  /** Dealer hits soft 17 when true. */
  hitSoft17: boolean
  /** Double after split. */
  das: boolean
  lateSurrender: boolean
  /** 1.5 is 3:2. 1.2 is 6:5. */
  blackjackPays: number
  /**
   * Free doubles on hard 9, 10, or 11, free splits on every pair except tens,
   * and a dealer 22 pushes.
   */
  freeBet: boolean
  /** A player total over 21 pushes. */
  noBust: boolean
}

export const DEFAULT_RULES: Rules = {
  decks: 6,
  hitSoft17: false,
  das: true,
  lateSurrender: true,
  blackjackPays: 1.5,
  freeBet: false,
  noBust: false,
}

export const ACTION_LABEL: Record<ActionName, string> = {
  H: 'Hit',
  S: 'Stand',
  D: 'Double',
  P: 'Split',
  R: 'Surrender',
}

export type Suit = 'S' | 'H' | 'D' | 'C'

export type Card = {
  rank: number
  suit: Suit
}

export type LiveHand = {
  cards: Card[]
  /** Money already taken. A push returns this. A free hand has none. */
  bet: number
  /** Profit added on a win. An ordinary hand matches `bet`. A free double pays twice the unit. */
  winPay: number
  /** Size of the original wager. Free doubles and free splits are measured against it. */
  unit: number
  doubled: boolean
  stood: boolean
  surrendered: boolean
  fromSplit: boolean
  /** Split from aces: one card, then stand, unless that card is another ace. */
  splitAces: boolean
}

export type Decision = {
  hand: number
  spot: string
  action: string
  actionCode: string
  best: string
  bestCode: string
  evChosen: number
  evBest: number
  regret: number
  bet: number
  detail: string
}

export type TicketRow = {
  label: string
  perDollar: number | null
  onBet: number | null
  mark?: 'you' | 'best'
}

export type TicketModel = {
  kicker: string
  title: string
  rows: TicketRow[]
  footer: string
  note: string
}

export type Phase = 'idle' | 'insurance' | 'play' | 'result'

export type Table = {
  phase: Phase
  shoe: Card[]
  dealer: Card[]
  hands: LiveHand[]
  active: number
  bet: number
  bankroll: number
  bankrollMark: number
  handNet: number | null
  insurance: 'take' | 'decline' | null
  ticket: TicketModel | null
  verdict: string | null
  handDecisions: Decision[]
  handsPlayed: number
  message: string | null
}
