import { money, pct, round2 } from '../lib/money'
import { mulberry32 } from '../lib/rng'
import { betProfit, dealHand, openShoe, type Outcome, type Side } from './engine'

export type SystemName = 'flat' | 'martingale' | 'follow'

export type SimConfig = {
  bankroll: number
  base: number
  target: number
  stop: number
  tableMin: number
  tableMax: number
  commission: number
  side: Side
  decks: number
  sessions: number
  systems: SystemName[]
  seed: number
  maxHands: number
}

export type EndReason = 'target' | 'stop' | 'broke' | 'cap'

export type SystemResult = {
  name: SystemName
  reasons: Record<EndReason, number>
  totalPnl: number
  meanPnl: number
  ahead: number
  wagered: number
  profit: number
  clipped: number
  bets: number
  pnls: number[]
  paths: number[][]
  hands: number[]
}

export type SimResult = {
  config: SimConfig
  systems: SystemResult[]
  sample: Outcome[]
  sampleHands: number
}

export const SYSTEM_LABEL: Record<SystemName, string> = {
  flat: 'Flat',
  martingale: 'Martingale',
  follow: 'Follow the shoe',
}

export function runSimulation(config: SimConfig, onProgress?: (fraction: number) => void): SimResult {
  const rng = mulberry32(config.seed)
  const systems = config.systems.map((name) => emptyResult(name))
  let sample: Outcome[] = []
  let sampleHands = 0

  for (let s = 0; s < config.sessions; s++) {
    const outcomes = shoeStream(config.decks, config.maxHands, rng)
    if (s === 0) sample = outcomes
    systems.forEach((result, i) => {
      const played = playSession(outcomes, config, config.systems[i]!)
      absorb(result, played, s < 36)
      if (s === 0 && config.systems[i] === 'flat') sampleHands = played.hands
    })
    if (onProgress && s % 40 === 0) onProgress(s / config.sessions)
  }
  if (onProgress) onProgress(1)
  if (sampleHands === 0) sampleHands = sample.length
  return { config, systems, sample, sampleHands }
}

export async function runSimulationAsync(
  config: SimConfig,
  onProgress: (fraction: number) => void,
  cancelled: () => boolean,
): Promise<SimResult | null> {
  const rng = mulberry32(config.seed)
  const systems = config.systems.map((name) => emptyResult(name))
  let sample: Outcome[] = []
  let sampleHands = 0
  for (let s = 0; s < config.sessions; s++) {
    if (cancelled()) return null
    const outcomes = shoeStream(config.decks, config.maxHands, rng)
    if (s === 0) sample = outcomes
    systems.forEach((result, i) => {
      const played = playSession(outcomes, config, config.systems[i]!)
      absorb(result, played, s < 36)
      if (s === 0 && config.systems[i] === 'flat') sampleHands = played.hands
    })
    if (s % 25 === 0) {
      onProgress(s / config.sessions)
      await new Promise((resolve) => setTimeout(resolve, 0))
    }
  }
  onProgress(1)
  if (sampleHands === 0) sampleHands = sample.length
  return { config, systems, sample, sampleHands }
}

type Played = {
  reason: EndReason
  pnl: number
  path: number[]
  hands: number
  wagered: number
  profit: number
  clipped: number
  bets: number
}

export function playSession(outcomes: readonly Outcome[], config: SimConfig, system: SystemName): Played {
  let bank = config.bankroll
  const start = bank
  let bet = config.base
  let side: Side = config.side
  let wagered = 0
  let profit = 0
  let clipped = 0
  let bets = 0
  const path = [bank]
  let hands = 0

  const finish = (reason: EndReason): Played => ({
    reason,
    pnl: round2(bank - start),
    path: downsample(path, 48),
    hands,
    wagered,
    profit,
    clipped,
    bets,
  })

  for (const outcome of outcomes) {
    if (bank + 1e-9 < config.tableMin) return finish('broke')
    const prescribed = system === 'martingale' ? bet : config.base
    let stake = Math.min(prescribed, config.tableMax, bank)
    stake = round2(stake)
    if (stake + 1e-9 < config.tableMin) return finish('broke')
    if (stake + 0.001 < prescribed) clipped += 1
    const delta = betProfit(side, stake, outcome, config.commission)
    bank = round2(bank + delta)
    wagered += stake
    profit += delta
    bets += 1
    hands += 1
    path.push(bank)
    if (bank >= start + config.target - 1e-9) return finish('target')
    if (bank <= start - config.stop + 1e-9) return finish('stop')
    if (system === 'martingale') {
      if (outcome === 'tie') {
        /* The same stake repeats. */
      } else if (delta > 0) bet = config.base
      else bet = round2(stake * 2)
    } else if (system === 'follow' && outcome !== 'tie') {
      side = outcome
    }
  }
  return finish('cap')
}

function shoeStream(decks: number, hands: number, rng: () => number): Outcome[] {
  let shoe = openShoe(decks, rng)
  const out: Outcome[] = []
  for (let h = 0; h < hands; h++) {
    if (shoe.cards.length - shoe.index < 6) shoe = openShoe(decks, rng)
    const dealt = dealHand(shoe.cards, shoe.index)
    shoe = { cards: shoe.cards, index: dealt.index }
    out.push(dealt.winner)
  }
  return out
}

function emptyResult(name: SystemName): SystemResult {
  return {
    name,
    reasons: { target: 0, stop: 0, broke: 0, cap: 0 },
    totalPnl: 0,
    meanPnl: 0,
    ahead: 0,
    wagered: 0,
    profit: 0,
    clipped: 0,
    bets: 0,
    pnls: [],
    paths: [],
    hands: [],
  }
}

function absorb(result: SystemResult, played: Played, keepPath: boolean): void {
  result.reasons[played.reason] += 1
  result.totalPnl += played.pnl
  result.wagered += played.wagered
  result.profit += played.profit
  result.clipped += played.clipped
  result.bets += played.bets
  if (played.pnl > 0.004) result.ahead += 1
  result.pnls.push(played.pnl)
  result.hands.push(played.hands)
  if (keepPath) result.paths.push(played.path)
  result.meanPnl = result.totalPnl / result.pnls.length
}

function downsample(path: number[], max: number): number[] {
  if (path.length <= max) return path.slice()
  const out: number[] = []
  for (let i = 0; i < max; i++) {
    const idx = Math.round((i * (path.length - 1)) / (max - 1))
    out.push(path[idx] ?? path[path.length - 1]!)
  }
  return out
}

export function narrate(result: SimResult): string[] {
  const { config } = result
  const paragraphs: string[] = []
  const flat = result.systems.find((s) => s.name === 'flat') ?? result.systems[0]
  if (!flat) return paragraphs
  const n = flat.pnls.length
  const targetRate = flat.reasons.target / n
  const stopRate = flat.reasons.stop / n
  const brokeRate = flat.reasons.broke / n
  const capRate = flat.reasons.cap / n
  const sideText = flat.name === 'follow' ? 'following the shoe' : `on ${config.side === 'banker' ? 'Banker' : 'Player'}`
  paragraphs.push(
    `${SYSTEM_LABEL[flat.name]} betting ${sideText} reached ${signedTarget(config.target)} in ${pct(targetRate)} of ${n.toLocaleString('en-US')} sessions and a ${signedTarget(-config.stop)} stop in ${pct(stopRate)}.${brokeRate > 0.005 ? ` ${pct(brokeRate)} ended broke.` : ''}${capRate > 0.005 ? ` ${pct(capRate)} were still going after ${config.maxHands} hands.` : ''}`,
  )
  paragraphs.push(
    `Those sessions finished ${flat.totalPnl < 0 ? 'down' : 'up'} ${money(Math.abs(flat.totalPnl))} altogether — ${edgePhrase(flat)}.`,
  )
  const others = result.systems.filter((s) => s !== flat)
  for (const system of others) {
    const ahead = system.ahead / system.pnls.length
    const clip = system.bets === 0 ? 0 : system.clipped / system.bets
    const moneyLine = `${SYSTEM_LABEL[system.name]} finished ahead in ${pct(ahead)} of sessions and ${system.totalPnl < 0 ? 'lost' : 'made'} ${money(Math.abs(system.totalPnl))} in total.`
    const clipNote =
      system.name === 'martingale' && clip > 0.005
        ? ` The $${config.tableMax} table maximum clipped ${pct(clip)} of its bets, which is where the progression stops recovering.`
        : ''
    paragraphs.push(`${moneyLine} ${edgePhrase(system)}.${clipNote}`)
  }
  if (result.systems.length > 1) {
    const richestSessions = [...result.systems].sort((a, b) => b.ahead / b.pnls.length - a.ahead / a.pnls.length)[0]
    const poorest = [...result.systems].sort((a, b) => a.totalPnl - b.totalPnl)[0]
    if (richestSessions && poorest && richestSessions.name !== poorest.name && poorest.totalPnl < 0) {
      paragraphs.push(
        `${SYSTEM_LABEL[richestSessions.name]} won the most sessions. ${SYSTEM_LABEL[poorest.name]} lost the most money. A system can produce a lot of winning sessions and still lose overall.`,
      )
    }
  }
  return paragraphs
}

function signedTarget(amount: number): string {
  const abs = Math.abs(amount)
  const body = Number.isInteger(abs) ? `$${abs}` : money(abs)
  return amount < 0 ? `−${body}` : `+${body}`
}

function edgePhrase(system: SystemResult): string {
  if (system.wagered < 1) return 'with too little wagered to read an edge'
  const edge = -system.profit / system.wagered
  const cents = Math.abs(edge * 100).toFixed(2)
  return edge >= 0 ? `${cents}¢ lost per dollar bet` : `${cents}¢ won per dollar bet`
}

export function defaultConfig(): SimConfig {
  return {
    bankroll: 500,
    base: 25,
    target: 100,
    stop: 200,
    tableMin: 25,
    tableMax: 100,
    commission: 0.05,
    side: 'banker',
    decks: 8,
    sessions: 2000,
    systems: ['flat', 'martingale', 'follow'],
    seed: 1,
    maxHands: 300,
  }
}
