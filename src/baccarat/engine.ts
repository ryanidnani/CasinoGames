import { shuffle } from '../lib/rng'

export type Side = 'player' | 'banker'
export type Outcome = 'player' | 'banker' | 'tie'

/** Point value. Tens and faces are 0. */
export function handValue(cards: readonly number[]): number {
  let sum = 0
  for (const card of cards) sum += card
  return sum % 10
}

/**
 * Banker draw tableau. `third` is null when the player stood.
 * Card 0 is a ten or a face.
 */
export function bankerDraws(total: number, third: number | null): boolean {
  if (third === null) return total <= 5
  if (total <= 2) return true
  if (total === 3) return third !== 8
  if (total === 4) return third !== 0 && third !== 1 && third !== 8 && third !== 9
  if (total === 5) return third >= 4 && third <= 7
  if (total === 6) return third === 6 || third === 7
  return false
}

export function freshShoe(decks = 8): number[] {
  const cards: number[] = []
  for (let d = 0; d < decks; d++) {
    for (let suit = 0; suit < 4; suit++) {
      cards.push(0, 0, 0, 0)
      for (let value = 1; value <= 9; value++) cards.push(value)
    }
  }
  return cards
}

export type Deal = { player: number[]; banker: number[]; winner: Outcome; index: number }

export function dealHand(shoe: readonly number[], index: number): Deal {
  let i = index
  const draw = () => shoe[i++] ?? 0
  const player = [draw(), draw()]
  const banker = [draw(), draw()]
  let playerTotal = handValue(player)
  let bankerTotal = handValue(banker)
  if (playerTotal < 8 && bankerTotal < 8) {
    let third: number | null = null
    if (playerTotal <= 5) {
      third = draw()
      player.push(third)
      playerTotal = handValue(player)
    }
    if (bankerDraws(bankerTotal, third)) {
      banker.push(draw())
      bankerTotal = handValue(banker)
    }
  }
  const winner: Outcome = playerTotal > bankerTotal ? 'player' : bankerTotal > playerTotal ? 'banker' : 'tie'
  return { player, banker, winner, index: i }
}

export function openShoe(decks: number, rng: () => number): { cards: number[]; index: number } {
  const cards = shuffle(freshShoe(decks), rng)
  let index = 0
  const burn = cards[index++] ?? 0
  const count = burn === 0 ? 10 : burn
  index += count
  return { cards, index }
}

/** Profit for a settled bet. Ties push. Banker wins pay (1 − commission). */
export function betProfit(side: Side, stake: number, winner: Outcome, commission: number): number {
  if (winner === 'tie') return 0
  if (winner !== side) return -stake
  if (side === 'banker') return Math.round(stake * (1 - commission) * 100) / 100
  return stake
}
