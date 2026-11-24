import { useEffect, useRef, useState } from 'react'
import { dealHand, openShoe, type Outcome } from './engine'
import { binIndex, countMix, mixLine, narrateMix, readMixAsync, share, type MixStudy } from './memory'

const SHOE_COUNTS = [1000, 4000, 16000]
const CUTS = [10, 20, 30]

type LiveShoe = { cards: number[]; index: number; outcomes: Outcome[] }

export function Memory() {
  const [shoes, setShoes] = useState(4000)
  const [splitAt, setSplitAt] = useState(20)
  const [seed, setSeed] = useState(11)
  const [running, setRunning] = useState(false)
  const [progress, setProgress] = useState(0)
  const [study, setStudy] = useState<MixStudy | null>(null)
  const [live, setLive] = useState<LiveShoe>(() => dealTo(20))
  const runId = useRef(0)

  useEffect(() => {
    const id = ++runId.current
    void load(id, shoes, seed, splitAt)
    return () => {
      runId.current += 1
    }
  }, [shoes, seed, splitAt])

  async function load(id: number, count: number, sample: number, cut: number) {
    setRunning(true)
    setProgress(0)
    const produced = await readMixAsync(
      count,
      sample,
      cut,
      (fraction) => {
        if (runId.current === id) setProgress(fraction)
      },
      () => runId.current !== id,
    )
    if (runId.current !== id) return
    if (produced) setStudy(produced)
    setRunning(false)
  }

  const early = countMix(live.outcomes.slice(0, splitAt))
  const rest = countMix(live.outcomes.slice(splitAt))
  const ready = live.outcomes.length >= splitAt
  const bin = study && ready ? study.bins[binIndex(share(early, 'banker'))] : null
  const paragraphs = study ? narrateMix(study) : []
  const liveLine = live.outcomes.length === 0 ? '' : mixLine(countMix(live.outcomes))

  return (
    <section className="memory" data-testid="baccarat-memory">
      <p className="question">
        {live.outcomes.length === 0
          ? 'As a shoe is dealt, it builds a percentage of Banker, Player, and Tie. Do the hands still to come follow that mix?'
          : `This shoe is ${liveLine}. Do the hands still to come follow that mix?`}
      </p>
      <div className="mix" data-testid="mix-live">
        <MixStat label="Banker" value={share(countMix(live.outcomes), 'banker')} tone="banker" />
        <MixStat label="Player" value={share(countMix(live.outcomes), 'player')} tone="player" />
        <MixStat label="Tie" value={share(countMix(live.outcomes), 'tie')} tone="tie" />
      </div>
      <p className="hint">
        {live.outcomes.length.toLocaleString('en-US')} hands in this shoe.
        {ready ? ` The first ${splitAt} were ${mixLine(early)}.` : ` The past starts once ${splitAt} hands are dealt.`}
        {rest.hands > 0 ? ` Since then, this shoe has been ${mixLine(rest)}.` : ''}
      </p>
      {bin && bin.shoes > 0 ? (
        <p className="finding">
          Shoes whose first {splitAt} hands were {bin.label.toLowerCase()} ({bin.shoes.toLocaleString('en-US')} of them) finished the rest at {mixLine(bin.rest)}.
        </p>
      ) : null}
      <div className="run-row">
        <button type="button" className="action" data-testid="mix-next" onClick={() => setLive((current) => dealNext(current))}>
          Deal the next hand
        </button>
        <button type="button" className="action" onClick={() => setLive(dealTo(splitAt))}>
          New shoe
        </button>
      </div>
      <p className="question-sub">
        Split every shoe after{' '}
        <span className="segment" role="group" aria-label="hands before the split">
          {CUTS.map((count) => (
            <button key={count} type="button" aria-pressed={splitAt === count} onClick={() => setSplitAt(count)}>
              {count}
            </button>
          ))}
        </span>{' '}
        hands and read the rest across{' '}
        <span className="segment" role="group" aria-label="shoes">
          {SHOE_COUNTS.map((count) => (
            <button key={count} type="button" aria-pressed={shoes === count} onClick={() => setShoes(count)}>
              {count.toLocaleString('en-US')}
            </button>
          ))}
        </span>{' '}
        shoes.
      </p>
      <div className="run-row">
        <button type="button" className="action" data-testid="memory-run" disabled={running} onClick={() => setSeed(Math.floor(Math.random() * 1e9))}>
          {running ? 'Reading the shoes…' : 'Read a fresh set'}
        </button>
        {running ? (
          <div className="progress" aria-hidden="true">
            <span style={{ width: `${Math.round(progress * 100)}%` }} />
          </div>
        ) : null}
      </div>
      <p className="hint">Each shoe is eight decks, dealt until fewer than six cards remain. Ties count in the percentages and push a Banker bet.</p>

      {study ? (
        <div className="findings" data-testid="memory-results">
          {paragraphs.map((paragraph) => (
            <p key={paragraph} className="finding">
              {paragraph}
            </p>
          ))}
          <figure>
            <figcaption>
              The pale bar is Banker so far. The red bar is Banker in the hands that followed. The dashed line is {pct1(share(study.overall, 'banker'))} for the whole shoe.
            </figcaption>
            <MixChart study={study} />
          </figure>
          <div className="compare memory-table" role="table">
            <div className="compare-head" role="row">
              <span>So far</span>
              <span>Shoes</span>
              <span>Opening</span>
              <span>Rest of the shoe</span>
            </div>
            {study.bins.map((row) => (
              <div key={row.id} className="compare-row" role="row">
                <span>{row.label}</span>
                <span>{row.shoes.toLocaleString('en-US')}</span>
                <span>{row.shoes === 0 ? '—' : mixLine(row.early)}</span>
                <span>{row.shoes === 0 ? '—' : mixLine(row.rest)}</span>
              </div>
            ))}
          </div>
          <p className="hint">Opening and rest are Banker / Player / Tie. The rest is every hand after the cut in shoes that opened in that range.</p>
        </div>
      ) : null}
    </section>
  )
}

function MixStat({ label, value, tone }: { label: string; value: number; tone: string }) {
  return (
    <div className={tone}>
      <strong>{pct1(value)}</strong>
      <span>{label}</span>
    </div>
  )
}

function MixChart({ study }: { study: MixStudy }) {
  const width = 640
  const height = 220
  const yMin = 0.22
  const yMax = 0.75
  const yOf = (rate: number) => {
    const t = (Math.min(yMax, Math.max(yMin, rate)) - yMin) / (yMax - yMin)
    return height - 28 - t * (height - 52)
  }
  const left = 36
  const rows = study.bins
  const slot = (width - left) / rows.length
  const baseline = yOf(share(study.overall, 'banker'))
  return (
    <svg viewBox={`0 0 ${width} ${height}`} role="img" aria-label="Banker percentage so far and in the rest of the shoe">
      {[0.4, 0.5, 0.6].map((mark) => (
        <text key={mark} x="0" y={yOf(mark) + 4} className="tick">
          {Math.round(mark * 100)}%
        </text>
      ))}
      <line x1={left} x2={width} y1={baseline} y2={baseline} className="axis" />
      {rows.map((row, index) => {
        const x = left + index * slot
        const early = row.shoes === 0 ? 0 : share(row.early, 'banker')
        const restRate = row.shoes === 0 ? 0 : share(row.rest, 'banker')
        return (
          <g key={row.id}>
            <rect x={x + slot * 0.16} y={yOf(early)} width={slot * 0.28} height={Math.max(height - 28 - yOf(early), 0)} rx="3" fill="#d4b483" opacity={row.shoes === 0 ? 0.25 : 0.95} />
            <rect x={x + slot * 0.5} y={yOf(restRate)} width={slot * 0.28} height={Math.max(height - 28 - yOf(restRate), 0)} rx="3" fill="#c4482d" opacity={row.shoes === 0 ? 0.25 : 0.9} />
            <text x={x + slot * 0.5} y={height - 8} textAnchor="middle" className="tick">
              {row.label.startsWith('Under') ? '<40' : row.label.startsWith('60') ? '60+' : row.label.slice(0, 5)}
            </text>
          </g>
        )
      })}
    </svg>
  )
}

function pct1(n: number): string {
  return `${(n * 100).toFixed(1)}%`
}

function freshLive(): LiveShoe {
  const opened = openShoe(8, Math.random)
  return { cards: opened.cards, index: opened.index, outcomes: [] }
}

function dealNext(shoe: LiveShoe): LiveShoe {
  if (shoe.cards.length - shoe.index < 6) return dealNext(freshLive())
  const dealt = dealHand(shoe.cards, shoe.index)
  return { cards: shoe.cards, index: dealt.index, outcomes: [...shoe.outcomes, dealt.winner] }
}

function dealTo(count: number): LiveShoe {
  let shoe = freshLive()
  for (let i = 0; i < count; i++) shoe = dealNext(shoe)
  return shoe
}
