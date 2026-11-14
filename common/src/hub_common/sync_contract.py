"""Onboard → Earth synchronization contract, version 1 (owner: Guilherme).

Shared by the onboard Outbox worker (sender) and the Earth ingest (receiver).
JSON uses camelCase; Python uses snake_case.
"""

from enum import StrEnum
from typing import Literal

from pydantic import BaseModel, ConfigDict, Field, JsonValue
from pydantic.alias_generators import to_camel

MAX_EVENTS_PER_BATCH = 100


class EventType(StrEnum):
    OBSERVATIONS = "OBSERVATIONS"
    ALERT = "ALERT"


# Lower is sent first: alerts must reach Earth before routine readings.
PRIORITY_BY_TYPE: dict[EventType, int] = {EventType.ALERT: 0, EventType.OBSERVATIONS: 1}


class CamelModel(BaseModel):
    model_config = ConfigDict(alias_generator=to_camel, populate_by_name=True, frozen=True)


class SyncEvent(CamelModel):
    """One self-contained event. `event_id` never changes across retries."""

    version: Literal[1] = 1
    event_id: str = Field(min_length=1, max_length=128)
    type: EventType
    priority: int = Field(ge=0, le=9)
    crew_id: str = Field(min_length=1)
    source_ref: str = Field(min_length=1)
    created_at_onboard_ms: int = Field(ge=0)
    data_source: Literal["SIMULATED"] = "SIMULATED"
    payload: dict[str, JsonValue]


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
