"""Rebuild a radiation timeline from the DosTel blocks stored with each wearable reading.

The wearable emulator attaches one historical ISS DosTel record (about 2 h recorded on
2022-04-01/02) to every reading, stepping one record per reading and starting over at
the end. Every device gets the same record for the same sequence number, and the
emulator's own clock runs from 2026-01-01. So the stored blocks are a looped recording,
repeated per device, whose emulator time says nothing about the original pace.

The route therefore:
1. reads the newest blocks of one device (they are identical across devices);
2. drops repeats, keyed by instrument + NASA timestamp;
3. orders them by their NASA timestamp, keeping the original spacing;
4. anchors the newest block at the time onboard received it, and places every other
   record at its distance from that block along the looped recording.

Example: with the newest block at 00:30 NASA time received at 15:00, the record from
00:25 is placed at 14:55 and the one from 00:40 (previous loop) about 1 h 55 min earlier.
"""

from datetime import UTC, datetime
from itertools import pairwise
from statistics import median
from typing import Any

from sqlalchemy import Connection, text

from app.environment.schemas import RadiationSampleOut, RadiationTrackOut

SOURCE = "ISS DosTel, NASA OSDR RadLab (historical records replayed by the wearable emulator)"

# Newest readings scanned for one device. The emulator cycles 180 DosTel records,
# so 720 readings (four loops) always contain every record at least once.
SCAN_LIMIT = 720

# Spacing assumed between the last and the first record of a loop when it cannot be measured.
DEFAULT_STEP_MS = 30_000


def nasa_time_ms(source_timestamp: str) -> int:
    """NASA timestamps are UTC without an offset: "2022-04-01T23:00:00" → epoch ms."""
    parsed = datetime.fromisoformat(source_timestamp)
    if parsed.tzinfo is None:
        parsed = parsed.replace(tzinfo=UTC)
    return int(parsed.timestamp() * 1000)


def load_recent_blocks(connection: Connection, crew_ids: list[str]) -> list[tuple[dict[str, Any], int]]:
    """Newest-first (radiation block, received_at_onboard_ms) pairs of the first member with data.

    Reads one device only: the index on (crew_id, acquired_at_ms) keeps this a short scan,
    and the blocks are the same for every device.
    """
    for crew_id in crew_ids:
        rows = connection.execute(
            text(
                """
                SELECT payload -> 'radiation' AS radiation, received_at_onboard_ms
                FROM wearable_samples
                WHERE crew_id = :crew_id AND payload ? 'radiation'
                ORDER BY acquired_at_ms DESC, sequence_number DESC
                LIMIT :limit
                """
            ),
            {"crew_id": crew_id, "limit": SCAN_LIMIT},
        ).fetchall()
        if rows:
            return [(row.radiation, row.received_at_onboard_ms) for row in rows]
    return []


def build_radiation_track(
    blocks: list[tuple[dict[str, Any], int]], now_ms: int, window_minutes: int
) -> RadiationTrackOut:
    """Readings of the last `window_minutes` on the rebuilt timeline, oldest first.

    `blocks` is newest first, as load_recent_blocks returns it. No blocks → no samples.
    """
    empty = RadiationTrackOut(generated_at_ms=now_ms, window_minutes=window_minutes, source=SOURCE, samples=[])
    if not blocks:
        return empty

    newest, anchor_ms = blocks[0]
    unique: dict[tuple[str, str], dict[str, Any]] = {}
    for block, _received in blocks:
        unique.setdefault((block["instrumentId"], block["sourceTimestamp"]), block)

    times = sorted({nasa_time_ms(block["sourceTimestamp"]) for block in unique.values()})
    gaps = [later - earlier for earlier, later in pairwise(times) if later > earlier]
    step_ms = int(median(gaps)) if gaps else DEFAULT_STEP_MS
    loop_ms = times[-1] - times[0] + step_ms
    window_ms = min(window_minutes * 60_000, loop_ms - 1)
    newest_ms = nasa_time_ms(newest["sourceTimestamp"])

    samples = []
    for block in unique.values():
        # Records later than the newest one in NASA time belong to the previous loop.
        age_ms = (newest_ms - nasa_time_ms(block["sourceTimestamp"])) % loop_ms
        if age_ms > window_ms:
            continue
        samples.append(
            RadiationSampleOut(
                taken_at_ms=anchor_ms - age_ms,
                source_timestamp=block["sourceTimestamp"],
                instrument_id=block["instrumentId"],
                absorbed_dose_rate_micro_gy_per_hour=block["absorbedDoseRateMicroGyPerHour"],
                latitude_degrees=block.get("latitudeDegrees"),
                longitude_degrees=block.get("longitudeDegrees"),
                altitude_kilometers=block.get("altitudeKilometers"),
                particle_flux_per_cm2_sr_second=block.get("particleFluxPerCm2SrSecond"),
            )
        )
    samples.sort(key=lambda sample: (sample.taken_at_ms, sample.instrument_id))
    return empty.model_copy(update={"samples": samples})
