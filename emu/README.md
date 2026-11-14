# Wearable Telemetry Emulator

A standalone TypeScript wearable emulator. Its existing `/api/sync` response combines simulated device measurements with documented NASA sleep, exercise, and ISS radiation observations.

The emulator runs either as a native Node.js HTTP server or as Vercel Functions. Vercel represents the wearable only; the VPS always initiates synchronization.

> This is an MVP integration emulator, not a production service. It does not implement BLE, MQTT, a ground server, persistence, clinical monitoring, or real device communication.

## How it works

```text
VPS (onboard)                    Wearable emulator
  | -- POST /api/sync ----------> |
  |    SyncRequest + Bearer token |
  | <--- 200 TelemetryBatch ------|
  |                                |
  | persists batch and cursor      |
  | -- POST /api/receipt-acks ---> |
  |    ReceiptAck + Bearer token   |
  | <--- 204 No Content -----------|
```

The emulator is stateless: it does not use a database, Redis, runtime file access, queues, cron jobs, stored cursors, or stored acknowledgements. `/api/sync` fetches NASA public files concurrently and uses checked-in NASA snapshots when a source fails. Baseline profiles are owned by another system and are not returned by this API.

The VPS must persist a batch before advancing its cursor. For each device and boot, advance it to the largest accepted `sequenceNumber + 1`. If no reading was received, keep the cursor unchanged. Retrying an ACK is safe and has no additional effect.

## Requirements

- Node.js 24.x
- npm

## Install and validate

```sh
npm install
npm run typecheck
```

`typescript` and `@types/node` are development-only dependencies. The emulator has no runtime package dependencies.

## Run locally

Copy the example environment file and set a private token:

```sh
cp .env.example .env.local
# Edit .env.local and replace SIMULATOR_TOKEN=change-me
npm run dev
```

The native Node.js server starts at `http://127.0.0.1:3000`. It does not require a Vercel account, CLI, or project.

Set `PORT` or `HOST` before the command to use another interface or port:

```sh
PORT=4000 HOST=0.0.0.0 npm run dev
```

| Command | Purpose |
| --- | --- |
| `npm run dev` | Start the native local HTTP server. |
| `npm run dev:local` | Explicit alias for the native local server. |
| `npm run dev:vercel` | Run through the Vercel CLI (requires it to be installed). |
| `npm run typecheck` | Run strict TypeScript checking without emitting files. |

## API documentation

Swagger UI is available at `http://127.0.0.1:3000/` and `http://127.0.0.1:3000/api/docs`, and the OpenAPI 3.0.3 document is available at `http://127.0.0.1:3000/api/openapi.json`.

The integration guide appears immediately below the title in Swagger and in the OpenAPI `info.description` field for tools that consume the JSON directly. It covers the call order, Bearer authentication, cursor updates, ACKs, NASA replay data, units, and error handling.

Use the same paths after the Vercel deployment domain. Swagger UI loads its frontend assets from the Swagger UI CDN; the JSON contract remains directly available at `/api/openapi.json`.

## Routes

| Method | Route | Authentication | Description |
| --- | --- | --- | --- |
| `GET` | `/` | None | Swagger UI shortcut. |
| `GET` | `/api/docs` | None | Interactive Swagger UI. |
| `GET` | `/api/openapi.json` | None | OpenAPI 3.0.3 JSON contract. |
| `GET` | `/api/health` | None | Returns emulator availability. |
| `POST` | `/api/sync` | Bearer token | Generates device readings with NASA sleep, exercise, and radiation evidence. |
| `POST` | `/api/receipt-acks` | Bearer token | Accepts a receipt acknowledgement. |

Unknown routes return `404`. Each implemented route only accepts the HTTP method listed above.

## NASA data in `/api/sync`

Each sync request fetches four public NASA files concurrently: the [2004 actigraphy CSV](https://nlsp.nasa.gov/api/v1/files/972badfb-238d-5dd5-81f2-8efc729a4452/download), two [2005 exercise summaries](https://nlsp.nasa.gov/view/lsdapub/lsda_experiment/07f12dd0-6725-582c-a4d2-618ed8b8c452) ([seated rest and stages](https://nlsp.nasa.gov/api/v1/files/c2794054-7a25-5891-9e77-5a4f4a2eca9e/download), [stage times and workload](https://nlsp.nasa.gov/api/v1/files/f1d341e1-ccc0-57ed-8249-6dbc045b5c22/download)), and a fixed [2022 ISS DosTel RadLab query](https://visualization.osdr.nasa.gov/radlab/api/?spacecraft=ISS&instrument=DosTel&timestamp%3E=2022-04-01T23%3A00&timestamp%3C2022-04-02T01%3A05&absorbed_dose_rate&latitude&longitude&altitude&flux&format=json). Each request has a 4-second timeout. If any source fails, its collection uses the NASA snapshot checked into `src/reference/` on 2026-11-14.

`X-NASA-Actigraphy-Source`, `X-NASA-Exercise-Source`, and `X-NASA-Radiation-Source` each report `LIVE` or `BUNDLED_SNAPSHOT`. `nasaSources` lists the exact source URLs, and `nasaSources.revision` is a SHA-256 hash of the parsed rows used in the batch. A live response and its identical snapshot produce the same JSON.

### Sleep

`nasaReplay.sleep` includes the source participant, phase, date, bed-rest day, duration in minutes, latency in minutes, efficiency in percent, and the original note. One participant is assigned deterministically per device/boot. Each 86,400 emulator sequences advance to the next available dated observation from that participant; source rows without a duration are skipped. The [actigraphy study](https://nlsp.nasa.gov/search/data/details/e26501eb-7d7a-5012-8c8e-c5bdb3eecaf6?dataType=DATASETS) has 207 rows, including 190 with a duration. These are Earth bed-rest observations, not an astronaut's current sleep.

### Exercise heart rate

The new `NASA_EXERCISE_REPLAY` scenario derives `heartRateBpm` from one participant's [NASA cycle-ergometry test](https://nlsp.nasa.gov/api/v1/files/f1d341e1-ccc0-57ed-8249-6dbc045b5c22/download). Source checkpoints are 49 bpm at seated rest, then 92, 123, 161, 177, and 180 bpm through 10 minutes of exercise. The emulator interpolates between the recorded checkpoints at its one-second cadence and then models a clearly labeled five-minute recovery back toward rest. The 15-minute pattern repeats. `heartRateOrigin` is `NASA_ANALOG_INTERPOLATED` during exercise and `NASA_ANALOG_DERIVED_RECOVERY` during recovery. `nasaReplay.exercise` exposes the original date, subject, source record IDs and file keys (`SUBMAX_SUMMARY` or `PEAK_SUMMARY`), adjacent checkpoints, stage, and simulated workload. The intermediate one-second values and recovery are emulator calculations, not direct NASA measurements.

The existing `NORMAL`, `ELEVATED_HEART_RATE`, and `LOW_SPO2` scenarios keep their previous heart-rate behavior and return `heartRateOrigin: "SIMULATED"` with `nasaReplay.exercise: null`. SpO₂, body temperature, and battery remain simulated in every scenario.

### ISS radiation context

`nasaReplay.radiation` includes a real DosTel absorbed dose rate in μGy/hour, its original source timestamp, instrument, ISS latitude/longitude in degrees, altitude in kilometers, and particle flux in cm⁻² sr⁻¹ s⁻¹ where available. The [RadLab API](https://visualization.osdr.nasa.gov/radlab/gui/data-api/) supplies 180 observations in the fixed historical window, replayed in source order across emulator sequences. These are ISS environmental measurements, not a personal radiation dose.

`acquiredAtMs` is always the emulator's synthetic timeline; the NASA fields retain their historical dates. `dataSource: "SIMULATED"` describes the emulated device sample; inspect `heartRateOrigin` and `nasaReplay` for precise provenance. Treat `nasaReplay.sleep.durationMinutes` as historical context, not as a current wearable `sleep_duration` observation; radiation is likewise environmental context rather than a crew health metric. `sensorStatus: "INVALID"` nulls the four device metrics but leaves source evidence intact. Baselines come from another system.

If NASA revises any public source, a later request can have a different `nasaSources.revision` and `transferId` even with the same payload. Deduplicate stored readings by `sampleId`. The onboard server still initiates `POST /api/sync`, persists the batch, advances cursors, and acknowledges it through `POST /api/receipt-acks`; no NASA request from the onboard server or extra emulator route is required.

## Configuration

| Variable | Default | Rules |
| --- | --- | --- |
| `SIMULATOR_TOKEN` | — | Required by protected endpoints. Missing or `change-me` fails safely with `503`. |
| `SIMULATOR_ENABLED` | `true` | `true` or `false`. `false` rejects sync and ACK requests with `503`. |
| `MAX_RECORDS_PER_SYNC` | `100` | Integer from 1 to 100; maximum total readings in a batch. |
| `SIMULATOR_VERSION` | `1` | Must be `1`. |

Malformed configuration returns `503`. Health does not require a token and reports whether generation is enabled; it does not prove that a valid secret is configured.

## Request examples

Set the base URL and token without writing the token to source control or logs:

```sh
export BASE_URL=http://127.0.0.1:3000
export SIMULATOR_TOKEN='replace-with-your-private-token'
```

Check the emulator:

```sh
curl "$BASE_URL/api/health"
```

Request a batch:

```sh
curl -X POST "$BASE_URL/api/sync" \
  -H "Authorization: Bearer $SIMULATOR_TOKEN" \
  -H 'Content-Type: application/json' \
  --data '{
    "version": 1,
    "requestId": "req-demo-1",
    "sessionId": "session-demo-1",
    "requestedAtMs": 1767225660000,
    "scenario": "NORMAL",
    "devices": [
      { "deviceId": "wearable-01", "bootId": "boot-demo-1", "fromSequence": 0 }
    ],
    "maxRecords": 1,
    "untilAcquiredAtMs": 1767225660000
  }'
```

Expected `200` response for the payload above (bundled NASA snapshot):

```json
{
  "version": 1,
  "requestId": "req-demo-1",
  "sessionId": "session-demo-1",
  "generatedAtMs": 1767225660000,
  "hasMore": true,
  "nasaSources": {
    "revision": "5cdfddba724014e64a4be65618d6a375c6c132fda58dab3b56958fe02361c198",
    "actigraphyUrl": "https://nlsp.nasa.gov/api/v1/files/972badfb-238d-5dd5-81f2-8efc729a4452/download",
    "radiationUrl": "https://visualization.osdr.nasa.gov/radlab/api/?spacecraft=ISS&instrument=DosTel&timestamp%3E=2022-04-01T23%3A00&timestamp%3C2022-04-02T01%3A05&absorbed_dose_rate&latitude&longitude&altitude&flux&format=json",
    "exerciseRestUrl": "https://nlsp.nasa.gov/api/v1/files/c2794054-7a25-5891-9e77-5a4f4a2eca9e/download",
    "exercisePeakUrl": "https://nlsp.nasa.gov/api/v1/files/f1d341e1-ccc0-57ed-8249-6dbc045b5c22/download"
  },
  "readings": [
    {
      "sampleId": "sample_36bf3162a6d99bbce118de6a9a3f7e20d4c31c78c036d668c2952427dd14707a",
      "deviceId": "wearable-01",
      "bootId": "boot-demo-1",
      "sequenceNumber": 0,
      "acquiredAtMs": 1767225600000,
      "validityMask": 15,
      "sensorStatus": "VALID",
      "heartRateBpm": 63,
      "heartRateOrigin": "SIMULATED",
      "spo2HundredthsPercent": 9753,
      "temperatureHundredthsCelsius": 3677,
      "batteryMillivolts": 3911,
      "dataSource": "SIMULATED",
      "nasaReplay": {
        "sleep": {
          "sourceRecordId": 149,
          "subjectCode": "C1G0003",
          "phase": "IN_TEST",
          "sourceDate": "2004-09-17",
          "bedRestDay": 9,
          "latencyMinutes": 16,
          "durationMinutes": 454,
          "efficiencyPercent": 77.5,
          "note": null
        },
        "radiation": {
          "sourceTimestamp": "2022-04-01T23:00:00",
          "instrumentId": "DosTel2",
          "absorbedDoseRateMicroGyPerHour": 10.2160856666667,
          "latitudeDegrees": -43.160972,
          "longitudeDegrees": 131.30666,
          "altitudeKilometers": 429.252563,
          "particleFluxPerCm2SrSecond": 0.5317479314
        },
        "exercise": null
      }
    }
  ],
  "transferId": "transfer_e5f4bdb959f20932dc275edba65719bdbdd9a86e865bd996327519e26d4c22c3"
}
```

The live response has the same values while NASA's source rows match the bundled snapshot.

To replay the NASA exercise trace, use this second `POST /api/sync` payload. It requests sequence 540, nine minutes into the recorded exercise test:

```json
{
  "version": 1,
  "requestId": "req-exercise-1",
  "sessionId": "session-demo-1",
  "requestedAtMs": 1767226200000,
  "scenario": "NASA_EXERCISE_REPLAY",
  "devices": [
    {
      "deviceId": "wearable-01",
      "bootId": "boot-demo-1",
      "fromSequence": 540
    }
  ],
  "maxRecords": 1,
  "untilAcquiredAtMs": 1767226200000
}
```

Expected `200` response for that payload (bundled NASA snapshot):

```json
{
  "version": 1,
  "requestId": "req-exercise-1",
  "sessionId": "session-demo-1",
  "generatedAtMs": 1767226200000,
  "hasMore": true,
  "nasaSources": {
    "revision": "5cdfddba724014e64a4be65618d6a375c6c132fda58dab3b56958fe02361c198",
    "actigraphyUrl": "https://nlsp.nasa.gov/api/v1/files/972badfb-238d-5dd5-81f2-8efc729a4452/download",
    "radiationUrl": "https://visualization.osdr.nasa.gov/radlab/api/?spacecraft=ISS&instrument=DosTel&timestamp%3E=2022-04-01T23%3A00&timestamp%3C2022-04-02T01%3A05&absorbed_dose_rate&latitude&longitude&altitude&flux&format=json",
    "exerciseRestUrl": "https://nlsp.nasa.gov/api/v1/files/c2794054-7a25-5891-9e77-5a4f4a2eca9e/download",
    "exercisePeakUrl": "https://nlsp.nasa.gov/api/v1/files/f1d341e1-ccc0-57ed-8249-6dbc045b5c22/download"
  },
  "readings": [
    {
      "sampleId": "sample_4f3950dfec15172b1f6c9de34f5627fb5b7b9d05dc0d732cb8d95e8aa69616e1",
      "deviceId": "wearable-01",
      "bootId": "boot-demo-1",
      "sequenceNumber": 540,
      "acquiredAtMs": 1767226140000,
      "validityMask": 15,
      "sensorStatus": "VALID",
      "heartRateBpm": 161,
      "heartRateOrigin": "NASA_ANALOG_INTERPOLATED",
      "spo2HundredthsPercent": 9821,
      "temperatureHundredthsCelsius": 3675,
      "batteryMillivolts": 3560,
      "dataSource": "SIMULATED",
      "nasaReplay": {
        "sleep": {
          "sourceRecordId": 149,
          "subjectCode": "C1G0003",
          "phase": "IN_TEST",
          "sourceDate": "2004-09-17",
          "bedRestDay": 9,
          "latencyMinutes": 16,
          "durationMinutes": 454,
          "efficiencyPercent": 77.5,
          "note": null
        },
        "radiation": {
          "sourceTimestamp": "2022-04-01T23:00:00",
          "instrumentId": "DosTel2",
          "absorbedDoseRateMicroGyPerHour": 10.2160856666667,
          "latitudeDegrees": -43.160972,
          "longitudeDegrees": 131.30666,
          "altitudeKilometers": 429.252563,
          "particleFluxPerCm2SrSecond": 0.5317479314
        },
        "exercise": {
          "sourceDate": "2005-07-24",
          "subjectCode": "4023",
          "phase": "EXERCISE",
          "elapsedSeconds": 540,
          "fromStage": "2",
          "toStage": "3",
          "fromSourceHeartRateBpm": 123,
          "toSourceHeartRateBpm": 161,
          "fromSourceRecordId": 2,
          "toSourceRecordId": 3,
          "fromSourceFileKey": "PEAK_SUMMARY",
          "toSourceFileKey": "PEAK_SUMMARY",
          "simulatedWorkloadWatts": 150
        }
      }
    }
  ],
  "transferId": "transfer_9d4ff87f286238bbb9c8e4672130bd887084b6783f6729b313206e8cdd85fa00"
}
```

Swagger has matching named request and response examples for both scenarios.

To acknowledge a batch, send its actual `transferId` and sample IDs:

```ts
const receipt = {
  version: 1,
  transferId: batch.transferId,
  requestId: batch.requestId,
  receivedAtMs: Date.now(), // defined by the VPS, not the emulator
  acceptedSampleIds: batch.readings.map((reading) => reading.sampleId),
};

// POST JSON.stringify(receipt) to /api/receipt-acks with the Bearer token.
// A valid acknowledgement returns 204 with an empty body.
```

## Contract behavior

The contracts under `src/contracts/` are initial MVP contracts and may evolve.

- Only numeric contract `version: 1` is accepted. A different numeric version returns `409`; a missing or malformed version returns `400`.
- Request, session, device, and boot IDs must be 1–128 characters and match `[A-Za-z0-9][A-Za-z0-9._:-]*`.
- Timestamps and sequence numbers are non-negative safe integers.
- A sync request accepts one to three distinct devices. Duplicate `deviceId` values return `409`.
- `fromSequence` is inclusive and means the next requested sequence. `untilAcquiredAtMs` is inclusive.
- Extra input fields are ignored during normalization.
- ACKs validate their shape, version, transfer ID, request ID, timestamp, and up to 100 sample IDs. Empty and duplicated sample-ID lists are accepted.

Because the emulator is stateless, it cannot confirm that an acknowledged batch existed, that a sample ID belonged to that batch, or that the VPS persisted it.

### Deterministic timeline and telemetry

The current contract has no boot-time origin. The emulator therefore uses the fixed acquisition epoch `2026-01-01T00:00:00.000Z` (`1767225600000` ms):

```text
acquiredAtMs = 1767225600000 + sequenceNumber * 1000
```

`requestedAtMs` is copied to `generatedAtMs`; the generator does not call `Date.now()`. Readings are interleaved by timestamp and sequence, with lexical device/boot tie-breaking, so one device does not consume the entire result limit.

- `sampleId` is `sample_` plus a SHA-256 hash of device, boot, and sequence.
- `transferId` is `transfer_` plus a SHA-256 hash of the request ID and normalized batch content.
- In the three original scenarios, device metrics are hash-derived; `Math.random()` is never used. In `NASA_EXERCISE_REPLAY`, heart rate is interpolated from NASA checkpoints while SpO₂, temperature, and battery stay hash-derived.
- Around 1% of readings are deterministically invalid: the four device metrics are `null` and `sensorStatus` is `INVALID`. The NASA replay remains available. Otherwise readings are `VALID`. `DEGRADED` exists in the contract but is not generated yet.
- `validityMask` uses bits 0–3 for heart rate, SpO₂, temperature, and battery. Valid readings use `15`; invalid readings use `0`.
- Ranges are demonstration-only: NORMAL heart rate 60–95 bpm and SpO₂ 96.00–100.00%; ELEVATED_HEART_RATE 130–180 bpm; LOW_SPO2 85.00–92.00%; NASA_EXERCISE_REPLAY heart rate follows the documented 49–180 bpm source checkpoints plus interpolation/recovery; temperature 36.00–37.50 °C; battery 3500–4200 mV. They have no clinical purpose.

## Status codes

Errors use this shape:

```json
{"version":1,"error":{"code":"INVALID_JSON","message":"JSON inválido."}}
```

| Status | Meaning |
| --- | --- |
| `200` | Valid health or sync response. |
| `204` | Valid acknowledgement, including retries. |
| `400` | Invalid JSON, fields, or identifiers. |
| `401` | Missing or invalid Bearer token when enabled and configured. |
| `405` | Unsupported method; includes an `Allow` header. |
| `409` | Contract version conflict or duplicate device. |
| `413` | Body, device, reading, or ACK ID limit exceeded. |
| `500` | Unexpected server error without private details. |
| `503` | Emulator disabled or configuration is invalid. |

The handler checks method first, then configuration and authentication, then request body and contract. Responses are not cached. Platform-level Vercel limits may reject requests before they reach a function and therefore outside this error format.

## Deploy to Vercel

1. Import the `emu` directory as a Vercel project, or run `npx vercel` from this directory.
2. Use the **Other** preset, no build command, no output directory, and Node.js 24.x. In the monorepo, set `emu` as the Root Directory.
3. Configure the four variables from `.env.example` for the required Preview and Production environments. Replace `change-me` with a strong private token.
4. Validate `/api/health`, `/api/docs`, and a protected endpoint on the deployment URL.

## Automatic GitHub deployment

`.github/workflows/deploy-emu.yml` deploys the production emulator on every push to `main` that changes `emu/**`. It can also be started manually from the GitHub Actions tab. The workflow installs dependencies, runs `npm run typecheck`, builds with Vercel, and deploys the prebuilt output.

Before the first deployment, configure these repository values:

| GitHub location | Name | Value |
| --- | --- | --- |
| Secret | `VERCEL_TOKEN` | Vercel access token with permission to deploy this project. |
| Secret | `VERCEL_ORG_ID` | ID of the Vercel account or team that owns the project. |
| Secret | `VERCEL_PROJECT_ID` | ID of the Vercel project whose Root Directory is `emu`. |

Create a GitHub `production` environment, restrict it to the `main` branch, and optionally require reviewers before a deployment. Never commit the token, a `.vercel/` directory, or an environment file containing secrets.

## Out of scope

Production hardening, external authentication, databases, Redis, queues, cron jobs, telemetry or ACK storage, push generation, VPS connections, BLE GATT, MQTT, a ground server, VPS-side deduplication, dashboards, and clinical alerts. Bearer-token comparison uses constant-time hash comparison, but it is not a replacement for production-grade authentication or rate limiting.
