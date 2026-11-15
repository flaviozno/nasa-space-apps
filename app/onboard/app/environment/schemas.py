"""Response contract of the station radiation route.

Field names mirror the emulator's RadiationEvidence (app/ingest/contracts.py), so the
web app reads the same names the wearable sends. Matches web/src/lib/radiation-contract.ts.
"""

from typing import Annotated

from pydantic import Field

from app.observations.schemas import CamelModel, EpochMs


class RadiationSampleOut(CamelModel):
    """One ISS DosTel reading. Environmental, not a crew member's personal dose."""

    taken_at_ms: EpochMs = Field(description="Onboard time of the reading on the rebuilt timeline.")
    source_timestamp: str = Field(description="Original NASA timestamp of the record (UTC).")
    instrument_id: str = Field(description="DosTel1 or DosTel2, the instrument's two detectors.")
    absorbed_dose_rate_micro_gy_per_hour: float
    latitude_degrees: float | None
    longitude_degrees: float | None
    altitude_kilometers: float | None
    particle_flux_per_cm2_sr_second: float | None


class RadiationTrackOut(CamelModel):
    """Readings of the last `window_minutes`, oldest first."""

    generated_at_ms: EpochMs
    window_minutes: int
    source: str = Field(description="Where the readings come from, shown to the user.")
    samples: Annotated[list[RadiationSampleOut], Field(max_length=2000)]
