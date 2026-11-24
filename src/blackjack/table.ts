import { money, round2 } from '../lib/money'
import { insurancePrice, naturalPrice, priceActions, TRIALS } from './ev'
import {
  bjRank,
  cardText,
  isBlackjack,
  isPair,
  makeShoe,
  popCard,
  totals,
  upLabel,
} from './shoe'
import { offersFreeDouble, offersFreeSplit } from './strategy'
import type { ActionName, Card, Decision, LiveHand, Rules, Table, TicketModel, TicketRow } from './types'
import { ACTION_LABEL } from './types'

const CLOSE = 0.015

export function createTable(rules: Rules, bankroll: number, bet: number, rng: () => number): Table {
  return {
    phase: 'idle',
    shoe: makeShoe(rules.decks, rng),
    dealer: [],
    hands: [],
    active: 0,
    bet,
    bankroll,
    bankrollMark: bankroll,
    handNet: null,
    insurance: null,
    ticket: null,
    verdict: null,
    handDecisions: [],
    handsPlayed: 0,
    message: null,
  }
}

export function rulesLine(rules: Rules): string {
  return [
    `${rules.decks} decks`,
    rules.hitSoft17 ? 'dealer hits soft 17' : 'dealer stands on soft 17',
    rules.das ? 'double after split' : 'no double after split',
    rules.lateSurrender ? 'late surrender' : 'no surrender',
    rules.blackjackPays === 1.5 ? 'blackjack 3:2' : 'blackjack 6:5',
    rules.freeBet ? 'free bet' : '',
    rules.noBust ? 'no bust' : '',
  ].filter(Boolean).join(' · ')
}

export function setWager(table: Table, bet: number): Table {
  if (table.phase === 'play' || table.phase === 'insurance') return table
  return { ...table, bet: Math.max(0, round2(bet)), message: null }
}

export function addBankroll(table: Table, amount: number): Table {
  if (table.phase === 'play' || table.phase === 'insurance') return table
  return { ...table, bankroll: round2(table.bankroll + amount), message: null }
}

export function reshuffle(table: Table, rules: Rules, rng: () => number): Table {
  if (table.phase === 'play' || table.phase === 'insurance') return table
  return { ...table, shoe: makeShoe(rules.decks, rng) }
}

export function legalActions(table: Table, rules: Rules): ActionName[] {
  if (table.phase !== 'play') return []
  const hand = table.hands[table.active]
  if (!hand || !isOpen(hand)) return []
  const ranks = values(hand)
  const twoCards = hand.cards.length === 2
  if (hand.splitAces) {
    const actions: ActionName[] = []
    if (twoCards && isPair(ranks) && table.hands.length < 4 && canAffordSplit(table, hand, rules)) actions.push('P')
    actions.push('S')
    return actions
  }
  const actions: ActionName[] = ['H', 'S']
  if (twoCards && (!hand.fromSplit || rules.das) && (offersFreeDouble(ranks, rules) || table.bankroll + 1e-9 >= hand.unit)) {
    actions.push('D')
  }
  if (twoCards && isPair(ranks) && table.hands.length < 4 && canAffordSplit(table, hand, rules)) actions.push('P')
  if (twoCards && !hand.fromSplit && table.hands.length === 1 && rules.lateSurrender) actions.push('R')
  return actions
}

function canAffordSplit(table: Table, hand: LiveHand, rules: Rules): boolean {
  if (offersFreeSplit(values(hand), rules)) return true
  return table.bankroll + 1e-9 >= hand.unit
}

function standAfterAceSplit(aces: boolean, card: Card, hand: LiveHand): boolean {
  if (totals(values(hand)).total >= 21) return true
  return aces && bjRank(card.rank) !== 1
}

function actionLabel(action: ActionName, ranks: readonly number[], rules: Rules): string {
  if (action === 'D' && offersFreeDouble(ranks, rules)) return 'Free double'
  if (action === 'P' && offersFreeSplit(ranks, rules)) return 'Free split'
  return ACTION_LABEL[action]
}

export function deal(table: Table, rules: Rules, rng: () => number): Table {
  if (table.phase === 'play' || table.phase === 'insurance') return table
  const bet = round2(table.bet)
  if (bet < 1) return { ...table, message: 'Set a bet of at least $1.' }
  if (table.bankroll + 1e-9 < bet) return { ...table, message: 'The bet is larger than the bankroll.' }

  let shoe = table.shoe.length < 40 ? makeShoe(rules.decks, rng) : table.shoe
  const p1 = popCard(shoe, rules.decks, rng)
  shoe = p1.shoe
  const up = popCard(shoe, rules.decks, rng)
  shoe = up.shoe
  const p2 = popCard(shoe, rules.decks, rng)
  shoe = p2.shoe
  const hole = popCard(shoe, rules.decks, rng)
  shoe = hole.shoe

  const hand: LiveHand = {
    cards: [p1.card, p2.card],
    bet,
    winPay: bet,
    unit: bet,
    doubled: false,
    stood: false,
    surrendered: false,
    fromSplit: false,
    splitAces: false,
  }
  const next: Table = {
    ...table,
    phase: 'play',
    shoe,
    dealer: [up.card, hole.card],
    hands: [hand],
    active: 0,
    bankroll: round2(table.bankroll - bet),
    bankrollMark: table.bankroll,
    handNet: null,
    insurance: null,
    ticket: null,
    verdict: null,
    handDecisions: [],
    message: null,
  }
  if (bjRank(up.card.rank) === 1) return { ...next, phase: 'insurance' }
  if (isDealerBlackjack(next.dealer) || isBlackjack(values(hand))) return finishHand(next, rules, rng)
  return next
}

export function chooseInsurance(table: Table, take: boolean, rules: Rules, rng: () => number): Table {
  if (table.phase !== 'insurance') return table
  const bet = table.hands[0]?.bet ?? table.bet
  const unseen = unseenRanks(table)
  const price = insurancePrice(unseen, bet)
  const chosenEv = take ? price.evDollars : 0
  const bestEv = Math.max(price.evDollars, 0)
  const regret = round2(Math.max(0, bestEv - chosenEv))
  const decision: Decision = {
    hand: table.handsPlayed + 1,
    spot: 'Insurance vs Ace',
    action: take ? 'Take insurance' : 'Decline insurance',
    actionCode: take ? 'IN' : 'OUT',
    best: price.evDollars > 0.0001 ? 'Take insurance' : 'Decline insurance',
    bestCode: price.evDollars > 0.0001 ? 'IN' : 'OUT',
    evChosen: chosenEv,
    evBest: bestEv,
    regret,
    bet,
    detail: `${unseen.filter((r) => r === 10).length} tens in ${unseen.length} unseen cards`,
  }
  const next: Table = {
    ...table,
    bankroll: take ? round2(table.bankroll - bet / 2) : table.bankroll,
    insurance: take ? 'take' : 'decline',
    handDecisions: [decision],
    ticket: insuranceTicket(price.p, unseen, bet, take, regret),
    phase: 'play',
  }
  const natural = isBlackjack(values(next.hands[0]!))
  if (isDealerBlackjack(next.dealer) || natural) return finishHand(next, rules, rng)
  return next
}

export function act(
  table: Table,
  action: ActionName,
  rules: Rules,
  rng: () => number,
  trials = TRIALS,
  seed = Math.floor(Math.random() * 1e9),
): Table {
  if (table.phase !== 'play') return table
  const legal = legalActions(table, rules)
  if (!legal.includes(action)) return { ...table, message: 'That action is closed on this hand.' }
  const index = table.active
  const hand = table.hands[index]
  if (!hand) return table

  const player = values(hand)
  const dealerUp = bjRank(table.dealer[0]!.rank)
  const ev = priceActions({
    shoe: unseenRanks(table),
    player,
    dealerUp,
    rules,
    actions: legal,
    trials,
    seed,
    risk: hand.unit === 0 ? 0 : hand.bet / hand.unit,
    win: hand.unit === 0 ? 0 : hand.winPay / hand.unit,
  })
  const maxEv = Math.max(...legal.map((a) => ev[a]))
  const bestCode = legal.reduce((best, a) => (ev[a] > ev[best] ? a : best), legal[0]!)
  const regretUnits = Math.max(0, maxEv - ev[action])
  const counted = regretUnits < CLOSE ? 0 : regretUnits
  const regret = round2(counted * hand.unit)
  const decision: Decision = {
    hand: table.handsPlayed + 1,
    spot: `${sentenceHand(player)} vs ${upLabel(dealerUp)}`,
    action: actionLabel(action, player, rules),
    actionCode: action,
    best: actionLabel(bestCode, player, rules),
    bestCode,
    evChosen: ev[action],
    evBest: maxEv,
    regret,
    bet: hand.bet,
    detail: `${hand.cards.map(cardText).join(' ')} vs ${cardText(table.dealer[0]!)}`,
  }
  const ticket = actionTicket(action, player, dealerUp, legal, ev, hand.unit, trials, regret, false, rules)

  let shoe = table.shoe
  let bankroll = table.bankroll
  const hands = table.hands.map((h) => ({ ...h, cards: h.cards.slice() }))
  const current = hands[index]!

  if (action === 'R') {
    current.surrendered = true
    current.stood = true
    bankroll = round2(bankroll + current.bet / 2)
  } else if (action === 'S') {
    current.stood = true
  } else if (action === 'D') {
    const free = offersFreeDouble(values(current), rules)
    if (!free) {
      bankroll = round2(bankroll - current.unit)
      current.bet = round2(current.bet + current.unit)
    }
    current.winPay = round2(current.winPay + current.unit)
    current.doubled = true
    current.stood = true
    const drawn = popCard(shoe, rules.decks, rng)
    shoe = drawn.shoe
    current.cards = [...current.cards, drawn.card]
  } else if (action === 'H') {
    const drawn = popCard(shoe, rules.decks, rng)
    shoe = drawn.shoe
    current.cards = [...current.cards, drawn.card]
    if (totals(values(current)).total >= 21) current.stood = true
  } else {
    const [a, b] = current.cards
    const rank = bjRank(a!.rank)
    const free = offersFreeSplit(values(current), rules)
    if (!free) bankroll = round2(bankroll - current.unit)
    const d1 = popCard(shoe, rules.decks, rng)
    shoe = d1.shoe
    const d2 = popCard(shoe, rules.decks, rng)
    shoe = d2.shoe
    const aces = rank === 1
    const left: LiveHand = { ...current, cards: [a!, d1.card], fromSplit: true, splitAces: aces, doubled: false }
    const right: LiveHand = {
      ...current,
      cards: [b!, d2.card],
      fromSplit: true,
      splitAces: aces,
      doubled: false,
      stood: false,
      surrendered: false,
      bet: free ? 0 : current.unit,
      winPay: current.unit,
      unit: current.unit,
    }
    left.stood = standAfterAceSplit(aces, d1.card, left) 
    right.stood = standAfterAceSplit(aces, d2.card, right)
    hands.splice(index, 1, left, right)
  }

  let next: Table = {
    ...table,
    hands,
    shoe,
    bankroll,
    ticket,
    handDecisions: [...table.handDecisions, decision],
    message: null,
  }
  next = moveActive(next)
  if (next.hands.every((h) => !isOpen(h))) return finishHand(next, rules, rng)
  return next
}

export function studyHand(
  playerCards: [Card, Card],
  dealer: Card,
  rules: Rules,
  trials = TRIALS,
  seed = 17,
): TicketModel {
  const player = playerCards.map((c) => bjRank(c.rank))
  const dealerUp = bjRank(dealer.rank)
  const unseen = freshUnseen(rules, [...playerCards, dealer])
  if (isBlackjack(player)) {
    const worth = naturalPrice(unseen, dealerUp, 1, rules.blackjackPays)
    return {
      kicker: 'Study price · fresh shoe',
      title: `Blackjack against a dealer ${upLabel(dealerUp)}.`,
      rows: [
        {
          label: rules.blackjackPays === 1.5 ? 'Locked-in price, 3 to 2' : 'Locked-in price, 6 to 5',
          perDollar: worth,
          onBet: null,
        },
      ],
      footer: naturalFooter(unseen, dealerUp),
      note: 'There is no hit or stand. This study price is not added to the lesson.',
    }
  }
  const actions: ActionName[] = ['H', 'S', 'D']
  if (isPair(player)) actions.push('P')
  if (rules.lateSurrender) actions.push('R')
  const ev = priceActions({ shoe: unseen, player, dealerUp, rules, actions, trials, seed })
  return actionTicket('S', player, dealerUp, actions, ev, 1, trials, 0, true, rules)
}

function finishHand(table: Table, rules: Rules, rng: () => number): Table {
  const dealerBJ = isDealerBlackjack(table.dealer)
  const playerNatural = table.hands.length === 1 && !table.hands[0]!.fromSplit && isBlackjack(values(table.hands[0]!))
  let bankroll = table.bankroll
  let dealer = table.dealer
  let shoe = table.shoe
  const bet = table.hands[0]?.bet ?? table.bet

  if (table.insurance === 'take' && dealerBJ) {
    bankroll = round2(bankroll + (bet / 2) * 3)
  }

  let ticket = table.ticket
  if (playerNatural && !ticket && !table.handDecisions.some((d) => d.actionCode === 'H' || d.actionCode === 'S')) {
    const unseen = unseenRanks(table)
    const worth = naturalPrice(unseen, bjRank(dealer[0]!.rank), bet, rules.blackjackPays)
    ticket = naturalTicket(rules, worth, bet, unseen, bjRank(dealer[0]!.rank))
  }

  if (playerNatural && dealerBJ) {
    bankroll = round2(bankroll + bet)
  } else if (playerNatural && !dealerBJ) {
    bankroll = round2(bankroll + bet + bet * rules.blackjackPays)
  } else if (!dealerBJ) {
    const alive = table.hands.some((h) => !h.surrendered && totals(values(h)).total <= 21)
    if (alive) {
      const played = drawDealer(dealer, shoe, rules, rng)
      dealer = played.dealer
      shoe = played.shoe
    }
    const dealerTotal = totals(dealer.map((c) => bjRank(c.rank))).total
    for (const hand of table.hands) {
      if (hand.surrendered) continue
      const total = totals(values(hand)).total
      if (total > 21) {
        if (rules.noBust) bankroll = round2(bankroll + hand.bet)
        continue
      }
      const push = (rules.freeBet && dealerTotal === 22) || total === dealerTotal
      if (!push && (dealerTotal > 21 || total > dealerTotal)) bankroll = round2(bankroll + hand.bet + hand.winPay)
      else if (push) bankroll = round2(bankroll + hand.bet)
    }
  }

  const handNet = round2(bankroll - table.bankrollMark)
  return {
    ...table,
    bankroll,
    dealer,
    shoe,
    ticket,
    phase: 'result',
    handNet,
    verdict: verdictFor(table, handNet, playerNatural, dealerBJ),
    handsPlayed: table.handsPlayed + 1,
  }
}

function drawDealer(dealer: Card[], shoe: Card[], rules: Rules, rng: () => number): { dealer: Card[]; shoe: Card[] } {
  const cards = dealer.slice()
  let next = shoe
  let guard = 0
  while (guard++ < 12) {
    const t = totals(cards.map((c) => bjRank(c.rank)))
    const hit = t.total < 17 || (t.total === 17 && t.soft && rules.hitSoft17)
    if (!hit || t.total > 21) break
    const drawn = popCard(next, rules.decks, rng)
    next = drawn.shoe
    cards.push(drawn.card)
  }
  return { dealer: cards, shoe: next }
}

function moveActive(table: Table): Table {
  if (isOpen(table.hands[table.active]!)) return table
  const next = table.hands.findIndex((h) => isOpen(h))
  if (next === -1) return table
  return { ...table, active: next }
}

function isOpen(hand: LiveHand | undefined): boolean {
  if (!hand || hand.stood || hand.surrendered) return false
  return totals(values(hand)).total < 21
}

function isDealerBlackjack(dealer: Card[]): boolean {
  return dealer.length >= 2 && isBlackjack(dealer.map((c) => bjRank(c.rank)))
}

function values(hand: LiveHand): number[] {
  return hand.cards.map((c) => bjRank(c.rank))
}

function unseenRanks(table: Table): number[] {
  const ranks = table.shoe.map((c) => bjRank(c.rank))
  const hole = table.dealer[1]
  if (hole) ranks.push(bjRank(hole.rank))
  return ranks
}

function freshUnseen(rules: Rules, remove: Card[]): number[] {
  const bag: number[] = []
  for (let rank = 1; rank <= 9; rank++) {
    for (let i = 0; i < 4 * rules.decks; i++) bag.push(rank)
  }
  for (let i = 0; i < 16 * rules.decks; i++) bag.push(10)
  for (const card of remove) {
    const rank = bjRank(card.rank)
    const at = bag.indexOf(rank)
    if (at >= 0) bag.splice(at, 1)
  }
  return bag
}

function sentenceHand(ranks: readonly number[]): string {
  if (isPair(ranks)) {
    if (ranks[0] === 1) return 'a pair of aces'
    if (ranks[0] === 10) return 'a pair of 10s'
    return `a pair of ${ranks[0]}s`
  }
  const t = totals(ranks)
  return `${t.soft ? 'soft' : 'hard'} ${t.total}`
}

function choiceTitle(action: ActionName, ranks: readonly number[], dealerUp: number, rules: Rules): string {
  const hand = sentenceHand(ranks)
  const vs = `against a dealer ${upLabel(dealerUp)}`
  if (action === 'S') return `You stood on ${hand} ${vs}.`
  if (action === 'H') return `You hit ${hand} ${vs}.`
  if (action === 'D' && offersFreeDouble(ranks, rules)) return `You took a free double on ${hand} ${vs}.`
  if (action === 'D') return `You doubled on ${hand} ${vs}.`
  if (action === 'P' && offersFreeSplit(ranks, rules)) return `You took a free split on ${hand} ${vs}.`
  if (action === 'P') return `You split ${hand} ${vs}.`
  return `You surrendered ${hand} ${vs}.`
}

function ticketFooter(trials: number, rules: Rules): string {
  const lines = [
    `Priced from ${trials.toLocaleString('en-US')} shuffles of the unseen shoe, before the next card was drawn. Later decisions in those shuffles follow basic strategy for these rules.`,
  ]
  if (rules.freeBet) {
    lines.push('Hard 9, 10, and 11 take a free double. Every pair except tens takes a free split. A dealer 22 pushes.')
  }
  if (rules.noBust) lines.push('A player total over 21 pushes.')
  return lines.join(' ')
}

function actionTicket(
  action: ActionName,
  ranks: readonly number[],
  dealerUp: number,
  legal: readonly ActionName[],
  ev: Record<ActionName, number>,
  bet: number,
  trials: number,
  regret: number,
  study = false,
  rules?: Rules,
): TicketModel {
  const ruleSet = rules ?? {
    decks: 6,
    hitSoft17: false,
    das: true,
    lateSurrender: false,
    blackjackPays: 1.5,
    freeBet: false,
    noBust: false,
  }
  const maxEv = Math.max(...legal.map((a) => ev[a]))
  const rows: TicketRow[] = legal
    .map((code) => ({
      label: actionLabel(code, ranks, ruleSet),
      perDollar: ev[code],
      onBet: study ? null : ev[code] * bet,
      mark: undefined as TicketRow['mark'],
      code,
    }))
    .sort((a, b) => b.perDollar - a.perDollar)
    .map((row) => ({
      label: row.label,
      perDollar: row.perDollar,
      onBet: row.onBet,
      mark: !study && row.code === action ? ('you' as const) : maxEv - row.perDollar < CLOSE ? ('best' as const) : undefined,
    }))
  if (!study) {
    for (const row of rows) {
      if (row.mark === 'you' && maxEv - (row.perDollar ?? 0) < CLOSE) row.mark = 'you'
    }
  }
  const bestRows = rows.filter((row) => maxEv - (row.perDollar ?? 0) < CLOSE)
  for (const row of bestRows) {
    if (row.mark !== 'you') row.mark = 'best'
  }
  return {
    kicker: study ? 'Study price · fresh shoe' : 'Priced before the next card',
    title: study
      ? `${capitalize(sentenceHand(ranks))} against a dealer ${upLabel(dealerUp)}.`
      : choiceTitle(action, ranks, dealerUp, ruleSet),
    rows: rows.map(({ label, perDollar, onBet, mark }) => ({ label, perDollar, onBet, mark })),
    footer: ticketFooter(trials, ruleSet),
    note: study
      ? 'Nothing is recorded. The lesson only counts a choice you make before the price is shown.'
      : regret <= 0.004
        ? 'You took the best price.'
        : `You gave up ${money(regret)} of expected value.`,
  }
}

function insuranceTicket(p: number, unseen: readonly number[], bet: number, take: boolean, regret: number): TicketModel {
  const tens = unseen.filter((r) => r === 10).length
  const evDollars = (bet / 2) * (3 * p - 1)
  const rows: TicketRow[] = [
    {
      label: 'Take insurance',
      perDollar: bet === 0 ? 0 : evDollars / bet,
      onBet: evDollars,
      mark: take ? 'you' : evDollars > 0.0001 ? 'best' : undefined,
    },
    {
      label: 'Decline',
      perDollar: 0,
      onBet: 0,
      mark: !take ? 'you' : evDollars <= 0.0001 ? 'best' : undefined,
    },
  ]
  if (evDollars <= 0.0001 && !take) rows[1]!.mark = 'you'
  if (evDollars > 0.0001 && take) rows[0]!.mark = 'you'
  return {
    kicker: 'Before the hole card is shown',
    title: take ? 'You took insurance against a dealer ace.' : 'You declined insurance against a dealer ace.',
    rows,
    footer: `${tens} of ${unseen.length} unseen cards are tens. Insurance is a winning price above one third.`,
    note: regret <= 0.004 ? 'You took the best price.' : `You gave up ${money(regret)} of expected value.`,
  }
}

function naturalTicket(rules: Rules, worth: number, bet: number, unseen: readonly number[], dealerUp: number): TicketModel {
  return {
    kicker: 'No choice on a blackjack',
    title: `Blackjack against a dealer ${upLabel(dealerUp)}.`,
    rows: [
      {
        label: rules.blackjackPays === 1.5 ? 'Pays 3 to 2' : 'Pays 6 to 5',
        perDollar: bet === 0 ? 0 : worth / bet,
        onBet: worth,
      },
    ],
    footer: naturalFooter(unseen, dealerUp),
    note: 'The price was locked in when the cards were dealt.',
  }
}

function naturalFooter(unseen: readonly number[], dealerUp: number): string {
  if (dealerUp !== 1 && dealerUp !== 10) return 'This upcard leaves the dealer without a blackjack. The price is the full bonus.'
  const need = dealerUp === 1 ? 'ten' : 'ace'
  const rank = dealerUp === 1 ? 10 : 1
  const count = unseen.filter((r) => r === rank).length
  return `${count} unseen ${need}${count === 1 ? '' : 's'} can still make a dealer blackjack, which pushes the hand.`
}

function verdictFor(table: Table, handNet: number, playerNatural: boolean, dealerBJ: boolean): string {
  const gaveUp = round2(table.handDecisions.reduce((sum, d) => sum + d.regret, 0))
  const decided = table.handDecisions.length > 0
  const allBest = !decided || gaveUp <= 0.004
  if (!decided && playerNatural && dealerBJ) return 'Both have blackjack. The hand pushes.'
  if (!decided && playerNatural) return 'Blackjack. There was no decision to price.'
  if (!decided && dealerBJ) return 'Dealer blackjack. The hand never reached a decision.'
  if (table.insurance === 'take' && dealerBJ && gaveUp > 0.004) {
    return `You gave up ${money(gaveUp)}. Insurance paid for the hand this time.`
  }
  if (allBest && handNet < -0.004) return 'Best decision. The hand still lost.'
  if (allBest && handNet > 0.004) return 'Best decision. The hand won.'
  if (allBest) return 'Best decision. The hand pushed.'
  if (handNet < -0.004) return `You gave up ${money(gaveUp)}. The hand lost ${money(Math.abs(handNet))}.`
  if (handNet > 0.004) return `You gave up ${money(gaveUp)}. The hand won anyway.`
  return `You gave up ${money(gaveUp)}. The hand pushed.`
}

function capitalize(text: string): string {
  return text.charAt(0).toUpperCase() + text.slice(1)
}
