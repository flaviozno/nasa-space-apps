import { describe, expect, it } from 'vitest'
import { formatCountdown, formatGmtClock, isAvailable, nextUtcMidnight, windowAfter } from '@/lib/questionnaire-status'

const at = (iso: string) => Date.parse(iso)

describe('questionnaire availability', () => {
  it('reopens the daily check-in at the next 00:00 UTC', () => {
    expect(nextUtcMidnight(at('2026-11-14T22:10:00Z'))).toBe(at('2026-11-15T00:00:00Z'))
    expect(nextUtcMidnight(at('2026-11-15T00:00:00Z'))).toBe(at('2026-11-16T00:00:00Z'))
  })

  it('reopens weekly questionnaires 7 days later', () => {
    expect(windowAfter('phq4', at('2026-11-14T10:00:00Z')).availableAgainAt).toBe(at('2026-11-21T10:00:00Z'))
  })

  it('is available when never answered or once the window has passed', () => {
    const answered = windowAfter('dailyCheckin', at('2026-11-14T08:00:00Z'))
    expect(isAvailable(windowAfter('dailyCheckin', null), at('2026-11-14T09:00:00Z'))).toBe(true)
    expect(isAvailable(answered, at('2026-11-14T23:59:00Z'))).toBe(false)
    expect(isAvailable(answered, at('2026-11-15T00:00:00Z'))).toBe(true)
  })

  it('formats GMT times and countdowns', () => {
    expect(formatGmtClock(at('2026-11-14T08:05:00Z'))).toBe('08:05 GMT')
    expect(formatCountdown(at('2026-11-15T00:00:00Z'), at('2026-11-14T18:48:00Z'))).toBe('5 h 12 min')
    expect(formatCountdown(at('2026-11-15T00:00:00Z'), at('2026-11-14T23:52:00Z'))).toBe('8 min')
  })
})
