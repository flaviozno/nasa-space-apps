"""Read queries over received_events. Ordering and ages use onboard time, never arrival order."""

from dataclasses import dataclass

from sqlalchemy import Connection, Row, text

# Newest value per (crew member, metric), unpacked from OBSERVATIONS payloads.
LATEST_METRICS_SQL = text(
    """
    SELECT DISTINCT ON (e.crew_id, o.metric)
           e.crew_id, o.metric, o.value, o.unit, o."takenAt" AS taken_at
    FROM received_events e
    CROSS JOIN LATERAL jsonb_to_recordset(e.payload -> 'observations')
         AS o(metric text, value double precision, unit text, "takenAt" bigint)
    WHERE e.type = 'OBSERVATIONS' AND o.metric IS NOT NULL AND o."takenAt" IS NOT NULL
    ORDER BY e.crew_id, o.metric, o."takenAt" DESC
    """
)

ALERTS_SQL = text(
    """
    SELECT event_id, crew_id, payload, created_at_onboard_ms, received_at_earth_ms
    FROM received_events
    WHERE type = 'ALERT' AND (CAST(:crew_id AS text) IS NULL OR crew_id = :crew_id)
    ORDER BY created_at_onboard_ms DESC, event_id
    LIMIT :limit
    """
)

STATUS_SQL = text(
    """
    SELECT count(*) FILTER (WHERE type = 'OBSERVATIONS') AS observation_events,
           count(*) FILTER (WHERE type = 'ALERT') AS alert_events,
           max(received_at_earth_ms) AS last_received_at_ms,
           max(created_at_onboard_ms) AS newest_created_at_ms,
           (SELECT avg(received_at_earth_ms - created_at_onboard_ms) FROM
              (SELECT received_at_earth_ms, created_at_onboard_ms FROM received_events
               ORDER BY received_at_earth_ms DESC LIMIT 100) AS recent) AS average_delay_ms,
           (SELECT count(*) FROM event_conflicts) AS conflicts
    FROM received_events
    """
)


@dataclass(frozen=True)
class LatestMetric:
    crew_id: str
    metric: str
    value: float | None
    unit: str
    taken_at_ms: int


def latest_metrics(connection: Connection) -> list[LatestMetric]:
    rows = connection.execute(LATEST_METRICS_SQL).all()
    return [
        LatestMetric(row.crew_id, row.metric, row.value, row.unit or "", row.taken_at)
        for row in rows
    ]


def alert_counts(connection: Connection) -> dict[str, int]:
    rows = connection.execute(
        text(
            "SELECT crew_id, count(*) AS n FROM received_events WHERE type = 'ALERT' GROUP BY crew_id"
        )
    ).all()
    return {row.crew_id: row.n for row in rows}


def recent_alerts(connection: Connection, crew_id: str | None, limit: int) -> list[Row]:
    return connection.execute(ALERTS_SQL, {"crew_id": crew_id, "limit": limit}).all()


def status_row(connection: Connection) -> Row:
    return connection.execute(STATUS_SQL).one()
