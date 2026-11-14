import { describe, expect, it } from 'vitest'
import { describeAlert } from '@/lib/alert-text'

describe('describeAlert', () => {
  it('writes a short sentence from the metric, value and z-score', () => {
    expect(
      describeAlert({
        metric: 'heart_rate',
        value: 125,
        zScore: 5,
        message: 'ELEVATED_HEART_RATE scenario: heart rate crossed |z| >= 3 of the baseline.',
      }),
    ).toEqual({ title: 'High heart rate', reading: '125 bpm', deviation: '5.0σ above your baseline' })
  })

  it('says Low for values under the baseline', () => {
    expect(describeAlert({ metric: 'spo2', value: 89, zScore: -8.2, message: 'x' }, 'the')).toEqual({
      title: 'Low SpO₂',
      reading: '89.0 %',
      deviation: '8.2σ below the baseline',
    })
  })

  it('falls back to the API text without code-style tokens for unknown metrics', () => {
    expect(describeAlert({ message: 'SENSOR_DETACHED scenario: no contact' }).title).toBe('Sensor detached')
  })
})
