"""Unit tests for astronaut-facing operational next actions."""

from app.crew.actions import build_action_plan
from app.crew.schemas import CrewSummaryOut, MetricSummaryOut, ObservationStatus
from app.readiness import ReadinessDecision, ReadinessStatus


def summary(status: ObservationStatus) -> CrewSummaryOut:
    return CrewSummaryOut(
        crew_id="crew-1",
        generated_at=1_700_000_000_000,
        metrics=[
            MetricSummaryOut(
                metric="heart_rate",
                label="Heart rate",
                unit="bpm",
                value=126 if status is not ObservationStatus.no_data else None,
                taken_at=1_700_000_000_000 if status is not ObservationStatus.no_data else None,
                z_score=5 if status is ObservationStatus.deviation else None,
                status=status,
            )
        ],
    )


def test_review_plan_pauses_and_uses_only_approved_procedures() -> None:
    decision = ReadinessDecision(
        ReadinessStatus.REVIEW_BEFORE_CRITICAL_TASK,
        "Review before a critical task.",
        (),
        True,
        5.0,
    )

    plan = build_action_plan("crew-1", decision, summary(ObservationStatus.deviation), 1_700_000_000_000)

    assert plan.priority == "ACT_NOW"
    assert [step.action_type for step in plan.steps] == [
        "PAUSE_TASK",
        "VERIFY_MEASUREMENT",
        "COMPLETE_CHECKIN",
        "FOLLOW_APPROVED_PROTOCOL",
    ]
    assert "does not diagnose" in plan.disclaimer


def test_incomplete_context_requests_collection_without_claiming_nominal_status() -> None:
    decision = ReadinessDecision(
        ReadinessStatus.MONITOR,
        "Mission context is incomplete.",
        (),
        False,
        None,
    )

    plan = build_action_plan("crew-1", decision, summary(ObservationStatus.no_data), 1_700_000_000_000)

    assert plan.priority == "RECHECK"
    assert plan.title == "Complete a local health check"
    assert plan.steps[0].action_type == "VERIFY_MEASUREMENT"
    assert "missing, invalid, or stale" in plan.steps[0].detail
