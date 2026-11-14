import type { ActigraphyTuple, ExerciseTuple, RadiationTuple } from "../reference/nasa-snapshots.ts";
import { actigraphyRows, exerciseRows, radiationRows } from "../reference/nasa-snapshots.ts";
import { hash } from "../utils/hash.ts";

export const ACTIGRAPHY_URL = "https://nlsp.nasa.gov/api/v1/files/972badfb-238d-5dd5-81f2-8efc729a4452/download";
export const RADIATION_URL = "https://visualization.osdr.nasa.gov/radlab/api/?spacecraft=ISS&instrument=DosTel&timestamp%3E=2022-04-01T23%3A00&timestamp%3C2022-04-02T01%3A05&absorbed_dose_rate&latitude&longitude&altitude&flux&format=json";
export const EXERCISE_REST_URL = "https://nlsp.nasa.gov/api/v1/files/c2794054-7a25-5891-9e77-5a4f4a2eca9e/download";
export const EXERCISE_PEAK_URL = "https://nlsp.nasa.gov/api/v1/files/f1d341e1-ccc0-57ed-8249-6dbc045b5c22/download";

export interface NasaData {
  actigraphy: ReadonlyArray<ActigraphyTuple>;
  radiation: ReadonlyArray<RadiationTuple>;
  exercise: ReadonlyArray<ExerciseTuple>;
  revision: string;
  actigraphyMode: "LIVE" | "BUNDLED_SNAPSHOT";
  radiationMode: "LIVE" | "BUNDLED_SNAPSHOT";
  exerciseMode: "LIVE" | "BUNDLED_SNAPSHOT";
}

function csvCells(csv: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let cell = "";
  let quoted = false;
  for (let index = 0; index < csv.length; index += 1) {
    const character = csv[index];
    if (character === '"') {
      if (quoted && csv[index + 1] === '"') {
        cell += '"';
        index += 1;
      } else {
        quoted = !quoted;
      }
    } else if (character === "," && !quoted) {
      row.push(cell);
      cell = "";
    } else if ((character === "\n" || character === "\r") && !quoted) {
      if (character === "\r" && csv[index + 1] === "\n") index += 1;
      row.push(cell);
      if (row.some((value) => value !== "")) rows.push(row);
      row = [];
      cell = "";
    } else {
      cell += character;
    }
  }
  if (quoted) throw new Error("Unclosed NASA CSV field");
  row.push(cell);
  if (row.some((value) => value !== "")) rows.push(row);
  return rows;
}

function minutes(value: string): number | null {
  if (value === "NA") return null;
  const parts = value.split(":").map(Number);
  if (parts.length < 1 || parts.length > 3 || parts.some((part) => !Number.isFinite(part) || part < 0)) {
    throw new Error("Invalid NASA sleep time");
  }
  if (parts.length === 1) return parts[0]! * 60;
  return parts[0]! * 60 + parts[1]! + (parts[2] ?? 0) / 60;
}

export function parseActigraphy(csv: string): ActigraphyTuple[] {
  const [header, ...rows] = csvCells(csv);
  if (!header) throw new Error("Missing NASA CSV header");
  const columns = ["ID", "Subject", "Test_Phase", "BR_Day", "Date", "Sleep Latency (hours)", "Sleep Duration (hours)", "Sleep Efficiency (%)", "Notes"].map((name) => header.indexOf(name));
  if (columns.some((index) => index < 0)) throw new Error("Unexpected NASA CSV columns");
  const parsed = rows.map((row): ActigraphyTuple => {
    const value = (index: number): string => row[columns[index]!] ?? "";
    const date = value(4).match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
    const id = Number(value(0));
    const day = Number(value(3));
    const efficiency = value(7) === "NA" ? null : Number(value(7));
    if (!date || !Number.isInteger(id) || !Number.isInteger(day) || (efficiency !== null && !Number.isFinite(efficiency))) throw new Error("Invalid NASA actigraphy row");
    return [id, value(1), value(2), day, `${date[3]}-${date[1]!.padStart(2, "0")}-${date[2]!.padStart(2, "0")}`, minutes(value(5)), minutes(value(6)), efficiency, value(8) === "NA" ? null : value(8)];
  });
  if (parsed.length === 0 || parsed.every((row) => row[6] === null)) throw new Error("No usable NASA sleep data");
  return parsed;
}

export function parseRadiation(json: unknown): RadiationTuple[] {
  if (typeof json !== "object" || json === null || !("columns" in json) || !("data" in json) || !Array.isArray(json.columns) || !Array.isArray(json.data)) throw new Error("Invalid RadLab JSON");
  const columns = json.columns as unknown[];
  const time = columns.indexOf("timestamp");
  const instrument = columns.indexOf("instrument_id");
  const dose = columns.indexOf("absorbed_dose_rate");
  const latitude = columns.indexOf("latitude");
  const longitude = columns.indexOf("longitude");
  const altitude = columns.indexOf("altitude");
  const flux = columns.indexOf("flux");
  if ([time, instrument, dose, latitude, longitude, altitude, flux].some((index) => index < 0)) throw new Error("Missing RadLab fields");
  const optionalNumber = (value: unknown): number | null => {
    if (value === null) return null;
    if (typeof value !== "number" || !Number.isFinite(value)) throw new Error("Invalid RadLab coordinate or flux");
    return value;
  };
  const rows = json.data.map((entry): RadiationTuple => {
    if (!Array.isArray(entry) || typeof entry[time] !== "string" || typeof entry[instrument] !== "string" || typeof entry[dose] !== "number" || !Number.isFinite(entry[dose])) throw new Error("Invalid RadLab row");
    return [entry[time], entry[instrument], entry[dose], optionalNumber(entry[latitude]), optionalNumber(entry[longitude]), optionalNumber(entry[altitude]), optionalNumber(entry[flux])];
  });
  if (rows.length === 0) throw new Error("No RadLab readings");
  return rows;
}

function sourceDate(value: string): string {
  const parts = value.match(/^(\d{1,2})\/(\d{1,2})\/(\d{2,4})$/);
  if (!parts) throw new Error("Invalid NASA exercise date");
  const year = parts[3]!.length === 2 ? `20${parts[3]}` : parts[3]!;
  return `${year}-${parts[1]!.padStart(2, "0")}-${parts[2]!.padStart(2, "0")}`;
}

export function parseExercise(restCsv: string, peakCsv: string): ExerciseTuple[] {
  const [restHeader, ...restRows] = csvCells(restCsv);
  const [peakHeader, ...peakRows] = csvCells(peakCsv);
  if (!restHeader || !peakHeader) throw new Error("Missing NASA exercise header");
  const read = (header: string[], row: string[], column: string): string => {
    const index = header.indexOf(column);
    if (index < 0 || row[index] === undefined) throw new Error(`Missing NASA exercise column ${column}`);
    return row[index];
  };
  const rest = restRows.find((row) => read(restHeader, row, "Stage") === "Seated Rest");
  if (!rest) throw new Error("Missing NASA exercise rest row");
  const make = (file: ExerciseTuple[0], header: string[], row: string[], stage: string, elapsedMinutes: number, heartRate: number, watts: number): ExerciseTuple => {
    const id = Number(read(header, row, "ID"));
    const subject = read(header, row, "Subject");
    if (!Number.isSafeInteger(id) || id < 0 || !subject || !Number.isFinite(elapsedMinutes) || elapsedMinutes < 0 || !Number.isFinite(heartRate) || heartRate <= 0 || !Number.isFinite(watts) || watts < 0) throw new Error("Invalid NASA exercise value");
    return [file, id, subject, sourceDate(read(header, row, "Date")), stage, elapsedMinutes, heartRate, watts];
  };
  const rows: ExerciseTuple[] = [make("SUBMAX_SUMMARY", restHeader, rest, "Seated Rest", 0, Number(read(restHeader, rest, "HR")), Number(read(restHeader, rest, "Workload")))];
  for (const row of peakRows) {
    const stage = read(peakHeader, row, "Stage");
    rows.push(make("PEAK_SUMMARY", peakHeader, row, stage, Number(read(peakHeader, row, "Cumulative Time (min)")), Number(read(peakHeader, row, "HR (bpm)")), Number(read(peakHeader, row, "Watts"))));
  }
  if (rows.length < 5 || rows[0]![5] !== 0 || rows[rows.length - 1]![5] <= 0 || rows.some((row) => row[2] !== rows[0]![2] || row[3] !== rows[0]![3]) || rows.some((row, index) => index > 0 && (index === rows.length - 1 ? row[5] < rows[index - 1]![5] : row[5] <= rows[index - 1]![5]))) throw new Error("Inconsistent NASA exercise stages");
  return rows;
}

async function fetchActigraphy(fetcher: typeof fetch): Promise<ActigraphyTuple[]> {
  const response = await fetcher(ACTIGRAPHY_URL, { signal: AbortSignal.timeout(4000) });
  if (!response.ok) throw new Error(`NASA actigraphy HTTP ${response.status}`);
  return parseActigraphy(await response.text());
}

async function fetchRadiation(fetcher: typeof fetch): Promise<RadiationTuple[]> {
  const response = await fetcher(RADIATION_URL, { signal: AbortSignal.timeout(4000) });
  if (!response.ok) throw new Error(`NASA RadLab HTTP ${response.status}`);
  return parseRadiation(await response.json());
}

async function fetchExercise(fetcher: typeof fetch): Promise<ExerciseTuple[]> {
  const [rest, peak] = await Promise.all([
    fetcher(EXERCISE_REST_URL, { signal: AbortSignal.timeout(4000) }),
    fetcher(EXERCISE_PEAK_URL, { signal: AbortSignal.timeout(4000) }),
  ]);
  if (!rest.ok || !peak.ok) throw new Error("NASA exercise request failed");
  const [restCsv, peakCsv] = await Promise.all([rest.text(), peak.text()]);
  return parseExercise(restCsv, peakCsv);
}

export async function loadNasaData(fetcher: typeof fetch = fetch): Promise<NasaData> {
  const [sleep, radiation, exercise] = await Promise.allSettled([fetchActigraphy(fetcher), fetchRadiation(fetcher), fetchExercise(fetcher)]);
  const actigraphy = sleep.status === "fulfilled" ? sleep.value : actigraphyRows;
  const doseRates = radiation.status === "fulfilled" ? radiation.value : radiationRows;
  const exerciseStages = exercise.status === "fulfilled" ? exercise.value : exerciseRows;
  return {
    actigraphy,
    radiation: doseRates,
    exercise: exerciseStages,
    revision: hash([actigraphy, doseRates, exerciseStages]),
    actigraphyMode: sleep.status === "fulfilled" ? "LIVE" : "BUNDLED_SNAPSHOT",
    radiationMode: radiation.status === "fulfilled" ? "LIVE" : "BUNDLED_SNAPSHOT",
    exerciseMode: exercise.status === "fulfilled" ? "LIVE" : "BUNDLED_SNAPSHOT",
  };
}
