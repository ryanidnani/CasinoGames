export function round2(n: number): number {
  return Math.round(n * 100) / 100
}

export function money(n: number, digits = 2): string {
  const sign = n < 0 ? '−' : ''
  const body = Math.abs(n).toLocaleString('en-US', { minimumFractionDigits: digits, maximumFractionDigits: digits })
  return `${sign}$${body}`
}

export function signedMoney(n: number): string {
  if (Math.abs(n) < 0.005) return '$0.00'
  const sign = n > 0 ? '+' : '−'
  const body = Math.abs(n).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
  return `${sign}$${body}`
}

export function cents(edge: number): string {
  const mills = edge * 100
  const sign = mills > 0.005 ? '+' : mills < -0.005 ? '−' : ''
  return `${sign}${Math.abs(mills).toFixed(2)}¢`
}

export function pct(n: number, digits = 1): string {
  return `${(n * 100).toFixed(digits)}%`
}
