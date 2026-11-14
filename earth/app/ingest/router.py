"""Ingest endpoint (owner: Guilherme). Private: the web proxy does not expose it."""

import logging

from fastapi import APIRouter, Request, status
from fastapi.responses import JSONResponse
from hub_common import Clock, require_bearer_token
from hub_common.structured_log import log_json
from hub_common.sync_contract import EventBatch, EventBatchAck, EventBatchConflict
from sqlalchemy import Engine

from app.ingest.store import store_batch

router = APIRouter(prefix="/v1/events", tags=["ingest"])
logger = logging.getLogger("earth.ingest")


@router.post(
    "/batches",
    response_model=EventBatchAck,
    response_model_by_alias=True,
    responses={409: {"model": EventBatchConflict}},
    dependencies=[require_bearer_token("ingest_token")],
)
def ingest_batch(batch: EventBatch, request: Request) -> EventBatchAck | JSONResponse:
    """Validate, deduplicate by eventId, commit, and only then return the ACK.

    Re-sending a batch is safe: identical events are confirmed again, not stored twice.
    """
    engine: Engine = request.app.state.engine
    clock: Clock = request.app.state.clock
    # Explicit transaction: it must commit before the ACK leaves this function.
    with engine.begin() as connection:
        conflicts = store_batch(connection, batch, clock.now_ms())
    if conflicts:
        return _conflict_response(batch, conflicts)
    log_json(
        logger, logging.INFO, "batch_ingested", batch_id=batch.batch_id, events=len(batch.events)
    )
    return EventBatchAck(
        batch_id=batch.batch_id,
        persisted_at_ms=clock.now_ms(),
        accepted_event_ids=[event.event_id for event in batch.events],
    )


def _conflict_response(batch: EventBatch, conflicts: list[str]) -> JSONResponse:
    log_json(
        logger, logging.WARNING, "batch_conflict", batch_id=batch.batch_id, event_ids=conflicts
    )
    body = EventBatchConflict(batch_id=batch.batch_id, conflicting_event_ids=conflicts)
    return JSONResponse(
        status_code=status.HTTP_409_CONFLICT, content=body.model_dump(by_alias=True)
    )
