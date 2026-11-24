import { useEffect, useRef, useState } from 'react'
import {
  decisiveRate,
  narrateMemory,
  readMemoryAsync,
  runLabel,
  sidePrice,
  type MemoryResult,
  type Side,
} from './memory'

const SHOE_COUNTS = [1000, 4000, 16000]

export function Memory() {
  const [shoes, setShoes] = useState(4000)
  const [seed, setSeed] = useState(11)
  const [running, setRunning] = useState(false)
  const [progress, setProgress] = useState(0)
  const [result, setResult] = useState<MemoryResult | null>(null)
  const runId = useRef(0)

  useEffect(() => {
    const id = ++runId.current
    void load(id, shoes, seed)
    return () => {
      runId.current += 1
    }
  }, [shoes, seed])

  async function load(id: number, count: number, sample: number) {
    setRunning(true)
    setProgress(0)
    const produced = await readMemoryAsync(
      count,
      sample,
      (fraction) => {
        if (runId.current === id) setProgress(fraction)
      },
      () => runId.current !== id,
    )
    if (runId.current !== id) return
    if (produced) setResult(produced)
    setRunning(false)
  }

  const paragraphs = result ? narrateMemory(result) : []
  const decisive = result ? result.banker + result.player : 0
  const usualBanker = decisive === 0 || !result ? 0 : result.banker / decisive
  const usualPlayer = decisive === 0 || !result ? 0 : result.player / decisive

  return (
    <section className="memory" data-testid="baccarat-memory">
      <p className="question">After a run of winners, does the next hand follow the past?</p>
      <p className="question-sub">
        Ties stay on the board and do not break a run. Read the next hand after each run across{' '}
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
      <p className="hint">Each shoe is an 8-deck shoe, dealt until fewer than six cards remain. A tie pushes a bet and leaves the run as it was.</p>

      {result ? (
        <div className="findings" data-testid="memory-results">
          {paragraphs.map((paragraph) => (
            <p key={paragraph} className="finding">
              {paragraph}
            </p>
          ))}
          <div className="charts">
            <figure>
              <figcaption>After Bankers in a row, how often the next decisive hand is Banker. The dashed line is {pct1(usualBanker)} in these shoes.</figcaption>
              <RateChart result={result} side="banker" usual={usualBanker} />
            </figure>
            <figure>
              <figcaption>After Players in a row, how often the next decisive hand is Player. The dashed line is {pct1(usualPlayer)}.</figcaption>
              <RateChart result={result} side="player" usual={usualPlayer} />
            </figure>
          </div>
          <div className="compare memory-table" role="table">
            <div className="compare-head" role="row">
              <span>Past</span>
              <span>Next same side</span>
              <span>Vs usual</span>
              <span>Noise</span>
              <span>Hands</span>
              <span>Bet that side</span>
            </div>
            {result.streaks.map((row) => {
              const n = row.next.banker + row.next.player
              const same = decisiveRate(row.next, row.side)
              const usual = row.side === 'banker' ? usualBanker : usualPlayer
              const price = sidePrice(row.next, row.side)
              const gap = same - usual
              const band = n < 2 ? 0 : 2 * Math.sqrt((same * (1 - same)) / n)
              const clears = n >= 200 && Math.abs(gap) > band
              return (
                <div key={`${row.side}-${row.length}`} className={clears ? 'compare-row hot' : 'compare-row'} role="row">
                  <span>{runLabel(row.side, row.length)}</span>
                  <span>{n === 0 ? '—' : pct1(same)}</span>
                  <span>{n === 0 ? '—' : signedPoints(gap)}</span>
                  <span>{n < 2 ? '—' : `±${(band * 100).toFixed(1)} pts`}</span>
                  <span>{n.toLocaleString('en-US')}</span>
                  <span>{price.bets === 0 ? '—' : signedCents(price.centsLost)}</span>
                </div>
              )
            })}
          </div>
          <p className="hint">Hands are the next results that were not ties. Noise is how far that row can wander by chance. The last column is a $1 bet on the side of the run, and a tie pushes. A one-point swing in the win rate moves that price by about 2¢.</p>
        </div>
      ) : null}
    </section>
  )
}

function RateChart({ result, side, usual }: { result: MemoryResult; side: Side; usual: number }) {
  const rows = result.streaks.filter((row) => row.side === side)
  const width = 640
  const height = 220
  const yMin = 0.38
  const yMax = 0.64
  const yOf = (rate: number) => {
    const t = (Math.min(yMax, Math.max(yMin, rate)) - yMin) / (yMax - yMin)
    return height - 28 - t * (height - 52)
  }
  const left = 36
  const slot = (width - left) / rows.length
  const baseline = yOf(usual)
  const fill = side === 'banker' ? '#c4482d' : '#8eb4d4'
  return (
    <svg viewBox={`0 0 ${width} ${height}`} role="img" aria-label={`Next ${side} rate after runs of ${side}`}>
      {[0.4, 0.5, 0.6].map((mark) => (
        <text key={mark} x="0" y={yOf(mark) + 4} className="tick">
          {Math.round(mark * 100)}%
        </text>
      ))}
      <line x1={left} x2={width} y1={baseline} y2={baseline} className="axis" />
      {rows.map((row, index) => {
        const n = row.next.banker + row.next.player
        const rate = n === 0 ? usual : decisiveRate(row.next, side)
        const x = left + index * slot + slot * 0.22
        const y = yOf(rate)
        const bar = height - 28 - y
        return (
          <g key={row.length}>
            <rect x={x} y={y} width={slot * 0.56} height={Math.max(bar, 0)} rx="3" fill={fill} opacity={n < 200 ? 0.35 : 0.9} />
            <text x={x + slot * 0.28} y={height - 8} textAnchor="middle" className="tick">
              {row.length >= 6 ? '6+' : String(row.length)}
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

function signedPoints(gap: number): string {
  const points = (Math.abs(gap) * 100).toFixed(1)
  if (gap > 0.0005) return `+${points} pts`
  if (gap < -0.0005) return `−${points} pts`
  return '0.0 pts'
}

function signedCents(centsLost: number): string {
  const body = `${Math.abs(centsLost).toFixed(2)}¢`
  if (centsLost > 0.005) return `−${body}`
  if (centsLost < -0.005) return `+${body}`
  return body
}
