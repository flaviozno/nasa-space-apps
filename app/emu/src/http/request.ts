import type { IncomingMessage } from "node:http";
import { HttpError } from "../contracts/errors.ts";
export type HttpRequest = IncomingMessage & { body?: unknown };
const MAX_BODY_BYTES = 65536;
function parse(text: string): unknown {
  if (Buffer.byteLength(text) > MAX_BODY_BYTES)
    throw new HttpError(413, "BODY_TOO_LARGE", "Corpo excede 64 KiB.");
  try {
    return JSON.parse(text) as unknown;
  } catch {
    throw new HttpError(400, "INVALID_JSON", "JSON inválido.");
  }
}
export async function readJson(request: HttpRequest): Promise<unknown> {
  if (request.body !== undefined) {
    if (Buffer.isBuffer(request.body))
      return parse(request.body.toString("utf8"));
    if (typeof request.body === "string") return parse(request.body);
    const serialized = JSON.stringify(request.body);
    if (serialized === undefined)
      throw new HttpError(400, "INVALID_JSON", "JSON inválido.");
    return parse(serialized);
  }
  const chunks: Buffer[] = [];
  let size = 0;
  for await (const chunk of request) {
    const buffer = Buffer.isBuffer(chunk)
      ? chunk
      : Buffer.from(chunk as string);
    size += buffer.length;
    if (size > MAX_BODY_BYTES)
      throw new HttpError(413, "BODY_TOO_LARGE", "Corpo excede 64 KiB.");
    chunks.push(buffer);
  }
  return parse(Buffer.concat(chunks).toString("utf8"));
}
