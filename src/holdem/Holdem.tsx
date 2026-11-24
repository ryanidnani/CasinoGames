import { useEffect, useMemo, useState } from 'react'
import { money, pct } from '../lib/money'
import { Ticket } from '../components/Ticket'
import { RANKS, SUITS, cardText, rankLabel, type PCard, type Suit } from './cards'
import { betShape, priceCall, type Equity } from './equity'
import { gridKeys, tightRange, wideRange } from './range'

const CELLS = gridKeys()

export function Holdem() {
  const [hero, setHero] = useState<[PCard, PCard]>([
    { rank: 14, suit: 'h' },
    { rank: 13, suit: 'h' },
  ])
  const [board, setBoard] = useState<(PCard | null)[]>([
    { rank: 12, suit: 'h' },
    { rank: 7, suit: 'h' },
    { rank: 2, suit: 'c' },
    null,
    null,
  ])
  const [pot, setPot] = useState(100)
  const [bet, setBet] = useState(50)
  const [tight, setTight] = useState<string[]>(tightRange)
  const [wide, setWide] = useState<string[]>(wideRange)
  const [editing, setEditing] = useState<'tight' | 'wide'>('wide')
  const [slot, setSlot] = useState<'h0' | 'h1' | 'b0' | 'b1' | 'b2' | 'b3' | 'b4'>('h0')
  const [priced, setPriced] = useState<null | { tight: Priced; wide: Priced }>(null)

  const boardCards = useMemo(() => board.filter((card): card is PCard => card != null), [board])
  const dead = useMemo(() => [...hero, ...boardCards], [hero, boardCards])
  const shape = betShape(pot, bet)
  const required = pot + 2 * bet <= 0 ? 0 : bet / (pot + 2 * bet)

  useEffect(() => {
    let cancel = false
    const timer = window.setTimeout(() => {
      const shared = { hero, board: boardCards, potBeforeBet: pot, bet, trials: 5000, seed: 11 }
      const next = {
        tight: priceCall({ ...shared, range: tight }),
        wide: priceCall({ ...shared, range: wide }),
      }
      if (!cancel) setPriced(next)
    }, 40)
    return () => {
      cancel = true
      window.clearTimeout(timer)
    }
  }, [hero, boardCards, pot, bet, tight, wide])

  function assign(card: PCard) {
    if (dead.some((used) => used.rank === card.rank && used.suit === card.suit && !isCurrentSlot(card))) return
    if (slot === 'h0') setHero([card, hero[1]])
    else if (slot === 'h1') setHero([hero[0], card])
    else setBoard((current) => current.map((existing, index) => (index === Number(slot.slice(1)) ? card : existing)))
  }

  function isCurrentSlot(card: PCard): boolean {
    const current = slot === 'h0' ? hero[0] : slot === 'h1' ? hero[1] : board[Number(slot.slice(1))]
    return current?.rank === card.rank && current.suit === card.suit
  }

  function toggle(key: string) {
    const update = editing === 'tight' ? setTight : setWide
    update((current) => (current.includes(key) ? current.filter((item) => item !== key) : [...current, key]))
  }

  const active = editing === 'tight' ? tight : wide
  const headline = priced ? comparison(priced.tight.ev, priced.wide.ev) : 'Pricing the call against both ranges.'

  return (
    <div className="layout holdem">
      <section className="play">
        <p className="question">
          You hold {cardText(hero[0])} {cardText(hero[1])}
          {boardCards.length ? ` on ${boardCards.map(cardText).join(' ')}` : ' before the flop'} and face {shape}. Calling needs {pct(required)}{' '}
          equity.
        </p>
        <div className="slots">
          <SlotButton label="You" selected={slot === 'h0'} card={hero[0]} onClick={() => setSlot('h0')} />
          <SlotButton label="You" selected={slot === 'h1'} card={hero[1]} onClick={() => setSlot('h1')} />
          <span className="slot-gap" />
          {board.map((card, index) => (
            <SlotButton
              key={index}
              label={['Flop', 'Flop', 'Flop', 'Turn', 'River'][index] ?? 'Board'}
              selected={slot === `b${index}`}
              card={card}
              onClick={() => setSlot(`b${index}` as typeof slot)}
              onClear={
                card
                  ? () => setBoard((current) => current.map((existing, existingIndex) => (existingIndex === index ? null : existing)))
                  : undefined
              }
            />
          ))}
        </div>
        <div className="tray" aria-label="Card tray">
          {SUITS.map((suit) => (
            <div key={suit} className="tray-row">
              {RANKS.map((rank) => {
                const card = { rank, suit }
                const used = dead.some((item) => item.rank === rank && item.suit === suit)
                return (
                  <button
                    key={`${rank}${suit}`}
                    type="button"
                    className={`pip-btn ${suit === 'h' || suit === 'd' ? 'red' : ''} ${used ? 'used' : ''}`}
                    onClick={() => assign(card)}
                    disabled={used && !isCurrentSlot(card)}
                  >
                    {rankLabel(rank)}
                    {suitGlyph(suit)}
                  </button>
                )
              })}
            </div>
          ))}
        </div>
        <p className="question-sub pot-line">
          The pot is <span className="nowrap">{'$'}<input className="blank" aria-label="pot before the bet" inputMode="numeric" value={pot} onChange={(event) => setPot(Math.max(0, Math.round(Number(event.target.value) || 0)))} /></span>
          {' before their '}
          <span className="nowrap">{'$'}<input className="blank" aria-label="bet to call" inputMode="numeric" value={bet} onChange={(event) => setBet(Math.max(0, Math.round(Number(event.target.value) || 0)))} /></span>
          {' bet. Folding is worth $0.'}
        </p>
        <div className="presets">
          <button
            type="button"
            onClick={() => {
              setHero([
                { rank: 14, suit: 'h' },
                { rank: 13, suit: 'h' },
              ])
              setBoard([{ rank: 12, suit: 'h' }, { rank: 7, suit: 'h' }, { rank: 2, suit: 'c' }, null, null])
              setPot(100)
              setBet(50)
            }}
          >
            Flush draw, half pot
          </button>
          <button
            type="button"
            onClick={() => {
              setHero([
                { rank: 14, suit: 's' },
                { rank: 14, suit: 'h' },
              ])
              setBoard([null, null, null, null, null])
              setPot(30)
              setBet(20)
            }}
          >
            Pocket aces, preflop
          </button>
        </div>
        <p className="finding" data-testid="holdem-results">
          {headline}
        </p>
        <div className="pair-tickets">
          <RangeTicket name="Strong hands" range={tight.length} priced={priced?.tight ?? null} />
          <RangeTicket name="Value and bluffs" range={wide.length} priced={priced?.wide ?? null} />
        </div>
      </section>
      <aside className="side">
        <div className="range-head">
          <button type="button" aria-pressed={editing === 'tight'} onClick={() => setEditing('tight')}>
            Edit strong
          </button>
          <button type="button" aria-pressed={editing === 'wide'} onClick={() => setEditing('wide')}>
            Edit the mix
          </button>
          <button
            type="button"
            className="text"
            onClick={() => {
              setTight(tightRange())
              setWide(wideRange())
            }}
          >
            Reset ranges
          </button>
        </div>
        <p className="hint">
          Strong is TT+, AQ, AJs, KQs. The mix adds 77–99, suited aces, suited connectors down to 65s, AJo, ATo, and KQo. Click a cell to add or remove it from the range you are editing.
        </p>
        <div className="matrix" role="grid" aria-label="Opponent range">
          <span />
          {RANKS.map((rank) => (
            <span key={`col-${rank}`} className="axis-label">
              {rankLabel(rank)}
            </span>
          ))}
          {RANKS.map((rowRank, row) => (
            <span key={`row-${rowRank}`} className="matrix-row">
              <span className="axis-label">{rankLabel(rowRank)}</span>
              {CELLS.filter((cell) => cell.row === row).map((cell) => (
                <button
                  key={cell.key}
                  type="button"
                  role="gridcell"
                  aria-pressed={active.includes(cell.key)}
                  className={`cell ${cell.pair ? 'pair' : cell.suited ? 'suited' : 'offsuit'} ${active.includes(cell.key) ? 'on' : ''}`}
                  onClick={() => toggle(cell.key)}
                >
                  {cell.key.replace(/[so]$/, '')}
                </button>
              ))}
            </span>
          ))}
        </div>
      </aside>
    </div>
  )
}

type Priced = { equity: Equity; ev: number; required: number }

function RangeTicket({ name, range, priced }: { name: string; range: number; priced: Priced | null }) {
  if (!priced) {
    return (
      <article className="ticket waiting">
        <p className="kicker">{name}</p>
        <h2>Pricing the call…</h2>
      </article>
    )
  }
  const equity = priced.equity
  const hold = priced.ev > 0.5
  const give = priced.ev < -0.5
  return (
    <Ticket
      kicker={`${name} · ${equity.combos} combos · ${range} hands selected`}
      title={equity.combos === 0 ? 'No hands in this range survive the cards already out.' : hold ? 'The call holds up.' : give ? 'The call gives up money.' : 'The call is about even.'}
      columns={['Choice', 'Worth']}
      rows={
        equity.combos === 0
          ? []
          : [
              { label: 'Fold', value: '$0.00', best: !hold },
              {
                label: `Call · ${pct(equity.equity)} equity`,
                value: money(priced.ev),
                best: hold,
              },
            ]
      }
      footer={`Estimate from ${equity.trials.toLocaleString('en-US')} runouts. Ties split the pot. The call needs ${pct(priced.required)} equity.`}
      note={equity.combos === 0 ? 'Clear a card or widen the range.' : hold ? 'Calling is worth more than folding.' : give ? `Calling is worth ${money(priced.ev)} against this range.` : 'A few runouts would swing this either way.'}
      tone={hold ? 'good' : give ? 'bad' : 'plain'}
    />
  )
}

function comparison(tightEv: number, wideEv: number): string {
  const tight = `Against strong hands, calling is worth ${money(tightEv)}.`
  const wide = `Against the mix of value hands and bluffs, calling is worth ${money(wideEv)}.`
  return `${tight} ${wide}`
}

function SlotButton({
  label,
  card,
  selected,
  onClick,
  onClear,
}: {
  label: string
  card: PCard | null
  selected: boolean
  onClick: () => void
  onClear?: () => void
}) {
  return (
    <div className={`slot-wrap ${selected ? 'selected' : ''}`}>
      <button type="button" className="slot-btn" onClick={onClick}>
        <span>{label}</span>
        <strong>{card ? cardText(card) : '—'}</strong>
      </button>
      {onClear ? (
        <button type="button" className="clear" onClick={onClear} aria-label={`Clear ${label}`}>
          ×
        </button>
      ) : null}
    </div>
  )
}

function suitGlyph(suit: Suit): string {
  return { s: '♠', h: '♥', d: '♦', c: '♣' }[suit]
}
