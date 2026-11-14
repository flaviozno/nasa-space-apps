export const openApiDocument = {
  openapi: '3.0.3',
  info: {
    title: 'Wearable Mock Emulator',
    version: '1.0.0',
    description: 'Simulated wearable telemetry API for onboard VPS integration.',
  },
  servers: [{ url: '/' }],
  tags: [{ name: 'Emulator', description: 'Simulated wearable endpoints.' }],
  paths: {
    '/api/health': {
      get: {
        tags: ['Emulator'], summary: 'Get emulator status',
        responses: {
          '200': { description: 'Current status.', content: { 'application/json': { schema: { $ref: '#/components/schemas/Health' } } }, },
          '405': { $ref: '#/components/responses/Error' },
          '503': { $ref: '#/components/responses/Error' },
        },
      },
    },
    '/api/sync': {
      post: {
        tags: ['Emulator'], summary: 'Generate a telemetry batch', security: [{ bearerAuth: [] }],
        requestBody: { required: true, content: { 'application/json': { schema: { $ref: '#/components/schemas/SyncRequest' } } } },
        responses: {
          '200': { description: 'Generated telemetry batch.', content: { 'application/json': { schema: { $ref: '#/components/schemas/TelemetryBatch' } } } },
          '400': { $ref: '#/components/responses/Error' }, '401': { $ref: '#/components/responses/Error' },
          '409': { $ref: '#/components/responses/Error' }, '413': { $ref: '#/components/responses/Error' },
          '503': { $ref: '#/components/responses/Error' },
        },
      },
    },
    '/api/receipt-acks': {
      post: {
        tags: ['Emulator'], summary: 'Acknowledge batch receipt', security: [{ bearerAuth: [] }],
        requestBody: { required: true, content: { 'application/json': { schema: { $ref: '#/components/schemas/ReceiptAck' } } } },
        responses: {
          '204': { description: 'Acknowledgement accepted; no content.' }, '400': { $ref: '#/components/responses/Error' },
          '401': { $ref: '#/components/responses/Error' }, '409': { $ref: '#/components/responses/Error' },
          '413': { $ref: '#/components/responses/Error' }, '503': { $ref: '#/components/responses/Error' },
        },
      },
    },
  },
  components: {
    securitySchemes: { bearerAuth: { type: 'http', scheme: 'bearer', bearerFormat: 'SIMULATOR_TOKEN' } },
    responses: { Error: { description: 'API error.', content: { 'application/json': { schema: { $ref: '#/components/schemas/Error' } } } } },
    schemas: {
      Identifier: { type: 'string', minLength: 1, maxLength: 128, pattern: '^[A-Za-z0-9][A-Za-z0-9._:-]{0,127}$' },
      Health: { type: 'object', required: ['status', 'version', 'enabled'], properties: { status: { type: 'string', enum: ['ok', 'disabled'] }, version: { type: 'integer', enum: [1] }, enabled: { type: 'boolean' } } },
      DeviceCursor: { type: 'object', required: ['deviceId', 'bootId', 'fromSequence'], properties: { deviceId: { $ref: '#/components/schemas/Identifier' }, bootId: { $ref: '#/components/schemas/Identifier' }, fromSequence: { type: 'integer', minimum: 0, maximum: 9007199254740991 } } },
      SyncRequest: { type: 'object', required: ['version', 'requestId', 'sessionId', 'requestedAtMs', 'scenario', 'devices', 'maxRecords', 'untilAcquiredAtMs'], properties: { version: { type: 'integer', enum: [1] }, requestId: { $ref: '#/components/schemas/Identifier' }, sessionId: { $ref: '#/components/schemas/Identifier' }, requestedAtMs: { type: 'integer', minimum: 0, maximum: 9007199254740991 }, scenario: { type: 'string', enum: ['NORMAL', 'ELEVATED_HEART_RATE', 'LOW_SPO2'] }, devices: { type: 'array', minItems: 1, maxItems: 3, items: { $ref: '#/components/schemas/DeviceCursor' } }, maxRecords: { type: 'integer', minimum: 1, maximum: 100 }, untilAcquiredAtMs: { type: 'integer', minimum: 0, maximum: 9007199254740991 } } },
      TelemetryReading: { type: 'object', required: ['sampleId', 'deviceId', 'bootId', 'sequenceNumber', 'acquiredAtMs', 'validityMask', 'sensorStatus', 'heartRateBpm', 'spo2HundredthsPercent', 'temperatureHundredthsCelsius', 'batteryMillivolts', 'dataSource'], properties: { sampleId: { type: 'string', pattern: '^sample_[a-f0-9]{64}$' }, deviceId: { $ref: '#/components/schemas/Identifier' }, bootId: { $ref: '#/components/schemas/Identifier' }, sequenceNumber: { type: 'integer', minimum: 0 }, acquiredAtMs: { type: 'integer', minimum: 0 }, validityMask: { type: 'integer', minimum: 0, maximum: 15 }, sensorStatus: { type: 'string', enum: ['VALID', 'INVALID', 'DEGRADED'] }, heartRateBpm: { type: 'integer', nullable: true }, spo2HundredthsPercent: { type: 'integer', nullable: true }, temperatureHundredthsCelsius: { type: 'integer', nullable: true }, batteryMillivolts: { type: 'integer', nullable: true }, dataSource: { type: 'string', enum: ['SIMULATED'] } } },
      TelemetryBatch: { type: 'object', required: ['version', 'transferId', 'requestId', 'sessionId', 'generatedAtMs', 'hasMore', 'baselines', 'readings'], properties: { version: { type: 'integer', enum: [1] }, transferId: { type: 'string', pattern: '^transfer_[a-f0-9]{64}$' }, requestId: { $ref: '#/components/schemas/Identifier' }, sessionId: { $ref: '#/components/schemas/Identifier' }, generatedAtMs: { type: 'integer', minimum: 0 }, hasMore: { type: 'boolean' }, baselines: { type: 'object', description: 'Randomized baseline profiles for the known contract devices, indexed by deviceId.', additionalProperties: { $ref: '#/components/schemas/BaselineProfile' } }, readings: { type: 'array', items: { $ref: '#/components/schemas/TelemetryReading' } } } },
      MetricBaseline: { type: 'object', required: ['median', 'spread'], properties: { median: { type: 'number' }, spread: { type: 'number', exclusiveMinimum: 0 } } },
      BaselineProfile: {
        type: 'object',
        required: ['heart_rate', 'hrv_rmssd', 'spo2', 'resp_rate', 'body_temp', 'sleep_duration', 'exercise_duration', 'body_mass', 'blood_pressure_systolic', 'blood_pressure_diastolic', 'water_intake', 'grip_strength', 'mood', 'stress', 'fatigue', 'sleepiness', 'symptom_headache', 'symptom_back_pain', 'symptom_congestion', 'symptom_eye_irritation', 'symptom_skin', 'symptom_nausea', 'phq4', 'team_climate'],
        properties: {
          heart_rate: { $ref: '#/components/schemas/MetricBaseline' }, hrv_rmssd: { $ref: '#/components/schemas/MetricBaseline' }, spo2: { $ref: '#/components/schemas/MetricBaseline' }, resp_rate: { $ref: '#/components/schemas/MetricBaseline' }, body_temp: { $ref: '#/components/schemas/MetricBaseline' }, sleep_duration: { $ref: '#/components/schemas/MetricBaseline' }, exercise_duration: { $ref: '#/components/schemas/MetricBaseline' }, body_mass: { $ref: '#/components/schemas/MetricBaseline' }, blood_pressure_systolic: { $ref: '#/components/schemas/MetricBaseline' }, blood_pressure_diastolic: { $ref: '#/components/schemas/MetricBaseline' }, water_intake: { $ref: '#/components/schemas/MetricBaseline' }, grip_strength: { $ref: '#/components/schemas/MetricBaseline' }, mood: { $ref: '#/components/schemas/MetricBaseline' }, stress: { $ref: '#/components/schemas/MetricBaseline' }, fatigue: { $ref: '#/components/schemas/MetricBaseline' }, sleepiness: { $ref: '#/components/schemas/MetricBaseline' }, symptom_headache: { $ref: '#/components/schemas/MetricBaseline' }, symptom_back_pain: { $ref: '#/components/schemas/MetricBaseline' }, symptom_congestion: { $ref: '#/components/schemas/MetricBaseline' }, symptom_eye_irritation: { $ref: '#/components/schemas/MetricBaseline' }, symptom_skin: { $ref: '#/components/schemas/MetricBaseline' }, symptom_nausea: { $ref: '#/components/schemas/MetricBaseline' }, phq4: { $ref: '#/components/schemas/MetricBaseline' }, team_climate: { $ref: '#/components/schemas/MetricBaseline' },
        },
      },
      ReceiptAck: { type: 'object', required: ['version', 'transferId', 'requestId', 'receivedAtMs', 'acceptedSampleIds'], properties: { version: { type: 'integer', enum: [1] }, transferId: { type: 'string', pattern: '^transfer_[a-f0-9]{64}$' }, requestId: { $ref: '#/components/schemas/Identifier' }, receivedAtMs: { type: 'integer', minimum: 0, maximum: 9007199254740991 }, acceptedSampleIds: { type: 'array', maxItems: 100, items: { type: 'string', pattern: '^sample_[a-f0-9]{64}$' } } } },
      Error: { type: 'object', required: ['version', 'error'], properties: { version: { type: 'integer', enum: [1] }, error: { type: 'object', required: ['code', 'message'], properties: { code: { type: 'string' }, message: { type: 'string' } } } } },
    },
  },
} as const;
