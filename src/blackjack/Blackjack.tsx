import { useEffect, useMemo, useState } from 'react'
import { money, signedMoney } from '../lib/money'
import { PlayingCard, CardSlot } from '../components/PlayingCard'
import { Ticket } from '../components/Ticket'
import { lessonDecisions, topSpots, totalRegret, type SpotSummary } from './review'
import { allCards, cardText, rankLabel } from './shoe'
import { loadSave, writeSave } from './storage'
import {
  act,
  addBankroll,
  chooseInsurance,
  createTable,
  deal,
  legalActions,
  reshuffle,
  rulesLine,
  setWager,
  studyHand,
} from './table'
import {
  ACTION_LABEL,
  DEFAULT_RULES,
  type ActionName,
  type Card,
  type Decision,
  type Rules,
  type Table,
  type TicketModel,
} from './types'

const ACTIONS: ActionName[] = ['H', 'S', 'D', 'P', 'R']
const KEYS: Record<ActionName, string> = { H: 'H', S: 'S', D: 'D', P: 'P', R: 'R' }
const PAST: Record<string, string> = {
  Hit: 'hit',
  Stand: 'stood',
  Double: 'doubled',
  Split: 'split',
  Surrender: 'surrendered',
  'Take insurance': 'took insurance',
  'Decline insurance': 'declined insurance',
}

export function Blackjack() {
  const saved = useMemo(loadSave, [])
  const [rules, setRules] = useState<Rules>(saved?.rules ?? DEFAULT_RULES)
  const [table, setTable] = useState<Table>(() => {
    const created = createTable(saved?.rules ?? DEFAULT_RULES, saved?.bankroll ?? 1000, saved?.bet ?? 25, Math.random)
    created.handsPlayed = saved?.handsPlayed ?? 0
    return created
  })
  const [decisions, setDecisions] = useState<Decision[]>(saved?.decisions ?? [])
  const [lessonStart, setLessonStart] = useState(saved?.lessonStart ?? 0)
  const [reviewShownFor, setReviewShownFor] = useState(saved?.reviewShownFor ?? 0)
  const [reviewOpen, setReviewOpen] = useState(false)
  const [studyCards, setStudyCards] = useState<[Card, Card, Card]>([
    { rank: 10, suit: 'S' },
    { rank: 6, suit: 'H' },
    { rank: 10, suit: 'D' },
  ])
  const [studyTicket, setStudyTicket] = useState<TicketModel | null>(null)
  const [studyMessage, setStudyMessage] = useState<string | null>(null)

  useEffect(() => {
    if (table.phase === 'play' || table.phase === 'insurance') return
    writeSave({
      version: 1,
      bankroll: table.bankroll,
      bet: table.bet,
      rules,
      handsPlayed: table.handsPlayed,
      lessonStart,
      reviewShownFor,
      decisions,
    })
  }, [table.phase, table.bankroll, table.bet, table.handsPlayed, rules, lessonStart, reviewShownFor, decisions])

  function commit(prev: Table, next: Table) {
    if (next.handDecisions.length > prev.handDecisions.length) {
      const added = next.handDecisions.slice(prev.handDecisions.length)
      setDecisions((current) => [...current, ...added].slice(-500))
    }
    if (next.phase === 'result') {
      const into = next.handsPlayed - lessonStart
      if (into > 0 && into % 20 === 0 && reviewShownFor !== next.handsPlayed) {
        setReviewOpen(true)
        setReviewShownFor(next.handsPlayed)
      }
    }
    setTable(next)
  }

  function onDeal() {
    commit(table, deal(table, rules, Math.random))
  }

  function onInsurance(take: boolean) {
    commit(table, chooseInsurance(table, take, rules, Math.random))
  }

  function onAct(action: ActionName) {
    commit(table, act(table, action, rules, Math.random))
  }

  useEffect(() => {
    function onKey(event: KeyboardEvent) {
      const target = event.target as HTMLElement | null
      if (target && ['INPUT', 'SELECT', 'TEXTAREA', 'BUTTON', 'A'].includes(target.tagName)) return
      if (reviewOpen) {
        if (event.key === 'Escape') setReviewOpen(false)
        return
      }
      const key = event.key.toLowerCase()
      if (table.phase === 'insurance') {
        if (key === 'y' || key === 'i') onInsurance(true)
        if (key === 'n') onInsurance(false)
        return
      }
      if (table.phase === 'play') {
        const mapped: Record<string, ActionName> = { h: 'H', s: 'S', d: 'D', p: 'P', r: 'R' }
        const action = mapped[key]
        if (action) onAct(action)
        return
      }
      if ((key === 'enter' || key === ' ') && (table.phase === 'idle' || table.phase === 'result')) {
        event.preventDefault()
        onDeal()
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  })

  function updateRules(patch: Partial<Rules>) {
    setRules((prev) => {
      const next = { ...prev, ...patch }
      if (patch.decks && patch.decks !== prev.decks) setTable((current) => reshuffle(current, next, Math.random))
      return next
    })
  }

  const legal = legalActions(table, rules)
  const lesson = lessonDecisions(decisions, lessonStart)
  const into = table.handsPlayed - lessonStart
  const idle = table.phase === 'idle' || table.phase === 'result'
  const spots = topSpots(lesson)
  const regret = totalRegret(lesson)
  const curve = cumulative(lesson)

  return (
    <div className="layout">
      <section className="play">
        <div className="felt">
          <div className="seat dealer-seat">
            <span className="who">Dealer</span>
            <div className="cards">
              {table.dealer.length === 0 ? (
                <>
                  <CardSlot />
                  <CardSlot />
                </>
              ) : (
                table.dealer.map((card, index) => (
                  <PlayingCard
                    key={`${index}-${card.rank}${card.suit}`}
                    rank={rankLabel(card.rank)}
                    suit={card.suit}
                    hidden={index === 1 && table.phase !== 'result'}
                    delay={index * 50}
                  />
                ))
              )}
            </div>
          </div>

          <div className="pot">
            <div className={`chip ${table.hands.some((hand) => hand.doubled) ? 'double' : ''}`}>
              <span>{money(table.bet, table.bet % 1 === 0 ? 0 : 2)}</span>
            </div>
            {table.phase === 'result' && table.handNet != null ? (
              <p className={`net ${table.handNet > 0 ? 'win' : table.handNet < 0 ? 'loss' : ''}`}>{signedMoney(table.handNet)}</p>
            ) : (
              <p className="pot-note">{table.shoe.length} cards left in the shoe</p>
            )}
            {table.verdict ? (
              <p className={`verdict ${table.verdict === 'Best decision. The hand still lost.' ? 'memorable' : ''}`} data-testid="verdict">
                {table.verdict}
              </p>
            ) : (
              <p className="verdict quiet">{table.phase === 'idle' ? 'The shoe is shuffled.' : 'Choose before the price is shown.'}</p>
            )}
          </div>

          <div className="seat player-seat">
            <span className="who">You</span>
            <div className="hands">
              {table.hands.length === 0 ? (
                <div className="cards">
                  <CardSlot />
                  <CardSlot />
                </div>
              ) : (
                table.hands.map((hand, index) => (
                  <div key={index} className={`player-hand ${table.phase === 'play' && index === table.active ? 'active' : ''}`}>
                    {table.hands.length > 1 ? <span className="hand-label">Hand {index + 1}</span> : null}
                    <div className="cards">
                      {hand.cards.map((card, cardIndex) => (
                        <PlayingCard key={`${cardIndex}-${card.rank}${card.suit}`} rank={rankLabel(card.rank)} suit={card.suit} delay={cardIndex * 50} />
                      ))}
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>

        <div className="action-bar">
          {table.phase === 'insurance' ? (
            <>
              <button type="button" className="action" data-testid="insurance-take" onClick={() => onInsurance(true)}>
                Take insurance <kbd>Y</kbd>
              </button>
              <button type="button" className="action primary" data-testid="insurance-decline" onClick={() => onInsurance(false)}>
                Decline <kbd>N</kbd>
              </button>
            </>
          ) : table.phase === 'play' ? (
            ACTIONS.map((code) => {
              const open = legal.includes(code)
              return (
                <button
                  key={code}
                  type="button"
                  className="action"
                  data-testid={`action-${code}`}
                  disabled={!open}
                  onClick={() => onAct(code)}
                >
                  {ACTION_LABEL[code]} <kbd>{KEYS[code]}</kbd>
                </button>
              )
            })
          ) : (
            <button type="button" className="action primary" data-testid="deal-button" onClick={onDeal}>
              {table.phase === 'result' ? 'Next hand' : 'Deal'} <kbd>Enter</kbd>
            </button>
          )}
        </div>
        {table.message ? <p className="message">{table.message}</p> : null}

        <div className="rail">
          <label>
            Bankroll
            <strong>{money(table.bankroll)}</strong>
          </label>
          <label>
            Bet
            <input
              type="number"
              min={1}
              step={5}
              value={table.bet}
              disabled={!idle}
              onChange={(event) => setTable((current) => setWager(current, Number(event.target.value)))}
            />
          </label>
          <button type="button" className="text" disabled={!idle} onClick={() => setTable((current) => addBankroll(current, 1000))}>
            Add $1,000
          </button>
          <p className="given">
            Given up this lesson <strong>{money(regret)}</strong>
          </p>
          <p className="lesson-progress">
            {into === 0
              ? 'The review opens after 20 hands.'
              : into % 20 === 0
                ? `${into} hands in this lesson.`
                : `${into % 20} of 20 hands toward the next review.`}
          </p>
          {curve.length > 1 ? <Spark values={curve} /> : null}
          <button type="button" className="text" disabled={lesson.length === 0} onClick={() => setReviewOpen(true)}>
            Review the lesson
          </button>
        </div>

        <details className="rules">
          <summary>{rulesLine(rules)}</summary>
          <div className="rule-grid">
            <label>
              Decks
              <select
                value={rules.decks}
                disabled={!idle}
                onChange={(event) => updateRules({ decks: Number(event.target.value) })}
              >
                {[2, 4, 6, 8].map((decks) => (
                  <option key={decks} value={decks}>
                    {decks}
                  </option>
                ))}
              </select>
            </label>
            <label className="check">
              <input
                type="checkbox"
                checked={rules.hitSoft17}
                disabled={!idle}
                onChange={(event) => updateRules({ hitSoft17: event.target.checked })}
              />
              Dealer hits soft 17
            </label>
            <label className="check">
              <input type="checkbox" checked={rules.das} disabled={!idle} onChange={(event) => updateRules({ das: event.target.checked })} />
              Double after split
            </label>
            <label className="check">
              <input
                type="checkbox"
                checked={rules.lateSurrender}
                disabled={!idle}
                onChange={(event) => updateRules({ lateSurrender: event.target.checked })}
              />
              Late surrender
            </label>
            <label>
              Blackjack pays
              <select
                value={rules.blackjackPays}
                disabled={!idle}
                onChange={(event) => updateRules({ blackjackPays: Number(event.target.value) })}
              >
                <option value={1.5}>3 to 2</option>
                <option value={1.2}>6 to 5</option>
              </select>
            </label>
          </div>
          <p className="rule-note">A new deck count reshuffles before the next hand. The other rules apply to the next decision.</p>
        </details>
      </section>

      <aside className="side">
        {table.handDecisions.length > 1 ? (
          <ul className="priors">
            {table.handDecisions.slice(0, -1).map((decision, index) => (
              <li key={`${decision.spot}-${index}`}>
                {decision.action} on {decision.spot}
                <span>{decision.regret > 0.004 ? `gave up ${money(decision.regret)}` : 'best price'}</span>
              </li>
            ))}
          </ul>
        ) : null}
        {table.ticket ? (
          <DecisionTicket ticket={table.ticket} />
        ) : (
          <article className="ticket waiting">
            <p className="kicker">The price stays hidden</p>
            <h2>Deal a hand, then choose.</h2>
            <p className="foot">Hit, stand, double, split, or surrender. The expected value of every option appears after you commit, priced from the cards still unseen.</p>
          </article>
        )}

        <details className="study">
          <summary>Price a hand without playing it</summary>
          <p>Hard 16 against a dealer 10 is waiting in the selectors. A study price stays off the lesson.</p>
          <div className="study-row">
            {([0, 1, 2] as const).map((index) => (
              <label key={index}>
                {index === 2 ? 'Dealer' : `Card ${index + 1}`}
                <select
                  value={cardValue(studyCards[index])}
                  onChange={(event) => {
                    const next = studyCards.slice() as [Card, Card, Card]
                    next[index] = parseCard(event.target.value)
                    setStudyCards(next)
                  }}
                >
                  {allCards().map((card) => (
                    <option key={cardValue(card)} value={cardValue(card)}>
                      {cardText(card)}
                    </option>
                  ))}
                </select>
              </label>
            ))}
            <button
              type="button"
              className="action"
              onClick={() => {
                if (cardValue(studyCards[0]) === cardValue(studyCards[1]) || cardValue(studyCards[0]) === cardValue(studyCards[2]) || cardValue(studyCards[1]) === cardValue(studyCards[2])) {
                  setStudyMessage('Pick three different cards to study.')
                  return
                }
                setStudyMessage(null)
                setStudyTicket(studyHand([studyCards[0], studyCards[1]], studyCards[2], rules))
              }}
            >
              Price it
            </button>
          </div>
          {studyMessage ? <p className="message">{studyMessage}</p> : null}
          {studyTicket ? <DecisionTicket ticket={studyTicket} /> : null}
        </details>
      </aside>

      {reviewOpen ? (
        <div className="sheet-back" role="presentation" onClick={() => setReviewOpen(false)}>
          <div
            className="sheet"
            role="dialog"
            aria-modal="true"
            aria-labelledby="review-title"
            data-testid="review"
            onClick={(event) => event.stopPropagation()}
          >
            <p className="kicker">After the cards</p>
            <h2 id="review-title">Where the money went</h2>
            <p className="sheet-lead">
              {into === 0
                ? 'Play a hand and the costly spots will collect here.'
                : `${into} hand${into === 1 ? '' : 's'} in this lesson gave up ${money(regret)} of expected value.`}
            </p>
            {spots.length === 0 ? (
              <p className="sheet-empty">Every choice matched the best price.</p>
            ) : (
              <ol className="spots">
                {spots.map((spot) => (
                  <li key={spot.spot}>
                    <div>
                      <strong>{spotTitle(spot.spot)}</strong>
                      <span>{spotSentence(spot)}</span>
                    </div>
                    <em>{money(spot.regret)}</em>
                  </li>
                ))}
              </ol>
            )}
            <p className="sheet-all">Across every saved hand, choices have given up {money(totalRegret(decisions))}.</p>
            <div className="sheet-actions">
              <button type="button" className="action primary" onClick={() => setReviewOpen(false)}>
                Keep playing
              </button>
              <button
                type="button"
                className="text"
                onClick={() => {
                  setLessonStart(table.handsPlayed)
                  setReviewOpen(false)
                }}
              >
                Start a fresh twenty
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  )
}

function DecisionTicket({ ticket }: { ticket: TicketModel }) {
  const max = Math.max(...ticket.rows.map((row) => row.perDollar ?? Number.NEGATIVE_INFINITY))
  const aside = ticket.rows.some((row) => row.onBet != null)
  return (
    <Ticket
      kicker={ticket.kicker}
      title={ticket.title}
      columns={aside ? ['Action', 'Per $1', 'On this bet'] : ['Action', 'Per $1']}
      rows={ticket.rows.map((row) => ({
        label: row.label,
        value: formatUnit(row.perDollar),
        aside: row.onBet == null ? undefined : signedMoney(row.onBet),
        you: row.mark === 'you',
        best: row.mark === 'best' || (row.perDollar != null && max - row.perDollar < 0.015),
      }))}
      footer={ticket.footer}
      note={ticket.note}
      tone={ticket.note.startsWith('You took') ? 'good' : ticket.note.startsWith('You gave up') ? 'bad' : 'plain'}
    />
  )
}

function formatUnit(value: number | null): string {
  if (value == null || Number.isNaN(value)) return '—'
  const sign = value > 0.0005 ? '+' : value < -0.0005 ? '−' : ''
  return `${sign}${Math.abs(value).toFixed(2)}`
}

function cumulative(decisions: Decision[]): number[] {
  let sum = 0
  return decisions.map((decision) => {
    sum += decision.regret
    return Math.round(sum * 100) / 100
  })
}

function Spark({ values }: { values: number[] }) {
  const width = 240
  const height = 46
  const max = Math.max(...values, 0.01)
  const d = values
    .map((value, index) => {
      const x = (index / Math.max(values.length - 1, 1)) * width
      const y = height - 4 - (value / max) * (height - 8)
      return `${index === 0 ? 'M' : 'L'}${x.toFixed(1)} ${y.toFixed(1)}`
    })
    .join(' ')
  return (
    <svg className="spark" viewBox={`0 0 ${width} ${height}`} role="img" aria-label="Expected value given up across this lesson">
      <path d={d} />
    </svg>
  )
}

function spotTitle(spot: string): string {
  return spot.charAt(0).toUpperCase() + spot.slice(1)
}

function spotSentence(spot: SpotSummary): string {
  const did = spot.actions.map((action) => `${PAST[action.action] ?? action.action.toLowerCase()} ${times(action.count)}`).join(' and ')
  const best =
    spot.bestCount === spot.bestLooks
      ? `${spot.best} was the best price every time.`
      : `${spot.best} was the best price ${spot.bestCount} of ${spot.bestLooks} times.`
  return `You ${did}. ${best}`
}

function times(count: number): string {
  if (count === 1) return 'once'
  if (count === 2) return 'twice'
  return `${count} times`
}

function cardValue(card: Card): string {
  return `${card.rank}${card.suit}`
}

function parseCard(value: string): Card {
  return { rank: Number(value.slice(0, -1)), suit: value.slice(-1) as Card['suit'] }
}
