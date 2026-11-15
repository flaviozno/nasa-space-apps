# Product Insights — Monitoring in Senior Living Facilities

> A hypothesis for applying the health telemetry architecture to everyday care. This document explores a product opportunity; it does not replace the current technical scope or represent a validated clinical solution.

## 1. Core idea

Use data collection, local processing, and synchronization to help a care team organize follow-ups for people living in a senior care facility.

The proposal turns a reading or observation into an understandable follow-up item, assigns it to a responsible professional, and tracks it until closure.

**Question the product should answer:**

> Who has a pending follow-up, what information created it, and who is responsible for the case?

## 2. Problem to investigate

Our hypothesis is that some follow-up information is spread across manual records, devices, conversations, and shift handovers. This may make it difficult to know whether an observation has already been checked or still requires action.

Before developing for real use, we need to confirm how each institution works today. We do not assume it lacks an electronic record, management system, or its own protocols.

| Situation to investigate | Possible product contribution |
| --- | --- |
| A reading is recorded without an explicit follow-up | Create a follow-up item linked to that record |
| Uncertainty about who will perform the check | Allow a professional to take ownership of the case |
| Shift handover with fragmented information | Show pending items, owners, and recent observations |
| A sensor stops sending data | Separate a collection failure from a change in the person's condition |
| Internet is unavailable | Keep records locally and synchronize later |

These are interview and pilot hypotheses, not problems already proven in this market.

## 3. Audience and expected benefit

**Initial users:** authorized care-team professionals and facility coordinators.

**Potential buyer:** the institution operating the senior living facility.

**Expected benefit:** organize follow-up work and reduce uncertainty about pending tasks and responsibilities.

Family access is not part of the first version. Its usefulness, permissions, and impact on the team's work must be evaluated separately.

## 4. Everyday usage example

1. A monitored person has a reading received from an integrated device or entered manually.
2. The system validates the source, timestamp, and data quality.
3. A rule previously configured by the team creates a follow-up item.
4. The screen shows the reason, the reading used, and the age of the data.
5. A professional takes ownership of the case.
6. They check the person according to the institution's procedures and record an observation.
7. The case is closed with the responsible person, time, and outcome recorded.

The system organizes this workflow. It does not diagnose, prescribe, or replace the team's assessment.

### Example case

| Information | Demonstration example |
| --- | --- |
| Person | Demonstration resident 03 |
| Reason | Reading meets the condition of a configured experimental rule |
| Source | Simulated device 03 |
| Quality | Valid reading in the test scenario |
| Collection time | 2 minutes ago |
| Status | Awaiting verification |
| Owner | Not assigned yet |
| Interface action | Take ownership |

Do not define clinical thresholds based on this example. In the prototype, rules and readings are synthetic and identified as experimental.

## 5. Insights that guide the product

### 5.1 A reading should lead to an understandable action

An isolated chart may require interpretation and fail to clarify the next step. The opportunity is to present data together with the reason for the follow-up and the available operational action.

**MVP application:** every case shows evidence, its reason, and a button to take ownership of the verification.

### 5.2 Missing data does not mean the person is well

A device may be out of battery, out of range, or disconnected. The absence of a reading must not look like a normal condition.

**MVP application:** distinguish valid, invalid, and stale readings. A collection failure creates a technical case separate from a follow-up item associated with a reading.

### 5.3 Receiving an alert does not mean it was checked

Technical delivery confirmation does not prove that someone became aware of an alert or performed a check.

**MVP application:** keep three separate records:

| Record | Meaning |
| --- | --- |
| Persistence confirmation | The server stored the event |
| Team acknowledgement | A professional took ownership of the case |
| Closure | The professional recorded the verification outcome |

### 5.4 Context and quality matter

An old reading or one with inadequate sensor contact cannot be presented as if it reflected the current state. Manual records must also indicate who reported the data.

**MVP application:** show collection time, source, quality, and author identification for manual entry.

### 5.5 Too many alerts can reduce usefulness

The hypothesis is that overly sensitive rules create work without benefit. The number of alerts should not be treated as a success metric.

**MVP application:** start with one experimental rule; allow staff to record when a case had no operational value and review results with the team.

### 5.6 Action history may be more useful than additional metrics

Knowing who checked an item and what was recorded can support continuity of care, especially between shifts.

**MVP application:** maintain a simple timeline and avoid adding metrics without an identified need.

## 6. Reusing the existing architecture

| Telemetry project element | Everyday application |
| --- | --- |
| Simulated wearable on Vercel | Source of synthetic readings for the demonstration |
| Onboard service | Facility ingestion and processing service |
| Local database and Outbox | Durable record and synchronization of pending events |
| Ground service | Central follow-up service |
| Experimental rules | Generation of explainable follow-up items |
| IDs and deduplication | Prevent duplicate readings and cases during retransmission |
| Application ACK | Prove technical persistence |
| Event history | Evidence for the case timeline |

### Important limitation of the current demonstration

While the services run on a VPS, unavailability between the facility and the VPS prevents access to remote processing. The demonstration can simulate a service-to-service interruption, but it does not prove offline operation at the institution.

For true local continuity, the ingestion, persistence, and interface required by the care team must be available on equipment at the facility. This evolution should enter scope only if the pilot confirms the need.

The ability to regenerate synthetic data also does not prove that a physical device can store and retransmit readings.

## 7. Minimum scope for a product prototype

### Features

1. Minimal registration of demonstration people and association with simulated devices.
2. Reading ingestion and history.
3. Display of source, time, and quality.
4. One experimental rule to create follow-up items.
5. Case list with statuses and owners.
6. Recording of acknowledgement, observation, and closure.
7. Communication-failure simulation and duplicate-free retransmission.

### Case states

- **Awaiting verification:** the follow-up item was created and has no owner.
- **Under verification:** a professional has taken ownership.
- **Closed:** observation and outcome have been recorded.

Technical retransmission of the same event must not reopen a closed case or create another one. A new observation that meets the rule needs an explicit grouping policy to avoid repeated cases for the same episode.

### Initial interface

| Screen | Main content |
| --- | --- |
| Pending items | People, reasons, data age, status, and owner |
| Monitored person | Recent readings, quality, and case history |
| Case | Evidence, owner, and verification record |

A simple interface is sufficient. Advanced charts, maps, and aggregated health indexes are not needed to validate the workflow.

## 8. What is outside the first version

- Automatic diagnosis and treatment recommendations.
- Prediction of falls, heart attacks, or clinical deterioration.
- Integration with any smartwatch without verifying data access.
- A complete electronic health record.
- Medication, billing, or staffing management.
- Family application and external notifications.
- Artificial intelligence for symptom interpretation.
- Guarantees of emergency response.

In a real operation, the service cannot be presented as a substitute for the institution's emergency channels and procedures.

## 9. How to demonstrate it in a pitch

Use fictional data and people in a short session:

1. Show three people receiving synthetic readings.
2. Trigger a scenario that creates an explainable follow-up item.
3. Take ownership of the case as a demonstration professional.
4. Record the result and close the verification.
5. Simulate an interruption in synchronization between services.
6. Restore the link and show history arriving without duplicates.

**Core pitch message:**

> A platform that brings readings together and organizes follow-ups, showing what is pending, why, and who is responsible.

Explain that the operational proposal is being validated. Do not claim that the demonstration prevents clinical events or produces health outcomes that have not been studied.

## 10. How to validate before expanding

### Initial conversations

Interview facility professionals and coordinators to understand:

- How are readings and observations recorded today?
- Who decides when a verification is needed?
- How does the team identify the owner and hand over pending work between shifts?
- Which devices are used and how can their data be accessed?
- Which system already exists, and which tasks would this tool duplicate?
- Who would maintain and pay for the solution?

### Workflow pilot

Start with a synthetic demonstration and team review of the process. The use of real data requires appropriate planning for devices, rules, responsibilities, access, and privacy.

| Validation metric | What to investigate |
| --- | --- |
| Time to acknowledgement | How long it takes for a follow-up item to be taken by someone |
| Unassigned follow-up items | Whether assignment helps organize work |
| Time to closure | How the workflow is completed, considering priority and context |
| Cases with no value | Whether rules create noise or rework |
| Record completeness | Whether closure contains useful information for the team |
| Effort per case | Whether the product reduces or adds manual work |

These metrics evaluate the process. They do not demonstrate clinical benefit by themselves. Define targets only after observing a real baseline.

## 11. Commercial hypothesis

One possible model is a subscription per facility, with a tier based on the number of monitored people. Pricing should be tied to validated operational value, not only to the number of stored readings.

Before setting a price, verify the buyer, budget, integration cost, support required, and willingness to pay. A pilot may reveal that integration with the existing system matters more than an independent product.

## 12. Suggested next step

Keep the current technical MVP to prove ingestion, processing, persistence, and synchronization. In parallel, present a simple pending-items screen and one demonstration case to a care team.

The decision to evolve should depend on a concrete answer:

> Does the team understand the workflow and recognize a relevant task it would help them perform better?

If the answer is positive, implement the cycle of taking ownership and closing cases before adding new sensors or infrastructure.

## Context reference

Remote monitoring in home care already exists in initiatives such as NHS virtual wards. This reference illustrates an application category; it does not validate this specific product or establish equivalence with a senior living facility context.

- NHS — Virtual wards: https://digital.nhs.uk/data-and-information/information-governance/guidance/virtual-wards
