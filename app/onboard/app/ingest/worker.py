"""Pulls bounded telemetry windows from the stateless Vercel emulator."""

import asyncio
import logging
import uuid

from hub_common import Clock
from hub_common.structured_log import log_json

from app.ingest.client import VercelEmulatorClient
from app.ingest.contracts import DeviceCursor, ReceiptAck, SyncRequest
from app.ingest.store import PostgresIngestStore

logger = logging.getLogger("onboard.ingest.worker")
MAX_RECORDS = 100
MAX_DEVICES_PER_REQUEST = 3


class WearableIngestWorker:
    def __init__(
        self,
        store: PostgresIngestStore,
        client: VercelEmulatorClient,
        clock: Clock,
        session_id: str,
        boot_id: str,
        scenario: str,
        interval_s: float,
    ) -> None:
        self._store = store
        self._client = client
        self._clock = clock
        self._session_id = session_id
        self._boot_id = boot_id
        self._scenario = scenario
        self._interval_s = interval_s
        self._devices = list(store.crew_by_device)

    def run_once(self) -> int:
        total = 0
        try:
            state = self._store.state(self._session_id, self._boot_id, self._scenario)
            for pending in self._store.pending_receipts(self._session_id):
                self._client.acknowledge(
                    ReceiptAck(
                        transfer_id=pending["transfer_id"],
                        request_id=pending["request_id"],
                        received_at_ms=pending["received_at_ms"],
                        accepted_sample_ids=pending["sample_ids"],
                    )
                )
                self._store.mark_acknowledged(pending["transfer_id"], self._clock.now_ms())
            for offset in range(0, len(self._devices), MAX_DEVICES_PER_REQUEST):
                group = self._devices[offset : offset + MAX_DEVICES_PER_REQUEST]
                cursors = dict(state["cursors"])
                page_count = 0
                while True:
                    request = SyncRequest(
                        request_id=f"onboard-{uuid.uuid4().hex}",
                        session_id=state["session_id"],
                        requested_at_ms=self._clock.now_ms(),
                        scenario=self._scenario,
                        devices=[
                            DeviceCursor(
                                device_id=device_id,
                                boot_id=self._boot_id,
                                from_sequence=cursors[device_id],
                            )
                            for device_id in group
                        ],
                        max_records=MAX_RECORDS,
                        until_acquired_at_ms=state["until_acquired_at_ms"],
                    )
                    batch = self._client.sync(request)
                    self._store.persist_batch(batch, self._clock.now_ms())
                    self._client.acknowledge(
                        ReceiptAck(
                            transfer_id=batch.transfer_id,
                            request_id=batch.request_id,
                            received_at_ms=self._clock.now_ms(),
                            accepted_sample_ids=[reading.sample_id for reading in batch.readings],
                        )
                    )
                    self._store.mark_acknowledged(batch.transfer_id, self._clock.now_ms())
                    total += len(batch.readings)
                    for reading in batch.readings:
                        cursors[reading.device_id] = max(
                            cursors[reading.device_id], reading.sequence_number + 1
                        )
                    page_count += 1
                    if not batch.has_more:
                        break
                    if not batch.readings or page_count >= 100:
                        raise RuntimeError("emulator pagination did not make bounded progress")
            self._store.complete_window(self._session_id, self._clock.now_ms())
            log_json(
                logger,
                logging.INFO,
                "wearable_window_ingested",
                session_id=self._session_id,
                readings=total,
            )
            return total
        except Exception as error:
            self._store.record_error(self._session_id, self._clock.now_ms(), type(error).__name__)
            log_json(
                logger,
                logging.WARNING,
                "wearable_ingest_failed",
                session_id=self._session_id,
                error=type(error).__name__,
            )
            raise

    async def run_forever(self) -> None:
        try:
            while True:
                try:
                    await asyncio.to_thread(self.run_once)
                except Exception:  # noqa: BLE001
                    pass  # Error is already recorded and logged; retry on the next interval.
                await asyncio.sleep(self._interval_s)
        finally:
            self._client.close()
