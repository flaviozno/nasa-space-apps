"""Crew list for the Earth view, read from contracts/crew.json.

Earth needs the full roster to show crew members it has no data for as MISSING.
"""

import json
from dataclasses import dataclass
from pathlib import Path


@dataclass(frozen=True)
class RosterMember:
    crew_id: str
    name: str
    role: str


def load_roster(crew_file: Path) -> list[RosterMember]:
    """Example: `load_roster(Path("contracts/crew.json"))[0].crew_id == "crew-1"`."""
    try:
        contract = json.loads(crew_file.read_text(encoding="utf-8"))
    except FileNotFoundError as error:
        raise FileNotFoundError(
            f"crew_file={crew_file!s} not found; expected contracts/crew.json"
        ) from error
    return [
        RosterMember(crew_id=member["crewId"], name=member["name"], role=member["role"])
        for member in contract["crew"]
    ]
