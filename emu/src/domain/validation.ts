import type { SyncRequest, Scenario } from "../contracts/sync.ts";
import type { ReceiptAck } from "../contracts/receipt-ack.ts";
import { HttpError } from "../contracts/errors.ts";
import { MAX_SEQUENCE } from "../utils/time.ts";
const fail = (message: string): never => {
  throw new HttpError(400, "INVALID_CONTRACT", message);
};
function object(value: unknown): Record<string, unknown> {
  if (value === null || typeof value !== "object" || Array.isArray(value))
    return fail("Objeto obrigatório.");
  return value as Record<string, unknown>;
}
function id(value: unknown, field: string): string {
  if (
    typeof value !== "string" ||
    !/^[A-Za-z0-9][A-Za-z0-9._:-]{0,127}$/.test(value)
  )
    return fail(`${field}: identificador inválido (1–128 caracteres).`);
  return value;
}
function integer(
  value: unknown,
  field: string,
  minimum = 0,
  maximum = Number.MAX_SAFE_INTEGER,
): number {
  if (
    typeof value !== "number" ||
    !Number.isSafeInteger(value) ||
    value < minimum ||
    value > maximum
  )
    return fail(`${field}: inteiro fora dos limites.`);
  return value;
}
function version(value: unknown): void {
  if (typeof value !== "number" || !Number.isSafeInteger(value))
    fail("version: inteiro obrigatório.");
  if (value !== 1)
    throw new HttpError(
      409,
      "VERSION_CONFLICT",
      "Versão de contrato incompatível; esperado 1.",
    );
}
function digestId(value: unknown, prefix: string): string {
  if (
    typeof value !== "string" ||
    !new RegExp(`^${prefix}_[a-f0-9]{64}$`).test(value)
  )
    return fail(`${prefix}: identificador inválido.`);
  return value;
}
export function validateSync(value: unknown, maxRecords = 100): SyncRequest {
  const input = object(value);
  version(input.version);
  const count = integer(input.maxRecords, "maxRecords", 1);
  if (count > Math.min(maxRecords, 100))
    throw new HttpError(
      413,
      "LIMIT_EXCEEDED",
      "Limite total de leituras excedido.",
    );
  if (!Array.isArray(input.devices) || input.devices.length === 0)
    fail("devices: lista não vazia obrigatória.");
  const devicesInput = input.devices as unknown[];
  if (devicesInput.length > 3)
    throw new HttpError(
      413,
      "LIMIT_EXCEEDED",
      "O MVP aceita até 3 dispositivos por requisição.",
    );
  const devices = devicesInput.map((value) => {
    const device = object(value);
    return {
      deviceId: id(device.deviceId, "deviceId"),
      bootId: id(device.bootId, "bootId"),
      fromSequence: integer(
        device.fromSequence,
        "fromSequence",
        0,
        MAX_SEQUENCE,
      ),
    };
  });
  if (new Set(devices.map((d) => d.deviceId)).size !== devices.length)
    throw new HttpError(
      409,
      "DEVICE_CONFLICT",
      "deviceId duplicado na mesma requisição.",
    );
  if (
    !["NORMAL", "ELEVATED_HEART_RATE", "LOW_SPO2"].includes(
      String(input.scenario),
    )
  )
    fail("scenario inválido.");
  return {
    version: 1,
    requestId: id(input.requestId, "requestId"),
    sessionId: id(input.sessionId, "sessionId"),
    requestedAtMs: integer(input.requestedAtMs, "requestedAtMs"),
    scenario: input.scenario as Scenario,
    devices,
    maxRecords: count,
    untilAcquiredAtMs: integer(input.untilAcquiredAtMs, "untilAcquiredAtMs"),
  };
}
export function validateAck(value: unknown): ReceiptAck {
  const input = object(value);
  version(input.version);
  if (!Array.isArray(input.acceptedSampleIds))
    fail("acceptedSampleIds: lista obrigatória.");
  const ids = input.acceptedSampleIds as unknown[];
  if (ids.length > 100)
    throw new HttpError(413, "LIMIT_EXCEEDED", "ACK aceita no máximo 100 IDs.");
  return {
    version: 1,
    transferId: digestId(input.transferId, "transfer"),
    requestId: id(input.requestId, "requestId"),
    receivedAtMs: integer(input.receivedAtMs, "receivedAtMs"),
    acceptedSampleIds: ids.map((value) => digestId(value, "sample")),
  };
}
