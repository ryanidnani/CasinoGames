import { useEffect, useState } from 'react'
import { Baccarat } from './baccarat/Baccarat'
import { Blackjack } from './blackjack/Blackjack'
import { Holdem } from './holdem/Holdem'

type Tab = 'blackjack' | 'baccarat' | 'holdem'

const TABS: { id: Tab; index: string; label: string }[] = [
  { id: 'blackjack', index: '01', label: 'Blackjack' },
  { id: 'baccarat', index: '02', label: 'Baccarat' },
  { id: 'holdem', index: '03', label: 'Hold’em' },
]

const LEDE: Record<Tab, string> = {
  blackjack: 'Play the hand. The price of each choice appears after you commit.',
  baccarat: 'Three betting systems. The same shoes. Winning sessions and losing money can happen together.',
  holdem: 'A call is a price. The range you put them on decides whether it is worth paying.',
}

function readTab(): Tab {
  const hash = window.location.hash.replace('#', '')
  if (hash === 'baccarat' || hash === 'holdem' || hash === 'blackjack') return hash
  return 'blackjack'
}

export function App() {
  const [tab, setTab] = useState<Tab>(readTab)

  useEffect(() => {
    const onHash = () => setTab(readTab())
    window.addEventListener('hashchange', onHash)
    return () => window.removeEventListener('hashchange', onHash)
  }, [])

  return (
    <div className="shell">
      <header className="top">
        <div className="brand">
          <p className="mark">Reveal</p>
          <p className="sub">Casino decision lab</p>
        </div>
        <nav>
          {TABS.map((item) => (
            <a key={item.id} href={`#${item.id}`} aria-current={tab === item.id ? 'page' : undefined}>
              <span>{item.index}</span>
              {item.label}
            </a>
          ))}
        </nav>
      </header>
      <p className="lede">{LEDE[tab]}</p>
      {tab === 'blackjack' ? <Blackjack /> : null}
      {tab === 'baccarat' ? <Baccarat /> : null}
      {tab === 'holdem' ? <Holdem /> : null}
      <p className="creed">Expected value is the average result over the cards still unseen. A good choice can lose.</p>
    </div>
  )
}
