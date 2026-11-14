import { MAX_SEQUENCE } from "../utils/time.ts";

const integrationGuide = `## Integration guide

1. Call **GET /api/health** to check whether the emulator is enabled. A healthy response is \`200 {"status":"ok","version":1,"enabled":true}\`. This endpoint needs no Bearer token.
2. Configure a private \`SIMULATOR_TOKEN\` on the emulator and send \`Authorization: Bearer <token>\` on both POST endpoints. In Swagger UI, click **Authorize** and enter the token. If Vercel Deployment Protection is enabled, access to the deployment itself also requires Vercel authentication.
3. Call **POST /api/sync** with the valid example below. Supply one to three distinct \`deviceId\` values, each with its \`bootId\` and next \`fromSequence\`. Use \`0\` for a new device/boot. \`requestedAtMs\` and \`untilAcquiredAtMs\` are Unix milliseconds; the example's cutoff returns readings. Set \`maxRecords\` to 1–100 (or the lower configured limit). A \`200\` response contains \`readings\`, \`transferId\`, and \`hasMore\`.
4. Persist the received batch before changing any cursor. For each device and boot, set its next \`fromSequence\` to the largest accepted \`sequenceNumber + 1\`. Leave a cursor unchanged when no reading was accepted. When \`hasMore\` is true, call sync again with the updated cursors and a new \`requestId\`; the emulator is stateless and does not store cursors. An unchanged request gives the same response, which supports retries.
5. After persistence, call **POST /api/receipt-acks** with the actual \`transferId\` and \`requestId\` from the batch, your \`receivedAtMs\`, and the accepted \`sampleId\` values. Expect **204 with an empty body**. ACK is stateless and does not prove persistence; keep that state on the VPS.

Telemetry values are simulated. \`spo2HundredthsPercent\` and \`temperatureHundredthsCelsius\` need division by 100 for percent and °C. \`sensorStatus: INVALID\` means metric values are null; inspect \`validityMask\` before ingesting them. Baseline profiles come from another system and are not returned here. See each operation's request and response examples below.

**Errors:** \`400\` invalid JSON or fields; \`401\` missing/invalid Bearer token; \`405\` wrong method; \`409\` version or duplicate device conflict; \`413\` request limit exceeded; \`503\` disabled emulator or invalid configuration. Read \`error.code\` for programmatic handling; \`error.message\` may be in Portuguese. Vercel Deployment Protection can reject a request before it reaches this API.`;

const syncRequestExample = {
  version: 1,
  requestId: "req-demo-1",
  sessionId: "session-demo-1",
  requestedAtMs: 1767225660000,
  scenario: "NORMAL",
  devices: [{ deviceId: "wearable-01", bootId: "boot-demo-1", fromSequence: 0 }],
  maxRecords: 1,
  untilAcquiredAtMs: 1767225660000,
} as const;

const syncResponseExample = {
  version: 1,
  transferId: "transfer_67fbe50849e77af9bb4fdea8812827d719661f326ccde156b847ec348afd8d46",
  requestId: "req-demo-1",
  sessionId: "session-demo-1",
  generatedAtMs: 1767225660000,
  hasMore: true,
  readings: [{
    sampleId: "sample_36bf3162a6d99bbce118de6a9a3f7e20d4c31c78c036d668c2952427dd14707a",
    deviceId: "wearable-01",
    bootId: "boot-demo-1",
    sequenceNumber: 0,
    acquiredAtMs: 1767225600000,
    validityMask: 15,
    sensorStatus: "VALID",
    heartRateBpm: 63,
    spo2HundredthsPercent: 9753,
    temperatureHundredthsCelsius: 3677,
    batteryMillivolts: 3911,
    dataSource: "SIMULATED",
  }],
} as const;

const receiptAckExample = {
  version: 1,
  transferId: syncResponseExample.transferId,
  requestId: syncRequestExample.requestId,
  receivedAtMs: 1767225661000,
  acceptedSampleIds: [syncResponseExample.readings[0].sampleId],
} as const;

export const openApiDocument = {
  openapi: '3.0.3',
  info: {
    title: 'Wearable Mock Emulator',
    version: '1.0.0',
    description: integrationGuide,
  },
  servers: [{ url: '/' }],
  tags: [{ name: 'Emulator', description: 'Simulated wearable endpoints.' }],
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
        description: 'The onboard VPS polls this stateless endpoint. Persist readings before advancing each device/boot cursor. Repeat an unchanged request to retry; change requestId for the next page after advancing cursors. hasMore indicates that at least one eligible reading remains before the cutoff.',
        requestBody: { required: true, content: { 'application/json': { schema: { $ref: '#/components/schemas/SyncRequest' }, example: syncRequestExample } } },
        responses: {
          '200': { description: 'Generated telemetry batch for the request example.', content: { 'application/json': { schema: { $ref: '#/components/schemas/TelemetryBatch' }, example: syncResponseExample } } },
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
      SyncRequest: { type: 'object', required: ['version', 'requestId', 'sessionId', 'requestedAtMs', 'scenario', 'devices', 'maxRecords', 'untilAcquiredAtMs'], properties: { version: { type: 'integer', enum: [1], description: 'Contract version; must be 1.' }, requestId: { allOf: [{ $ref: '#/components/schemas/Identifier' }], description: 'Caller supplied ID. Keep it unchanged for retries; use a new ID for the next page.' }, sessionId: { allOf: [{ $ref: '#/components/schemas/Identifier' }], description: 'Caller supplied synchronization session ID.' }, requestedAtMs: { type: 'integer', minimum: 0, maximum: 9007199254740991, description: 'Caller supplied Unix time in milliseconds, echoed as generatedAtMs. No server clock is used.' }, scenario: { type: 'string', enum: ['NORMAL', 'ELEVATED_HEART_RATE', 'LOW_SPO2'], description: 'NORMAL: heart rate 60–95 bpm, SpO₂ 96–100%; ELEVATED_HEART_RATE: heart rate 130–180 bpm; LOW_SPO2: SpO₂ 85–92%.' }, devices: { type: 'array', minItems: 1, maxItems: 3, description: 'One to three distinct deviceId values with independent boot/sequence cursors.', items: { $ref: '#/components/schemas/DeviceCursor' } }, maxRecords: { type: 'integer', minimum: 1, maximum: 100, description: 'Maximum total readings across all requested devices, subject to MAX_RECORDS_PER_SYNC configuration.' }, untilAcquiredAtMs: { type: 'integer', minimum: 0, maximum: 9007199254740991, description: 'Inclusive Unix millisecond cutoff. A sequence is eligible when 1767225600000 + sequenceNumber × 1000 is at or before this time.' } } },
      TelemetryReading: { type: 'object', required: ['sampleId', 'deviceId', 'bootId', 'sequenceNumber', 'acquiredAtMs', 'validityMask', 'sensorStatus', 'heartRateBpm', 'spo2HundredthsPercent', 'temperatureHundredthsCelsius', 'batteryMillivolts', 'dataSource'], properties: { sampleId: { type: 'string', pattern: '^sample_[a-f0-9]{64}$', description: 'Stable identifier derived from deviceId, bootId, and sequenceNumber. Use to deduplicate retried samples.' }, deviceId: { $ref: '#/components/schemas/Identifier' }, bootId: { $ref: '#/components/schemas/Identifier' }, sequenceNumber: { type: 'integer', minimum: 0, description: 'Sequence within a device/boot. Use for cursor advancement after successful persistence.' }, acquiredAtMs: { type: 'integer', minimum: 0, description: 'Unix milliseconds: 1767225600000 + sequenceNumber × 1000.' }, validityMask: { type: 'integer', minimum: 0, maximum: 15, description: 'Bit 0 heart rate, bit 1 SpO₂, bit 2 temperature, bit 3 battery. Current output uses 15 for VALID and 0 for INVALID.' }, sensorStatus: { type: 'string', enum: ['VALID', 'INVALID', 'DEGRADED'], description: 'INVALID means all four metric values are null. DEGRADED is reserved and is not generated currently.' }, heartRateBpm: { type: 'integer', nullable: true, description: 'Heart rate in beats per minute, or null when invalid.' }, spo2HundredthsPercent: { type: 'integer', nullable: true, description: 'SpO₂ in hundredths of a percent; divide by 100, or null when invalid.' }, temperatureHundredthsCelsius: { type: 'integer', nullable: true, description: 'Body temperature in hundredths of a degree Celsius; divide by 100, or null when invalid.' }, batteryMillivolts: { type: 'integer', nullable: true, description: 'Battery voltage in millivolts, or null when invalid.' }, dataSource: { type: 'string', enum: ['SIMULATED'] } } },
      TelemetryBatch: { type: 'object', required: ['version', 'transferId', 'requestId', 'sessionId', 'generatedAtMs', 'hasMore', 'readings'], properties: { version: { type: 'integer', enum: [1] }, transferId: { type: 'string', pattern: '^transfer_[a-f0-9]{64}$', description: 'Batch identifier to send in the receipt ACK.' }, requestId: { allOf: [{ $ref: '#/components/schemas/Identifier' }], description: 'Echoes the sync request ID; send the same value in the receipt ACK.' }, sessionId: { $ref: '#/components/schemas/Identifier' }, generatedAtMs: { type: 'integer', minimum: 0, description: 'Echoes requestedAtMs, not the server time.' }, hasMore: { type: 'boolean', description: 'True when another reading exists for at least one requested device before untilAcquiredAtMs. Advance persisted cursors and request another page.' }, readings: { type: 'array', description: 'Up to maxRecords readings, interleaved across devices. May be empty if no sequence is eligible.', items: { $ref: '#/components/schemas/TelemetryReading' } } } },
      ReceiptAck: { type: 'object', required: ['version', 'transferId', 'requestId', 'receivedAtMs', 'acceptedSampleIds'], properties: { version: { type: 'integer', enum: [1] }, transferId: { type: 'string', pattern: '^transfer_[a-f0-9]{64}$', description: 'Copy from the sync response; the emulator validates its format only.' }, requestId: { $ref: '#/components/schemas/Identifier' }, receivedAtMs: { type: 'integer', minimum: 0, maximum: 9007199254740991, description: 'Unix milliseconds assigned by the VPS when it receives/persists the batch.' }, acceptedSampleIds: { type: 'array', maxItems: 100, description: 'IDs of readings accepted by the VPS. An empty list is valid. The emulator does not store or cross-check these IDs against a batch.', items: { type: 'string', pattern: '^sample_[a-f0-9]{64}$' } } } },
      Error: { type: 'object', required: ['version', 'error'], properties: { version: { type: 'integer', enum: [1] }, error: { type: 'object', required: ['code', 'message'], properties: { code: { type: 'string' }, message: { type: 'string' } } } } },
    },
  },
} as const;
