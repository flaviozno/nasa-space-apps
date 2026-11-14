// Weekly questionnaires. Scales match the API (onboard/app/crew/schemas.py):
// PHQ-4 = exactly 4 answers scored 0–3 (the server stores the 0–12 total); team climate = 1–10.

/**
 * PHQ-4 (Kroenke et al., 2009) wording, unchanged because it is a validated instrument.
 * Items 1–2 screen for anxiety, items 3–4 for depression; the API expects this order.
 */
export const PHQ4_PROMPT = 'Over the last 2 weeks, how often have you been bothered by the following problems?'

export const PHQ4_QUESTIONS = [
  'Feeling nervous, anxious or on edge',
  'Not being able to stop or control worrying',
  'Feeling down, depressed or hopeless',
  'Little interest or pleasure in doing things',
] as const

export const PHQ4_OPTIONS = [
  { value: 0, label: 'Not at all' },
  { value: 1, label: 'Several days' },
  { value: 2, label: 'More than half the days' },
  { value: 3, label: 'Nearly every day' },
] as const

export const TEAM_CLIMATE_QUESTION = {
  title: 'How would you rate the team climate this week?',
  min: 1,
  max: 10,
  lowLabel: 'Very poor',
  highLabel: 'Excellent',
} as const

/** Label of a PHQ-4 answer value, e.g. 2 → "More than half the days". */
export function phq4OptionLabel(value: number | undefined): string {
  return PHQ4_OPTIONS.find((option) => option.value === value)?.label ?? '—'
}
