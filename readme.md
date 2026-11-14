# Space Health Telemetry — Minimal MVP Flow

**Status:** MVP implementation standard  
**Scope:** Astronaut Health Hub for a 4-person crew — synthetic wearable telemetry, manual and questionnaire input, onboard processing and crew dashboard, and delivery to a simulated Earth service with a flight-surgeon view.

> **Team plan:** ownership, phases, and the 30-second demo script are in [docs/plan.md](./docs/plan.md).

> **MVP adaptation and integration baseline:** this document defines the reduced, integrable implementation that will be presented in the MVP. It is adapted from the broader architecture proposed in [../infra/telemetry.drawio](./infra/telemetry.drawio) and detailed in [../docs/telemetry-architecture.md](./docs/telemetry-architecture.md). It preserves the core guarantees—local durable ingestion, onboard processing, an outbox, automatic delivery, and durable acknowledgements—while intentionally replacing production-scale components with simpler MVP equivalents.

> The MVP is therefore **not** a replacement for the proposed telemetry architecture. It is a demonstrable integration path that validates its most important behaviors now and can evolve toward BLE, MQTT, Protobuf, PostgreSQL, DELTA/FULL reconstruction, and the other capabilities described in the infrastructure plan.

## 1. Goal

Build the smallest working, integrable system that demonstrates this flow:

1. Have the onboard service request synthetic wearable health readings for a crew of 4 astronauts.
2. Store and process them onboard, together with manual entries and questionnaire answers submitted by the astronauts.
3. Show each astronaut their current levels, trends, and deviations from their personal baseline in the Crew Hub.
4. Forward events to an Earth service when the simulated communication link is available.
5. Confirm durable reception, safely handle retransmission, and show the crew's data in the Earth view.

There is no physical wearable and no login in this MVP; the astronaut is picked from a crew list. The onboard and Earth services run in separate Docker containers on the same VPS. Their separation is logical, not geographic.

### Modularity: everything becomes an `observation`

Every data source — wearable, questionnaire, manual entry, or a future integration — is converted into the same record. The Crew Hub and the trend logic read only observations, so adding a source means adding one adapter.

| Field | Purpose |
| --- | --- |
| id | Stable observation identity |
| crewId | `crew-1` … `crew-4` |
| metric | Metric ID from `contracts/metrics.json` (e.g. `heart_rate`, `mood`) |
| value | Number, or null for an invalid reading (never 0) |
| unit | Unit from the metric catalog |
| source | `wearable`, `manual`, `questionnaire`, or a future source name |
| sourceRef | Original identity (sample ID, response ID, …) |
| takenAt | Measurement time, epoch ms |

The metric catalog (`contracts/metrics.json`) and the crew list with fixed baseline values (`contracts/crew.json`) are the shared source of truth for metric IDs, units, and reference ranges.

## 2. Architecture

```mermaid
flowchart TD
    A["VPS: onboard scheduler"] -->|"HTTPS SyncRequest once per minute"| B["Vercel: wearable simulator"]
    B -->|"TelemetryBatch response"| A
    A -->|"ReceiptAck after durable commit"| B
    A -->|"persist + process"| C["VPS: onboard service + SQLite"]
    W["Web: Crew Hub"] -->|"read metrics, submit questionnaires and manual entries"| C
    C -->|"HTTPS: pending events when link is enabled"| D["VPS: Earth service + SQLite"]
    D -->|"ACK after durable commit"| C
    E["Web: Earth view"] -->|"read synced crew data"| D
```

For the initial implementation, **use HTTP for both communication steps**. Do not add an MQTT broker yet. The onboard service initiates the wearable synchronization, just as the Edge does in the proposed BLE architecture; Vercel only emulates the wearable's response. HTTP is an MVP transport substitution for the BLE and MQTT transports proposed in `infra/telemetry.drawio`; durable storage, the receipt acknowledgement, the Outbox, and application ACK preserve the delivery behavior we need to demonstrate without another running component.

The simulator package implements the Vercel responder and includes a development-only onboard mock. The production onboard and Earth services described here still need to be implemented.

## 3. Minimum Components

| Component | Runs on | Responsibility |
| --- | --- | --- |
| Onboard scheduler | Onboard service container on VPS | Start each wearable synchronization window |
| Wearable simulator | Vercel, Node.js/TypeScript | Respond to `SyncRequest` with one deterministic bounded batch (4 devices, one per astronaut); validate `ReceiptAck` |
| Onboard service | VPS, Docker, Python/FastAPI | Request readings, convert them to observations, evaluate simple rules, serve the Crew API (trends, baselines, questionnaires, manual entries), and forward pending events |
| Onboard database | Dedicated Docker volume, SQLite | Store sessions, readings, observations, questionnaire responses, alerts, and Outbox records |
| Earth service | VPS, Docker, Python/FastAPI | Deduplicate and persist incoming events, return an ACK, and serve read endpoints for the Earth view |
| Earth database | Separate Docker volume, SQLite | Store received events and reception timestamps |
| Web app | VPS, Docker, React + Vite + shadcn/ui (TypeScript) | Crew Hub (`/crew/:id`) and Earth view (`/earth`); UI in English |
| Simulator HTTPS endpoint | Vercel | Expose authenticated simulator synchronization endpoints to the VPS |
| Web HTTPS entry point | Existing VPS proxy or one small reverse proxy | Serve the web app and the read/input APIs it calls |

Use three application containers (onboard, earth, web) and persistent volumes for the two databases. The onboard service calls the public Vercel endpoint over HTTPS. Earth ingestion stays on the private Docker network; only its read endpoints are exposed to the web app.

PostgreSQL, Redis, MQTT, Kubernetes, login, and a separate worker service are not required for this MVP.

### Repository layout and ownership

| Path | Owner | Contents |
| --- | --- | --- |
| `simulator/` | Flávio | Wearable emulator and scenarios (`NORMAL`, `FEVER`, `HYPOXIA`, `POOR_SLEEP`) |
| `onboard/app/ingest/` | Miguel | Telemetry batch ingestion, cursor, sample → observation conversion, alert rules |
| `onboard/app/crew/`, `onboard/app/observations/` | Matheus | Observation model, crew and baselines, trends, questionnaires, manual entries |
| `onboard/app/sync/`, `earth/`, `infra/` | Guilherme | Outbox worker, link toggle, Earth service, Docker Compose, VPS deploy |
| `web/` | Wallace | Crew Hub and Earth view |
| `contracts/` | Matheus (metrics, crew), Flávio (`SyncRequest` / `TelemetryBatch` / `ReceiptAck`), Guilherme (onboard → Earth) | Shared contracts; changed only through an announced PR |

## 4. Step-by-Step Flow

### Step 1 — Start a wearable synchronization window

The lightweight scheduler inside the onboard service runs once per minute and calls:

```http
POST https://<vercel-domain>/api/sync
Authorization: Bearer <SIMULATOR_TOKEN>
Content-Type: application/json
```

The `SyncRequest` identifies the simulation session, the next requested sequence (or cursor) for each device, a bounded maximum batch size, and the simulated time boundary. The onboard scheduler derives these values from its durable session state. The simulator rejects unauthorized or invalid requests and performs no generation when disabled.

### Step 2 — Generate and return a bounded batch

The simulator generates readings deterministically from the `SyncRequest` cursor and time boundary, subject to the configured batch limit, and returns a `TelemetryBatch` in the HTTP response. Vercel stores no persistent session state and does not call the VPS. The onboard database is the source of truth for cursor advancement.

Initial configuration:

| Setting | Initial value |
| --- | --- |
| Simulated devices | 4 (one per astronaut, `crew-1` … `crew-4`) |
| Sampling interval | 1 second per device |
| Onboard synchronization interval | 1 minute |
| Maximum simulated seconds per invocation | 60 |
| Typical full-minute batch | 240 readings |
| Scenario | NORMAL |
| Data source label | SIMULATED |

All readings are generated immediately during the invocation. There is no one-second waiting loop.

Each reading contains a stable sample ID, device ID, boot/session identity, sequence, acquisition timestamp, sensor status, and health metrics. The base metrics are heart rate in BPM, SpO₂ in hundredths of a percent, temperature in hundredths of a degree Celsius, and battery voltage in millivolts; any additional wearable metrics use the IDs and units of `contracts/metrics.json`. Invalid metrics are null, not zero. Each device is bound to one crew member, and the onboard service converts every valid metric into an observation.

The same seed, session, configuration, device, and sequence produce the same reading. Configuration changes that affect generated data require a new session ID.

### Step 3 — Persist onboard and acknowledge

The onboard service:

1. Validates the simulator response contract and requested sequence range.
2. Checks that the session configuration matches the stored configuration.
3. Opens a database transaction with appropriate session serialization.
4. Inserts new readings, evaluates the initial simple rules, records any alerts, and creates Outbox events.
5. Advances the contiguous cursor.
6. Commits the transaction durably before acknowledging the simulator.

For this small MVP, rule evaluation is deterministic and lightweight and runs inside this bounded transaction. No separate processing queue is required. If asynchronous jobs are introduced later, they must be persisted in the same transaction before ACK.

The simulator-response contract is **all or nothing per batch**. A conflicting or invalid batch is rejected without partially advancing the cursor. Repeated identical samples do not create additional readings or alerts.

### Step 4 — Send `ReceiptAck`

After the commit, the onboard service calls the simulator's acknowledgement endpoint with the transfer ID and accepted sample IDs:

```http
POST https://<vercel-domain>/api/receipt-acks
Authorization: Bearer <SIMULATOR_TOKEN>
Content-Type: application/json
```

The acknowledgement makes the HTTP simulation mirror the BLE contract. Since the simulator is stateless, it only validates the acknowledgement; the durable cursor remains onboard. If this request fails, a retry is harmless, and the next `SyncRequest` starts from the advanced onboard cursor.

The Vercel Function returns the requested telemetry directly and does not continue work in the background or make calls to the VPS.

### Step 5 — Process the onboard Outbox

A single lightweight worker loop inside the onboard container checks for pending events. Start with a configurable five-second interval and one batch in flight.

The loop:

1. Checks the simulated Earth-link setting.
2. If disabled, leaves events pending without attempting delivery.
3. If enabled, reads up to 100 pending events.
4. Sends them to the Earth service over the private Docker network.
5. Validates the Earth ACK.
6. Marks only confirmed events as synchronized.

Use a bounded request timeout and persist retry scheduling. Failed attempts use backoff with jitter. The first version runs one onboard container/worker; do not scale it horizontally without adding durable work claiming.

### Step 6 — Persist on Earth and acknowledge

The Earth service exposes an internal ingestion endpoint, for example:

```http
POST http://earth-service:3000/v1/events/batches
Authorization: Bearer <EARTH_INGEST_TOKEN>
Content-Type: application/json
```

Earth validates events, deduplicates them by stable event ID, and commits them to its own database before returning accepted IDs. Identical retries receive confirmation again. The same ID with different content is rejected and recorded as a conflict.

Use an atomic batch ACK for this first version as well. The onboard worker only synchronizes the batch after a complete, valid ACK. Keep onboard and Earth databases separate; onboard must not read or write the Earth database directly.

## 5. Minimal Event Contract

The Vercel simulator's OpenAPI and JSON Schemas are the source of truth for onboard-to-simulator `SyncRequest`, `TelemetryBatch` response, and `ReceiptAck` traffic. Reuse them rather than redefining those payloads in prose.

For onboard-to-Earth traffic, define one small versioned JSON contract before implementation. The first version needs only:

| Field | Purpose |
| --- | --- |
| version | Contract version, initially 1 |
| eventId | Stable identity retained across every retry |
| type | FULL_READING or EXPERIMENTAL_ALERT |
| sessionId | Simulation session |
| sourceSampleId | Original reading identity |
| createdAtOnboardMs | Onboard event creation time |
| dataSource | Always SIMULATED |
| payload | Complete reading or self-contained alert evidence |

The batch adds batchId and events. The ACK adds batchId, persistedAtMs, and acceptedEventIds. Correlate sourceSampleId, eventId, and batchId in technical logs without logging credentials or full health payloads.

The minimal MVP sends **complete readings**. Delta encoding, Protobuf, base recovery, and partial ACKs are deferred. They remain planned extensions from the proposed architecture after the basic delivery path works.

## 6. Simulated Disconnection

Simulate loss of the onboard-to-Earth link while keeping VPS-to-simulator synchronization available.

A single persisted boolean setting, controlled through an authenticated administration endpoint, is enough initially:

- Link disabled: onboard continues receiving, processing, and storing readings; its Outbox grows.
- Link enabled: the worker resumes forwarding pending events.

This setting represents a communication outage. It does not require disabling the VPS network or stopping either database.

If the entire VPS is unavailable, both services stop. Once it returns, the deterministic simulator can regenerate missing synthetic readings from the recovered cursor. This is not proof of offline storage in a physical wearable.

## 7. Minimum Persistence Model

| Onboard table | Purpose |
| --- | --- |
| simulation_sessions | Immutable configuration hash and contiguous ingestion cursor |
| samples | Original readings with identity and sequence uniqueness |
| observations | Normalized values from every source (wearable, manual, questionnaire, future) |
| questionnaire_responses | Submitted questionnaires (daily check-in, PHQ-4, team climate) with their answers |
| alerts | Experimental rule results, unique by source sample and rule version |
| outbox | Stable events, delivery status, attempts, and next retry time |
| settings | Persisted simulated link state |

Each owner keeps their tables in their own migration file (`001_observations.sql` Matheus, `002_ingest.sql` Miguel, `003_sync.sql` Guilherme). Crew members and baselines are fixed seed values loaded from `contracts/crew.json`.

| Earth table | Purpose |
| --- | --- |
| received_events | Unique event IDs, original content, and Earth reception timestamps |

SQLite files must live on separate persistent Docker volumes, not container writable layers. Use transactions, WAL, and synchronous=FULL; verify durability against the actual host storage. Container restarts must preserve data.

Start with PENDING and SYNCED delivery states. A single worker can safely retry PENDING events after a crash if Earth deduplicates. Add leases and IN_FLIGHT state when introducing concurrent workers, rather than adding them before they are needed.

Do not delete active session cursors or unsynchronized events. Add cleanup of old completed simulation sessions after the first successful end-to-end demonstration, with a defined retention policy.

## 8. Initial Rules and Inspection

Implement one configurable experimental threshold rule and explicit invalid-sensor handling. Record the rule identifier/version and supporting sample. This tests local processing without building a clinical decision engine.

A second rule type flags deviations from the astronaut's fixed baseline (z-score against the baseline median and spread), for both wearable and manual observations.

### Crew Hub and Earth view

The Crew Hub lets each astronaut pick themselves from the crew list and:

- see current levels, trends, and baseline deviations per metric;
- see local alerts;
- answer the daily check-in (mood, stress, fatigue, sleepiness, symptoms) and the weekly questionnaires (PHQ-4, team climate);
- enter manual measurements that no integration collected (body mass, blood pressure, water intake, grip strength).

An astronaut's view shows only their own data. The Earth view shows the synced data of the whole crew, its alerts, and synchronization status (pending events, last reception time, link state).

Onboard and Earth also provide read-only status endpoints showing counts and the latest reception time.

Onboard processing continues while the Earth link is disabled. However, acquisition is delivered in minute batches, so readings can already be roughly one minute old, plus scheduling and network delay, when they arrive onboard. Do not describe this as second-by-second live monitoring.

## 9. Security Basics

- Use HTTPS for VPS-to-Vercel communication and validate certificates.
- Use distinct secrets for onboard-to-simulator and onboard-to-Earth communication.
- Keep secrets in environment configuration and out of source control.
- Expose only the required simulator HTTPS routes publicly; keep onboard, Earth, and database files private.
- Authenticate control and status endpoints as well as ingestion.
- Validate payload size, shape, identity, and sequence relationships before processing.
- Avoid logging tokens and complete health payloads.

## 10. Failure Behavior

| Failure | Expected behavior |
| --- | --- |
| Scheduler is delayed | The next onboard synchronization request covers the eligible interval from its durable cursor |
| Vercel request fails before onboard commit | Cursor stays unchanged; the next request receives the same deterministic readings |
| Onboard commits but `ReceiptAck` is lost | Cursor is already advanced; retrying the acknowledgement is harmless |
| Two simulator calls overlap | Onboard transaction and uniqueness constraints prevent duplication or cursor gaps |
| Earth link is disabled | Local ingestion/processing continues; Outbox retains events |
| Earth commits but its ACK is lost | Onboard retries; Earth deduplicates and confirms again |
| Application container restarts | Database survives on its volume; worker resumes pending delivery |
| Persistent storage is lost or full | Report failure; no claim of unlimited retention or zero data loss |

With 60 generated seconds per minute, existing backlog does not shrink at steady state. Set `MAX_SECONDS_PER_SYNC` to 120 when catch-up is required. Likewise, onboard-to-Earth throughput must exceed incoming event generation to drain its backlog.

## 11. What We Intentionally Defer

- Physical wearable integration and BLE.
- MQTT broker and other transport infrastructure.
- Delta compression, Protobuf, and base synchronization.
- Dedicated job queues, Redis, and separate worker containers.
- PostgreSQL/time-series infrastructure and database replication.
- Geographically separated onboard/Earth deployments and high availability.
- Automatic diagnosis or medically validated alert thresholds.
- Continuous second-by-second transmission from Vercel.
- Login and per-user authentication in the web app.
- Advanced tracing infrastructure and operational dashboards.

This document defines the reduced implementation scope and the integration standard for the MVP. The proposed architecture in [../infra/telemetry.drawio](../infra/telemetry.drawio), with its supporting [architecture documentation](../docs/telemetry-architecture.md), remains the reference for future hardening; its MQTT/BLE/DELTA and asynchronous-worker requirements are not mandatory for this first milestone.

## 12. First Milestone — Definition of Done

1. The onboard scheduler sends an authenticated `SyncRequest` to the Vercel simulator.
2. A batch of synthetic readings is durably received onboard.
3. At least one configured scenario produces an experimental local alert.
4. Readings and alert events reach the Earth service and receive durable ACKs.
5. Disabling the Earth link increases pending events without interrupting onboard ingestion.
6. Re-enabling the link drains pending events.
7. Repeating batches or losing ACKs does not create logical duplicates.
8. Restarting application containers preserves readings and pending events.
9. The Crew Hub shows each of the 4 astronauts' metrics, trends, and baseline deviations.
10. A questionnaire answer and a manual entry submitted in the Crew Hub appear as observations and in the trends.
11. The Earth view shows synced crew data and the link state, and catches up after the link is re-enabled.

**Success means the basic data path works reliably and can be demonstrated. Additional infrastructure is introduced only when a measured requirement calls for it.**
