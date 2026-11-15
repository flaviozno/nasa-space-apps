# CORA

<p align="center">
  <img src="app/assets/cora-logo.svg" alt="CORA" width="260" />
</p>

> **Crew Operations Readiness Assistant**
>
> *Local insight. Clear action. Even offline.*

CORA is an onboard-first health telemetry MVP for space crews. It turns
simulated wearable signals, check-ins, and manual measurements into an
explainable next operational step — without requiring a live connection to
Earth. When the link returns, the evidence synchronizes safely with the ground
team.

The project uses only synthetic or historical demonstration data. It is not a
medical device, clinical monitor, or diagnostic system.

## Product principles

- **Local first:** collection, assessment, and action guidance continue when Earth is unavailable.
- **Personal context:** each reading is compared with the astronaut's own pre-flight baseline.
- **Clear evidence:** `OK`, `DEVIATION`, `STALE`, `INVALID`, and `NO_DATA` are distinct states.
- **Operational support, not diagnosis:** CORA does not diagnose, prescribe, or calculate an individual's radiation dose.

## Structure

```text
app/
├── emu/          # Wearable emulator (TypeScript/Vercel)
├── onboard/      # Onboard API and processing (FastAPI)
├── earth/        # Earth ingestion and query API (FastAPI)
├── web/          # Crew Hub and Earth View (React/Vite)
├── common/       # Shared Python code
├── contracts/    # Metric catalog and crew data
├── pyproject.toml
└── uv.lock
docs/             # Architecture, plan, and product documentation
infra/
└── docker-compose.yml
scripts/
└── start.py      # Local launcher
```

## Run locally

1. Copy the environment file and configure the emulator token if needed:

   ```bash
   cp .env.example .env
   ```

2. Start the complete stack — Onboard, Earth, Web, and both databases:

   ```bash
   python scripts/start.py
   ```

   Or run Docker Compose directly:

   ```bash
   docker compose --env-file .env -f infra/docker-compose.yml up --build
   ```

3. Open:

   | Service | Address |
   | --- | --- |
   | Web | http://localhost:8080 |
   | Onboard API | http://localhost:8001/docs |
   | Earth API | http://localhost:8002/docs |

To work on the Onboard API alone with local reload:

```bash
python scripts/start.py --onboard-only
```

## Main flow

```text
app/emu → app/onboard → app/earth
                 ↘
                  app/web
```

- `emu` responds to telemetry requests from Onboard.
- `onboard` stores readings, evaluates alerts, and maintains a reliable outbox.
- `earth` receives synchronized events idempotently.
- `web` provides CORA's onboard Crew Hub and Earth View.

## Development and validation

```bash
# Python: run inside app/
cd app && uv sync --all-packages

# Emulator
cd app/emu && npm run typecheck

# Web
cd app/web && npm run typecheck && npm test

# Contracts, from the repository root
python -m unittest discover -s app/contracts/tests
```

## Documentation

- [Product insights and MVP scope](docs/insights.md) — why CORA exists, the onboard action loop, NASA-data boundaries, and known MVP gaps.
- [Telemetry architecture](docs/telemetry-architecture.md) — the intended end-to-end telemetry and synchronization design.
- [Plan and ownership](docs/plan.md) — implementation scope, delivery flow, and team ownership.
- [Infrastructure](infra/) — Docker Compose stack, local service topology, and the telemetry diagrams.
- [Emulator](app/emu/README.md)
- [Onboard migrations](app/onboard/migrations/README.md)
- [Frontend](app/web/README.md)
