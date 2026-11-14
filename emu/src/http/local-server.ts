import {
  createServer,
  type IncomingMessage,
  type ServerResponse,
} from "node:http";
import health from "../../api/health.ts";
import docs from "../../api/docs.ts";
import openapi from "../../api/openapi.json.ts";
import receiptAcks from "../../api/receipt-acks.ts";
import sync from "../../api/sync.ts";
import { json } from "./response.ts";

type Handler = (
  request: IncomingMessage,
  response: ServerResponse,
) => void | Promise<void>;

const routes: Readonly<Record<string, Handler>> = {
  "/": docs,
  "/api/docs": docs,
  "/api/health": health,
  "/api/openapi.json": openapi,
  "/api/receipt-acks": receiptAcks,
  "/api/sync": sync,
};

function portFromEnv(value: string | undefined): number {
  if (value === undefined) return 3000;
  if (!/^\d+$/.test(value) || Number(value) < 1 || Number(value) > 65535) {
    throw new Error("PORT deve ser um inteiro entre 1 e 65535.");
  }
  return Number(value);
}

const port = portFromEnv(process.env.PORT);
const host = process.env.HOST ?? "127.0.0.1";
const server = createServer(async (request, response) => {
  const pathname = new URL(
    request.url ?? "/",
    `http://${request.headers.host ?? host}`,
  ).pathname;
  const handler = routes[pathname];
  if (handler === undefined) {
    json(response, 404, {
      version: 1,
      error: { code: "NOT_FOUND", message: "Endpoint não encontrado." },
    });
    return;
  }
  await handler(request, response);
});

server.listen(port, host, () => {
  console.log(`Emulador disponível em http://${host}:${port}`);
});

for (const signal of ["SIGINT", "SIGTERM"] as const) {
  process.once(signal, () => server.close(() => process.exit(0)));
}
