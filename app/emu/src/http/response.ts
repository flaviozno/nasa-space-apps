import type { ServerResponse } from "node:http";
import type { ErrorResponse } from "../contracts/errors.ts";
import { HttpError } from "../contracts/errors.ts";
export function json(
  response: ServerResponse,
  status: number,
  data: unknown,
): void {
  response.statusCode = status;
  response.setHeader("Content-Type", "application/json; charset=utf-8");
  response.setHeader("Cache-Control", "no-store");
  response.end(JSON.stringify(data));
}
export function errorResponse(response: ServerResponse, error: unknown): void {
  const known =
    error instanceof HttpError
      ? error
      : new HttpError(500, "INTERNAL_ERROR", "Erro interno do emulador.");
  const body: ErrorResponse = {
    version: 1,
    error: { code: known.code, message: known.message },
  };
  json(response, known.status, body);
}
export function requireMethod(
  method: string | undefined,
  expected: string,
  response: ServerResponse,
): void {
  if (method !== expected) {
    response.setHeader("Allow", expected);
    throw new HttpError(405, "METHOD_NOT_ALLOWED", "Método não permitido.");
  }
}
