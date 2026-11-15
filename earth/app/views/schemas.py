"""Earth view response shapes (camelCase JSON)."""

from enum import StrEnum

from hub_common.sync_contract import AlertEvidence, CamelModel
from pydantic import Field


class Freshness(StrEnum):
    FRESH = "FRESH"
    STALE = "STALE"  # older than the configured threshold: never show it as current
    MISSING = "MISSING"  # nothing received yet


class MetricView(CamelModel):
    metric: str
    value: float | None
    unit: str
    taken_at_ms: int
    data_age_ms: int
    freshness: Freshness


class CrewMemberView(CamelModel):
    crew_id: str
    name: str
    role: str
    freshness: Freshness
    last_measured_at_ms: int | None
    data_age_ms: int | None
    alert_count: int
    metrics: list[MetricView]


class AlertView(CamelModel):
    event_id: str
    crew_id: str
    alert_id: str
    rule_id: str
    metric: str | None
    value: float | None
    z_score: float | None
    message: str
    created_at_onboard_ms: int
    received_at_ms: int
    data_age_ms: int
    delivery_delay_ms: int
    recommendation_status: str | None = None
    evidence: list[AlertEvidence] = Field(default_factory=list)
    disclaimer: str | None = None


class EarthStatusView(CamelModel):
    generated_at_ms: int
    last_received_at_ms: int | None
    newest_data_age_ms: int | None
    observation_events: int
    alert_events: int
    conflicts: int
    average_delivery_delay_ms: int | None
