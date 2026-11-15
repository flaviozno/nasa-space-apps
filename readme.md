# Space Health Telemetry

An MVP that demonstrates a space-crew health telemetry flow: a simulated
wearable sends readings to the onboard service, which processes and stores the
data locally, then synchronizes it with Earth when the link is available.

The project uses only synthetic or historical demonstration data. It is not a
medical device, clinical monitor, or diagnostic system.

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
- `web` provides the Crew Hub and Earth View.

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

- [Plan and ownership](docs/plan.md)
- [Telemetry architecture](docs/telemetry-architecture.md)
- [Emulator](app/emu/README.md)
- [Onboard migrations](app/onboard/migrations/README.md)
- [Frontend](app/web/README.md)
