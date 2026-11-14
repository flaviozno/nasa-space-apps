export const openApiDocument = {
  openapi: '3.0.3',
  info: {
    title: 'Emulador mock de wearable',
    version: '1.0.0',
    description: 'API determinística de telemetria simulada para integração com a VPS de bordo.',
  },
  servers: [{ url: '/' }],
  tags: [{ name: 'Emulador', description: 'Endpoints do wearable simulado.' }],
  paths: {
    '/api/health': {
      get: {
        tags: ['Emulador'], summary: 'Consulta o estado do emulador',
        responses: {
          '200': { description: 'Estado atual.', content: { 'application/json': { schema: { $ref: '#/components/schemas/Health' } } }, },
          '405': { $ref: '#/components/responses/Error' },
          '503': { $ref: '#/components/responses/Error' },
        },
      },
    },
    '/api/sync': {
      post: {
        tags: ['Emulador'], summary: 'Gera um lote de telemetria', security: [{ bearerAuth: [] }],
        requestBody: { required: true, content: { 'application/json': { schema: { $ref: '#/components/schemas/SyncRequest' } } } },
        responses: {
          '200': { description: 'Lote gerado.', content: { 'application/json': { schema: { $ref: '#/components/schemas/TelemetryBatch' } } } },
          '400': { $ref: '#/components/responses/Error' }, '401': { $ref: '#/components/responses/Error' },
          '409': { $ref: '#/components/responses/Error' }, '413': { $ref: '#/components/responses/Error' },
          '503': { $ref: '#/components/responses/Error' },
        },
      },
    },
    '/api/receipt-acks': {
      post: {
        tags: ['Emulador'], summary: 'Confirma o recebimento de um lote', security: [{ bearerAuth: [] }],
        requestBody: { required: true, content: { 'application/json': { schema: { $ref: '#/components/schemas/ReceiptAck' } } } },
        responses: {
          '204': { description: 'ACK aceito; sem corpo.' }, '400': { $ref: '#/components/responses/Error' },
          '401': { $ref: '#/components/responses/Error' }, '409': { $ref: '#/components/responses/Error' },
          '413': { $ref: '#/components/responses/Error' }, '503': { $ref: '#/components/responses/Error' },
        },
      },
    },
  },
  components: {
    securitySchemes: { bearerAuth: { type: 'http', scheme: 'bearer', bearerFormat: 'SIMULATOR_TOKEN' } },
    responses: { Error: { description: 'Erro da API.', content: { 'application/json': { schema: { $ref: '#/components/schemas/Error' } } } } },
    schemas: {
      Identifier: { type: 'string', minLength: 1, maxLength: 128, pattern: '^[A-Za-z0-9][A-Za-z0-9._:-]{0,127}$' },
      Health: { type: 'object', required: ['status', 'version', 'enabled'], properties: { status: { type: 'string', enum: ['ok', 'disabled'] }, version: { type: 'integer', enum: [1] }, enabled: { type: 'boolean' } } },
      DeviceCursor: { type: 'object', required: ['deviceId', 'bootId', 'fromSequence'], properties: { deviceId: { $ref: '#/components/schemas/Identifier' }, bootId: { $ref: '#/components/schemas/Identifier' }, fromSequence: { type: 'integer', minimum: 0, maximum: 9007199254740991 } } },
      SyncRequest: { type: 'object', required: ['version', 'requestId', 'sessionId', 'requestedAtMs', 'scenario', 'devices', 'maxRecords', 'untilAcquiredAtMs'], properties: { version: { type: 'integer', enum: [1] }, requestId: { $ref: '#/components/schemas/Identifier' }, sessionId: { $ref: '#/components/schemas/Identifier' }, requestedAtMs: { type: 'integer', minimum: 0, maximum: 9007199254740991 }, scenario: { type: 'string', enum: ['NORMAL', 'ELEVATED_HEART_RATE', 'LOW_SPO2'] }, devices: { type: 'array', minItems: 1, maxItems: 3, items: { $ref: '#/components/schemas/DeviceCursor' } }, maxRecords: { type: 'integer', minimum: 1, maximum: 100 }, untilAcquiredAtMs: { type: 'integer', minimum: 0, maximum: 9007199254740991 } } },
      TelemetryReading: { type: 'object', required: ['sampleId', 'deviceId', 'bootId', 'sequenceNumber', 'acquiredAtMs', 'validityMask', 'sensorStatus', 'heartRateBpm', 'spo2HundredthsPercent', 'temperatureHundredthsCelsius', 'batteryMillivolts', 'dataSource'], properties: { sampleId: { type: 'string', pattern: '^sample_[a-f0-9]{64}$' }, deviceId: { $ref: '#/components/schemas/Identifier' }, bootId: { $ref: '#/components/schemas/Identifier' }, sequenceNumber: { type: 'integer', minimum: 0 }, acquiredAtMs: { type: 'integer', minimum: 0 }, validityMask: { type: 'integer', minimum: 0, maximum: 15 }, sensorStatus: { type: 'string', enum: ['VALID', 'INVALID', 'DEGRADED'] }, heartRateBpm: { type: 'integer', nullable: true }, spo2HundredthsPercent: { type: 'integer', nullable: true }, temperatureHundredthsCelsius: { type: 'integer', nullable: true }, batteryMillivolts: { type: 'integer', nullable: true }, dataSource: { type: 'string', enum: ['SIMULATED'] } } },
      TelemetryBatch: { type: 'object', required: ['version', 'transferId', 'requestId', 'sessionId', 'generatedAtMs', 'hasMore', 'readings'], properties: { version: { type: 'integer', enum: [1] }, transferId: { type: 'string', pattern: '^transfer_[a-f0-9]{64}$' }, requestId: { $ref: '#/components/schemas/Identifier' }, sessionId: { $ref: '#/components/schemas/Identifier' }, generatedAtMs: { type: 'integer', minimum: 0 }, hasMore: { type: 'boolean' }, readings: { type: 'array', items: { $ref: '#/components/schemas/TelemetryReading' } } } },
      ReceiptAck: { type: 'object', required: ['version', 'transferId', 'requestId', 'receivedAtMs', 'acceptedSampleIds'], properties: { version: { type: 'integer', enum: [1] }, transferId: { type: 'string', pattern: '^transfer_[a-f0-9]{64}$' }, requestId: { $ref: '#/components/schemas/Identifier' }, receivedAtMs: { type: 'integer', minimum: 0, maximum: 9007199254740991 }, acceptedSampleIds: { type: 'array', maxItems: 100, items: { type: 'string', pattern: '^sample_[a-f0-9]{64}$' } } } },
      Error: { type: 'object', required: ['version', 'error'], properties: { version: { type: 'integer', enum: [1] }, error: { type: 'object', required: ['code', 'message'], properties: { code: { type: 'string' }, message: { type: 'string' } } } } },
    },
  },
} as const;
