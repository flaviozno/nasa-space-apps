import type { IncomingMessage, ServerResponse } from 'node:http';
import { getConfig } from '../src/config.ts';
import { errorResponse, json, requireMethod } from '../src/http/response.ts';
export default function handler(request: IncomingMessage, response: ServerResponse): void {
  try {
    requireMethod(request.method, 'GET', response);
    const config = getConfig();
    json(response, 200, { status: config.enabled ? 'ok' : 'disabled', version: config.version, enabled: config.enabled });
  } catch (error) { errorResponse(response, error); }
}
