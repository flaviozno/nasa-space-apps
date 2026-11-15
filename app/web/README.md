# web — Crew Hub and Earth view

Owner: Wallace. React + Vite + TypeScript + shadcn/ui. UI text in English.

| Command | What |
| --- | --- |
| `npm install` | Install dependencies |
| `npm run dev` | Dev server; proxies `/api/onboard` to `localhost:8001` and `/api/earth` to `localhost:8002` |
| `npm run dev:mock` | Dev server with the onboard Crew API answered by MSW mocks (no backend needed) |
| `npm run gen:api` | Regenerate `src/generated/onboard-api.d.ts` from the onboard OpenAPI (onboard running on port 8001, or set `ONBOARD_OPENAPI` to a URL or file) |
| `npm test` | Vitest |
| `npm run typecheck` | TypeScript |
| `npm run lint` | oxlint |
| `npx shadcn@latest add <component>` | Add a shadcn/ui component under `src/components/ui/` |

| Path | Contents |
| --- | --- |
| `src/routes.tsx` | Routes: `/` (crew picker), `/crew/:crewId` (Crew Hub), `/earth` (Earth view) |
| `src/lib/api.ts` | API base paths and fetch helpers |
| `src/generated/onboard-api.d.ts` | Types generated from the onboard OpenAPI — do not edit; run `npm run gen:api` |
| `src/lib/onboard-types.ts` | Short names for those types (`CrewMember`, `CrewSummary`, `MetricTrend`, …) |
| `src/mocks/` | MSW handlers for the Crew API; `fixtures/onboard.json` holds responses captured from the Phase 0 stubs |
| `src/lib/onboard-api.ts` | Typed calls to the Crew API; errors become `ApiError` with FastAPI's `detail` as the message |
| `src/lib/onboard-queries.ts` | TanStack Query hooks (`useCrew`, `useCrewMetrics`, `useMetricTrend`, `useSubmitDailyCheckin`, …) — pages use these, not `fetch` |
| `src/components/query-state.tsx` | `LoadingBlock` and `QueryError` for loading and error states |
| `src/lib/earth-contract.ts` | Earth view data shapes: `SyncStatus` from Guilherme's `feat/outbox-sync`, and the **provisional** `/v1/views/*` shapes (Earth does not implement them yet) |
| `src/lib/earth-api.ts`, `src/lib/earth-queries.ts` | Earth view calls and hooks (5 s polling) |
| `src/mocks/earth-handlers.ts` | Time-based outbox simulation for `dev:mock`: cut the link and the queue grows, restore it and it drains |
| `src/test/mock-server.ts` | The MSW mocks as a Node server for tests (`startMockServer()`) |

### Data fetching

Server data goes through [TanStack Query](https://tanstack.com/query): caching, loading/error states, and polling. Metrics and trends refresh every 30 s (wearable batches arrive once a minute), alerts every 15 s. A successful submission refetches that crew member's data. 4xx errors are not retried.
| `src/test/` | Test setup and named fakes (`FakeHealthServer`) |
| `nginx.conf` | Production proxy: same `/api/*` paths as the dev server |

How to run the whole stack: see the root [readme.md](../../readme.md#running-locally).
