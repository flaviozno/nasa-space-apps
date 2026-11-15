# Telemetry Architecture

## Purpose

This document describes the proposed end-to-end telemetry architecture for crew wearables. It explains how measurements travel from a device to the ground system, how the design behaves during intermittent connectivity, and why each technology and reliability mechanism was selected.

The architecture is designed for an environment in which the link to Earth may be slow, unavailable, or expensive. The onboard system must therefore operate autonomously, retain data safely, detect urgent conditions locally, expose each crew member's own information locally, and synchronize reliably when connectivity returns.

## Architecture at a glance

```text
Wearable ── BLE advertisements / GATT ──> Onboard / Edge Server ── MQTT 5 over TLS/mTLS ──> Ground Server
   │                                         │                                                │
   │                                         ├─ Crew dashboard (own data only)                ├─ PostgreSQL
   │                                         ├─ SQLite outbox and local alerts               ├─ Data reconstruction
   └─ Non-volatile storage + low-power       └─ MQTT broker                                  └─ Ground dashboard
      advertisements
```

The detailed flow is maintained in [the telemetry diagram](../infra/telemetry.drawio).

## Design principles

- **Store before sending.** A sample is persisted on the wearable before it is transmitted, and is persisted again on the Edge before an acknowledgement is returned.
- **Pull routine data; push urgency.** The Edge opens scheduled BLE synchronization sessions and requests buffered data. The wearable only advertises an urgent condition outside those windows.
- **Operate without Earth.** Alerting, rule evaluation, dashboards, and local retention continue while the ground link is offline.
- **Use at-least-once delivery with idempotent processing.** Messages may be delivered more than once, but never need to be interpreted more than once.
- **Preserve traceability.** A measurement can be followed from `sampleId` through `eventId` and `batchId` to its acknowledgement.
- **Prioritize health and recovery.** Emergency alerts and requested base snapshots take precedence over routine telemetry, while capacity remains reserved for historical synchronization.

## Components and responsibilities

### 1. Wearable

The wearable firmware samples heart rate, oxygen saturation (SpO₂), temperature, and battery level at **1 Hz**. Each measurement also contains `validityMask` and `sensorStatus`, allowing downstream systems to distinguish a missing or unreliable reading from a valid physiological value.

Each sample receives a stable identity composed of `sampleId`, `deviceId`, `bootId`, and `sequenceNumber`.

#### Local durable storage

Measurements are written to non-volatile storage before BLE transmission. The target retention period is **72 hours without BLE connectivity**.

This choice prevents data loss when the wearable temporarily leaves radio range, the Edge server restarts, or the BLE session fails. The device can resend the same sample identity later, which is essential for safe at-least-once delivery.

#### BLE availability and synchronization

The wearable operates as a BLE peripheral and spends most of its time asleep. It emits a short, low-duty-cycle authenticated advertisement that identifies it as available for the next synchronization window; the interval is configurable according to the mission's latency and battery budget. It does **not** open a connection or transmit routine measurements for every sample.

The Edge acts as the BLE central. On its configured schedule it scans, connects to available wearables, and writes a `SyncRequest` control message with a request ID and the maximum records or bytes to return. The wearable then sends one bounded batch and keeps the records until it receives a durable `ReceiptAck`. The Edge can make a follow-up request when more records remain.

An emergency condition is the exception: the wearable advertises an authenticated urgent flag immediately, allowing the Edge to prioritize its connection and request the alert batch without waiting for the next routine window. It still does not require a permanently open BLE link.

This pull-based routine flow minimizes radio wakeups and connection setup on the wearable. A server cannot retrieve data from a fully sleeping device with no advertising window, so the advertisements remain necessary.

#### BLE payload format

Telemetry uses a compact fixed-layout little-endian binary codec. A transfer header carries the protocol version, message type, device ID, boot ID, transfer ID, and record count. Transfers are limited to 100 records and 64 KiB, and can be fragmented through `fragmentIndex` and `fragmentCount`.

Binary encoding is used here because BLE has constrained payload sizes and the wearable benefits from predictable CPU, memory, bandwidth, and battery use. Protobuf is reserved for `SyncRequest`, `ReceiptAck`, and other BLE control messages, where evolvability and explicit schemas are more useful than byte-level compactness.

#### Retry behavior

If a `ReceiptAck` is not received, the wearable keeps the batch unchanged. The Edge retries the synchronization session at the next eligible window, using jittered exponential backoff from 1 to 30 seconds when a connection or transfer fails. A later `SyncRequest` can therefore retrieve the same sample identities safely. Invalid or rejected payloads are placed in local quarantine rather than retried indefinitely.

This separates transient communication failures from permanent data-quality or protocol problems, keeps retry scheduling on the better-powered Edge, and avoids retry storms.

### 2. Onboard / Edge Server

The Edge server runs **Node.js with TypeScript**. It is the operational center of the onboard system: it schedules and initiates BLE synchronization, durably records received data, evaluates rules locally, maintains a synchronization outbox, and sends data to the broker.

Node.js is appropriate for this role because the workload is primarily I/O-bound: BLE communication, database operations, MQTT sessions, and dashboard APIs. TypeScript provides compile-time contracts around telemetry schemas, message states, and error handling.

#### Crew dashboard and access boundaries

The onboard system provides a simplified local dashboard for astronauts. It displays the health and device information generated by the authenticated crew member, such as recent heart rate, SpO₂, temperature, battery, data quality, and local alert status.

The dashboard reads only from the Edge's local SQLite database and applies the device-to-crew-member binding during authorization. Consequently, an astronaut can access only their own telemetry; they do not receive other crew members' data and have no direct access to the ground server, ground dashboard, PostgreSQL database, or ground-side operational data.

The Edge may also expose a separate operational view to explicitly authorized onboard personnel, but that is a different role and must not be part of the astronaut self-service interface.

#### BLE GATT synchronization

The Edge scans for wearable advertisements, prioritizes urgent advertisements, opens the BLE GATT connection as central, and issues `SyncRequest`. It receives the requested GATT telemetry fragments, reassembles them with a 30-second expiry, validates message structure, and validates the binding between each device and its assigned crew member.

After the local commit, the Edge writes `ReceiptAck` for the transfer. Fragment expiry bounds memory use and prevents incomplete transfers from being accepted later. Device-to-crew binding ensures physiological data is associated with the correct person before it enters the clinical or operational record.

#### Local database: SQLite

The Edge uses **SQLite** with write-ahead logging (WAL) and `synchronous=FULL`. It stores:

- `samples`
- `processing_jobs`
- `device_bindings`
- `audit_log`
- the outbound synchronization state

The ingestion transaction inserts the sample and its processing job atomically, then sends the BLE `ReceiptAck`. SQLite is chosen because it is embedded, operationally simple, durable on a single Edge node, and does not depend on a separate database service. WAL improves concurrent read/write behavior, while `synchronous=FULL` prioritizes durability over maximum write speed.

#### Local worker and alerts

The future architecture may also evaluate an explainable Mission Readiness rule locally: personal baseline deviation, a recent crew check-in, and a separately stored mission-context reference can produce an operational review recommendation. This is an alert with bounded evidence and existing priority/delivery guarantees, not a new channel, clinical score, diagnosis, or personal radiation-dose calculation. The HTTP/PostgreSQL MVP implementation is documented in `readme.md` and deliberately uses historical DosTel context only.

A local worker evaluates versioned rules, emits onboard alerts, and creates encoded telemetry events. It can generate:

- **FULL** snapshots at least every 300 seconds;
- **DELTA** updates relative to a known FULL base;
- emergency alerts and data-gap events.

Rules are versioned so that an alert can later be interpreted with the exact rule set that produced it. Processing is local because safety-relevant decisions cannot wait for a round trip to Earth.

#### Outbox pattern

The Edge keeps `alerts`, `encoder_state`, `base_archive`, and outgoing messages in a SQLite-backed outbox. Each message moves through the state machine below:

```text
PENDING → IN_FLIGHT → SYNCED
                  └→ QUARANTINED
```

The outbox decouples local acceptance from network delivery. If the broker or ground link is unavailable, data remains durable and resumes from the last safe state after recovery.

#### MQTT sender and scheduling

The sender prioritizes traffic in this order:

1. Emergency alerts
2. Requested FULL bases
3. Routine FULL bases
4. Routine readings

At least 20% of sending capacity is reserved for historical data so a continuous stream of urgent or current readings cannot permanently starve recovery. MQTT acknowledgement timeout is 30 seconds, and reconnection uses full-jitter backoff capped at 60 seconds. Link state is explicitly represented as `OFFLINE`, `CONNECTING`, `ONLINE`, or `BACKOFF`.

### 3. Event-driven synchronization and MQTT 5 Broker

The transport layer uses **MQTT 5** over **TLS with mutual TLS (mTLS)**.

MQTT is selected because it is lightweight, supports persistent sessions and QoS semantics, and is well suited to long-lived intermittent connections. TLS encrypts telemetry in transit; mTLS authenticates both the Edge and the broker, avoiding a trust model based only on client-side passwords or tokens.

The broker uses QoS 1, `retain=false`, persistent sessions, and access-control lists scoped by mission, Edge, and topic. QoS 1 supplies at-least-once delivery; application-level identifiers and deduplication make duplicate delivery safe. Retained messages are disabled to avoid presenting stale telemetry as current state to a newly connected subscriber.

Topics are scoped by mission and Edge:

```text
missions/{missionId}/edges/{edgeId}/telemetry
missions/{missionId}/edges/{edgeId}/ack
missions/{missionId}/edges/{edgeId}/base-request
```

This structure enables least-privilege ACLs and provides a clear tenant boundary.

Synchronization with Earth is automatic and event-driven. New locally committed telemetry, alerts, FULL bases, DELTA updates, and base requests create or update work in the Edge outbox. The MQTT sender reacts to pending outbox work and current link state; no astronaut action is required to transmit data. If the link is unavailable, events remain durable in the outbox and are published automatically after reconnection according to the configured priority rules.

### 4. Ground Server

The ground service also uses **TypeScript**, maintaining a consistent message model with the Edge service.

Its telemetry consumer:

1. Authenticates and authorizes the Edge, mission, and topic.
2. Validates payload size, protocol version, and event contents.
3. Deduplicates using `eventId`; a repeated ID with different content is treated as an integrity conflict.
4. Commits the event durably before issuing the application acknowledgement.

The application acknowledgement lets the Edge mark only accepted event IDs as `SYNCED`. Rejected events remain visible for investigation instead of being silently discarded.

#### PostgreSQL and reconstruction

The ground system stores events and reconstruction state in **PostgreSQL**, using time-oriented indexes and a 30-day retention policy for unresolved `WAITING_BASE` records.

PostgreSQL is selected for reliable multi-user persistence, transactional ingestion, indexing, operational reporting, and queryable historical data. A reconstruction service combines a DELTA event with its referenced FULL base to produce exact metrics and materialized history. If a required base is missing, the system sends a `BaseRequest` to the Edge.

#### Ground dashboard

The dashboard exposes telemetry age, data quality, clock health, and synchronization status. It explicitly marks records as `STALE`, `MISSING`, or `INVALID`; unknown data must not look healthy.

## Message contracts

The Edge and ground services share Protobuf contracts:

- `TelemetryBatch { version, batchId, edgeId, events[] }`
- `SpaceMessageEnvelope = EventMeta + event type`
- `ApplicationAck { batchId, receiverId, persistedAtMs, acceptedEventIds[], rejected[] }`
- `BaseRequest { requestId, edgeId, baseEventIds[] }`

`EventMeta` carries `eventId`, `missionId`, `edgeId`, `edgeSessionId`, `createdAtEdgeMs`, `dataSource`, and trace context. Supported event types are `FULL_HEARTBEAT`, `DELTA_UPDATE`, `EMERGENCY_ALERT`, and `DATA_GAP`.

Protobuf is used between Edge and ground because it supplies explicit, versionable schemas and efficient serialization while allowing controlled evolution of fields and event types.

## Reliability, security, and observability

### Delivery semantics

The end-to-end guarantee is **at-least-once delivery**, achieved through durable writes, retries, persistent MQTT sessions, and the Edge outbox. Idempotent storage keyed by `eventId` prevents duplicate events from changing the resulting record.

### Integrity and failure handling

- A wearable sample is durable before transmission.
- An Edge `ReceiptAck` is sent only after the sample and processing job commit together.
- A ground acknowledgement is sent only after durable ground commit.
- Conflicting reuse of an `eventId` is rejected as an integrity issue.
- Invalid payloads and unrecoverable messages are quarantined for inspection.
- Missing FULL bases result in an explicit base request rather than approximate reconstruction.

### Security

The design uses mTLS for service identity, ACLs for topic authorization, mission-scoped topics for isolation, and audit logging for traceability. Credential rotation, certificate expiry monitoring, and encrypted storage at rest should be included in the deployment plan.

### Observability

The system propagates **W3C Trace Context** across the pipeline:

```text
sampleId → eventId → batchId → ApplicationAck
```

Operational metrics should include BLE advertisement rate, scan-to-connect latency, synchronization-window success rate, urgent-advertisement latency, BLE fragment expiry, wearable and Edge retry counts, local storage utilization, outbox depth and age, MQTT connection state, acknowledgement latency, rejected-event counts, base-request frequency, and the number of stale or missing dashboard records.

## End-to-end flow

1. The wearable samples sensors and writes the sample to non-volatile storage.
2. It remains asleep except for low-duty-cycle BLE advertisements that make it available for the next routine synchronization window; an emergency produces an urgent advertisement immediately.
3. The Edge scans, connects as BLE central, and writes `SyncRequest` to request a bounded batch.
4. The wearable sends the requested compact BLE payload; the Edge reassembles and validates it.
5. The Edge atomically writes the sample and a processing job to SQLite, then returns `ReceiptAck` to release the persisted records.
6. The local worker evaluates rules, raises onboard alerts if required, and creates FULL or DELTA events.
7. Events enter the SQLite outbox and are scheduled automatically by priority; astronaut interaction is never required for transmission.
8. The MQTT sender publishes a Protobuf `TelemetryBatch` with QoS 1.
9. The ground consumer validates, deduplicates, and commits the events to PostgreSQL.
10. The ground server publishes `ApplicationAck`; the Edge marks accepted events as `SYNCED`.
11. When a DELTA is missing its FULL base, the ground server sends `BaseRequest` and the Edge republishes the requested base.

## Implementation priorities

1. Define and version Protobuf schemas, validation rules, and compatibility policy.
2. Implement wearable durable queueing, low-power/urgent BLE advertisements, BLE fragmentation, and `ReceiptAck` handling.
3. Implement the Edge BLE central scheduler, `SyncRequest`/`ReceiptAck`, transactional ingestion, outbox state machine, and local worker.
4. Configure broker mTLS, ACLs, persistent sessions, and topic provisioning.
5. Implement ground validation, idempotent PostgreSQL ingestion, reconstruction, acknowledgements, and base requests.
6. Add dashboards, tracing, metrics, alerting, and fault-injection tests for offline, duplicate, delayed, and conflicting messages.
