"""Pydantic contract for observations (owner: Matheus).

Shared by `POST /v1/observations`, the Crew Hub input endpoints, and (later) the
real observation persistence. Payloads use camelCase so the OpenAPI schema matches
the contracts (`crewId`, `sourceRef`, ...) and the web app's TypeScript types.
"""

from enum import Enum
from typing import Annotated

from pydantic import BaseModel, ConfigDict, Field
from pydantic.alias_generators import to_camel


class CamelModel(BaseModel):
    """Base model: snake_case attributes, camelCase JSON (see crew.json naming)."""

    model_config = ConfigDict(alias_generator=to_camel, populate_by_name=True)


class ObservationSource(str, Enum):
    """Where an observation came from. Future sources are added here."""

    wearable = "wearable"
    manual = "manual"
    questionnaire = "questionnaire"


CrewId = Annotated[str, Field(pattern=r"^crew-[1-4]$", description="Crew member id: crew-1 .. crew-4")]
MetricId = Annotated[str, Field(min_length=2, max_length=64, description="Metric id from contracts/metrics.json")]
EpochMs = Annotated[int, Field(ge=0, description="Unix timestamp in milliseconds")]


class ObservationIn(CamelModel):
    """One normalized reading, whatever the source."""

    crew_id: CrewId
    metric: MetricId
    value: float | None = Field(
        default=None,
        description="Metric value in the catalog unit. null = invalid reading (never 0).",
    )
    source: ObservationSource = Field(default=ObservationSource.manual)
    source_ref: str | None = Field(
        default=None,
        max_length=128,
        description="Original identity at the source (sampleId, responseId, clientRequestId).",
    )
    taken_at: EpochMs | None = Field(
        default=None,
        description="When the value was measured. The server fills it with now() when omitted.",
    )


class ObservationBatchIn(CamelModel):
    """Request body of `POST /v1/observations`."""

    observations: Annotated[list[ObservationIn], Field(min_length=1, max_length=1000)]


class ObservationOut(CamelModel):
    """A stored observation. `unit` is resolved by the server from the catalog."""

    id: str
    crew_id: CrewId
    metric: MetricId
    value: float | None = None
    unit: str
    source: ObservationSource
    source_ref: str | None = None
    taken_at: EpochMs


class ObservationBatchOut(CamelModel):
    """Response of `POST /v1/observations`: accepted rows plus how many were duplicates."""

    accepted: Annotated[list[ObservationOut], Field(max_length=1000)]
    duplicates: int = Field(description="Rows ignored because the same (source, sourceRef, metric) already existed.")
