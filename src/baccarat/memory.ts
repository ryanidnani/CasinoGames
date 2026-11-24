import { pct } from '../lib/money'
import { mulberry32 } from '../lib/rng'
import { dealHand, openShoe, type Outcome } from './engine'

export type Mix = { banker: number; player: number; tie: number; hands: number }

export type MixBin = {
  id: string
  label: string
  min: number
  max: number
  shoes: number
  early: Mix
  rest: Mix
}

export type MixStudy = {
  shoes: number
  splitAt: number
  used: number
  overall: Mix
  bins: MixBin[]
}

export const MIX_BINS: { id: string; label: string; min: number; max: number }[] = [
  { id: 'under40', label: 'Under 40% Banker', min: 0, max: 0.4 },
  { id: '40', label: '40–45% Banker', min: 0.4, max: 0.45 },
  { id: '45', label: '45–50% Banker', min: 0.45, max: 0.5 },
  { id: '50', label: '50–55% Banker', min: 0.5, max: 0.55 },
  { id: '55', label: '55–60% Banker', min: 0.55, max: 0.6 },
  { id: '60', label: '60% Banker or more', min: 0.6, max: 1.0001 },
]

export function emptyMix(): Mix {
  return { banker: 0, player: 0, tie: 0, hands: 0 }
}

export function countMix(outcomes: readonly Outcome[]): Mix {
  const mix = emptyMix()
  for (const outcome of outcomes) mix[outcome] += 1
  mix.hands = outcomes.length
  return mix
}

export function share(mix: Mix, side: keyof Omit<Mix, 'hands'>): number {
  return mix.hands === 0 ? 0 : mix[side] / mix.hands
}

export function binIndex(bankerShare: number): number {
  const found = MIX_BINS.findIndex((bin, index) => {
    const end = index === MIX_BINS.length - 1 ? bankerShare <= bin.max : bankerShare < bin.max
    return bankerShare >= bin.min && end
  })
  return found === -1 ? MIX_BINS.length - 1 : found
}

export function emptyStudy(splitAt: number): MixStudy {
  return {
    shoes: 0,
    splitAt,
    used: 0,
    overall: emptyMix(),
    bins: MIX_BINS.map((bin) => ({ ...bin, shoes: 0, early: emptyMix(), rest: emptyMix() })),
  }
}

/** Record one shoe. The opening `splitAt` hands are the past. The rest is the future. */
export function observeShoe(study: MixStudy, outcomes: readonly Outcome[]): void {
  study.shoes += 1
  if (outcomes.length < study.splitAt + 15) return
  const early = countMix(outcomes.slice(0, study.splitAt))
  const rest = countMix(outcomes.slice(study.splitAt))
  const bin = study.bins[binIndex(share(early, 'banker'))]!
  addMix(bin.early, early)
  addMix(bin.rest, rest)
  bin.shoes += 1
  addMix(study.overall, countMix(outcomes))
  study.used += 1
}

export function readMix(shoes: number, seed: number, splitAt: number, decks = 8): MixStudy {
  const rng = mulberry32(seed)
  const study = emptyStudy(splitAt)
  for (let i = 0; i < shoes; i++) observeShoe(study, dealShoe(decks, rng))
  return study
}

export async function readMixAsync(
  shoes: number,
  seed: number,
  splitAt: number,
  onProgress: (fraction: number) => void,
  cancelled: () => boolean,
  decks = 8,
): Promise<MixStudy | null> {
  const rng = mulberry32(seed)
  const study = emptyStudy(splitAt)
  for (let i = 0; i < shoes; i++) {
    if (cancelled()) return null
    observeShoe(study, dealShoe(decks, rng))
    if (i % 40 === 0) {
      onProgress(i / shoes)
      await new Promise((resolve) => setTimeout(resolve, 0))
    }
  }
  onProgress(1)
  return study
}

/** House take on a Banker bet, in cents per dollar. Ties are wagers that push. */
export function bankerCents(mix: Mix): number {
  if (mix.hands === 0) return 0
  const profit = mix.banker * 0.95 - mix.player
  return (-profit / mix.hands) * 100
}

export function narrateMix(study: MixStudy): string[] {
  if (study.used === 0) return ['These shoes were too short to split into a past and a future.']
  const lines = [
    `Across ${study.used.toLocaleString('en-US')} shoes, the full shoe was ${mixLine(study.overall)}. A $1 Banker bet on every hand ${took(bankerCents(study.overall))} per dollar.`,
  ]
  const hot = study.bins[study.bins.length - 1]!
  const cold = study.bins[0]!
  if (hot.shoes >= 20) {
    lines.push(
      `When the first ${study.splitAt} hands were ${hot.label.toLowerCase()} — ${mixLine(hot.early)} in ${hot.shoes.toLocaleString('en-US')} shoes — the rest of the shoe was ${mixLine(hot.rest)}.`,
    )
    lines.push(carrySentence(hot, study.overall))
    lines.push(
      `Betting Banker on those remaining hands ${took(bankerCents(hot.rest))} per dollar. Betting Banker on the whole shoe ${took(bankerCents(study.overall))} per dollar.`,
    )
  }
  if (cold.shoes >= 20) {
    lines.push(
      `When the opening was ${cold.label.toLowerCase()} (${mixLine(cold.early)}), the rest was ${mixLine(cold.rest)}.`,
    )
  }
  return lines
}

export function mixLine(mix: Mix): string {
  return `${pct(share(mix, 'banker'))} Banker, ${pct(share(mix, 'player'))} Player, ${pct(share(mix, 'tie'))} Tie`
}

function carrySentence(bin: MixBin, overall: Mix): string {
  const restRate = share(bin.rest, 'banker')
  const usual = share(overall, 'banker')
  const gap = restRate - usual
  const n = bin.rest.hands
  const band = n < 2 ? 1 : 2 * Math.sqrt((restRate * (1 - restRate)) / n)
  const points = `${(Math.abs(gap) * 100).toFixed(1)} points ${gap > 0.0005 ? 'toward Banker' : gap < -0.0005 ? 'toward Player' : 'from the usual rate'}`
  if (n >= 200 && Math.abs(gap) <= band) {
    return `The rest sat ${points} from the shoe’s usual Banker rate, inside the sampling noise of about ±${(band * 100).toFixed(1)} points. The opening percentage did not carry forward.`
  }
  if (n >= 200 && Math.abs(gap) > band) {
    return `The rest sat ${points} from the shoe’s usual Banker rate, outside the sampling noise of about ±${(band * 100).toFixed(1)} points.`
  }
  return `That opening showed up ${n.toLocaleString('en-US')} hands later, too few to read a rate from it.`
}

function took(centsLost: number): string {
  const body = `${Math.abs(centsLost).toFixed(2)}¢`
  return `${centsLost < -0.005 ? 'won' : 'lost'} ${body}`
}

function addMix(into: Mix, extra: Mix): void {
  into.banker += extra.banker
  into.player += extra.player
  into.tie += extra.tie
  into.hands += extra.hands
}

function dealShoe(decks: number, rng: () => number): Outcome[] {
  const shoe = openShoe(decks, rng)
  const out: Outcome[] = []
  let index = shoe.index
  while (shoe.cards.length - index >= 6) {
    const dealt = dealHand(shoe.cards, index)
    index = dealt.index
    out.push(dealt.winner)
  }
  return out
}
