import type { ServerResponse } from 'node:http';
import { getConfig } from '../src/config.ts';
import { validateAck } from '../src/domain/validation.ts';
import { authenticate } from '../src/http/auth.ts';
import { readJson } from '../src/http/request.ts';
import type { HttpRequest } from '../src/http/request.ts';
import { errorResponse, requireMethod } from '../src/http/response.ts';
export default async function handler(request: HttpRequest, response: ServerResponse): Promise<void> {
  try {
    requireMethod(request.method, 'POST', response);
    authenticate(request.headers.authorization, getConfig());
    validateAck(await readJson(request));
    response.statusCode = 204; response.setHeader('Cache-Control', 'no-store'); response.end();
  } catch (error) { errorResponse(response, error); }
}
