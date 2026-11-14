"""Authenticated client for the Vercel-hosted wearable emulator."""

import httpx
from pydantic import ValidationError

from app.ingest.contracts import ReceiptAck, SyncRequest, TelemetryBatch


class EmulatorRequestError(RuntimeError):
    """A safe-to-log error from the Vercel emulator request or response."""


class VercelEmulatorClient:
    def __init__(self, http: httpx.Client, token: str) -> None:
        self._http = http
        self._headers = {"Authorization": f"Bearer {token}"}

    def sync(self, request: SyncRequest) -> TelemetryBatch:
        try:
            response = self._http.post(
                "/api/sync",
                headers=self._headers,
                json=request.model_dump(mode="json", by_alias=True),
            )
            response.raise_for_status()
            batch = TelemetryBatch.model_validate(response.json())
        except httpx.HTTPStatusError as error:
            raise EmulatorRequestError(
                f"Vercel /api/sync returned HTTP {error.response.status_code}"
            ) from error
        except (httpx.HTTPError, ValueError, ValidationError) as error:
            raise EmulatorRequestError(
                f"Vercel /api/sync failed ({type(error).__name__})"
            ) from error

        if batch.request_id != request.request_id or batch.session_id != request.session_id:
            raise EmulatorRequestError("Vercel /api/sync echoed a different request or session ID")
        if len(batch.readings) > request.max_records:
            raise EmulatorRequestError("Vercel /api/sync exceeded the requested record limit")
        requested = {item.device_id: item.from_sequence for item in request.devices}
        requested_boot_ids = {item.device_id: item.boot_id for item in request.devices}
        expected_sequences = dict(requested)
        for reading in batch.readings:
            start_sequence = requested.get(reading.device_id)
            if (
                start_sequence is None
                or reading.boot_id != requested_boot_ids[reading.device_id]
                or reading.sequence_number != expected_sequences[reading.device_id]
                or reading.acquired_at_ms > request.until_acquired_at_ms
            ):
                raise EmulatorRequestError("Vercel /api/sync returned a reading outside the request")
            expected_sequences[reading.device_id] += 1
        return batch

    def acknowledge(self, receipt: ReceiptAck) -> None:
        try:
            response = self._http.post(
                "/api/receipt-acks",
                headers=self._headers,
                json=receipt.model_dump(mode="json", by_alias=True),
            )
            if response.status_code != 204:
                raise EmulatorRequestError(
                    f"Vercel /api/receipt-acks returned HTTP {response.status_code}"
                )
        except httpx.HTTPError as error:
            raise EmulatorRequestError(
                f"Vercel /api/receipt-acks failed ({type(error).__name__})"
            ) from error

    def close(self) -> None:
        self._http.close()
