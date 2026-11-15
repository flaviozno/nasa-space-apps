"""Build small, explainable next-step plans from local onboard evidence.

The plans deliberately turn *assessment* into an operational next action without
diagnosing, prescribing treatment, or relying on a ground connection.  They are
computed on demand from data already retained onboard, so no extra service,
database table, or synchronization path is required for the MVP.
"""

from app.crew.schemas import (
    ActionPlanOut,
    ActionPriority,
    ActionStepOut,
    ActionType,
    CrewSummaryOut,
    ObservationStatus,
)
from app.readiness import ReadinessDecision, ReadinessStatus

DISCLAIMER = (
    "Operational decision support only. This plan does not diagnose, prescribe, "
    "or replace the mission's approved medical procedures."
)


def _step(id: str, title: str, detail: str, action_type: ActionType) -> ActionStepOut:
    return ActionStepOut(id=id, title=title, detail=detail, action_type=action_type)


def _measurement_quality_step(summary: CrewSummaryOut) -> ActionStepOut:
    heart_rate = next(metric for metric in summary.metrics if metric.metric == "heart_rate")
    if heart_rate.status in {ObservationStatus.no_data, ObservationStatus.invalid, ObservationStatus.stale}:
        return _step(
            "verify-measurement",
            "Restore a usable heart-rate reading",
            "Check wearable contact and battery, then repeat the measurement. Do not act on missing, invalid, or stale data.",
            ActionType.verify_measurement,
        )
    return _step(
        "verify-measurement",
        "Confirm the heart-rate reading",
        "Check sensor contact, remain at rest for the repeat measurement, and compare the new reading with your personal baseline.",
        ActionType.verify_measurement,
    )


def build_action_plan(
    crew_id: str,
    decision: ReadinessDecision,
    summary: CrewSummaryOut,
    now_ms: int,
) -> ActionPlanOut:
    """Translate the local readiness state into bounded, astronaut-facing actions.

    A critical-task review is intentionally a pause-and-verify workflow. A
    missing context becomes a request to collect it, never a claim that the
    crew member is well. Every branch is useful while the Earth link is down.
    """
    if decision.status is ReadinessStatus.REVIEW_BEFORE_CRITICAL_TASK:
        return ActionPlanOut(
            crew_id=crew_id,
            priority=ActionPriority.act_now,
            title="Pause before a critical task",
            detail="Local signals need a short review before the next safety-critical activity.",
            evaluated_at=now_ms,
            steps=[
                _step(
                    "pause-task",
                    "Pause the critical task",
                    "Tell the nearby crew member or task lead that a local health review is in progress.",
                    ActionType.pause_task,
                ),
                _measurement_quality_step(summary),
                _step(
                    "record-context",
                    "Record current symptoms and fatigue",
                    "Complete the local check-in so the review has a current self-report alongside the device reading.",
                    ActionType.complete_checkin,
                ),
                _step(
                    "approved-protocol",
                    "Use the approved onboard procedure",
                    "Follow the mission procedure applicable to the confirmed finding; do not wait for a ground link to begin it.",
                    ActionType.follow_approved_protocol,
                ),
            ],
            disclaimer=DISCLAIMER,
        )

    if decision.status is ReadinessStatus.MONITOR:
        if not decision.sufficient_context:
            title = "Complete a local health check"
            detail = "A current check-in or measurement is missing, so the system cannot make a stronger readiness conclusion."
        else:
            title = "Recheck before the next critical task"
            detail = "One local signal needs attention. Confirm it before increasing task demand."
        return ActionPlanOut(
            crew_id=crew_id,
            priority=ActionPriority.recheck,
            title=title,
            detail=detail,
            evaluated_at=now_ms,
            steps=[
                _measurement_quality_step(summary),
                _step(
                    "complete-checkin",
                    "Complete the current health check-in",
                    "Record fatigue, sleepiness, mood, and symptoms so local context is complete.",
                    ActionType.complete_checkin,
                ),
                _step(
                    "observe-change",
                    "Monitor for a meaningful change",
                    "If the repeat reading remains different from your baseline or symptoms change, use the approved onboard procedure.",
                    ActionType.follow_approved_protocol,
                ),
            ],
            disclaimer=DISCLAIMER,
        )

    return ActionPlanOut(
        crew_id=crew_id,
        priority=ActionPriority.routine,
        title="Continue the planned routine",
        detail="No configured local signal currently requires a task review.",
        evaluated_at=now_ms,
        steps=[
            _step(
                "continue-routine",
                "Continue the planned routine",
                "Keep following the scheduled sleep, exercise, and health-check routine.",
                ActionType.continue_routine,
            ),
            _step(
                "report-change",
                "Record a change when it appears",
                "Use the local check-in whenever symptoms, fatigue, or mood change between routine prompts.",
                ActionType.complete_checkin,
            ),
        ],
        disclaimer=DISCLAIMER,
    )
