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
| `src/lib/placeholder-crew.ts` | Temporary crew list until `GET /api/onboard/v1/crew` exists |
| `src/generated/onboard-api.d.ts` | Types generated from the onboard OpenAPI — do not edit; run `npm run gen:api` |
| `src/lib/onboard-types.ts` | Short names for those types (`CrewMember`, `CrewSummary`, `MetricTrend`, …) |
| `src/mocks/` | MSW handlers for the Crew API; `fixtures/onboard.json` holds responses captured from the Phase 0 stubs |
| `src/test/` | Test setup and named fakes (`FakeHealthServer`) |
| `nginx.conf` | Production proxy: same `/api/*` paths as the dev server |

How to run the whole stack: see the root [readme.md](../readme.md#running-locally).
