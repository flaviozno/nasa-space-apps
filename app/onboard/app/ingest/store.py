"""Durable MVP storage for emulator samples and onboard cursors."""

import json

from hub_common.sync_contract import AlertPayload, ObservationItem, ObservationsPayload
from sqlalchemy import Engine, text

from app.ingest.contracts import TelemetryBatch
from app.readiness import persist_radiation_context, persist_review_recommendation
from app.sync.events import build_alert_event, build_observations_event, enqueue_event

SIMULATOR_EPOCH_MS = 1_767_225_600_000  # 2026-01-01T00:00:00Z in emulator time.
WINDOW_MS = 60_000
METRIC_FIELDS = (
    ("heart_rate", "heart_rate_bpm", "bpm", 1.0),
    ("spo2", "spo2_hundredths_percent", "%", 100.0),
    ("body_temp", "temperature_hundredths_celsius", "°C", 100.0),
)
ALERT_Z = 3.0


class PostgresIngestStore:
    """Stores samples, normalized observations, Outbox events, and cursors atomically."""

    def __init__(
        self,
        engine: Engine,
        crew_by_device: dict[str, str],
        baselines_by_device: dict[str, dict[str, dict[str, float]]],
    ) -> None:
        self._engine = engine
        self.crew_by_device = crew_by_device
        self._baselines_by_device = baselines_by_device

    def state(self, session_id: str, boot_id: str, scenario: str) -> dict:
        with self._engine.begin() as connection:
            connection.execute(
                text("""
                    INSERT INTO ingest_sessions
                        (session_id, scenario, next_until_acquired_at_ms, updated_at_ms)
                    VALUES (:session_id, :scenario, :initial_until, 0)
                    ON CONFLICT (session_id) DO NOTHING
                """),
                {
                    "session_id": session_id,
                    "scenario": scenario,
                    "initial_until": SIMULATOR_EPOCH_MS + WINDOW_MS - 1,
                },
            )
            for device_id, crew_id in self.crew_by_device.items():
                connection.execute(
                    text("""
                        INSERT INTO ingest_cursors
                            (session_id, device_id, crew_id, boot_id, next_sequence)
                        VALUES (:session_id, :device_id, :crew_id, :boot_id, 0)
                        ON CONFLICT (session_id, device_id) DO NOTHING
                    """),
                    {
                        "session_id": session_id,
                        "device_id": device_id,
                        "crew_id": crew_id,
                        "boot_id": boot_id,
                    },
                )
            session = connection.execute(
                text("""SELECT scenario, next_until_acquired_at_ms
                        FROM ingest_sessions WHERE session_id = :session_id"""),
                {"session_id": session_id},
            ).one()
            cursors = connection.execute(
                text("""SELECT device_id, boot_id, next_sequence FROM ingest_cursors
                        WHERE session_id = :session_id"""),
                {"session_id": session_id},
            ).all()
            if session.scenario != scenario or any(row.boot_id != boot_id for row in cursors):
                raise ValueError("scenario or bootId changed; configure a new ingest sessionId")
        return {
            "session_id": session_id,
            "scenario": session.scenario,
            "until_acquired_at_ms": session.next_until_acquired_at_ms,
            "cursors": {row.device_id: row.next_sequence for row in cursors},
        }

    def persist_batch(self, batch: TelemetryBatch, received_at_ms: int) -> None:
        with self._engine.begin() as connection:
            for reading in batch.readings:
                crew_id = self.crew_by_device.get(reading.device_id)
                if crew_id is None:
                    raise ValueError(f"unknown emulator device: {reading.device_id}")
                connection.execute(
                    text("""
                        INSERT INTO wearable_samples
                            (sample_id, session_id, crew_id, device_id, boot_id,
                             sequence_number, acquired_at_ms, payload, received_at_onboard_ms)
                        VALUES (:sample_id, :session_id, :crew_id, :device_id, :boot_id,
                                :sequence_number, :acquired_at_ms, CAST(:payload AS jsonb),
                                :received_at_ms)
                        ON CONFLICT (device_id, boot_id, sequence_number) DO NOTHING
                    """),
                    {
                        "sample_id": reading.sample_id,
                        "session_id": batch.session_id,
                        "crew_id": crew_id,
                        "device_id": reading.device_id,
                        "boot_id": reading.boot_id,
                        "sequence_number": reading.sequence_number,
                        "acquired_at_ms": reading.acquired_at_ms,
                        "payload": json.dumps(reading.model_dump(mode="json", by_alias=True)),
                        "received_at_ms": received_at_ms,
                    },
                )

                observation_items = []
                persist_radiation_context(
                    connection,
                    observed_at_ms=reading.acquired_at_ms,
                    source_timestamp=reading.radiation.source_timestamp,
                    instrument_id=reading.radiation.instrument_id,
                    dose_rate_micro_gy_per_hour=reading.radiation.absorbed_dose_rate_micro_gy_per_hour,
                )
                for metric, field, unit, divisor in METRIC_FIELDS:
                    raw_value = getattr(reading, field)
                    value = None if raw_value is None else raw_value / divisor
                    observation_items.append(
                        ObservationItem(
                            metric=metric,
                            value=value,
                            unit=unit,
                            taken_at=reading.acquired_at_ms,
                        )
                    )
                    connection.execute(
                        text("""
                            INSERT INTO observations
                                (id, crew_id, metric, value, unit, source, source_ref,
                                 taken_at, created_at)
                            VALUES (:id, :crew_id, :metric, :value, :unit, 'wearable',
                                    :source_ref, :taken_at, :created_at)
                            ON CONFLICT (source, source_ref, metric) DO NOTHING
                        """),
                        {
                            "id": f"{reading.sample_id}:{metric}",
                            "crew_id": crew_id,
                            "metric": metric,
                            "value": value,
                            "unit": unit,
                            "source_ref": reading.sample_id,
                            "taken_at": reading.acquired_at_ms,
                            "created_at": received_at_ms,
                        },
                    )
                enqueue_event(
                    connection,
                    build_observations_event(
                        crew_id,
                        reading.sample_id,
                        ObservationsPayload(source="wearable", observations=observation_items),
                        received_at_ms,
                    ),
                )
                baselines = self._baselines_by_device[reading.device_id]
                for item in observation_items:
                    baseline = baselines.get(item.metric)
                    if item.value is None or baseline is None or baseline["spread"] <= 0:
                        continue
                    z_score = (item.value - baseline["median"]) / baseline["spread"]
                    if abs(z_score) < ALERT_Z:
                        continue
                    alert_id = f"alert:{reading.sample_id}:{item.metric}:baseline-v1"
                    connection.execute(
                        text("""
                            INSERT INTO alerts
                                (alert_id, crew_id, sample_id, metric, value, z_score, created_at_ms)
                            VALUES (:alert_id, :crew_id, :sample_id, :metric, :value, :z_score, :now_ms)
                            ON CONFLICT (alert_id) DO NOTHING
                        """),
                        {
                            "alert_id": alert_id,
                            "crew_id": crew_id,
                            "sample_id": reading.sample_id,
                            "metric": item.metric,
                            "value": item.value,
                            "z_score": z_score,
                            "now_ms": received_at_ms,
                        },
                    )
                    enqueue_event(
                        connection,
                        build_alert_event(
                            crew_id,
                            AlertPayload(
                                alert_id=alert_id,
                                rule_id="single_reading_zscore",
                                rule_version="1",
                                metric=item.metric,
                                value=item.value,
                                z_score=z_score,
                                message=f"{item.metric} crossed the baseline threshold |z| >= {ALERT_Z:g}.",
                                created_at=received_at_ms,
                            ),
                            received_at_ms,
                        ),
                    )
                persist_review_recommendation(
                    connection, crew_id, baselines.get("heart_rate"), received_at_ms
                )
                connection.execute(
                    text("""
                        UPDATE ingest_cursors
                        SET next_sequence = GREATEST(next_sequence, :next_sequence)
                        WHERE session_id = :session_id AND device_id = :device_id
                          AND boot_id = :boot_id
                    """),
                    {
                        "next_sequence": reading.sequence_number + 1,
                        "session_id": batch.session_id,
                        "device_id": reading.device_id,
                        "boot_id": reading.boot_id,
                    },
                )

            connection.execute(
                text("""UPDATE ingest_sessions SET last_success_at_ms = :now_ms,
                            updated_at_ms = :now_ms, last_error = NULL
                        WHERE session_id = :session_id"""),
                {"now_ms": received_at_ms, "session_id": batch.session_id},
            )
            connection.execute(
                text("""
                    INSERT INTO ingest_receipts
                        (transfer_id, request_id, session_id, accepted_sample_ids, created_at_ms)
                    VALUES (:transfer_id, :request_id, :session_id,
                            CAST(:accepted_sample_ids AS jsonb), :created_at_ms)
                    ON CONFLICT (transfer_id) DO NOTHING
                """),
                {
                    "transfer_id": batch.transfer_id,
                    "request_id": batch.request_id,
                    "session_id": batch.session_id,
                    "accepted_sample_ids": json.dumps(
                        [reading.sample_id for reading in batch.readings]
                    ),
                    "created_at_ms": received_at_ms,
                },
            )

    def pending_receipts(self, session_id: str) -> list[dict[str, object]]:
        with self._engine.connect() as connection:
            rows = connection.execute(
                text("""
                    SELECT transfer_id, request_id, accepted_sample_ids, created_at_ms
                    FROM ingest_receipts
                    WHERE session_id = :session_id AND acknowledged_at_ms IS NULL
                    ORDER BY created_at_ms, transfer_id
                """),
                {"session_id": session_id},
            ).all()
        return [
            {
                "transfer_id": row.transfer_id,
                "request_id": row.request_id,
                "sample_ids": row.accepted_sample_ids,
                "received_at_ms": row.created_at_ms,
            }
            for row in rows
        ]

    def mark_acknowledged(self, transfer_id: str, acknowledged_at_ms: int) -> None:
        with self._engine.begin() as connection:
            connection.execute(
                text("""
                    UPDATE ingest_receipts SET acknowledged_at_ms = :now_ms
                    WHERE transfer_id = :transfer_id
                """),
                {"transfer_id": transfer_id, "now_ms": acknowledged_at_ms},
            )

    def complete_window(self, session_id: str, completed_at_ms: int) -> None:
        with self._engine.begin() as connection:
            connection.execute(
                text("""UPDATE ingest_sessions
                        SET next_until_acquired_at_ms = next_until_acquired_at_ms + :window_ms,
                            updated_at_ms = :now_ms, last_success_at_ms = :now_ms, last_error = NULL
                        WHERE session_id = :session_id"""),
                {"window_ms": WINDOW_MS, "now_ms": completed_at_ms, "session_id": session_id},
            )

    def record_error(self, session_id: str, now_ms: int, error: str) -> None:
        with self._engine.begin() as connection:
            connection.execute(
                text("""UPDATE ingest_sessions SET updated_at_ms = :now_ms, last_error = :error
                        WHERE session_id = :session_id"""),
                {"now_ms": now_ms, "error": error[:300], "session_id": session_id},
            )

    def status(self, session_id: str) -> dict[str, object]:
        with self._engine.connect() as connection:
            session = connection.execute(
                text("""SELECT scenario, next_until_acquired_at_ms, last_success_at_ms,
                            last_error FROM ingest_sessions WHERE session_id = :session_id"""),
                {"session_id": session_id},
            ).first()
            if session is None:
                return {"sessionId": session_id, "initialized": False}
            cursors = connection.execute(
                text("""SELECT device_id, next_sequence FROM ingest_cursors
                        WHERE session_id = :session_id ORDER BY device_id"""),
                {"session_id": session_id},
            ).all()
        return {
            "sessionId": session_id,
            "initialized": True,
            "scenario": session.scenario,
            "nextUntilAcquiredAtMs": session.next_until_acquired_at_ms,
            "lastSuccessAtMs": session.last_success_at_ms,
            "lastError": session.last_error,
            "cursors": {row.device_id: row.next_sequence for row in cursors},
        }
