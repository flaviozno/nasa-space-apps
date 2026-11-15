"""Station radiation route: timeline rebuilt from the DosTel blocks of the wearable readings.

Pure tests of the timeline plus a route test with the database read stubbed out, so
they run without onboard-db and never touch stored data.

    uv run pytest tests/test_environment_radiation.py -v
"""

from collections.abc import Iterator

import pytest
from app.config import OnboardSettings
from app.environment import router as environment_router
from app.environment.radiation import build_radiation_track, nasa_time_ms
from app.main import create_app
from fastapi.testclient import TestClient
from hub_common.dependencies import get_connection

UNREACHABLE_DB = "postgresql+psycopg://user:pw@nowhere.invalid:5432/onboard"
NOW = 1_794_756_000_000
MINUTE = 60_000


def block(source_timestamp: str, rate: float, instrument: str = "DosTel1", latitude: float | None = 10.0) -> dict:
    """A radiation block as the emulator sends it (camelCase, NASA time without offset)."""
    return {
        "sourceTimestamp": source_timestamp,
        "instrumentId": instrument,
        "absorbedDoseRateMicroGyPerHour": rate,
        "latitudeDegrees": latitude,
        "longitudeDegrees": 20.0,
        "altitudeKilometers": 420.0,
        "particleFluxPerCm2SrSecond": 0.5,
    }


# A 4-record recording, one record per 10 min: 23:00, 23:10, 23:20, 23:30 (loop = 40 min).
RECORDING = [block(f"2022-04-01T23:{m:02d}:00", rate) for m, rate in ((0, 2.0), (10, 4.0), (20, 6.0), (30, 8.0))]


def test_nasa_time_reads_naive_timestamps_as_utc() -> None:
    assert nasa_time_ms("2022-04-01T23:00:00") == nasa_time_ms("2022-04-01T23:00:00Z") == 1_648_854_000_000


def test_no_blocks_means_no_samples() -> None:
    track = build_radiation_track([], NOW, 120)
    assert track.samples == []
    assert track.generated_at_ms == NOW
    assert "DosTel" in track.source


def test_repeats_from_every_device_and_loop_are_dropped() -> None:
    newest_first = list(reversed(RECORDING)) * 8  # four devices, two loops each
    track = build_radiation_track([(b, NOW) for b in newest_first], NOW, 120)
    assert [s.source_timestamp for s in track.samples] == [b["sourceTimestamp"] for b in RECORDING]


def test_newest_record_is_anchored_at_reception_with_nasa_spacing() -> None:
    received = NOW - 30_000
    newest_first = [(b, received) for b in reversed(RECORDING)]
    samples = build_radiation_track(newest_first, NOW, 120).samples
    assert samples[-1].source_timestamp == "2022-04-01T23:30:00"
    assert samples[-1].taken_at_ms == received
    assert [received - s.taken_at_ms for s in samples] == [30 * MINUTE, 20 * MINUTE, 10 * MINUTE, 0]


def test_records_after_the_newest_one_come_from_the_previous_loop() -> None:
    # The emulator is at 23:10 now; 23:20 and 23:30 were sent before it started over.
    newest_first = [(RECORDING[1], NOW), (RECORDING[0], NOW), (RECORDING[3], NOW), (RECORDING[2], NOW)]
    samples = build_radiation_track(newest_first, NOW, 120).samples
    assert [s.source_timestamp[11:16] for s in samples] == ["23:20", "23:30", "23:00", "23:10"]
    assert [NOW - s.taken_at_ms for s in samples] == [30 * MINUTE, 20 * MINUTE, 10 * MINUTE, 0]


def test_window_keeps_only_recent_records() -> None:
    newest_first = [(b, NOW) for b in reversed(RECORDING)]
    samples = build_radiation_track(newest_first, NOW, 15).samples
    assert [s.source_timestamp[11:16] for s in samples] == ["23:20", "23:30"]


def test_values_and_names_pass_through_unchanged() -> None:
    reading = block("2022-04-01T23:00:00", 12.616413, instrument="DosTel2", latitude=None)
    [sample] = build_radiation_track([(reading, NOW)], NOW, 120).samples
    assert sample.instrument_id == "DosTel2"
    assert sample.absorbed_dose_rate_micro_gy_per_hour == 12.616413
    assert sample.latitude_degrees is None


@pytest.fixture()
def client(monkeypatch: pytest.MonkeyPatch) -> Iterator[TestClient]:
    """The app with the database read stubbed: returns RECORDING for crew-1 only."""
    calls: list[list[str]] = []

    def fake_load(_connection: object, crew_ids: list[str]) -> list[tuple[dict, int]]:
        calls.append(crew_ids)
        return [(b, NOW) for b in reversed(RECORDING)]

    monkeypatch.setattr(environment_router, "load_recent_blocks", fake_load)
    app = create_app(OnboardSettings(database_url=UNREACHABLE_DB, sync_worker_enabled=False, ingest_worker_enabled=False))
    app.dependency_overrides[get_connection] = lambda: iter([None])
    with TestClient(app) as test_client:
        test_client.calls = calls  # type: ignore[attr-defined]
        yield test_client


def test_route_returns_the_track_in_camel_case(client: TestClient) -> None:
    response = client.get("/v1/environment/radiation", params={"windowMinutes": 120})
    assert response.status_code == 200
    body = response.json()
    assert body["windowMinutes"] == 120
    assert len(body["samples"]) == 4
    assert set(body["samples"][0]) == {
        "takenAtMs",
        "sourceTimestamp",
        "instrumentId",
        "absorbedDoseRateMicroGyPerHour",
        "latitudeDegrees",
        "longitudeDegrees",
        "altitudeKilometers",
        "particleFluxPerCm2SrSecond",
    }
    assert client.calls == [["crew-1", "crew-2", "crew-3", "crew-4"]]  # type: ignore[attr-defined]


def test_route_rejects_a_window_out_of_range(client: TestClient) -> None:
    assert client.get("/v1/environment/radiation", params={"windowMinutes": 0}).status_code == 422
    assert client.get("/v1/environment/radiation", params={"windowMinutes": 1441}).status_code == 422
