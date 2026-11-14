export type BaselineMetricId =
  | "heart_rate"
  | "hrv_rmssd"
  | "spo2"
  | "resp_rate"
  | "body_temp"
  | "sleep_duration"
  | "exercise_duration"
  | "body_mass"
  | "blood_pressure_systolic"
  | "blood_pressure_diastolic"
  | "water_intake"
  | "grip_strength"
  | "mood"
  | "stress"
  | "fatigue"
  | "sleepiness"
  | "symptom_headache"
  | "symptom_back_pain"
  | "symptom_congestion"
  | "symptom_eye_irritation"
  | "symptom_skin"
  | "symptom_nausea"
  | "phq4"
  | "team_climate";

export interface MetricBaseline {
  median: number;
  spread: number;
}

export type BaselineProfile = Record<BaselineMetricId, MetricBaseline>;
export type BaselinesByDevice = Record<string, BaselineProfile>;

const DECIMAL_PLACES: Partial<Record<BaselineMetricId, number>> = {
  spo2: 1,
  body_temp: 2,
  sleep_duration: 1,
  body_mass: 1,
  water_intake: 1,
  grip_strength: 1,
};

const SCALES: Partial<Record<BaselineMetricId, readonly [number, number]>> = {
  spo2: [0, 100],
  sleep_duration: [0, 24],
  exercise_duration: [0, 1440],
  mood: [1, 10],
  stress: [1, 10],
  fatigue: [1, 10],
  sleepiness: [1, 9],
  symptom_headache: [0, 10],
  symptom_back_pain: [0, 10],
  symptom_congestion: [0, 10],
  symptom_eye_irritation: [0, 10],
  symptom_skin: [0, 10],
  symptom_nausea: [0, 10],
  phq4: [0, 12],
  team_climate: [1, 10],
};

// Mirrors the wearable bindings and baselines in ../../contracts/crew.json.
// The emulator is deployed from emu/, so this module keeps the Function bundle self-contained.
export const BASELINES_BY_DEVICE: BaselinesByDevice = {
  "wearable-01": {
    heart_rate: { median: 76, spread: 10 }, hrv_rmssd: { median: 52, spread: 12 },
    spo2: { median: 98, spread: 1.1 }, resp_rate: { median: 14, spread: 2 },
    body_temp: { median: 36.75, spread: 0.45 }, sleep_duration: { median: 7.1, spread: 0.6 },
    exercise_duration: { median: 115, spread: 20 }, body_mass: { median: 61.5, spread: 0.8 },
    blood_pressure_systolic: { median: 112, spread: 7 }, blood_pressure_diastolic: { median: 71, spread: 5 },
    water_intake: { median: 2.3, spread: 0.4 }, grip_strength: { median: 30, spread: 2.5 },
    mood: { median: 7, spread: 1 }, stress: { median: 4, spread: 1 },
    fatigue: { median: 3, spread: 1 }, sleepiness: { median: 3, spread: 1 },
    symptom_headache: { median: 0, spread: 1 }, symptom_back_pain: { median: 0, spread: 1 },
    symptom_congestion: { median: 0, spread: 1 }, symptom_eye_irritation: { median: 0, spread: 1 },
    symptom_skin: { median: 0, spread: 1 }, symptom_nausea: { median: 0, spread: 1 },
    phq4: { median: 1, spread: 1 }, team_climate: { median: 8, spread: 1 },
  },
  "wearable-02": {
    heart_rate: { median: 78, spread: 10 }, hrv_rmssd: { median: 61, spread: 14 },
    spo2: { median: 98.2, spread: 1.1 }, resp_rate: { median: 13, spread: 2 },
    body_temp: { median: 36.7, spread: 0.45 }, sleep_duration: { median: 6.8, spread: 0.7 },
    exercise_duration: { median: 130, spread: 20 }, body_mass: { median: 74.2, spread: 1 },
    blood_pressure_systolic: { median: 118, spread: 7 }, blood_pressure_diastolic: { median: 76, spread: 5 },
    water_intake: { median: 2.8, spread: 0.5 }, grip_strength: { median: 46, spread: 3 },
    mood: { median: 7, spread: 1 }, stress: { median: 3, spread: 1 },
    fatigue: { median: 3, spread: 1 }, sleepiness: { median: 4, spread: 1 },
    symptom_headache: { median: 0, spread: 1 }, symptom_back_pain: { median: 0, spread: 1 },
    symptom_congestion: { median: 0, spread: 1 }, symptom_eye_irritation: { median: 0, spread: 1 },
    symptom_skin: { median: 0, spread: 1 }, symptom_nausea: { median: 0, spread: 1 },
    phq4: { median: 1, spread: 1 }, team_climate: { median: 8, spread: 1 },
  },
  "wearable-03": {
    heart_rate: { median: 75, spread: 10 }, hrv_rmssd: { median: 68, spread: 15 },
    spo2: { median: 98, spread: 1.1 }, resp_rate: { median: 15, spread: 2 },
    body_temp: { median: 36.8, spread: 0.45 }, sleep_duration: { median: 7.4, spread: 0.5 },
    exercise_duration: { median: 125, spread: 20 }, body_mass: { median: 79.8, spread: 1 },
    blood_pressure_systolic: { median: 121, spread: 8 }, blood_pressure_diastolic: { median: 78, spread: 6 },
    water_intake: { median: 3, spread: 0.5 }, grip_strength: { median: 49, spread: 3 },
    mood: { median: 8, spread: 1 }, stress: { median: 3, spread: 1 },
    fatigue: { median: 2, spread: 1 }, sleepiness: { median: 3, spread: 1 },
    symptom_headache: { median: 0, spread: 1 }, symptom_back_pain: { median: 0, spread: 1 },
    symptom_congestion: { median: 0, spread: 1 }, symptom_eye_irritation: { median: 0, spread: 1 },
    symptom_skin: { median: 0, spread: 1 }, symptom_nausea: { median: 0, spread: 1 },
    phq4: { median: 0, spread: 1 }, team_climate: { median: 9, spread: 1 },
  },
  "wearable-04": {
    heart_rate: { median: 80, spread: 10 }, hrv_rmssd: { median: 47, spread: 11 },
    spo2: { median: 97.9, spread: 1.1 }, resp_rate: { median: 14, spread: 2 },
    body_temp: { median: 36.75, spread: 0.45 }, sleep_duration: { median: 7, spread: 0.6 },
    exercise_duration: { median: 110, spread: 20 }, body_mass: { median: 66.3, spread: 0.9 },
    blood_pressure_systolic: { median: 109, spread: 6 }, blood_pressure_diastolic: { median: 70, spread: 5 },
    water_intake: { median: 2.5, spread: 0.4 }, grip_strength: { median: 32, spread: 2.5 },
    mood: { median: 7, spread: 1 }, stress: { median: 4, spread: 1 },
    fatigue: { median: 3, spread: 1 }, sleepiness: { median: 4, spread: 1 },
    symptom_headache: { median: 0, spread: 1 }, symptom_back_pain: { median: 0, spread: 1 },
    symptom_congestion: { median: 0, spread: 1 }, symptom_eye_irritation: { median: 0, spread: 1 },
    symptom_skin: { median: 0, spread: 1 }, symptom_nausea: { median: 0, spread: 1 },
    phq4: { median: 2, spread: 1 }, team_climate: { median: 8, spread: 1 },
  },
};

function randomUnit(): number {
  return randomInt(0, 1_000_000) / 1_000_000;
}

function rounded(value: number, places: number): number {
  return Number(value.toFixed(places));
}

function randomizeBaseline(metric: BaselineMetricId, baseline: MetricBaseline): MetricBaseline {
  const places = DECIMAL_PLACES[metric] ?? 0;
  const [minimum, maximum] = SCALES[metric] ?? [-Infinity, Infinity];
  const median = Math.min(
    maximum,
    Math.max(minimum, baseline.median + (randomUnit() - 0.5) * baseline.spread * 1.5),
  );
  const spread = baseline.spread * (0.8 + randomUnit() * 0.4);
  return { median: rounded(median, places), spread: rounded(Math.max(spread, 10 ** -places), places) };
}

function randomizeProfile(profile: BaselineProfile): BaselineProfile {
  return Object.fromEntries(
    (Object.keys(profile) as BaselineMetricId[]).map((metric) => [
      metric,
      randomizeBaseline(metric, profile[metric]),
    ]),
  ) as BaselineProfile;
}

export function randomizedBaselinesForDevices(deviceIds: readonly string[]): BaselinesByDevice {
  return Object.fromEntries(
    [...new Set(deviceIds)].flatMap((deviceId) => {
      const profile = BASELINES_BY_DEVICE[deviceId];
      return profile === undefined ? [] : [[deviceId, randomizeProfile(profile)]];
    }),
  );
}
import { randomInt } from "node:crypto";

