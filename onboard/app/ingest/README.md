# Onboard ingest

The ingest is the wearable data path on the onboard side. Its job is to pull
telemetry from the emulator, persist it, run alert rules locally, and feed the
Outbox to Earth. Alerts run on the onboard side so they work even when the
Earth link is down (readme.md §8).

A full cycle, when all stages are in place:

```
┌──────────────────────┐  SyncRequest   ┌─────────────────────┐
│ onboard/app/ingest/  │ ─────────────▶ │  Vercel emulator    │
│ (this module)        │ ◀───────────── │  (emu/)             │
│                      │  TelemetryBatch
│  ├─ client           │
│  ├─ validate         │                 ┌─ samples
│  ├─ convert          │                 │  observations  (Matheus)
│  ├─ rules (A1 ✔)    │ ──────────────▶ ├─ alerts
│  └─ cycle            │                 │  outbox        (Guilherme)
│                      │                 └─ cursor
└──────────────────────┘
```

## Stage status

| Stage | File | Status |
|---|---|---|
| A1 Rules engine | `rules.py` | **Done.** Explained in detail below |
| M-1 Migration | `onboard/migrations/versions/ingest/` | Planned |
| M-2 Status endpoint | `router.py` / `schemas.py` | Planned |
| M-3 Repository | `repository.py` | Planned |
| B-1 Emulator client | `client.py` | Planned |
| B-2 Batch validation | `validate.py` | Planned |
| B-3 Sample → observation | `convert.py` | Planned |
| C-1 Cycle orchestrator | `cycle.py` | Planned |
| C-2 Background scheduler | `scheduler.py` | Planned |

Full roadmap in `Claude outputs/miguel-plano-de-trabalho.md`.

---

## `rules.py` — alert rule engine

Pure Python module. No HTTP, no database, no FastAPI. The ingest cycle calls
it for every converted observation and persists the returned alerts in the
`alerts` table. Rules are **versioned** so an alert can later be
re-interpreted with the exact rule set that produced it (readme.md §8).

### Shapes

```
Observation  ──┐
Baseline     ──┼──▶  evaluate(…)  ──▶  list[RuleAlert]
Rule         ──┘
```

**`Observation`** — one reading already in the catalog unit.

| Field | Meaning |
|---|---|
| `crew_id` | `crew-1` … `crew-4` |
| `metric` | id from `contracts/metrics.json` |
| `value` | number, or `None` for invalid / out of scale |
| `taken_at_ms` | epoch ms, from the emulator's simulated time |
| `sample_id` | source identity, goes to `alerts.sample_id` |

**`Baseline`** — pre-flight reference from `contracts/crew.json`.

| Field | Meaning |
|---|---|
| `median` | pre-flight median |
| `spread` | robust standard deviation (1.4826 × MAD) |

**`Rule`** — union of two shapes.

| Shape | Fires when | Common fields |
|---|---|---|
| `AbsoluteRule` | `value OP threshold` where `OP` is `lt`, `le`, `gt`, `ge` | `id`, `version`, `metric`, `message_template` |
| `ZScoreRule` | `|z| >= threshold`, with `z = (value − median) / spread` | `id`, `version`, `metric`, `message_template` |

**`RuleAlert`** — what comes out when a rule fires. Mirrors the columns of
the `alerts` table and the fields of `common.sync_contract.AlertPayload`.

| Field | Used by |
|---|---|
| `crew_id`, `sample_id`, `rule_id`, `rule_version`, `metric`, `value`, `z_score`, `message`, `created_at_ms` | `alerts` table, Outbox envelope, ALERT payload |

### `evaluate` function

```
evaluate(observation, rules, baselines, now_ms) → list[RuleAlert]
```

Guards baked in:

- `value is None` → returns `[]` (invalid readings produce no alerts).
- Rule's `metric` differs from the observation → the rule is skipped.
- Missing baseline for a z-score rule → the rule is skipped (no crash).
- `spread <= 0` → the z-score rule is skipped (no division by zero).

### Default rule set

The default set contains **only z-score rules**, one per wearable metric, all
sharing `rule_id = "single_reading_zscore"` and `rule_version = "1"`.

Threshold: `|z| ≥ 3` (constant `SINGLE_READING_ZSCORE_THRESHOLD`, matching
`ALERT_Z` in `contracts/tests/test_crew_baseline.py`).

```python
default_rules(("heart_rate", "spo2", "body_temp"))
# → three ZScoreRule instances, all with threshold 3.0
```

#### Why no absolute rule in the default set

1. `readme.md §11` puts "medically validated alert thresholds" out of scope.
   Any hard-coded number would be experimental by definition and without
   lineage inside the repository.
2. The emulator's `LOW_SPO2` range (85–92 %) and `ELEVATED_HEART_RATE`
   (130–180 bpm) already trigger the z-score rule with `|z| ≥ 5` by
   calibration (`contracts/README.md`). An absolute rule would duplicate
   the alert on the same sample.
3. `web/src/lib/alert-text.ts` builds every alert's wording from `metric`,
   `value` and `zScore`. Alerts without a `zScore` (the absolute case) lose
   the direction (`"Low SpO₂"`) and the baseline deviation (`"11.8σ below
   your baseline"`). The UI is tuned for z-score alerts.
4. There is no `FEVER` scenario in the emulator yet, so a body-temp absolute
   rule would be dead code.

The `AbsoluteRule` shape stays in the module so a clinically-validated
threshold can plug in later by appending it to `default_rules`.

### Calibration proof (encoded in the tests)

`tests/test_ingest_rules.py` pins the expected behavior against the crew-1
baselines for every emulator scenario:

| Scenario | Emulator range | Expected |
|---|---|---|
| `NORMAL` | HR 60–95; SpO₂ 96–100 %; temp 36.0–37.5 °C | No alert, every extreme |
| `ELEVATED_HEART_RATE` | HR 130–180 | Z-score alert, `z` ≫ 3 |
| `LOW_SPO2` | SpO₂ 85–92 % | Z-score alert, `z` ≪ −3 |

### How the ingest cycle will use this (planned, C-1)

```python
from app.ingest.rules import Baseline, Observation, default_rules, evaluate
from app.observations.catalog import load_catalog

rules = default_rules(("heart_rate", "spo2", "body_temp"))
baselines_by_crew = _load_baselines(settings.crew_file)  # crew_id → metric → Baseline

for sample in batch.readings:
    observation = convert(sample, catalog)                 # B-3
    alerts = evaluate(
        observation,
        rules,
        baselines_by_crew[observation.crew_id],
        now_ms,
    )
    # persist samples, observations, alerts, outbox events in one transaction
    # (M-3 repository + app.sync.events.enqueue_event for ALERT and OBSERVATIONS)
```

### Not handled here

- Rules on **manual and questionnaire** observations (readme.md §8 says the
  z-score rule applies to them too). The ingest only sees wearable data; the
  Crew API can import `evaluate` and run the same rules when a manual entry
  is submitted.
- **Multi-reading rules** (trends, moving averages). Out of scope for the MVP.
