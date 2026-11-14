# web — Crew Hub and Earth view

Owner: Wallace. React + Vite + TypeScript + shadcn/ui. UI text in English.

| Command | What |
| --- | --- |
| `npm install` | Install dependencies |
| `npm run dev` | Dev server; proxies `/api/onboard` to `localhost:8001` and `/api/earth` to `localhost:8002` |
| `npm test` | Vitest |
| `npm run typecheck` | TypeScript |
| `npm run lint` | oxlint |
| `npx shadcn@latest add <component>` | Add a shadcn/ui component under `src/components/ui/` |

| Path | Contents |
| --- | --- |
| `src/routes.tsx` | Routes: `/` (crew picker), `/crew/:crewId` (Crew Hub), `/earth` (Earth view) |
| `src/lib/api.ts` | API base paths and fetch helpers |
| `src/lib/placeholder-crew.ts` | Temporary crew list until `GET /api/onboard/v1/crew` exists |
| `src/test/` | Test setup and named fakes (`FakeHealthServer`) |
| `nginx.conf` | Production proxy: same `/api/*` paths as the dev server |

How to run the whole stack: see the root [readme.md](../readme.md#running-locally).
