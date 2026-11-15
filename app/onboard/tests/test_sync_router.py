from app.config import OnboardSettings
from app.main import create_app
from fastapi.testclient import TestClient
from hub_common.sync_contract import EventType
from sync_fakes import FakeClock, FakeOutboxStore, make_event

UNREACHABLE_DB = "postgresql+psycopg://user:pw@nowhere.invalid:5432/onboard"
ADMIN = {"Authorization": "Bearer admin-secret"}


def build_client(store: FakeOutboxStore) -> TestClient:
    settings = OnboardSettings(
        database_url=UNREACHABLE_DB, sync_worker_enabled=False, admin_token="admin-secret"
    )
    return TestClient(create_app(settings, outbox_store=store, clock=FakeClock()))


def test_status_reports_link_and_backlog_in_camel_case() -> None:
    store = FakeOutboxStore([make_event("s1"), make_event("a1", EventType.ALERT)])
    body = build_client(store).get("/v1/sync/status").json()
    assert body["linkEnabled"] is True
    assert (body["pendingCount"], body["pendingAlerts"]) == (2, 1)


def test_admin_can_turn_the_link_off() -> None:
    store = FakeOutboxStore()
    response = build_client(store).put("/v1/sync/link", json={"enabled": False}, headers=ADMIN)
    assert response.json()["linkEnabled"] is False
    assert store.link is False


def test_link_change_requires_the_admin_token() -> None:
    store = FakeOutboxStore()
    response = build_client(store).put("/v1/sync/link", json={"enabled": False})
    assert response.status_code == 401
    assert store.link is True
