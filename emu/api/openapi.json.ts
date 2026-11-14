import type { IncomingMessage, ServerResponse } from 'node:http';
import { openApiDocument } from '../src/contracts/openapi.ts';
import { errorResponse, json, requireMethod } from '../src/http/response.ts';

export default function handler(request: IncomingMessage, response: ServerResponse): void {
  try {
    requireMethod(request.method, 'GET', response);
    json(response, 200, openApiDocument);
  } catch (error) { errorResponse(response, error); }
}
