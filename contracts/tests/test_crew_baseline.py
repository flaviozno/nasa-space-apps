"""Consistency checks for contracts/crew.json (Phase 0.2 — fixed crew baselines).

Run from the app/ folder:
    python3 -m unittest discover -s contracts/tests
"""

import json
import math
import re
import unittest
from pathlib import Path

CREW_FILE = Path(__file__).resolve().parents[1] / "crew.json"
ALERT_Z = 3.0
ALLOWED_SOURCES = {"wearable", "manual", "questionnaire"}
# Same identifier rule the emulator applies to deviceId (emu/src/domain/validation.ts).
EMULATOR_ID_PATTERN = re.compile(r"^[A-Za-z0-9][A-Za-z0-9._:-]{0,127}$")
# Value ranges produced by the emulator (emu/src/domain/deterministic-generator.ts),
# converted from hundredths to the observation units used in crew.json.
EMULATOR_RANGES = {
    "NORMAL": {"heart_rate": (60, 95), "spo2": (96.0, 100.0), "body_temp": (36.0, 37.5)},
    "ELEVATED_HEART_RATE": {"heart_rate": (130, 180)},
    "LOW_SPO2": {"spo2": (85.0, 92.0)},
}


def load_crew_contract() -> dict[str, object]:
    """Read crew.json. Example: load_crew_contract()["crew"][0]["crewId"] == "crew-1"."""
    with CREW_FILE.open(encoding="utf-8") as handle:
        return json.load(handle)


def z_score(value: float, baseline: dict[str, float]) -> float:
    """Deviation from a baseline in spreads. Example: z_score(96, {"median": 76, "spread": 10}) == 2.0."""
    return (value - baseline["median"]) / baseline["spread"]


class CrewStructureTest(unittest.TestCase):
    def setUp(self) -> None:
        self.contract = load_crew_contract()
        self.crew = self.contract["crew"]
        self.metrics = self.contract["metrics"]

    def test_has_four_crew_members_with_unique_ids(self) -> None:
        self.assertEqual(len(self.crew), 4)
        self.assertEqual(len({member["crewId"] for member in self.crew}), 4)
        self.assertEqual(len({member["deviceId"] for member in self.crew}), 4)

    def test_device_ids_are_accepted_by_the_emulator(self) -> None:
        for member in self.crew:
            self.assertRegex(member["deviceId"], EMULATOR_ID_PATTERN)

    def test_every_metric_has_a_known_source(self) -> None:
        for metric_id, metric in self.metrics.items():
            self.assertIn(metric["source"], ALLOWED_SOURCES, f"metric={metric_id}")

    def test_every_member_has_a_baseline_for_every_metric(self) -> None:
        for member in self.crew:
            self.assertEqual(
                set(member["baselines"]), set(self.metrics), f"crewId={member['crewId']}"
            )


class BaselineValuesTest(unittest.TestCase):
    def setUp(self) -> None:
        contract = load_crew_contract()
        self.metrics = contract["metrics"]
        self.pairs = [
            (member["crewId"], metric_id, baseline)
            for member in contract["crew"]
            for metric_id, baseline in member["baselines"].items()
        ]

    def test_spread_is_positive_and_finite(self) -> None:
        for crew_id, metric_id, baseline in self.pairs:
            spread = baseline["spread"]
            self.assertTrue(
                math.isfinite(spread) and spread > 0, f"{crew_id}/{metric_id}: spread={spread}"
            )

    def test_median_is_inside_the_metric_scale(self) -> None:
        for crew_id, metric_id, baseline in self.pairs:
            scale = self.metrics[metric_id].get("scale")
            if scale is None:
                continue
            low, high = scale
            self.assertTrue(
                low <= baseline["median"] <= high,
                f"{crew_id}/{metric_id}: median={baseline['median']}, scale={scale}",
            )


class EmulatorCalibrationTest(unittest.TestCase):
    """Baselines must keep NORMAL quiet and make the anomaly scenarios alert."""

    def setUp(self) -> None:
        self.crew = load_crew_contract()["crew"]

    def z_bounds(self, scenario: str) -> list[tuple[str, float, float]]:
        """(label, smallest |z|, largest |z|) of each emulator range against each member's baseline."""
        bounds = []
        for member in self.crew:
            for metric_id, (low, high) in EMULATOR_RANGES[scenario].items():
                baseline = member["baselines"][metric_id]
                z_low, z_high = z_score(low, baseline), z_score(high, baseline)
                # A range that straddles the median reaches |z| = 0.
                smallest = 0.0 if z_low <= 0 <= z_high else min(abs(z_low), abs(z_high))
                bounds.append(
                    (
                        f"{scenario} {member['crewId']}/{metric_id}",
                        smallest,
                        max(abs(z_low), abs(z_high)),
                    )
                )
        return bounds

    def test_normal_scenario_stays_below_alert_threshold(self) -> None:
        for label, _, largest in self.z_bounds("NORMAL"):
            self.assertLess(largest, ALERT_Z, f"{label}: max |z|={largest:.2f}")

    def test_anomaly_scenarios_cross_alert_threshold(self) -> None:
        for scenario in ("ELEVATED_HEART_RATE", "LOW_SPO2"):
            for label, smallest, _ in self.z_bounds(scenario):
                self.assertGreaterEqual(smallest, ALERT_Z, f"{label}: min |z|={smallest:.2f}")


if __name__ == "__main__":
    unittest.main()
