# Product Insights — Astronaut Health Hub

> Product framing for the NASA Space Apps Challenge MVP. This document describes
> the implemented scope and its limits; it does not claim clinical validation,
> flight qualification, diagnosis, or treatment capability.

## 1. Product thesis

Long-duration missions expose crews to radiation, altered gravity, isolation
and confinement, distance from Earth, and hostile or closed environments.
Those hazards can interact, while medical support and communications may be
delayed. The product must therefore help an astronaut understand a change and
take a bounded operational next step **onboard**, before Earth receives a copy.

**Astronaut Health Hub** is an offline-capable health telemetry demonstrator
for a fictional crew. It brings together simulated wearable measurements,
self-reported check-ins, manual measurements, personal baselines, explainable
local rules, and eventual synchronization with Earth.

The central product question is:

> What does this astronaut need to do next, based on current local evidence,
> without waiting for a connection to Earth?

NASA groups the relevant mission conditions into five human-spaceflight
hazards: radiation, isolation and confinement, distance from Earth, gravity
fields, and hostile/closed environments.

- NASA Human Research Program, [Five Hazards of Human Spaceflight](https://www.nasa.gov/hrp/hazards/)
- NASA Human Research Program, [Risks of Human Spaceflight](https://www.nasa.gov/hrp/risks/)

## 2. The MVP loop: collect → assess → act → synchronize

```text
Wearable / self-report / manual input
                ↓
       Onboard observations store
                ↓
  Personal baseline + freshness + rules
                ↓
  Local action plan for the astronaut
                ↓
 Durable outbox → Earth copy when the link is available
```

The onboard service is the operational source of truth. Earth is intentionally
a delayed, idempotent copy for the flight-surgeon view; loss of the Earth link
does not stop local collection, assessment, or action guidance.

## 3. What the MVP implements

### 3.1 Collect

All inputs are normalized as an `observation`: crew member, metric, value,
unit, source, source reference, and collection time.

| Input path | Current MVP coverage |
| --- | --- |
| Wearable emulator | Heart rate, SpO₂, body temperature, device battery, and a radiation-context channel |
| Manual input | Body mass, blood pressure, water intake, and grip strength |
| Daily check-in | Mood, stress, fatigue, sleepiness, and six symptom scores |
| Weekly questionnaires | PHQ-4 total and team-climate score |

`null` represents an invalid measurement, never a zero. The summary also
distinguishes `OK`, `DEVIATION`, `STALE`, `INVALID`, and `NO_DATA` so missing
or old data cannot look normal.

### 3.2 Assess

The service compares an observation with the astronaut's fixed pre-flight
baseline using an explainable z-score. Charts show current readings, trends,
age, and baseline deviation. A local Mission Readiness rule combines only
three explicit signals:

1. heart-rate deviation from the astronaut's own baseline;
2. a fresh fatigue self-report; and
3. historical ISS DosTel radiation context.

The result is `READY`, `MONITOR`, or `REVIEW_BEFORE_CRITICAL_TASK`. Missing
evidence produces `MONITOR`, not a reassuring conclusion.

### 3.3 Act

The Crew Hub starts with **What to do now**, a local action plan computed from
the current readiness decision and measurement quality. It is operational
decision support, not clinical triage.

| State | Onboard guidance |
| --- | --- |
| `ACT_NOW` | Pause a critical task, confirm the measurement, record symptoms/fatigue, and use the approved onboard procedure |
| `RECHECK` | Restore or verify a usable measurement, complete the health check-in, and monitor for meaningful change |
| `ROUTINE` | Continue the planned routine and record a change when it appears |

The plan remains available with no Earth link and never tells the astronaut to
wait for ground authorization before following an approved onboard procedure.

### 3.4 Synchronize

Every persisted observation and operational recommendation is added to a
durable outbox in the same transaction. When the link is off, local work
continues and events queue; when it returns, the worker drains the queue.
Earth accepts events idempotently, so a retry cannot create a second copy.

The Earth view makes the delay visible: link state, queued events, last receipt
time, delivered alerts, and data freshness.

## 4. NASA-data provenance in this demonstration

The MVP uses synthetic and historical demonstration data. Source provenance is
kept distinct from the fictional mission timeline.

| Source | MVP use | What it does **not** mean |
| --- | --- | --- |
| NASA Life Sciences Data Archive / NLSP actigraphy | Sleep reference in the emulator | A current astronaut sleep measurement |
| NASA exercise-study checkpoints | Exercise heart-rate replay scenario | Continuous real flight telemetry |
| NASA OSDR RadLab / ISS DosTel | Historical environmental dose-rate context | A crew member's individual dose or exposure estimate |
| NASA HRP hazards and risks | Product rationale and metric selection | A clinically validated alert threshold |

The radiation reference is displayed with its source and disclaimer. It is not
stored as a crew-health observation and must not be presented as a personal
radiation dose. The Canadian Space Agency's radiation-monitoring material is
useful context for a future crew-worn dosimeter, not proof that this MVP has
one. [CSA: Monitoring Radiation for Astronaut Health](https://www.asc-csa.gc.ca/eng/news/articles/2026/2026-02-26-monitoring-radiation-astronaut-health.asp)

## 5. Demonstration story

The 30-second demo should show one complete, inspectable path rather than a
tour of every screen:

1. An astronaut opens the Crew Hub and sees personal baseline context.
2. A simulated signal and current fatigue check-in produce a local readiness
   review.
3. **What to do now** shows the immediate, non-clinical next steps.
4. The Earth link is cut; the onboard action still works and events queue.
5. The link returns; Earth receives the same evidence once, with delivery
   delay visible.

**Pitch statement:**

> Astronaut Health Hub turns local health signals and mission context into an
> explainable next operational step, even when Earth is unavailable.

## 6. Scope boundaries and known gaps

The following boundaries are intentional for the hackathon MVP:

- No diagnosis, prescription, treatment recommendation, or clinically
  validated threshold.
- No personal radiation-dose calculation; DosTel is historical environmental
  context only.
- No physical BLE device, real flight telemetry, or clinical hardware
  integration; the wearable is an authenticated emulator.
- No user authentication or production-grade medical-data governance; crew
  selection is deliberately local/demo-only.
- The emulator currently emits heart rate, SpO₂, and body temperature. Other
  catalog metrics are self-reported or manually entered in this MVP.
- The z-score rule is an experimental, explainable demo rule. It should not be
  described as detecting fever, hypoxia, or another medical condition.

Two implementation gaps should be described honestly and are the best next
engineering steps:

1. The Crew API's alert-list endpoint still uses a deterministic fixture for
   the Crew Hub. Before claiming that a live ingest alert appears in that view,
   replace the fixture with a query over the persisted `alerts` table and add
   an end-to-end test.
2. The action plan gives guidance but does not yet persist acknowledgement,
   execution, or closure. A future version can record those states locally and
   synchronize them to Earth without turning the system into a diagnostic tool.

## 7. Why this is sufficient for the challenge MVP

The challenge asks for software that gathers health indicators and enables
astronauts to evaluate and act on their health status. The implemented MVP
demonstrates that core loop with personal context, clear data quality states,
bounded local actions, and delayed ground synchronization.

The next priority is not adding more dashboards or unvalidated medical rules;
it is closing the live-alert read path and making the evidence/data provenance
easy for an evaluator to inspect.
