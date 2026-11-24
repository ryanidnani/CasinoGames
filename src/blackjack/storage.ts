import type { Decision, Rules } from './types'
import { DEFAULT_RULES } from './types'

const KEY = 'reveal.blackjack.v1'

export type Save = {
  version: 1
  bankroll: number
  bet: number
  rules: Rules
  handsPlayed: number
  lessonStart: number
  reviewShownFor: number
  decisions: Decision[]
}

export function loadSave(): Save | null {
  try {
    const raw = localStorage.getItem(KEY)
    if (!raw) return null
    const parsed = JSON.parse(raw) as Partial<Save>
    if (parsed.version !== 1 || !isRules(parsed.rules) || !Array.isArray(parsed.decisions)) return null
    return {
      version: 1,
      bankroll: numberOr(parsed.bankroll, 1000),
      bet: numberOr(parsed.bet, 25),
      rules: parsed.rules,
      handsPlayed: numberOr(parsed.handsPlayed, 0),
      lessonStart: numberOr(parsed.lessonStart, 0),
      reviewShownFor: numberOr(parsed.reviewShownFor, 0),
      decisions: parsed.decisions.slice(-500),
    }
  } catch {
    return null
  }
}

export function writeSave(save: Save): void {
  try {
    localStorage.setItem(KEY, JSON.stringify({ ...save, decisions: save.decisions.slice(-500) }))
  } catch {
    /* The lesson still works for this visit if storage is blocked. */
  }
}

function isRules(value: unknown): value is Rules {
  if (!value || typeof value !== 'object') return false
  const rules = value as Rules
  return (
    [2, 4, 6, 8].includes(rules.decks) &&
    typeof rules.hitSoft17 === 'boolean' &&
    typeof rules.das === 'boolean' &&
    typeof rules.lateSurrender === 'boolean' &&
    (rules.blackjackPays === 1.5 || rules.blackjackPays === 1.2)
  )
}

function numberOr(value: unknown, fallback: number): number {
  return typeof value === 'number' && Number.isFinite(value) ? value : fallback
}

export { DEFAULT_RULES }
