# Wearable Telemetry Emulator

A standalone, deterministic TypeScript mock of a wearable device. It exposes HTTP endpoints that a spacecraft VPS can use to request simulated telemetry and acknowledge received batches.

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

The emulator is stateless: it does not use a database, Redis, files, queues, cron jobs, external calls, stored cursors, or stored acknowledgements. Retrying the same request produces the same telemetry batch.

The VPS must persist a batch before advancing its cursor. For each device and boot, advance it to the largest accepted `sequenceNumber + 1`. If no reading was received, keep the cursor unchanged. Retrying an ACK is safe and has no additional effect.

## Requirements

- Node.js 22.x
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

Swagger UI is available at `http://127.0.0.1:3000/api/docs`, and the OpenAPI 3.0.3 document is available at `http://127.0.0.1:3000/api/openapi.json`.

Use the same paths after the Vercel deployment domain. Swagger UI loads its frontend assets from the Swagger UI CDN; the JSON contract remains directly available at `/api/openapi.json`.

## Routes

| Method | Route | Authentication | Description |
| --- | --- | --- | --- |
| `GET` | `/api/docs` | None | Interactive Swagger UI. |
| `GET` | `/api/openapi.json` | None | OpenAPI 3.0.3 JSON contract. |
| `GET` | `/api/health` | None | Returns emulator availability. |
| `POST` | `/api/sync` | Bearer token | Generates a deterministic telemetry batch. |
| `POST` | `/api/receipt-acks` | Bearer token | Accepts a receipt acknowledgement. |

Unknown routes return `404`. Each implemented route only accepts the HTTP method listed above.

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
    "requestId": "req-1",
    "sessionId": "session-1",
    "requestedAtMs": 1767225660000,
    "scenario": "NORMAL",
    "devices": [
      { "deviceId": "wearable-1", "bootId": "boot-1", "fromSequence": 0 }
    ],
    "maxRecords": 100,
    "untilAcquiredAtMs": 1767225660000
  }'
```

The response includes `transferId`, `requestId`, `sessionId`, `generatedAtMs`, `hasMore`, and `readings`. Repeating the identical request returns identical JSON.

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
- Metric values are hash-derived; `Math.random()` is never used.
- Around 1% of readings are deterministically invalid: all metrics are `null` and `sensorStatus` is `INVALID`. Otherwise readings are `VALID`. `DEGRADED` exists in the contract but is not generated yet.
- `validityMask` uses bits 0–3 for heart rate, SpO₂, temperature, and battery. Valid readings use `15`; invalid readings use `0`.
- Ranges are demonstration-only: NORMAL heart rate 60–95 bpm and SpO₂ 96.00–100.00%; ELEVATED_HEART_RATE 130–180 bpm; LOW_SPO2 85.00–92.00%; temperature 36.00–37.50 °C; battery 3500–4200 mV. They have no clinical purpose.

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
2. Use the **Other** preset, no build command, no output directory, and Node.js 22.x. In the monorepo, set `emu` as the Root Directory.
3. Configure the four variables from `.env.example` for the required Preview and Production environments. Replace `change-me` with a strong private token.
4. Validate `/api/health`, `/api/docs`, and a protected endpoint on the deployment URL.

## Automatic GitHub deployment

`.github/workflows/deploy-emu.yml` deploys the production emulator on every push to `main` that changes `emu/**`. It can also be started manually from the GitHub Actions tab. The workflow installs dependencies, runs `npm run typecheck`, builds with Vercel, and deploys the prebuilt output.

Before the first deployment, configure these repository values:

| GitHub location | Name | Value |
| --- | --- | --- |
| Secret | `VERCEL_TOKEN` | Vercel access token with permission to deploy this project. |
| Variable | `VERCEL_ORG_ID` | ID of the Vercel account or team that owns the project. |
| Variable | `VERCEL_PROJECT_ID` | ID of the Vercel project whose Root Directory is `emu`. |

Create a GitHub `production` environment, restrict it to the `main` branch, and optionally require reviewers before a deployment. Never commit the token, a `.vercel/` directory, or an environment file containing secrets.

## Out of scope

Production hardening, external authentication, databases, Redis, queues, cron jobs, telemetry or ACK storage, push generation, VPS connections, BLE GATT, MQTT, a ground server, VPS-side deduplication, dashboards, and clinical alerts. Bearer-token comparison uses constant-time hash comparison, but it is not a replacement for production-grade authentication or rate limiting.
