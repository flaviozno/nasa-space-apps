"""Sync API and worker data shapes."""

from dataclasses import dataclass

from hub_common.sync_contract import CamelModel, SyncEvent


@dataclass(frozen=True)
class PendingEvent:
    """An outbox row the worker may send, with how many times it already failed."""

    event: SyncEvent
    attempts: int


@dataclass(frozen=True)
class RetrySchedule:
    """When a failed event becomes due again."""

    event_id: str
    next_attempt_at_ms: int


class SyncStatus(CamelModel):
    link_enabled: bool
    pending_count: int
    pending_alerts: int
    oldest_pending_age_ms: int | None
    last_ack_at_ms: int | None
    last_error: str | None


class LinkUpdate(CamelModel):
    enabled: bool
