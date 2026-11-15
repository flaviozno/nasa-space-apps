"""Onboard-side models for the single Vercel emulator API contract."""

from typing import Annotated, Literal

from pydantic import BaseModel, ConfigDict, Field, model_validator
from pydantic.alias_generators import to_camel

SAFE_INTEGER = 9_007_199_254_740_991
Identifier = Annotated[
    str,
    Field(min_length=1, max_length=128, pattern=r"^[A-Za-z0-9][A-Za-z0-9._:-]{0,127}$"),
]
NonNegativeSafeInteger = Annotated[int, Field(ge=0, le=SAFE_INTEGER)]


class VercelModel(BaseModel):
    model_config = ConfigDict(alias_generator=to_camel, populate_by_name=True, extra="ignore")


class DeviceCursor(VercelModel):
    device_id: Identifier
    boot_id: Identifier
    from_sequence: NonNegativeSafeInteger


class SyncRequest(VercelModel):
    version: Literal[1] = 1
    request_id: Identifier
    session_id: Identifier
    requested_at_ms: NonNegativeSafeInteger
    scenario: Literal["NORMAL", "ELEVATED_HEART_RATE", "LOW_SPO2", "NASA_EXERCISE_REPLAY"]
    devices: Annotated[list[DeviceCursor], Field(min_length=1, max_length=3)]
    max_records: Annotated[int, Field(ge=1, le=100)]
    until_acquired_at_ms: NonNegativeSafeInteger

    @model_validator(mode="after")
    def device_ids_are_unique(self) -> "SyncRequest":
        ids = [device.device_id for device in self.devices]
        if len(set(ids)) != len(ids):
            raise ValueError("deviceId values must be unique within a SyncRequest")
        return self


class SleepEvidence(VercelModel):
    source_record_id: int
    subject_code: str
    phase: str
    source_date: str
    bed_rest_day: int
    latency_minutes: float | None
    duration_minutes: float
    efficiency_percent: float | None
    note: str | None


class RadiationEvidence(VercelModel):
    source_timestamp: str
    instrument_id: Literal["DosTel1", "DosTel2"]
    absorbed_dose_rate_micro_gy_per_hour: float
    latitude_degrees: float | None
    longitude_degrees: float | None
    altitude_kilometers: float | None
    particle_flux_per_cm2_sr_second: float | None


class ExerciseEvidence(VercelModel):
    source_date: str
    subject_code: str
    phase: Literal["EXERCISE", "SIMULATED_RECOVERY"]
    elapsed_seconds: int
    from_stage: str
    to_stage: str
    from_source_heart_rate_bpm: float
    to_source_heart_rate_bpm: float
    from_source_record_id: int
    to_source_record_id: int
    from_source_file_key: Literal["SUBMAX_SUMMARY", "PEAK_SUMMARY"]
    to_source_file_key: Literal["SUBMAX_SUMMARY", "PEAK_SUMMARY"]
    simulated_workload_watts: float


class TelemetryReading(VercelModel):
    sample_id: Annotated[str, Field(pattern=r"^sample_[a-f0-9]{64}$")]
    device_id: Identifier
    boot_id: Identifier
    sequence_number: NonNegativeSafeInteger
    acquired_at_ms: NonNegativeSafeInteger
    validity_mask: Annotated[int, Field(ge=0, le=15)]
    sensor_status: Literal["VALID", "INVALID", "DEGRADED"]
    heart_rate_bpm: int | None
    heart_rate_origin: Literal[
        "SIMULATED", "NASA_ANALOG_INTERPOLATED", "NASA_ANALOG_DERIVED_RECOVERY"
    ]
    spo2_hundredths_percent: int | None
    temperature_hundredths_celsius: int | None
    battery_millivolts: int | None
    data_source: Literal["SIMULATED"]
    sleep: SleepEvidence
    radiation: RadiationEvidence
    exercise: ExerciseEvidence | None


class TelemetryBatch(VercelModel):
    version: Literal[1]
    transfer_id: Annotated[str, Field(pattern=r"^transfer_[a-f0-9]{64}$")]
    request_id: Identifier
    session_id: Identifier
    generated_at_ms: NonNegativeSafeInteger
    has_more: bool
    readings: Annotated[list[TelemetryReading], Field(max_length=100)]


class ReceiptAck(VercelModel):
    version: Literal[1] = 1
    transfer_id: Annotated[str, Field(pattern=r"^transfer_[a-f0-9]{64}$")]
    request_id: Identifier
    received_at_ms: NonNegativeSafeInteger
    accepted_sample_ids: Annotated[
        list[Annotated[str, Field(pattern=r"^sample_[a-f0-9]{64}$")]], Field(max_length=100)
    ]
