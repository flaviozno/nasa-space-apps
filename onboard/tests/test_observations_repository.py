"""Behavior tests for the observations repository (integration, needs onboard-db).

These tests define the contract Matheus implements in
app/observations/repository.py. Run them with the database up:

    uv run pytest tests/test_observations_repository.py -v
"""

from app.observations.repository import (
    insert_observations,
    latest_per_metric,
    query_observations,
    range_observations,
)
from sqlalchemy.engine import Engine

BASE = 1_700_000_000_000  # fixed epoch ms so time filters are deterministic


def make_obs(index: int, **overrides: object) -> dict:
    """One complete observation row ready for the repository.

    Example: make_obs(0) has crew_id='crew-1', metric='heart_rate',
    taken_at=BASE, and a stable id.
    """
    row = {
        "id": f"obs-{index:04d}",
        "crew_id": "crew-1",
        "metric": "heart_rate",
        "value": 76.0 + index,
        "unit": "bpm",
        "source": "wearable",
        "source_ref": f"emu-crew-1-{index:04d}",
        "taken_at": BASE + index * 1_000,
        "created_at": BASE,
    }
    row.update(overrides)
    return row


def test_insert_counts_inserted_and_duplicates(clean_tables: Engine) -> None:
    with clean_tables.begin() as connection:
        inserted, duplicates = insert_observations(connection, [make_obs(i) for i in range(3)])
        assert (inserted, duplicates) == (3, 0)

        # Same identity (source, source_ref, metric): skipped, not re-inserted.
        repeated = [make_obs(i) for i in range(3)]
        fresh = [make_obs(3, metric="spo2", unit="%")]
        inserted, duplicates = insert_observations(connection, repeated + fresh)
        assert (inserted, duplicates) == (1, 3)


def test_query_applies_filters_and_oldest_first_order(clean_tables: Engine) -> None:
    rows = [
        make_obs(0),
        make_obs(1, metric="spo2", unit="%"),
        make_obs(2, metric="body_temp", unit="°C", source="manual", source_ref="manual-1"),
        make_obs(3, taken_at=BASE + 60_000),
    ]
    with clean_tables.begin() as connection:
        insert_observations(connection, rows)

        everything = query_observations(connection, "crew-1")
        assert [row["id"] for row in everything] == ["obs-0000", "obs-0001", "obs-0002", "obs-0003"]

        by_metric = query_observations(connection, "crew-1", metric="heart_rate")
        assert [row["id"] for row in by_metric] == ["obs-0000", "obs-0003"]

        by_source = query_observations(connection, "crew-1", source="manual")
        assert [row["id"] for row in by_source] == ["obs-0002"]

        by_window = query_observations(connection, "crew-1", from_ms=BASE + 500, to_ms=BASE + 61_000)
        assert [row["id"] for row in by_window] == ["obs-0001", "obs-0002", "obs-0003"]

        limited = query_observations(connection, "crew-1", limit=2, offset=1)
        assert [row["id"] for row in limited] == ["obs-0001", "obs-0002"]


def test_latest_per_metric_returns_the_newest_row(clean_tables: Engine) -> None:
    rows = [make_obs(0), make_obs(1), make_obs(2, metric="spo2", unit="%")]
    with clean_tables.begin() as connection:
        insert_observations(connection, rows)
        latest = latest_per_metric(connection, "crew-1")

    assert latest["heart_rate"]["id"] == "obs-0001"
    assert latest["heart_rate"]["value"] == 77.0
    assert latest["spo2"]["id"] == "obs-0002"


def test_null_value_round_trips_as_none(clean_tables: Engine) -> None:
    with clean_tables.begin() as connection:
        insert_observations(connection, [make_obs(0, value=None, source_ref="emu-invalid")])
        rows = query_observations(connection, "crew-1", metric="heart_rate")

    assert rows[0]["value"] is None


def test_range_returns_only_the_window(clean_tables: Engine) -> None:
    rows = [make_obs(i) for i in range(5)]  # taken_at BASE+0s .. BASE+4s
    with clean_tables.begin() as connection:
        insert_observations(connection, rows)
        points = range_observations(connection, "crew-1", "heart_rate", from_ms=BASE + 1_000, to_ms=BASE + 3_000)

    assert [point["taken_at"] for point in points] == [BASE + 1_000, BASE + 2_000, BASE + 3_000]
    assert points[0]["value"] == 77.0
