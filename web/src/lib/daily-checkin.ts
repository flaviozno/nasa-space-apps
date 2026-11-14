// The daily check-in questions. Scales match the API's DailyCheckinIn validation
// (onboard/app/crew/schemas.py): 1–10, sleepiness 1–9 (Karolinska), symptoms 0–10.

import type { DailyCheckinInput } from '@/lib/onboard-types'

export type CheckinKey = keyof DailyCheckinInput

export interface ScaleQuestion {
  key: CheckinKey
  title: string
  min: number
  max: number
  lowLabel: string
  highLabel: string
}

/** One question per screen, in this order. */
export const FEELING_QUESTIONS: ScaleQuestion[] = [
  { key: 'mood', title: 'How is your mood today?', min: 1, max: 10, lowLabel: 'Very low', highLabel: 'Excellent' },
  { key: 'stress', title: 'How stressed do you feel?', min: 1, max: 10, lowLabel: 'Not at all', highLabel: 'Extremely' },
  { key: 'fatigue', title: 'How tired do you feel?', min: 1, max: 10, lowLabel: 'Fully rested', highLabel: 'Exhausted' },
  {
    key: 'sleepiness',
    title: 'How sleepy are you right now?',
    min: 1,
    max: 9,
    lowLabel: 'Extremely alert',
    highLabel: 'Fighting sleep',
  },
]

/** Shown together on one screen; each starts at 0 (none). */
export const SYMPTOM_QUESTIONS: ScaleQuestion[] = [
  { key: 'symptomHeadache', title: 'Headache', min: 0, max: 10, lowLabel: 'None', highLabel: 'Severe' },
  { key: 'symptomBackPain', title: 'Back pain', min: 0, max: 10, lowLabel: 'None', highLabel: 'Severe' },
  { key: 'symptomCongestion', title: 'Congestion', min: 0, max: 10, lowLabel: 'None', highLabel: 'Severe' },
  { key: 'symptomEyeIrritation', title: 'Eye irritation', min: 0, max: 10, lowLabel: 'None', highLabel: 'Severe' },
  { key: 'symptomSkin', title: 'Skin irritation', min: 0, max: 10, lowLabel: 'None', highLabel: 'Severe' },
  { key: 'symptomNausea', title: 'Nausea', min: 0, max: 10, lowLabel: 'None', highLabel: 'Severe' },
]

export type CheckinAnswers = Partial<Record<CheckinKey, number>>

export const INITIAL_ANSWERS: CheckinAnswers = Object.fromEntries(SYMPTOM_QUESTIONS.map((q) => [q.key, 0]))

/** The request body once every question has an answer; null while something is missing. */
export function toCheckinPayload(answers: CheckinAnswers): DailyCheckinInput | null {
  const all = [...FEELING_QUESTIONS, ...SYMPTOM_QUESTIONS]
  if (all.some((q) => answers[q.key] === undefined)) return null
  return Object.fromEntries(all.map((q) => [q.key, answers[q.key]])) as unknown as DailyCheckinInput
}
