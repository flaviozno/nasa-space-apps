"""HTTP delivery of event batches to the Earth ingest endpoint."""

import httpx
from hub_common.sync_contract import EventBatch, EventBatchAck, EventBatchConflict
from pydantic import ValidationError


class EarthDeliveryError(Exception):
    """The batch did not get a usable ACK; the worker will retry it later."""


class HttpEarthClient:
    """Posts batches to `POST {earth_url}/v1/events/batches` with the ingest token.

    Example:
        HttpEarthClient(httpx.Client(base_url="http://earth:8000", timeout=10), token)
    """

    def __init__(self, http: httpx.Client, ingest_token: str) -> None:
        self._http = http
        self._headers = {"Authorization": f"Bearer {ingest_token}"}

    def send_batch(self, batch: EventBatch) -> EventBatchAck:
        try:
            response = self._http.post(
                "/v1/events/batches",
                content=batch.model_dump_json(by_alias=True),
                headers={**self._headers, "Content-Type": "application/json"},
            )
        except httpx.HTTPError as error:
            raise EarthDeliveryError(f"earth unreachable: {type(error).__name__}") from error
        return _parse_response(response)


def _parse_response(response: httpx.Response) -> EventBatchAck:
    if response.status_code == 409:
        conflict = EventBatchConflict.model_validate_json(response.content)
        raise EarthDeliveryError(
            f"earth reported conflicting event ids: {conflict.conflicting_event_ids}"
        )
    if response.status_code != 200:
        raise EarthDeliveryError(f"earth answered HTTP {response.status_code}, expected 200")
    try:
        return EventBatchAck.model_validate_json(response.content)
    except ValidationError as error:
        raise EarthDeliveryError(f"earth ACK has an invalid body: {error.error_count()} errors")
