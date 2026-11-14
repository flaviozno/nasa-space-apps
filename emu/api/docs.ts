import type { IncomingMessage, ServerResponse } from 'node:http';
import { errorResponse, requireMethod } from '../src/http/response.ts';

const page = `<!doctype html>
<html lang="pt-BR"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
<title>Swagger — Emulador wearable</title><link rel="stylesheet" href="https://unpkg.com/swagger-ui-dist@5.17.14/swagger-ui.css"></head>
<body><div id="swagger-ui"></div><script src="https://unpkg.com/swagger-ui-dist@5.17.14/swagger-ui-bundle.js"></script>
<script>SwaggerUIBundle({ url: '/api/openapi.json', dom_id: '#swagger-ui', persistAuthorization: true });</script></body></html>`;

export default function handler(request: IncomingMessage, response: ServerResponse): void {
  try {
    requireMethod(request.method, 'GET', response);
    response.statusCode = 200;
    response.setHeader('Content-Type', 'text/html; charset=utf-8');
    response.setHeader('Cache-Control', 'no-store');
    response.end(page);
  } catch (error) { errorResponse(response, error); }
}
