"""Sync endpoints (owner: Guilherme): Outbox status and the simulated Earth link."""

from typing import Protocol

from fastapi import APIRouter, Request
from hub_common import Clock, require_bearer_token

from app.sync.schemas import LinkUpdate, SyncStatus

router = APIRouter(prefix="/v1/sync", tags=["sync"])


class SyncControlStore(Protocol):
    def status(self, now_ms: int) -> SyncStatus: ...
    def set_link_enabled(self, enabled: bool, now_ms: int) -> None: ...


def _store(request: Request) -> SyncControlStore:
    return request.app.state.outbox_store


def _clock(request: Request) -> Clock:
    return request.app.state.clock


@router.get("/status", response_model=SyncStatus, response_model_by_alias=True)
def read_status(request: Request) -> SyncStatus:
    """Earth link state and Outbox backlog. Example: `GET /v1/sync/status`."""
    return _store(request).status(_clock(request).now_ms())


@router.put(
    "/link",
    response_model=SyncStatus,
    response_model_by_alias=True,
    dependencies=[require_bearer_token("admin_token")],
)
def update_link(update: LinkUpdate, request: Request) -> SyncStatus:
    """Turn the simulated Earth link on or off. Example: `PUT /v1/sync/link {"enabled": false}`."""
    now_ms = _clock(request).now_ms()
    _store(request).set_link_enabled(update.enabled, now_ms)
    return _store(request).status(now_ms)
