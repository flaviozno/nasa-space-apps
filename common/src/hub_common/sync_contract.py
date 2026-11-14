"""Onboard → Earth synchronization contract, version 1 (owner: Guilherme).

Shared by the onboard Outbox worker (sender) and the Earth ingest (receiver).
JSON uses camelCase; Python uses snake_case.
"""

from enum import StrEnum
from typing import Literal, Self

from pydantic import BaseModel, ConfigDict, Field, JsonValue, model_validator
from pydantic.alias_generators import to_camel

MAX_EVENTS_PER_BATCH = 100


class EventType(StrEnum):
    OBSERVATIONS = "OBSERVATIONS"
    ALERT = "ALERT"


# Lower is sent first: alerts must reach Earth before routine readings.
PRIORITY_BY_TYPE: dict[EventType, int] = {EventType.ALERT: 0, EventType.OBSERVATIONS: 1}


class CamelModel(BaseModel):
    model_config = ConfigDict(alias_generator=to_camel, populate_by_name=True, frozen=True)


class ObservationItem(CamelModel):
    """One normalized value; same fields as an onboard observation."""

    metric: str = Field(min_length=1)
    value: float | None  # null = invalid reading, never 0
    unit: str
    taken_at: int = Field(ge=0)


class ObservationsPayload(CamelModel):
    """Payload of an OBSERVATIONS event: values from one source record."""

    source: str = Field(min_length=1)  # wearable, manual, questionnaire, or a future source
    observations: list[ObservationItem] = Field(min_length=1)


class AlertPayload(CamelModel):
    """Payload of an ALERT event: self-contained evidence (mirrors the Crew API AlertOut)."""

    alert_id: str = Field(min_length=1)
    rule_id: str
    rule_version: str
    metric: str | None = None
    value: float | None = None
    z_score: float | None = None
    message: str
    created_at: int = Field(ge=0)


PAYLOAD_MODEL_BY_TYPE: dict[EventType, type[CamelModel]] = {
    EventType.OBSERVATIONS: ObservationsPayload,
    EventType.ALERT: AlertPayload,
}


class SyncEvent(CamelModel):
    """One self-contained event. `event_id` never changes across retries.

    `payload` is stored as JSON (camelCase) and must match the model for `type`.
    """

    version: Literal[1] = 1
    event_id: str = Field(min_length=1, max_length=128)
    type: EventType
    priority: int = Field(ge=0, le=9)
    crew_id: str = Field(min_length=1)
    source_ref: str = Field(min_length=1)
    created_at_onboard_ms: int = Field(ge=0)
    data_source: Literal["SIMULATED"] = "SIMULATED"
    payload: dict[str, JsonValue]

    @model_validator(mode="after")
    def payload_matches_type(self) -> Self:
        PAYLOAD_MODEL_BY_TYPE[self.type].model_validate(self.payload)
        return self


def payload_json(payload: CamelModel) -> dict[str, JsonValue]:
    """Payload model → the camelCase JSON dict stored in SyncEvent.payload.

    Example: `payload_json(ObservationsPayload(source="manual", observations=[...]))`
    """
    return payload.model_dump(mode="json", by_alias=True)


class EventBatch(CamelModel):
    version: Literal[1] = 1
    batch_id: str = Field(min_length=1, max_length=128)
    sent_at_onboard_ms: int = Field(ge=0)
    events: list[SyncEvent] = Field(min_length=1, max_length=MAX_EVENTS_PER_BATCH)


class EventBatchAck(CamelModel):
    """Sent by Earth only after the batch is durably committed."""

    batch_id: str
    persisted_at_ms: int
    accepted_event_ids: list[str]


class EventBatchConflict(CamelModel):
    """Earth refused the whole batch: these IDs already exist with different content."""

    batch_id: str
    conflicting_event_ids: list[str]


def ack_confirms_batch(batch: EventBatch, ack: EventBatchAck) -> bool:
    """True when the ACK is for this batch and lists every event in it.

    Example: `ack_confirms_batch(batch, EventBatchAck(batch_id=batch.batch_id, ...))`
    """
    sent_ids = {event.event_id for event in batch.events}
    return ack.batch_id == batch.batch_id and sent_ids <= set(ack.accepted_event_ids)
