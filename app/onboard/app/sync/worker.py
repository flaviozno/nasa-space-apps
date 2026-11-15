"""Outbox worker: sends PENDING events to Earth when the simulated link is up.

One worker per onboard container. Sending again is safe because Earth deduplicates
by event_id, so delivery is at-least-once with exactly-once effect.
"""

import asyncio
import logging
import random
import uuid
from dataclasses import dataclass
from enum import StrEnum
from typing import Protocol

from hub_common import Clock
from hub_common.structured_log import log_json
from hub_common.sync_contract import EventBatch, EventBatchAck, ack_confirms_batch

from app.sync.backoff import retry_delay_ms
from app.sync.earth_client import EarthDeliveryError
from app.sync.schemas import PendingEvent, RetrySchedule

logger = logging.getLogger("onboard.sync.worker")
MAX_ERROR_LENGTH = 500


class OutboxStore(Protocol):
    def link_enabled(self) -> bool: ...
    def due_events(self, now_ms: int, limit: int) -> list[PendingEvent]: ...
    def mark_synced(self, event_ids: list[str], now_ms: int) -> None: ...
    def mark_failed(self, schedules: list[RetrySchedule], error: str) -> None: ...


class EarthBatchSender(Protocol):
    def send_batch(self, batch: EventBatch) -> EventBatchAck: ...


class CycleOutcome(StrEnum):
    LINK_DOWN = "LINK_DOWN"
    IDLE = "IDLE"
    SYNCED = "SYNCED"
    FAILED = "FAILED"


@dataclass(frozen=True)
class CycleReport:
    outcome: CycleOutcome
    events: int = 0


class OutboxWorker:
    """Example: `asyncio.create_task(OutboxWorker(store, sender, clock, 100, 5.0).run_forever())`."""

    def __init__(
        self,
        store: OutboxStore,
        sender: EarthBatchSender,
        clock: Clock,
        batch_size: int,
        interval_s: float,
        rng: random.Random | None = None,
    ) -> None:
        self._store = store
        self._sender = sender
        self._clock = clock
        self._batch_size = batch_size
        self._interval_s = interval_s
        self._rng = rng or random.Random()

    def run_once(self) -> CycleReport:
        """One cycle: check the link, send one batch, record the outcome."""
        if not self._store.link_enabled():
            return CycleReport(CycleOutcome.LINK_DOWN)
        pending = self._store.due_events(self._clock.now_ms(), self._batch_size)
        if not pending:
            return CycleReport(CycleOutcome.IDLE)
        batch = self._build_batch(pending)
        try:
            ack = self._sender.send_batch(batch)
        except EarthDeliveryError as error:
            return self._fail(batch, pending, str(error))
        if not ack_confirms_batch(batch, ack):
            return self._fail(batch, pending, "earth ACK does not confirm every event of the batch")
        return self._succeed(batch)

    async def run_forever(self) -> None:
        """Loop until cancelled; a full batch is followed by another one right away."""
        while True:
            report = await self._run_cycle_safely()
            drained_full_batch = (
                report.outcome is CycleOutcome.SYNCED and report.events == self._batch_size
            )
            await asyncio.sleep(0 if drained_full_batch else self._interval_s)

    async def _run_cycle_safely(self) -> CycleReport:
        try:
            return await asyncio.to_thread(self.run_once)
        # Any failure (e.g. database down) must not kill the loop; the next cycle retries.
        except Exception as error:  # noqa: BLE001
            log_json(logger, logging.ERROR, "outbox_cycle_crashed", error=type(error).__name__)
            return CycleReport(CycleOutcome.FAILED)

    def _build_batch(self, pending: list[PendingEvent]) -> EventBatch:
        return EventBatch(
            batch_id=f"bat-{uuid.uuid4().hex}",
            sent_at_onboard_ms=self._clock.now_ms(),
            events=[item.event for item in pending],
        )

    def _succeed(self, batch: EventBatch) -> CycleReport:
        event_ids = [event.event_id for event in batch.events]
        self._store.mark_synced(event_ids, self._clock.now_ms())
        log_json(
            logger,
            logging.INFO,
            "outbox_batch_synced",
            batch_id=batch.batch_id,
            events=len(event_ids),
        )
        return CycleReport(CycleOutcome.SYNCED, len(event_ids))

    def _fail(self, batch: EventBatch, pending: list[PendingEvent], error: str) -> CycleReport:
        now_ms = self._clock.now_ms()
        schedules = [
            RetrySchedule(
                item.event.event_id, now_ms + retry_delay_ms(item.attempts + 1, self._rng)
            )
            for item in pending
        ]
        self._store.mark_failed(schedules, error[:MAX_ERROR_LENGTH])
        log_json(
            logger, logging.WARNING, "outbox_batch_failed", batch_id=batch.batch_id, error=error
        )
        return CycleReport(CycleOutcome.FAILED, len(pending))
