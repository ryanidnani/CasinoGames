export type TicketRowView = {
  label: string
  value: string
  aside?: string
  you?: boolean
  best?: boolean
}

export function Ticket({
  kicker,
  title,
  columns,
  rows,
  footer,
  note,
  tone = 'plain',
}: {
  kicker: string
  title: string
  columns: string[]
  rows: TicketRowView[]
  footer: string
  note: string
  tone?: 'plain' | 'good' | 'bad'
}) {
  const wide = columns.length > 2
  return (
    <article className="ticket" data-testid="ticket">
      <p className="kicker">{kicker}</p>
      <h2>{title}</h2>
      <div className="ticket-table" role="table">
        <div className={`ticket-head ${wide ? 'wide' : 'narrow'}`} role="row">
          {columns.map((column) => (
            <span key={column || 'mark'} role="columnheader">
              {column}
            </span>
          ))}
          <span />
        </div>
        {rows.map((row) => (
          <div key={row.label} className={`ticket-row ${wide ? 'wide' : 'narrow'} ${row.you ? 'you' : ''} ${row.best ? 'best' : ''}`} role="row">
            <span role="cell">{row.label}</span>
            <span className="num" role="cell">
              {row.value}
            </span>
            {wide ? (
              <span className="num" role="cell">
                {row.aside ?? ''}
              </span>
            ) : null}
            <span className="marks" role="cell">
              {row.you ? <em>you</em> : null}
              {row.best ? <em className="best-mark">best</em> : null}
            </span>
          </div>
        ))}
      </div>
      {note ? <p className={`note ${tone}`}>{note}</p> : null}
      <p className="foot">{footer}</p>
    </article>
  )
}
