import { useEffect, useRef, useState } from 'react'
import { money, pct } from '../lib/money'
import { Memory } from './Memory'
import {
  defaultConfig,
  narrate,
  runSimulationAsync,
  SYSTEM_LABEL,
  type SimConfig,
  type SimResult,
  type SystemName,
} from './simulate'

const COLORS: Record<SystemName, string> = {
  flat: '#d4b483',
  martingale: '#e25b32',
  follow: '#9ec7b2',
}

export function Baccarat() {
  const defaults = defaultConfig()
  const [bankroll, setBankroll] = useState(defaults.bankroll)
  const [base, setBase] = useState(defaults.base)
  const [target, setTarget] = useState(defaults.target)
  const [stop, setStop] = useState(defaults.stop)
  const [tableMin, setTableMin] = useState(defaults.tableMin)
  const [tableMax, setTableMax] = useState(defaults.tableMax)
  const [side, setSide] = useState(defaults.side)
  const [sessions, setSessions] = useState(defaults.sessions)
  const [systems, setSystems] = useState<SystemName[]>(defaults.systems)
  const [running, setRunning] = useState(false)
  const [progress, setProgress] = useState(0)
  const [result, setResult] = useState<SimResult | null>(null)
  const runId = useRef(0)

  useEffect(() => () => {
    runId.current += 1
  }, [])

  const config: SimConfig = {
    ...defaults,
    bankroll,
    base,
    target,
    stop,
    tableMin,
    tableMax,
    side,
    sessions,
    systems,
    seed: 1,
  }
  const issue = validate(config)

  async function run() {
    if (issue || running) return
    const id = ++runId.current
    setRunning(true)
    setProgress(0)
    const next = { ...config, seed: Math.floor(Math.random() * 1e9) }
    const produced = await runSimulationAsync(next, (fraction) => {
      if (runId.current === id) setProgress(fraction)
    }, () => runId.current !== id)
    if (runId.current !== id) return
    if (produced) setResult(produced)
    setRunning(false)
  }

  function toggle(name: SystemName) {
    setSystems((current) => (current.includes(name) ? current.filter((item) => item !== name) : [...current, name]))
  }

  const paragraphs = result ? narrate(result) : []

  return (
    <div className="lab">
      <p className="question">
        If you start with <Money value={bankroll} onChange={setBankroll} label="starting bankroll" />
        {', bet '}
        <Money value={base} onChange={setBase} label="bet size" />
        {' on '}
        <select className="blank" aria-label="bet side" value={side} onChange={(event) => setSide(event.target.value as SimConfig['side'])}>
          <option value="banker">Banker</option>
          <option value="player">Player</option>
        </select>
        {', and walk away when you are up '}
        <Money value={target} onChange={setTarget} label="win target" />
        {', how often do you hit that target before losing '}
        <Money value={stop} onChange={setStop} label="stop loss" />?
      </p>
      <p className="question-sub">
        Table limits <Money value={tableMin} onChange={setTableMin} label="table minimum" />
        {' to '}
        <Money value={tableMax} onChange={setTableMax} label="table maximum" />. Run{' '}
        <span className="segment" role="group" aria-label="sessions">
          {[500, 2000, 10000].map((count) => (
            <button key={count} type="button" aria-pressed={sessions === count} onClick={() => setSessions(count)}>
              {count.toLocaleString('en-US')}
            </button>
          ))}
        </span>{' '}
        sessions of{' '}
        <button type="button" className="inline-toggle" aria-pressed={systems.includes('flat')} onClick={() => toggle('flat')}>
          {SYSTEM_LABEL.flat}
        </button>
        {', '}
        <button type="button" className="inline-toggle" aria-pressed={systems.includes('martingale')} onClick={() => toggle('martingale')}>
          {SYSTEM_LABEL.martingale}
        </button>
        {', and '}
        <button type="button" className="inline-toggle" aria-pressed={systems.includes('follow')} onClick={() => toggle('follow')}>
          {SYSTEM_LABEL.follow}
        </button>
        .
      </p>
      <div className="run-row">
        <button type="button" className="action primary" data-testid="baccarat-run" disabled={Boolean(issue) || running} onClick={() => void run()}>
          {running ? 'Running the same shoes…' : 'Run the same shoes'}
        </button>
        {running ? (
          <div className="progress" aria-hidden="true">
            <span style={{ width: `${Math.round(progress * 100)}%` }} />
          </div>
        ) : null}
      </div>
      {issue ? <p className="message">{issue}</p> : <p className="hint">Flat, Martingale, and Follow the shoe play identical shoes. Banker wins pay 95¢ on the dollar. Ties push. A session also stops after 300 hands.</p>}

      {result ? (
        <div className="findings" data-testid="baccarat-results">
          {paragraphs.map((paragraph) => (
            <p key={paragraph} className="finding">
              {paragraph}
            </p>
          ))}
          <div className="compare" role="table">
            <div className="compare-head" role="row">
              <span>System</span>
              <span>Hit target</span>
              <span>Hit stop</span>
              <span>Sessions ahead</span>
              <span>Total</span>
              <span>Per $1 bet</span>
            </div>
            {result.systems.map((system) => {
              const n = system.pnls.length
              const edge = system.wagered > 0 ? -system.profit / system.wagered : 0
              return (
                <div key={system.name} className="compare-row" role="row">
                  <span>
                    <i style={{ background: COLORS[system.name] }} />
                    {SYSTEM_LABEL[system.name]}
                  </span>
                  <span>{pct(system.reasons.target / n)}</span>
                  <span>{pct((system.reasons.stop + system.reasons.broke) / n)}</span>
                  <span>{pct(system.ahead / n)}</span>
                  <span>{money(system.totalPnl)}</span>
                  <span>{edge >= 0 ? '−' : '+'}{(Math.abs(edge) * 100).toFixed(2)}¢</span>
                </div>
              )
            })}
          </div>
          <div className="charts">
            <figure>
              <figcaption>Average bankroll on the shared shoes. Faint lines are individual sessions.</figcaption>
              <Paths systems={result.systems} start={result.config.bankroll} />
            </figure>
            <figure>
              <figcaption>Where a session ends. Results pile up at the target and at the stop.</figcaption>
              <Histogram systems={result.systems} />
            </figure>
          </div>
          <div className="road">
            <p>One shared shoe. {SYSTEM_LABEL[result.systems[0]?.name ?? 'flat']} played {result.sampleHands} hands of it.</p>
            <div className="beads" aria-hidden="true">
              {result.sample.slice(0, Math.min(result.sampleHands, 78)).map((outcome, index) => (
                <span key={index} className={`bead ${outcome}`}>
                  {outcome === 'banker' ? 'B' : outcome === 'player' ? 'P' : 'T'}
                </span>
              ))}
            </div>
          </div>
        </div>
      ) : null}
      <Memory />
    </div>
  )
}

function Money({ value, onChange, label }: { value: number; onChange: (value: number) => void; label: string }) {
  return (
    <span className="nowrap">{'$'}<NumberField value={value} onChange={onChange} label={label} /></span>
  )
}

function NumberField({ value, onChange, label }: { value: number; onChange: (value: number) => void; label: string }) {
  return (
    <input
      className="blank"
      aria-label={label}
      inputMode="numeric"
      value={Number.isFinite(value) ? String(value) : ''}
      onChange={(event) => {
        const next = Number(event.target.value)
        if (Number.isFinite(next)) onChange(Math.max(0, Math.round(next)))
      }}
    />
  )
}

function validate(config: SimConfig): string | null {
  if (config.systems.length === 0) return 'Choose at least one system.'
  if (config.base > config.bankroll) return 'The bet is larger than the bankroll.'
  if (config.base < config.tableMin) return 'The bet is below the table minimum.'
  if (config.base > config.tableMax) return 'The bet is above the table maximum.'
  if (config.tableMin > config.tableMax) return 'The table minimum is above the maximum.'
  if (config.target <= 0) return 'Set a win target above zero.'
  if (config.stop <= 0) return 'Set a stop-loss above zero.'
  if (config.base < 1) return 'Set a bet of at least $1.'
  return null
}

function Paths({ systems, start }: { systems: SimResult['systems']; start: number }) {
  const width = 640
  const height = 220
  const paths = systems.flatMap((system) => system.paths)
  const values = paths.flat()
  if (values.length === 0) return null
  const min = Math.min(...values, start)
  const max = Math.max(...values, start)
  const span = Math.max(max - min, 1)
  const yOf = (value: number) => height - 16 - ((value - min) / span) * (height - 32)
  const startY = yOf(start)
  return (
    <svg viewBox={`0 0 ${width} ${height}`} role="img" aria-label="Bankroll paths for each betting system">
      <line x1="0" x2={width} y1={startY} y2={startY} className="axis" />
      {systems.map((system) =>
        system.paths.map((path, index) => (
          <path key={`${system.name}-${index}`} d={line(path, width, yOf)} stroke={COLORS[system.name]} className="faint" />
        )),
      )}
      {systems.map((system) => (
        <path key={system.name} d={line(averagePath(system.paths), width, yOf)} stroke={COLORS[system.name]} className="mean" />
      ))}
    </svg>
  )
}

function Histogram({ systems }: { systems: SimResult['systems'] }) {
  const width = 640
  const height = 220
  const values = systems.flatMap((system) => system.pnls)
  if (values.length === 0) return null
  let min = Math.min(...values)
  let max = Math.max(...values)
  if (min === max) {
    min -= 1
    max += 1
  }
  const bins = 26
  const step = (max - min) / bins
  const series = systems.map((system) => {
    const counts = Array.from({ length: bins }, () => 0)
    for (const value of system.pnls) {
      let bin = Math.floor((value - min) / step)
      if (bin >= bins) bin = bins - 1
      if (bin < 0) bin = 0
      counts[bin] += 1
    }
    return counts
  })
  const peak = Math.max(...series.flat(), 1)
  const zero = Math.min(bins - 1, Math.max(0, Math.floor((0 - min) / step)))
  return (
    <svg viewBox={`0 0 ${width} ${height}`} role="img" aria-label="Histogram of session results">
      {series.map((counts, seriesIndex) => (
        <path key={systems[seriesIndex]!.name} d={area(counts, peak, width, height)} fill={COLORS[systems[seriesIndex]!.name]} opacity="0.55" />
      ))}
      <line x1={(zero / bins) * width} x2={(zero / bins) * width} y1="8" y2={height - 8} className="axis" />
    </svg>
  )
}

function line(path: number[], width: number, yOf: (value: number) => number): string {
  if (path.length === 0) return ''
  return path
    .map((value, index) => {
      const x = path.length === 1 ? width / 2 : (index / (path.length - 1)) * width
      return `${index === 0 ? 'M' : 'L'}${x.toFixed(1)} ${yOf(value).toFixed(1)}`
    })
    .join(' ')
}

function area(counts: number[], peak: number, width: number, height: number): string {
  const step = width / Math.max(counts.length - 1, 1)
  let d = `M 0 ${height}`
  counts.forEach((count, index) => {
    const x = index * step
    const y = height - 12 - (count / peak) * (height - 24)
    d += ` L ${x.toFixed(1)} ${y.toFixed(1)}`
  })
  return `${d} L ${width} ${height} Z`
}

function averagePath(paths: number[][]): number[] {
  if (paths.length === 0) return []
  const n = 24
  const sums = Array.from({ length: n }, () => 0)
  for (const path of paths) {
    for (let i = 0; i < n; i++) {
      const index = Math.round((i * (path.length - 1)) / (n - 1))
      sums[i] += path[index] ?? path[path.length - 1] ?? 0
    }
  }
  return sums.map((sum) => sum / paths.length)
}
