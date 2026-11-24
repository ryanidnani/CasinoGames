import type { Decision } from './types'

export type SpotSummary = {
  spot: string
  regret: number
  count: number
  actions: { action: string; count: number }[]
  best: string
  bestCount: number
  bestLooks: number
}

export function lessonDecisions(decisions: readonly Decision[], lessonStart: number): Decision[] {
  return decisions.filter((d) => d.hand > lessonStart)
}

export function topSpots(decisions: readonly Decision[], n = 3): SpotSummary[] {
  const grouped = new Map<string, Decision[]>()
  for (const d of decisions) {
    const list = grouped.get(d.spot) ?? []
    list.push(d)
    grouped.set(d.spot, list)
  }
  const spots: SpotSummary[] = []
  for (const [spot, list] of grouped) {
    const actions = new Map<string, number>()
    const bests = new Map<string, number>()
    let regret = 0
    for (const d of list) {
      regret += d.regret
      actions.set(d.action, (actions.get(d.action) ?? 0) + 1)
      bests.set(d.best, (bests.get(d.best) ?? 0) + 1)
    }
    let best = list[0]?.best ?? ''
    let bestCount = 0
    for (const [name, count] of bests) {
      if (count > bestCount) {
        best = name
        bestCount = count
      }
    }
    spots.push({
      spot,
      regret,
      count: list.length,
      actions: [...actions.entries()]
        .map(([action, count]) => ({ action, count }))
        .sort((a, b) => b.count - a.count),
      best,
      bestCount,
      bestLooks: list.length,
    })
  }
  spots.sort((a, b) => b.regret - a.regret || b.count - a.count)
  return spots.filter((s) => s.regret > 0.004).slice(0, n)
}

export function totalRegret(decisions: readonly Decision[]): number {
  return decisions.reduce((sum, d) => sum + d.regret, 0)
}
