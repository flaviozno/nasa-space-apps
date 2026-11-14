import { MAX_SEQUENCE } from "../utils/time.ts";
import type { SyncRequest } from "./sync.ts";
import { simulate } from "../domain/simulator.ts";
import { actigraphyRows, exerciseRows, radiationRows } from "../reference/nasa-snapshots.ts";

const integrationGuide = `## Integration guide

1. Call **GET /api/health** to check whether the emulator is enabled. A healthy response is \`200 {"status":"ok","version":1,"enabled":true}\`. This endpoint needs no Bearer token.
2. Configure a private \`SIMULATOR_TOKEN\` on the emulator and send \`Authorization: Bearer <token>\` on both POST endpoints. In Swagger UI, click **Authorize** and enter the token. If Vercel Deployment Protection is enabled, access to the deployment itself also requires Vercel authentication.
3. Call **POST /api/sync** with either valid example below. Supply one to three distinct \`deviceId\` values, each with its \`bootId\` and next \`fromSequence\`. Use \`0\` for a new device/boot. \`requestedAtMs\` and \`untilAcquiredAtMs\` are Unix milliseconds; both examples' cutoffs return readings. Set \`maxRecords\` to 1–100 (or the lower configured limit). \`NASA_EXERCISE_REPLAY\` interpolates heart rate from real NASA exercise-stage checkpoints and marks its synthetic recovery separately. A \`200\` response contains \`readings\`, \`transferId\`, and \`hasMore\`.
4. Persist the received batch before changing any cursor. For each device and boot, set its next \`fromSequence\` to the largest accepted \`sequenceNumber + 1\`. Leave a cursor unchanged when no reading was accepted. When \`hasMore\` is true, call sync again with the updated cursors and a new \`requestId\`; the emulator is stateless and does not store cursors. Deduplicate by \`sampleId\`.
5. After persistence, call **POST /api/receipt-acks** with the actual \`transferId\` and \`requestId\` from the batch, your \`receivedAtMs\`, and the accepted \`sampleId\` values. Expect **204 with an empty body**. ACK is stateless and does not prove persistence; keep that state on the VPS.

SpO₂, body temperature, and battery remain simulated; heart rate is simulated in the original scenarios and based on NASA exercise checkpoints only in \`NASA_EXERCISE_REPLAY\`. \`heartRateOrigin\` distinguishes these cases. Each reading exposes the historical source records directly as \`sleep\` and \`radiation\`; \`exercise\` contains source-stage evidence when replay is requested and is null in other scenarios. The target wearable includes an onboard radiation sensor. In this MVP, historical ISS DosTel values provide demonstration input for that channel; they are environmental references, not personal dose measurements. The emulator fetches public NASA sources during sync and uses a bundled snapshot for each unavailable source. The headers \`X-NASA-Actigraphy-Source\`, \`X-NASA-Radiation-Source\`, and \`X-NASA-Exercise-Source\` report \`LIVE\` or \`BUNDLED_SNAPSHOT\`. Original NASA dates do not equal \`acquiredAtMs\`; do not ingest historical sleep duration as a current wearable \`sleep_duration\` observation. Radiation is device telemetry in the target design, but its MVP source values are not personal dose measurements or a crew-health metric. Divide \`spo2HundredthsPercent\` and \`temperatureHundredthsCelsius\` by 100 for percent and °C. \`sensorStatus: INVALID\` makes the four physiological metrics null; it does not invalidate the NASA evidence. Baselines come from another system and are not returned here.

**Errors:** \`400\` invalid JSON or fields; \`401\` missing/invalid Bearer token; \`405\` wrong method; \`409\` version or duplicate device conflict; \`413\` request limit exceeded; \`503\` disabled emulator or invalid configuration. Read \`error.code\` for programmatic handling; \`error.message\` may be in Portuguese. Vercel Deployment Protection can reject a request before it reaches this API.`;

const syncRequestExample: SyncRequest = {
  version: 1,
  requestId: "req-demo-1",
  sessionId: "session-demo-1",
  requestedAtMs: 1767225660000,
  scenario: "NORMAL",
  devices: [{ deviceId: "wearable-01", bootId: "boot-demo-1", fromSequence: 0 }],
  maxRecords: 1,
  untilAcquiredAtMs: 1767225660000,
};

const exampleNasaData = {
  actigraphy: actigraphyRows, radiation: radiationRows, exercise: exerciseRows,
  actigraphyMode: "BUNDLED_SNAPSHOT" as const,
  radiationMode: "BUNDLED_SNAPSHOT" as const,
  exerciseMode: "BUNDLED_SNAPSHOT" as const,
};
const syncResponseExample = simulate(syncRequestExample, exampleNasaData);
const exerciseRequestExample: SyncRequest = {
  ...syncRequestExample,
  requestId: "req-exercise-1",
  requestedAtMs: 1767226200000,
  scenario: "NASA_EXERCISE_REPLAY",
  devices: [{ deviceId: "wearable-01", bootId: "boot-demo-1", fromSequence: 540 }],
  untilAcquiredAtMs: 1767226200000,
};
const exerciseResponseExample = simulate(exerciseRequestExample, exampleNasaData);

const receiptAckExample = {
  version: 1,
  transferId: syncResponseExample.transferId,
  requestId: syncRequestExample.requestId,
  receivedAtMs: 1767225661000,
  acceptedSampleIds: [syncResponseExample.readings[0]!.sampleId],
} as const;

export const openApiDocument = {
  openapi: '3.0.3',
  info: {
    title: 'Wearable Mock Emulator',
    version: '1.0.0',
    description: integrationGuide,
  },
  servers: [{ url: '/' }],
  tags: [{ name: 'Emulator', description: 'Wearable simulation with historical NASA data replay.' }],
  paths: {
    '/api/health': {
      get: {
        tags: ['Emulator'], summary: 'Get emulator status',
        description: 'Call first. This unauthenticated check reports whether the emulator is enabled; it does not verify that a private token is configured.',
        responses: {
          '200': { description: 'Current status.', content: { 'application/json': { schema: { $ref: '#/components/schemas/Health' }, example: { status: 'ok', version: 1, enabled: true } } }, },
          '405': { $ref: '#/components/responses/Error' },
          '503': { $ref: '#/components/responses/Error' },
        },
      },
    },
    '/api/sync': {
      post: {
        tags: ['Emulator'], summary: 'Generate a telemetry batch', security: [{ bearerAuth: [] }],
        description: 'The onboard VPS polls this stateless endpoint. In NASA_EXERCISE_REPLAY, heart rate follows interpolated checkpoints from a NASA Earth analog cycle-ergometry test; recovery is simulated and labeled. Other scenarios keep their existing simulated heart rate. NASA actigraphy is replayed as successive available nights for one source participant per device/boot. ISS DosTel radiation includes absorbed dose rate, coordinates, altitude, and particle flux where available. Each reading exposes sleep, radiation, and optional exercise evidence directly. All NASA observations retain original dates. Four public NASA data sources are queried concurrently during sync with a bundled snapshot fallback per source. X-NASA-Actigraphy-Source, X-NASA-Radiation-Source, and X-NASA-Exercise-Source headers report LIVE or BUNDLED_SNAPSHOT. Persist readings before advancing each device/boot cursor.',
        requestBody: { required: true, content: { 'application/json': { schema: { $ref: '#/components/schemas/SyncRequest' }, examples: { normal: { summary: 'Normal sync from sequence 0', value: syncRequestExample }, nasaExercise: { summary: 'NASA exercise replay at source stage 3', value: exerciseRequestExample } } } } },
        responses: {
          '200': { description: 'Generated telemetry batch. Each named response matches its corresponding request example using the bundled NASA snapshot.', headers: { 'X-NASA-Actigraphy-Source': { schema: { type: 'string', enum: ['LIVE', 'BUNDLED_SNAPSHOT'] } }, 'X-NASA-Radiation-Source': { schema: { type: 'string', enum: ['LIVE', 'BUNDLED_SNAPSHOT'] } }, 'X-NASA-Exercise-Source': { schema: { type: 'string', enum: ['LIVE', 'BUNDLED_SNAPSHOT'] } } }, content: { 'application/json': { schema: { $ref: '#/components/schemas/TelemetryBatch' }, examples: { normal: { summary: 'Normal sync result', value: syncResponseExample }, nasaExercise: { summary: 'NASA exercise replay result', value: exerciseResponseExample } } } } },
          '400': { $ref: '#/components/responses/Error' }, '401': { $ref: '#/components/responses/Error' },
          '409': { $ref: '#/components/responses/Error' }, '413': { $ref: '#/components/responses/Error' },
          '503': { $ref: '#/components/responses/Error' },
        },
      },
    },
    '/api/receipt-acks': {
      post: {
        tags: ['Emulator'], summary: 'Acknowledge batch receipt', security: [{ bearerAuth: [] }],
        description: 'Call after the VPS persists a batch. Copy transferId and requestId from the sync response and include accepted sample IDs. Retries are safe; the emulator does not store or validate receipt history.',
        requestBody: { required: true, content: { 'application/json': { schema: { $ref: '#/components/schemas/ReceiptAck' }, example: receiptAckExample } } },
        responses: {
          '204': { description: 'Acknowledgement accepted; no content.' }, '400': { $ref: '#/components/responses/Error' },
          '401': { $ref: '#/components/responses/Error' }, '409': { $ref: '#/components/responses/Error' },
          '413': { $ref: '#/components/responses/Error' }, '503': { $ref: '#/components/responses/Error' },
        },
      },
    },
  },
  components: {
    securitySchemes: { bearerAuth: { type: 'http', scheme: 'bearer', bearerFormat: 'SIMULATOR_TOKEN', description: 'Set Authorization: Bearer <SIMULATOR_TOKEN>. Required for sync and ACK, but not health or documentation.' } },
    responses: { Error: { description: 'API error. Inspect error.code for programmatic handling; the body always includes version: 1. The code and message depend on the HTTP status and failed validation.', content: { 'application/json': { schema: { $ref: '#/components/schemas/Error' } } } } },
    schemas: {
      Identifier: { type: 'string', description: '1–128 characters; begins with a letter or digit, then letters, digits, periods, underscores, colons, or hyphens.', minLength: 1, maxLength: 128, pattern: '^[A-Za-z0-9][A-Za-z0-9._:-]{0,127}$' },
      Health: { type: 'object', required: ['status', 'version', 'enabled'], properties: { status: { type: 'string', enum: ['ok', 'disabled'], description: 'ok when enabled, disabled otherwise.' }, version: { type: 'integer', enum: [1] }, enabled: { type: 'boolean', description: 'Reports generation enabled; does not confirm token configuration.' } } },
      DeviceCursor: { type: 'object', required: ['deviceId', 'bootId', 'fromSequence'], properties: { deviceId: { $ref: '#/components/schemas/Identifier' }, bootId: { $ref: '#/components/schemas/Identifier' }, fromSequence: { type: 'integer', minimum: 0, maximum: MAX_SEQUENCE, example: 0, description: 'Inclusive next sequence to request for this device and boot. Start at 0. After persisting readings, use max accepted sequenceNumber + 1; otherwise keep the previous value.' } } },
      SyncRequest: { type: 'object', required: ['version', 'requestId', 'sessionId', 'requestedAtMs', 'scenario', 'devices', 'maxRecords', 'untilAcquiredAtMs'], properties: { version: { type: 'integer', enum: [1], description: 'Contract version; must be 1.' }, requestId: { allOf: [{ $ref: '#/components/schemas/Identifier' }], description: 'Caller supplied ID. Keep it unchanged for retries; use a new ID for the next page.' }, sessionId: { allOf: [{ $ref: '#/components/schemas/Identifier' }], description: 'Caller supplied synchronization session ID.' }, requestedAtMs: { type: 'integer', minimum: 0, maximum: 9007199254740991, description: 'Caller supplied Unix time in milliseconds, echoed as generatedAtMs. No server clock is used.' }, scenario: { type: 'string', enum: ['NORMAL', 'ELEVATED_HEART_RATE', 'LOW_SPO2', 'NASA_EXERCISE_REPLAY'], description: 'NORMAL: heart rate 60–95 bpm, SpO₂ 96–100%; ELEVATED_HEART_RATE: heart rate 130–180 bpm; LOW_SPO2: SpO₂ 85–92%; NASA_EXERCISE_REPLAY: heart rate follows NASA exercise stages over 10 minutes, then 5 minutes of simulated recovery.' }, devices: { type: 'array', minItems: 1, maxItems: 3, description: 'One to three distinct deviceId values with independent boot/sequence cursors.', items: { $ref: '#/components/schemas/DeviceCursor' } }, maxRecords: { type: 'integer', minimum: 1, maximum: 100, description: 'Maximum total readings across all requested devices, subject to MAX_RECORDS_PER_SYNC configuration.' }, untilAcquiredAtMs: { type: 'integer', minimum: 0, maximum: 9007199254740991, description: 'Inclusive Unix millisecond cutoff. A sequence is eligible when 1767225600000 + sequenceNumber × 1000 is at or before this time.' } } },
      SleepEvidence: { type: 'object', required: ['sourceRecordId', 'subjectCode', 'phase', 'sourceDate', 'bedRestDay', 'latencyMinutes', 'durationMinutes', 'efficiencyPercent', 'note'], description: 'Historical sleep record from a NASA Earth bed-rest study, with its original date.', properties: {
          sourceRecordId: { type: 'integer', description: 'Original actigraphy CSV row ID.' }, subjectCode: { type: 'string', description: 'Pseudonymous Earth analog participant code; one participant is held constant per device/boot.' }, phase: { type: 'string', enum: ['PRE_TEST', 'IN_TEST', 'POST_TEST'] },
          sourceDate: { type: 'string', format: 'date', description: 'Original 2004 observation date. Available observations advance with emulator days.' }, bedRestDay: { type: 'integer', description: 'BR_Day in the source CSV.' },
          latencyMinutes: { type: 'number', nullable: true, description: 'Observed sleep latency converted from source H:mm to minutes.' }, durationMinutes: { type: 'number', description: 'Observed sleep duration converted from source H:mm:ss to minutes.' }, efficiencyPercent: { type: 'number', nullable: true, description: 'Observed sleep efficiency in percent.' }, note: { type: 'string', nullable: true, description: 'Source note, including medication annotations.' },
      } },
      RadiationEvidence: { type: 'object', required: ['sourceTimestamp', 'instrumentId', 'absorbedDoseRateMicroGyPerHour', 'latitudeDegrees', 'longitudeDegrees', 'altitudeKilometers', 'particleFluxPerCm2SrSecond'], description: 'MVP demonstration input for the target wearable onboard radiation sensor, sourced from historical ISS DosTel environmental observations; not a crew member personal dose.', properties: {
          sourceTimestamp: { type: 'string', description: 'Original RadLab timestamp in 2022; timezone is not assumed.' }, instrumentId: { type: 'string', enum: ['DosTel1', 'DosTel2'] }, absorbedDoseRateMicroGyPerHour: { type: 'number', description: 'ISS instrument absorbed dose rate in μGy/hour; not personal dose equivalent.' },
          latitudeDegrees: { type: 'number', nullable: true, description: 'ISS latitude in degrees where available.' }, longitudeDegrees: { type: 'number', nullable: true, description: 'ISS longitude in degrees where available.' }, altitudeKilometers: { type: 'number', nullable: true, description: 'ISS altitude in kilometers where available.' }, particleFluxPerCm2SrSecond: { type: 'number', nullable: true, description: 'Particle flux in cm^-2 sr^-1 s^-1 where available.' },
      } },
      ExerciseEvidence: { type: 'object', nullable: true, description: 'Present only in NASA_EXERCISE_REPLAY. Interpolated exercise is based on NASA checkpoints; recovery is synthetic. Null in other scenarios.', required: ['sourceDate', 'subjectCode', 'phase', 'elapsedSeconds', 'fromStage', 'toStage', 'fromSourceHeartRateBpm', 'toSourceHeartRateBpm', 'fromSourceRecordId', 'toSourceRecordId', 'fromSourceFileKey', 'toSourceFileKey', 'simulatedWorkloadWatts'], properties: {
          sourceDate: { type: 'string', format: 'date', description: 'Original 2005 exercise-test date.' }, subjectCode: { type: 'string', description: 'Pseudonymous Earth analog participant code.' }, phase: { type: 'string', enum: ['EXERCISE', 'SIMULATED_RECOVERY'] }, elapsedSeconds: { type: 'integer', description: 'Seconds within the repeated 15-minute emulator exercise cycle.' },
          fromStage: { type: 'string' }, toStage: { type: 'string' }, fromSourceHeartRateBpm: { type: 'number', description: 'NASA heart-rate checkpoint at the beginning of the interval.' }, toSourceHeartRateBpm: { type: 'number', description: 'NASA heart-rate checkpoint at the end of the interval.' }, fromSourceRecordId: { type: 'integer' }, toSourceRecordId: { type: 'integer' }, fromSourceFileKey: { type: 'string', enum: ['SUBMAX_SUMMARY', 'PEAK_SUMMARY'], description: 'NASA exercise CSV containing the starting checkpoint: exerciseRestUrl for SUBMAX_SUMMARY, exercisePeakUrl for PEAK_SUMMARY.' }, toSourceFileKey: { type: 'string', enum: ['SUBMAX_SUMMARY', 'PEAK_SUMMARY'], description: 'NASA exercise CSV containing the ending checkpoint.' }, simulatedWorkloadWatts: { type: 'number', description: 'Emulator interpolation of NASA stage workload checkpoints; not a wearable measurement.' },
      } },
      TelemetryReading: { type: 'object', required: ['sampleId', 'deviceId', 'bootId', 'sequenceNumber', 'acquiredAtMs', 'validityMask', 'sensorStatus', 'heartRateBpm', 'heartRateOrigin', 'spo2HundredthsPercent', 'temperatureHundredthsCelsius', 'batteryMillivolts', 'dataSource', 'sleep', 'radiation', 'exercise'], properties: { sampleId: { type: 'string', pattern: '^sample_[a-f0-9]{64}$', description: 'Stable identifier derived from deviceId, bootId, and sequenceNumber. Use to deduplicate retried samples.' }, deviceId: { $ref: '#/components/schemas/Identifier' }, bootId: { $ref: '#/components/schemas/Identifier' }, sequenceNumber: { type: 'integer', minimum: 0, description: 'Sequence within a device/boot. Use for cursor advancement after successful persistence.' }, acquiredAtMs: { type: 'integer', minimum: 0, description: 'Unix milliseconds: 1767225600000 + sequenceNumber × 1000.' }, validityMask: { type: 'integer', minimum: 0, maximum: 15, description: 'Bit 0 heart rate, bit 1 SpO₂, bit 2 temperature, bit 3 battery. Current output uses 15 for VALID and 0 for INVALID.' }, sensorStatus: { type: 'string', enum: ['VALID', 'INVALID', 'DEGRADED'], description: 'INVALID means all four metric values are null. DEGRADED is reserved and is not generated currently.' }, heartRateBpm: { type: 'integer', nullable: true, description: 'Heart rate in bpm. In NASA_EXERCISE_REPLAY, interpolated from NASA exercise checkpoints or derived for simulated recovery; null when sensorStatus is INVALID.' }, heartRateOrigin: { type: 'string', enum: ['SIMULATED', 'NASA_ANALOG_INTERPOLATED', 'NASA_ANALOG_DERIVED_RECOVERY'], description: 'Provenance of heartRateBpm. SIMULATED is used in the three original scenarios.' }, spo2HundredthsPercent: { type: 'integer', nullable: true, description: 'SpO₂ in hundredths of a percent; divide by 100, or null when invalid.' }, temperatureHundredthsCelsius: { type: 'integer', nullable: true, description: 'Body temperature in hundredths of a degree Celsius; divide by 100, or null when invalid.' }, batteryMillivolts: { type: 'integer', nullable: true, description: 'Battery voltage in millivolts, or null when invalid.' }, dataSource: { type: 'string', enum: ['SIMULATED'], description: 'The sample timeline and device values are emulated. Use heartRateOrigin and direct NASA evidence fields for precise provenance.' }, sleep: { $ref: '#/components/schemas/SleepEvidence' }, radiation: { $ref: '#/components/schemas/RadiationEvidence' }, exercise: { $ref: '#/components/schemas/ExerciseEvidence' } } },
      TelemetryBatch: { type: 'object', required: ['version', 'transferId', 'requestId', 'sessionId', 'generatedAtMs', 'hasMore', 'readings'], properties: { version: { type: 'integer', enum: [1] }, transferId: { type: 'string', pattern: '^transfer_[a-f0-9]{64}$', description: 'Batch identifier to send in the receipt ACK.' }, requestId: { allOf: [{ $ref: '#/components/schemas/Identifier' }], description: 'Echoes the sync request ID; send the same value in the receipt ACK.' }, sessionId: { $ref: '#/components/schemas/Identifier' }, generatedAtMs: { type: 'integer', minimum: 0, description: 'Echoes requestedAtMs, not the server time.' }, hasMore: { type: 'boolean', description: 'True when another reading exists for at least one requested device before untilAcquiredAtMs. Advance persisted cursors and request another page.' }, readings: { type: 'array', description: 'Up to maxRecords readings, interleaved across devices. May be empty if no sequence is eligible.', items: { $ref: '#/components/schemas/TelemetryReading' } } } },
      ReceiptAck: { type: 'object', required: ['version', 'transferId', 'requestId', 'receivedAtMs', 'acceptedSampleIds'], properties: { version: { type: 'integer', enum: [1] }, transferId: { type: 'string', pattern: '^transfer_[a-f0-9]{64}$', description: 'Copy from the sync response; the emulator validates its format only.' }, requestId: { $ref: '#/components/schemas/Identifier' }, receivedAtMs: { type: 'integer', minimum: 0, maximum: 9007199254740991, description: 'Unix milliseconds assigned by the VPS when it receives/persists the batch.' }, acceptedSampleIds: { type: 'array', maxItems: 100, description: 'IDs of readings accepted by the VPS. An empty list is valid. The emulator does not store or cross-check these IDs against a batch.', items: { type: 'string', pattern: '^sample_[a-f0-9]{64}$' } } } },
      Error: { type: 'object', required: ['version', 'error'], properties: { version: { type: 'integer', enum: [1] }, error: { type: 'object', required: ['code', 'message'], properties: { code: { type: 'string' }, message: { type: 'string' } } } } },
    },
  },
} as const;
