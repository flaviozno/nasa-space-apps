// When each questionnaire may be answered again.
//
// PROVISIONAL CONTRACT: the onboard API does not expose this yet (Matheus will add it and the
// shape may change). Everything that depends on the shape lives here and in
// onboardApi.getQuestionnaireStatus, so adapting to the final endpoint touches only those.
//
// Rule agreed with the team: the daily check-in reopens at 00:00 UTC (GMT, the ISS's official
// time); the weekly questionnaires reopen 7 days after the last answer.

export interface QuestionnaireWindow {
  /** Epoch ms of the last submission, or null if never answered. */
  lastSubmittedAt: number | null
  /** Epoch ms when it may be answered again, or null if available now. */
  availableAgainAt: number | null
}

export interface QuestionnaireStatus {
  dailyCheckin: QuestionnaireWindow
  phq4: QuestionnaireWindow
  teamClimate: QuestionnaireWindow
}

const DAY_MS = 24 * 60 * 60 * 1000

/** Next 00:00 UTC after `timestamp`. Example: 2026-11-14T22:10Z → 2026-11-15T00:00Z. */
export function nextUtcMidnight(timestamp: number): number {
  return Math.floor(timestamp / DAY_MS) * DAY_MS + DAY_MS
}

/** The window for a questionnaire answered at `lastSubmittedAt` under the agreed rules. */
export function windowAfter(kind: keyof QuestionnaireStatus, lastSubmittedAt: number | null): QuestionnaireWindow {
  if (lastSubmittedAt === null) return { lastSubmittedAt: null, availableAgainAt: null }
  const availableAgainAt = kind === 'dailyCheckin' ? nextUtcMidnight(lastSubmittedAt) : lastSubmittedAt + 7 * DAY_MS
  return { lastSubmittedAt, availableAgainAt }
}

/**
 * The status to use while the endpoint does not exist yet (404): every questionnaire open,
 * so the forms keep working against the current API, just without the once-per-window lock.
 */
export const OPEN_STATUS: QuestionnaireStatus = {
  dailyCheckin: { lastSubmittedAt: null, availableAgainAt: null },
  phq4: { lastSubmittedAt: null, availableAgainAt: null },
  teamClimate: { lastSubmittedAt: null, availableAgainAt: null },
}

export function isAvailable(window: QuestionnaireWindow, now: number): boolean {
  return window.availableAgainAt === null || now >= window.availableAgainAt
}

/** "14:32 GMT" — questionnaire times are shown in the ISS's official time. */
export function formatGmtClock(timestamp: number): string {
  return `${new Date(timestamp).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit', timeZone: 'UTC' })} GMT`
}

/** Time left until `target`: "5 h 12 min", "8 min", "less than a minute". */
export function formatCountdown(target: number, now: number): string {
  const minutes = Math.ceil((target - now) / 60_000)
  if (minutes <= 0) return 'less than a minute'
  if (minutes < 60) return `${minutes} min`
  const hours = Math.floor(minutes / 60)
  const rest = minutes % 60
  if (hours >= 24) return `${Math.round(hours / 24)} d`
  return rest === 0 ? `${hours} h` : `${hours} h ${rest} min`
}
