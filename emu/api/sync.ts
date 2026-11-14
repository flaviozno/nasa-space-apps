import type { ServerResponse } from 'node:http';
import { getConfig } from '../src/config.ts';
import { validateSync } from '../src/domain/validation.ts';
import { simulate } from '../src/domain/simulator.ts';
import { authenticate } from '../src/http/auth.ts';
import { readJson } from '../src/http/request.ts';
import type { HttpRequest } from '../src/http/request.ts';
import { errorResponse, json, requireMethod } from '../src/http/response.ts';
export default async function handler(request: HttpRequest, response: ServerResponse): Promise<void> {
  try {
    requireMethod(request.method, 'POST', response);
    const config = getConfig(); authenticate(request.headers.authorization, config);
    const input = validateSync(await readJson(request), config.maxRecords);
    json(response, 200, simulate(input));
  } catch (error) { errorResponse(response, error); }
}
