type Suit = 'S' | 'H' | 'D' | 'C' | 's' | 'h' | 'd' | 'c'

const GLYPH: Record<string, string> = { S: '♠', H: '♥', D: '♦', C: '♣', s: '♠', h: '♥', d: '♦', c: '♣' }

export function PlayingCard({
  rank,
  suit,
  hidden = false,
  delay = 0,
}: {
  rank: string
  suit?: Suit
  hidden?: boolean
  delay?: number
}) {
  if (hidden || !suit) {
    return <div className="card back" style={{ animationDelay: `${delay}ms` }} aria-label="Face-down card" />
  }
  const red = suit === 'H' || suit === 'D' || suit === 'h' || suit === 'd'
  const glyph = GLYPH[suit]
  return (
    <div
      className={`card ${red ? 'red' : 'black'}`}
      style={{ animationDelay: `${delay}ms` }}
      aria-label={`${rank} ${glyph}`}
    >
      <span className="corner">
        {rank}
        <i>{glyph}</i>
      </span>
      <span className="pip">{glyph}</span>
    </div>
  )
}

export function CardSlot() {
  return <div className="slot" aria-hidden="true" />
}
