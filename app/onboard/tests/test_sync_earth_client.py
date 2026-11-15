import httpx
import pytest
from app.sync.earth_client import EarthDeliveryError, HttpEarthClient
from hub_common.sync_contract import EventBatch, EventBatchAck, EventBatchConflict
from sync_fakes import make_event


class FakeEarthServer:
    """Answers POST /v1/events/batches like Earth would, as an httpx transport."""

    def __init__(self, status_code: int = 200, body: bytes | None = None) -> None:
        self.status_code = status_code
        self.body = body
        self.requests: list[httpx.Request] = []

    def handle(self, request: httpx.Request) -> httpx.Response:
        self.requests.append(request)
        if self.body is not None:
            return httpx.Response(self.status_code, content=self.body)
        batch = EventBatch.model_validate_json(request.content)
        ack = EventBatchAck(
            batch_id=batch.batch_id,
            persisted_at_ms=7,
            accepted_event_ids=[e.event_id for e in batch.events],
        )
        return httpx.Response(200, content=ack.model_dump_json(by_alias=True))

    def client(self, token: str = "tok") -> HttpEarthClient:
        http = httpx.Client(base_url="http://earth", transport=httpx.MockTransport(self.handle))
        return HttpEarthClient(http, token)


def build_batch() -> EventBatch:
    return EventBatch(batch_id="bat-1", sent_at_onboard_ms=1, events=[make_event("s1")])


def test_sends_camel_case_batch_with_token_and_parses_ack() -> None:
    server = FakeEarthServer()
    ack = server.client("tok").send_batch(build_batch())
    request = server.requests[0]
    assert request.url.path == "/v1/events/batches"
    assert request.headers["Authorization"] == "Bearer tok"
    assert b'"batchId":"bat-1"' in request.content
    assert ack.accepted_event_ids == [build_batch().events[0].event_id]


def test_conflict_names_the_event_ids() -> None:
    body = EventBatchConflict(batch_id="bat-1", conflicting_event_ids=["evt-x"])
    server = FakeEarthServer(409, body.model_dump_json(by_alias=True).encode())
    with pytest.raises(EarthDeliveryError, match="evt-x"):
        server.client().send_batch(build_batch())


def test_unexpected_status_is_a_delivery_error() -> None:
    with pytest.raises(EarthDeliveryError, match="HTTP 401"):
        FakeEarthServer(401, b"{}").client().send_batch(build_batch())


def test_invalid_ack_body_is_a_delivery_error() -> None:
    with pytest.raises(EarthDeliveryError, match="invalid body"):
        FakeEarthServer(200, b'{"nope": 1}').client().send_batch(build_batch())


def test_network_failure_is_a_delivery_error() -> None:
    def refuse(request: httpx.Request) -> httpx.Response:
        raise httpx.ConnectError("refused", request=request)

    http = httpx.Client(base_url="http://earth", transport=httpx.MockTransport(refuse))
    with pytest.raises(EarthDeliveryError, match="ConnectError"):
        HttpEarthClient(http, "tok").send_batch(build_batch())
