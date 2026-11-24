export function mulberry32(seed: number): () => number {
  let a = seed >>> 0
  return () => {
    a = (a + 0x6d2b79f5) | 0
    let t = Math.imul(a ^ (a >>> 15), 1 | a)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

export function shuffle<T>(items: readonly T[], rng: () => number): T[] {
  const a = items.slice()
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1))
    const t = a[i]!
    a[i] = a[j]!
    a[j] = t
  }
  return a
}

/** Shuffle only the prefix the caller will read. The tail stays in place. */
export function shufflePrefix<T>(items: readonly T[], count: number, rng: () => number): T[] {
  const a = items.slice()
  const n = Math.min(count, a.length)
  for (let i = 0; i < n; i++) {
    const j = i + Math.floor(rng() * (a.length - i))
    const t = a[i]!
    a[i] = a[j]!
    a[j] = t
  }
  return a
}
