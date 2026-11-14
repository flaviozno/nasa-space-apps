"""Turn query results into Earth view responses (pure functions, no database)."""

import logging

from hub_common.structured_log import log_json
from hub_common.sync_contract import AlertPayload
from pydantic import ValidationError
from sqlalchemy import Row

from app.views.crew_roster import RosterMember
from app.views.queries import LatestMetric
from app.views.schemas import AlertView, CrewMemberView, EarthStatusView, Freshness, MetricView

logger = logging.getLogger("earth.views")


def freshness(age_ms: int | None, stale_after_ms: int) -> Freshness:
    """FRESH, STALE (older than the threshold) or MISSING (no data).

    Example: `freshness(700_000, 600_000)` → STALE.
    """
    if age_ms is None:
        return Freshness.MISSING
    return Freshness.STALE if age_ms > stale_after_ms else Freshness.FRESH


def build_crew_views(
    roster: list[RosterMember],
    latest: list[LatestMetric],
    alerts_by_crew: dict[str, int],
    now_ms: int,
    stale_after_ms: int,
) -> list[CrewMemberView]:
    """One view per roster member, in roster order; members without data are MISSING."""
    return [
        _crew_view(
            member,
            [m for m in latest if m.crew_id == member.crew_id],
            alerts_by_crew,
            now_ms,
            stale_after_ms,
        )
        for member in roster
    ]


def _crew_view(
    member: RosterMember,
    metrics: list[LatestMetric],
    alerts_by_crew: dict[str, int],
    now_ms: int,
    stale_after_ms: int,
) -> CrewMemberView:
    last_measured = max((m.taken_at_ms for m in metrics), default=None)
    age = None if last_measured is None else now_ms - last_measured
    return CrewMemberView(
        crew_id=member.crew_id,
        name=member.name,
        role=member.role,
        freshness=freshness(age, stale_after_ms),
        last_measured_at_ms=last_measured,
        data_age_ms=age,
        alert_count=alerts_by_crew.get(member.crew_id, 0),
        metrics=[
            _metric_view(m, now_ms, stale_after_ms) for m in sorted(metrics, key=lambda m: m.metric)
        ],
    )


def _metric_view(metric: LatestMetric, now_ms: int, stale_after_ms: int) -> MetricView:
    age = now_ms - metric.taken_at_ms
    return MetricView(
        metric=metric.metric,
        value=metric.value,
        unit=metric.unit,
        taken_at_ms=metric.taken_at_ms,
        data_age_ms=age,
        freshness=freshness(age, stale_after_ms),
    )


def build_alert_views(rows: list[Row], now_ms: int) -> list[AlertView]:
    """Alerts newest first; rows whose payload does not match the contract are skipped and logged."""
    views = []
    for row in rows:
        try:
            alert = AlertPayload.model_validate(row.payload)
        except ValidationError:
            log_json(logger, logging.WARNING, "alert_payload_invalid", event_id=row.event_id)
            continue
        views.append(_alert_view(row, alert, now_ms))
    return views


def _alert_view(row: Row, alert: AlertPayload, now_ms: int) -> AlertView:
    return AlertView(
        event_id=row.event_id,
        crew_id=row.crew_id,
        alert_id=alert.alert_id,
        rule_id=alert.rule_id,
        metric=alert.metric,
        value=alert.value,
        z_score=alert.z_score,
        message=alert.message,
        created_at_onboard_ms=row.created_at_onboard_ms,
        received_at_earth_ms=row.received_at_earth_ms,
        data_age_ms=now_ms - row.created_at_onboard_ms,
        delivery_delay_ms=row.received_at_earth_ms - row.created_at_onboard_ms,
    )


def build_status_view(row: Row, now_ms: int) -> EarthStatusView:
    newest = row.newest_created_at_ms
    delay = row.average_delay_ms
    return EarthStatusView(
        generated_at_ms=now_ms,
        last_received_at_ms=row.last_received_at_ms,
        newest_data_age_ms=None if newest is None else now_ms - newest,
        observation_events=row.observation_events,
        alert_events=row.alert_events,
        conflicts=row.conflicts,
        average_delivery_delay_ms=None if delay is None else int(delay),
    )
