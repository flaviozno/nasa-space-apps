"""PostgreSQL persistence for observations (owner: Matheus).

Schema reference (created by migration 089bc82e7798):

    observations(id TEXT PK, crew_id TEXT, metric TEXT, value DOUBLE NULL, unit TEXT,
                 source TEXT, source_ref TEXT NULL, taken_at BIGINT, created_at BIGINT)
    UNIQUE (source, source_ref, metric)
    INDEX  ix_observations_crew_metric_taken (crew_id, metric, taken_at)

Notes:
- Rows arrive as plain dicts and come back as SQLAlchemy Rows (dict-like access works).
- Idempotency keys on (source, source_ref, metric). A NULL source_ref never conflicts,
  so rows without a source identity are always inserted (that is the intended behavior).
- One transactional connection per request is provided by DatabaseConnection; these
  functions must not commit or roll back, only execute.
"""

from sqlalchemy import text
from sqlalchemy.engine import Connection

INSERT_SQL = """
INSERT INTO observations (id, crew_id, metric, value, unit, source, source_ref, taken_at, created_at)
VALUES (:id, :crew_id, :metric, :value, :unit, :source, :source_ref, :taken_at, :created_at)
ON CONFLICT (source, source_ref, metric) DO NOTHING
RETURNING id
"""


def insert_observations(connection: Connection, observations: list[dict]) -> tuple[list[dict], int]:
    """Insert rows, skipping identities that already exist.

    Returns (inserted_rows, duplicates): the rows that actually persisted, in
    input order, plus how many were skipped. RETURNING gives back the id only
    when the row was inserted; a conflict returns no row, which is how you tell
    one from the other. Rows with NULL source_ref always insert (no identity to
    conflict on).
    """
    inserted_rows: list[dict] = []
    duplicates = 0
    for row in observations:
        result = connection.execute(text(INSERT_SQL), row)
        if result.first() is None:
            duplicates += 1
        else:
            inserted_rows.append(row)
    return inserted_rows, duplicates


def query_observations(
    connection: Connection,
    crew_id: str | None,
    *,
    metric: str | None = None,
    source: str | None = None,
    from_ms: int | None = None,
    to_ms: int | None = None,
    limit: int = 100,
    offset: int = 0,
) -> list:
    """Filtered observation history, oldest first (then by id as a tie-break).

    crew_id is optional: None lists every crew member. The WHERE clause is built
    from the filters that are not None; values are always bound parameters,
    never interpolated into the SQL string. The time window is inclusive on
    both ends.
    """
    conditions: list[str] = []
    params: dict[str, object] = {"limit": limit, "offset": offset}
    if crew_id is not None:
        conditions.append("crew_id = :crew_id")
        params["crew_id"] = crew_id
    if metric is not None:
        conditions.append("metric = :metric")
        params["metric"] = metric
    if source is not None:
        conditions.append("source = :source")
        params["source"] = source
    if from_ms is not None:
        conditions.append("taken_at >= :from_ms")
        params["from_ms"] = from_ms
    if to_ms is not None:
        conditions.append("taken_at <= :to_ms")
        params["to_ms"] = to_ms
    sql = text(
        f"SELECT * FROM observations WHERE {' AND '.join(conditions)} "
        "ORDER BY taken_at ASC, id ASC LIMIT :limit OFFSET :offset"
    )
    return connection.execute(sql, params).mappings().fetchall()


def latest_per_metric(connection: Connection, crew_id: str) -> dict:
    """The newest row of each metric for one crew member, keyed by metric id.

    DISTINCT ON (metric) keeps the first row of each metric group, so the ORDER BY
    starts with metric and then puts the newest first. A metric missing from the
    result means no data — the summary renders that as NO_DATA, never zero.
    """
    rows = connection.execute(
        text(
            "SELECT DISTINCT ON (metric) * FROM observations "
            "WHERE crew_id = :crew_id "
            "ORDER BY metric, taken_at DESC, id DESC"
        ),
        {"crew_id": crew_id},
    ).mappings().fetchall()
    return {row["metric"]: row for row in rows}


def range_observations(
    connection: Connection,
    crew_id: str,
    metric: str,
    *,
    from_ms: int,
    to_ms: int,
    limit: int = 1000,
) -> list:
    """All rows of one metric inside an inclusive time window, oldest first.

    Downsampling to the chart's max_points happens in the service layer, not here.
    """
    return connection.execute(
        text(
            "SELECT * FROM observations "
            "WHERE crew_id = :crew_id AND metric = :metric "
            "AND taken_at BETWEEN :from_ms AND :to_ms "
            "ORDER BY taken_at ASC, id ASC LIMIT :limit"
        ),
        {"crew_id": crew_id, "metric": metric, "from_ms": from_ms, "to_ms": to_ms, "limit": limit},
    ).mappings().fetchall()
