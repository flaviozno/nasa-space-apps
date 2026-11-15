# Graph Report - nasa-space-apps  (2026-11-15)

## Corpus Check
- cluster-only mode — file stats not available

## Summary
- 1682 nodes · 4015 edges · 88 communities (67 shown, 21 thin omitted)
- Extraction: 95% EXTRACTED · 5% INFERRED · 0% AMBIGUOUS · INFERRED: 218 edges (avg confidence: 0.94)
- Token cost: 0 input · 0 output

## Graph Freshness
- Built from commit: `6b2a0d61`
- Run `git rev-parse HEAD` and compare to check if the graph is stale.
- Run `graphify update .` after code changes (no API cost).

## Community Hubs (Navigation)
- API Configuration
- Crew API Fixtures
- Crew Member Management
- React Router Integration
- Crew API Integration Tests
- Onboard-Earth Sync Contract
- Onboard API Endpoints
- Shared FastAPI Dependencies
- Event Batch Handling
- Earth Test Fakes
- Vercel Emulator Client
- Alert Banner UI
- Sync Endpoints
- Fake Outbox Store
- System Clock
- Retry Schedule
- FastAPI App Factory
- Crew Baseline Tests
- Onboard App Settings
- Testing Utilities
- Observation Persistence
- UI Components
- Crew UI Elements
- Earth View Endpoints
- Alembic Migrations
- UI Library
- App Layout
- Alembic Migration Scripts
- View Construction
- Logging Utility
- Dev Dependencies
- Trend Chart
- TypeScript Configuration
- Retry Logic
- Mock Service Worker
- Questionnaire UI
- Earth Service Entry Point
- Shared Dependencies
- Node TypeScript Configuration
- Structured Logging
- Earth API Endpoints
- Alembic Environment
- Test Utilities
- TypeScript Configuration
- Observation Schemas
- UI Theme Management
- Dev Dependencies
- Questionnaire Status
- Earth Handlers
- Observation API Tests
- Emulator Package
- Event Ingest Store
- Earth Queries
- Crew Stub Tests
- Onboard Test Fixtures
- Alembic Branches
- Postgres Ingest Store
- Earth Test Fixtures
- Scripts
- Bearer Token Auth
- Auth Test Utilities
- Card UI Component
- Daily Check-in
- Ingest Status Endpoint
- Sync Contract Tests
- Vercel Configuration
- OxLint Configuration
- Onboard API Types
- Alert View Construction
- Scripts
- Web TypeScript Configuration
- ResizeObserver Stub
- Shared Services
- Event Ingest
- health-hub-workspace

## God Nodes (most connected - your core abstractions)
1. `FakeOutboxStore` - 27 edges
2. `make_event()` - 27 edges
3. `evaluate()` - 25 edges
4. `QueryError()` - 25 edges
5. `SyncEvent` - 23 edges
6. `LoadingBlock()` - 22 edges
7. `lucide-react` - 22 edges
8. `react` - 22 edges
9. `EventBatch` - 21 edges
10. `CrewOverviewPage()` - 20 edges

## Surprising Connections (you probably didn't know these)
- `test_alert_payload_carries_bounded_mission_readiness_evidence()` --uses--> `AlertPayload`  [INFERRED]
  app/common/tests/test_sync_contract.py → app/common/src/hub_common/sync_contract.py
- `test_payload_json_uses_camel_case()` --uses--> `AlertPayload`  [INFERRED]
  app/common/tests/test_sync_contract.py → app/common/src/hub_common/sync_contract.py
- `alert_event()` --uses--> `AlertPayload`  [INFERRED]
  app/earth/tests/earth_fakes.py → app/common/src/hub_common/sync_contract.py
- `PostgresIngestStore` --uses--> `AlertPayload`  [INFERRED]
  app/onboard/app/ingest/store.py → app/common/src/hub_common/sync_contract.py
- `persist_review_recommendation()` --uses--> `AlertPayload`  [INFERRED]
  app/onboard/app/readiness.py → app/common/src/hub_common/sync_contract.py

## Import Cycles
- None detected.

## Communities (88 total, 21 thin omitted)

### Community 0 - "API Configuration"
Cohesion: 0.06
Nodes (70): handler(), handler(), handler(), handler(), handler(), Config, getConfig(), ErrorResponse (+62 more)

### Community 1 - "Crew API Fixtures"
Cohesion: 0.06
Nodes (32): AlertPayload, create_app(), _alert_view(), build_alert_views(), build_crew_views(), build_status_view(), _crew_view(), freshness() (+24 more)

### Community 2 - "Crew Member Management"
Cohesion: 0.05
Nodes (16): load_contract(), load_catalog(), metric_label(), require_metric(), validate_value(), create_observations(), list_observations(), _now_ms() (+8 more)

### Community 3 - "React Router Integration"
Cohesion: 0.10
Nodes (39): actionIcons, ActionPlanCard(), ActionStep(), priorityLabels, AlertBanner(), labels, MissionReadinessCard(), TREND_WINDOWS (+31 more)

### Community 4 - "Crew API Integration Tests"
Cohesion: 0.10
Nodes (27): api(), outbox_events(), summary_by_metric(), test_action_plan_turns_missing_local_context_into_collection_steps(), test_daily_checkin_creates_ten_observations_and_one_event(), test_daily_checkin_rejects_out_of_scale_answers(), test_manual_entries_persist_and_enqueue_earth_event(), test_phq4_stores_the_total() (+19 more)

### Community 5 - "Onboard-Earth Sync Contract"
Cohesion: 0.12
Nodes (29): AbsoluteRule, Baseline, default_rules(), default_zscore_rules(), evaluate(), _evaluate_absolute(), _evaluate_zscore(), Observation (+21 more)

### Community 6 - "Onboard API Endpoints"
Cohesion: 0.10
Nodes (17): require_crew_member(), _catalog(), _contract(), create_daily_checkin(), create_manual_entries(), create_phq4(), create_team_climate(), list_crew() (+9 more)

### Community 7 - "Shared FastAPI Dependencies"
Cohesion: 0.08
Nodes (15): clean_tables(), integration_engine(), insert_observations(), insert_questionnaire_response(), latest_per_metric(), query_observations(), range_observations(), clean_tables() (+7 more)

### Community 8 - "Event Batch Handling"
Cohesion: 0.09
Nodes (32): ONBOARD_API, onboardApi, TrendOptions, ActionPlan, ActionStep, Alert, Baseline, CrewMember (+24 more)

### Community 9 - "Earth Test Fakes"
Cohesion: 0.17
Nodes (28): LoadingBlock(), ScalePicker(), useNow(), useCrewHubMember(), toCheckinPayload(), onboardKeys, useMemberMutation(), useQuestionnaireStatus() (+20 more)

### Community 10 - "Vercel Emulator Client"
Cohesion: 0.07
Nodes (21): Badge(), badgeVariants, Button(), buttonVariants, ChartContainer(), ChartContext, ChartContextProps, ChartLegendContent() (+13 more)

### Community 11 - "Alert Banner UI"
Cohesion: 0.13
Nodes (17): build_action_plan(), _measurement_quality_step(), _step(), ActionPlanOut, ActionPriority, ActionStepOut, ActionType, CrewSummaryOut (+9 more)

### Community 12 - "Sync Endpoints"
Cohesion: 0.15
Nodes (19): alert_event(), batch_json(), build_client(), FakeClock, observation_event(), count(), database_url(), post() (+11 more)

### Community 13 - "Fake Outbox Store"
Cohesion: 0.09
Nodes (18): alerts_for(), baseline_for(), crew_members(), metric_label(), now_ms(), require_metric(), stable_id(), _stub_value() (+10 more)

### Community 14 - "System Clock"
Cohesion: 0.13
Nodes (12): EmulatorRequestError, VercelEmulatorClient, DeviceCursor, ExerciseEvidence, RadiationEvidence, ReceiptAck, SleepEvidence, SyncRequest (+4 more)

### Community 15 - "Retry Schedule"
Cohesion: 0.16
Nodes (15): CycleOutcome, FakeClock, FakeEarthSender, FakeOutboxStore, build_client(), test_admin_can_turn_the_link_off(), test_link_change_requires_the_admin_token(), test_status_reports_link_and_backlog_in_camel_case() (+7 more)

### Community 16 - "FastAPI App Factory"
Cohesion: 0.12
Nodes (10): ack_confirms_batch(), AlertEvidence, CamelModel, EventBatch, EventBatchAck, EventBatchConflict, ObservationItem, ObservationsPayload (+2 more)

### Community 17 - "Crew Baseline Tests"
Cohesion: 0.10
Nodes (8): build_service_app(), lifespan(), _cancel_all(), build_probe_router(), ProbeSettings, RecordingJob, test_background_jobs_run_for_the_app_lifetime(), test_service_app_mounts_health_and_routers()

### Community 18 - "Onboard App Settings"
Cohesion: 0.10
Nodes (5): BaselineValuesTest, CrewStructureTest, EmulatorCalibrationTest, load_crew_contract(), z_score()

### Community 19 - "Testing Utilities"
Cohesion: 0.16
Nodes (9): RetrySchedule, PostgresOutboxStore, enqueue(), store(), test_due_events_put_alerts_first_and_respect_retry_time(), test_enqueue_is_idempotent_per_event_id(), test_link_setting_persists(), test_rolled_back_producer_leaves_no_event() (+1 more)

### Community 20 - "Observation Persistence"
Cohesion: 0.12
Nodes (16): EARTH_API, earthApi, EarthAlert, EarthCrewMember, EarthMetric, EarthStatus, SyncStatus, dataUpToMs() (+8 more)

### Community 21 - "UI Components"
Cohesion: 0.12
Nodes (6): Clock, OnboardSettings, create_app(), _ingest_jobs(), _sync_jobs(), OutboxStore

### Community 22 - "Crew UI Elements"
Cohesion: 0.12
Nodes (6): configure_service_logging(), log_json(), test_log_json_writes_one_json_line(), test_service_logging_enables_info_once(), _conflict_response(), ingest_batch()

### Community 23 - "Earth View Endpoints"
Cohesion: 0.26
Nodes (11): setup(), createQueryClient(), resetMockSubmissions(), answerFeelings(), pick(), mockServer, startMockServer(), renderAt() (+3 more)

### Community 24 - "Alembic Migrations"
Cohesion: 0.13
Nodes (8): downgrade(), upgrade(), upgrade(), upgrade(), downgrade(), upgrade(), downgrade(), upgrade()

### Community 25 - "UI Library"
Cohesion: 0.18
Nodes (13): evaluate_for_crew(), evaluate_readiness(), Evidence, _latest_evidence(), observation(), persist_radiation_context(), persist_review_recommendation(), ReadinessStatus (+5 more)

### Community 26 - "App Layout"
Cohesion: 0.19
Nodes (9): EarthDeliveryError, HttpEarthClient, build_batch(), FakeEarthServer, test_conflict_names_the_event_ids(), test_invalid_ack_body_is_a_delivery_error(), test_network_failure_is_a_delivery_error(), test_sends_camel_case_batch_with_token_and_parses_ack() (+1 more)

### Community 27 - "Alembic Migration Scripts"
Cohesion: 0.09
Nodes (9): _manual_source_ref(), _questionnaire_rows(), _to_out(), DailyCheckinIn, ManualEntryIn, ManualEntryOut, MissionReadinessOut, Phq4In (+1 more)

### Community 28 - "View Construction"
Cohesion: 0.16
Nodes (7): _clock(), read_status(), _store(), SyncControlStore, update_link(), LinkUpdate, SyncStatus

### Community 29 - "Logging Utility"
Cohesion: 0.09
Nodes (21): aliases, components, hooks, lib, ui, utils, iconLibrary, menuAccent (+13 more)

### Community 30 - "Dev Dependencies"
Cohesion: 0.10
Nodes (18): msw, workerDirectory, name, private, type, version, @fontsource-variable/geist, jsdom (+10 more)

### Community 31 - "Trend Chart"
Cohesion: 0.20
Nodes (13): CrewAvatar(), CrewNavRail(), itemClass(), ITEMS, RailItem, DeviceChip(), CrewHubContext, formatDeviceId() (+5 more)

### Community 32 - "TypeScript Configuration"
Cohesion: 0.10
Nodes (20): compilerOptions, allowArbitraryExtensions, allowImportingTsExtensions, erasableSyntaxOnly, jsx, lib, module, moduleDetection (+12 more)

### Community 33 - "Retry Logic"
Cohesion: 0.15
Nodes (17): activeClientIds, activeClientIdsRestorePromise, activeClientIdsStorePromise, getResponse(), handleRequest(), IS_MOCKED_RESPONSE, notifyClient(), pendingRequests (+9 more)

### Community 34 - "Mock Service Worker"
Cohesion: 0.13
Nodes (5): SystemClock, create_database_engine(), get_connection(), test_accepts_a_psycopg_postgres_url_without_connecting(), test_rejects_other_databases_with_the_offending_url()

### Community 35 - "Questionnaire UI"
Cohesion: 0.17
Nodes (7): EventType, build_alert_event(), build_event(), build_observations_event(), enqueue_event(), _insert_params(), test_payload_must_match_the_event_type()

### Community 36 - "Earth Service Entry Point"
Cohesion: 0.24
Nodes (15): QuestionnaireSaved(), ValueStepper(), ValueStepperProps, bloodPressureError(), MANUAL_METRICS, ManualMetric, ManualMetricId, MEASUREMENT_GROUPS (+7 more)

### Community 37 - "Shared Dependencies"
Cohesion: 0.11
Nodes (18): dependencies, class-variance-authority, cn, @fontsource-variable/geist, lucide-react, motion, next-themes, radix-ui (+10 more)

### Community 38 - "Node TypeScript Configuration"
Cohesion: 0.22
Nodes (14): AlertFields, AlertText, capitalize(), describeAlert(), METRIC_WORDING, earthKeys, useEarthAlerts(), useEarthCrew() (+6 more)

### Community 39 - "Structured Logging"
Cohesion: 0.20
Nodes (7): retry_delay_ms(), make_event(), test_backoff_doubles_with_bounded_jitter(), test_backoff_is_capped_at_five_minutes_plus_jitter(), test_backoff_rejects_negative_attempts(), test_priority_comes_from_the_type(), test_same_source_gives_the_same_event_id()

### Community 40 - "Earth API Endpoints"
Cohesion: 0.12
Nodes (16): compilerOptions, allowImportingTsExtensions, erasableSyntaxOnly, lib, module, moduleDetection, noEmit, noFallthroughCasesInSwitch (+8 more)

### Community 41 - "Alembic Environment"
Cohesion: 0.20
Nodes (6): test_upgrade_heads_renders_sql_offline(), branch_label_of(), load_scripts(), test_each_owner_branch_has_exactly_one_head(), test_each_owner_branch_starts_from_base(), test_upgrade_heads_renders_sql_offline()

### Community 42 - "Test Utilities"
Cohesion: 0.13
Nodes (13): CheckinAnswers, CheckinKey, FEELING_QUESTIONS, INITIAL_ANSWERS, ScaleQuestion, SYMPTOM_QUESTIONS, ApiError, describeError() (+5 more)

### Community 43 - "TypeScript Configuration"
Cohesion: 0.15
Nodes (3): run_migrations(), run_offline(), run_online()

### Community 44 - "Observation Schemas"
Cohesion: 0.13
Nodes (14): devDependencies, @types/node, typescript, engines, node, name, private, scripts (+6 more)

### Community 45 - "UI Theme Management"
Cohesion: 0.22
Nodes (5): build_app(), FakeConnection, FakeEngine, test_endpoint_error_rolls_back(), test_endpoint_receives_a_connection_and_commits()

### Community 46 - "Dev Dependencies"
Cohesion: 0.14
Nodes (13): compilerOptions, allowImportingTsExtensions, exactOptionalPropertyTypes, lib, module, moduleResolution, noEmit, noUncheckedIndexedAccess (+5 more)

### Community 47 - "Questionnaire Status"
Cohesion: 0.20
Nodes (9): AppLayout(), navClass(), PrimaryNav(), DisplayMode, DisplayModeControl(), MODES, OptionPicker(), OptionPickerProps (+1 more)

### Community 48 - "Earth Handlers"
Cohesion: 0.25
Nodes (6): ServiceStatus(), ServiceStatusProps, fetchServiceHealth(), HealthFetcher, ServiceHealth, FakeHealthServer

### Community 50 - "Observation API Tests"
Cohesion: 0.15
Nodes (13): devDependencies, jsdom, msw, oxlint, @testing-library/jest-dom, @testing-library/react, @types/node, @types/react (+5 more)

### Community 51 - "Emulator Package"
Cohesion: 0.33
Nodes (9): QuestionnaireClosed(), QuestionnaireClosedProps, formatCountdown(), formatGmtClock(), formatReopening(), nextUtcMidnight(), QuestionnaireWindow, windowAfter() (+1 more)

### Community 52 - "Event Ingest Store"
Cohesion: 0.18
Nodes (9): Toaster(), enableMocking(), queryClient, worker, earthHandlers, handlers, routes, next-themes (+1 more)

### Community 53 - "Earth Queries"
Cohesion: 0.29
Nodes (5): api(), test_get_applies_filters(), test_null_value_round_trips_through_the_api(), test_post_persists_and_is_idempotent(), test_post_rejects_unknown_metric_and_out_of_scale_values()

### Community 54 - "Crew Stub Tests"
Cohesion: 0.26
Nodes (9): payload_json(), build_batch(), build_event(), test_ack_must_name_the_batch_and_every_event(), test_alert_payload_carries_bounded_mission_readiness_evidence(), test_batch_parses_camel_case_json(), test_batch_rejects_more_than_100_events(), test_event_serializes_as_camel_case() (+1 more)

### Community 55 - "Onboard Test Fixtures"
Cohesion: 0.22
Nodes (4): SyncEvent, test_payload_is_validated_against_the_type(), PendingEvent, _pending_event()

### Community 56 - "Alembic Branches"
Cohesion: 0.31
Nodes (5): _conflicting_ids(), content_sha256(), _event_params(), _record_conflicts(), store_batch()

### Community 58 - "Earth Test Fixtures"
Cohesion: 0.33
Nodes (7): QueryError(), QueryErrorProps, Alert(), AlertDescription(), AlertTitle(), alertVariants, Skeleton()

### Community 59 - "Scripts"
Cohesion: 0.27
Nodes (4): client(), test_alerts_are_empty_except_the_fixture_member(), test_baseline_lists_every_contract_metric(), test_crew_list_matches_the_contract()

### Community 63 - "Card UI Component"
Cohesion: 0.22
Nodes (9): scripts, build, dev, dev:mock, gen:api, lint, preview, test (+1 more)

### Community 64 - "Daily Check-in"
Cohesion: 0.32
Nodes (3): require_bearer_token(), check(), _token_matches()

### Community 65 - "Ingest Status Endpoint"
Cohesion: 0.36
Nodes (4): build_app(), test_correct_token_passes(), test_unconfigured_secret_refuses_everyone(), test_wrong_or_missing_token_is_401()

### Community 68 - "OxLint Configuration"
Cohesion: 0.29
Nodes (4): build_health_router(), read_health(), HealthStatus, test_health_reports_service_name()

### Community 70 - "Alert View Construction"
Cohesion: 0.33
Nodes (5): includeFiles, maxDuration, functions, api/*.ts, rewrites

### Community 71 - "Scripts"
Cohesion: 0.33
Nodes (5): plugins, rules, react/only-export-components, react/rules-of-hooks, $schema

### Community 72 - "Web TypeScript Configuration"
Cohesion: 0.33
Nodes (5): components, $defs, operations, paths, webhooks

### Community 73 - "ResizeObserver Stub"
Cohesion: 0.40
Nodes (4): compilerOptions, paths, files, references

### Community 75 - "Event Ingest"
Cohesion: 0.67
Nodes (3): earth, hub-common, onboard

## Knowledge Gaps
- **11 isolated node(s):** `@fontsource-variable/geist`, `jsdom`, `oxlint`, `shadcn`, `tailwindcss` (+6 more)
  These have ≤1 connection - possible missing edges or undocumented components. (Counts symbols only; 675 node(s) total have ≤1 connection when file, concept and rationale nodes are included.)
- **21 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `read_trend()` connect `Onboard API Endpoints` to `Alembic Migration Scripts`, `Fake Outbox Store`, `Shared FastAPI Dependencies`?**
  _High betweenness centrality (0.014) - this node is a cross-community bridge._
- **Are the 7 inferred relationships involving `FakeOutboxStore` (e.g. with `EventType` and `SyncEvent`) actually correct?**
  _`FakeOutboxStore` has 7 INFERRED edges - model-reasoned connections that need verification._
- **What connects `@fontsource-variable/geist`, `jsdom`, `oxlint` to the rest of the system?**
  _11 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `API Configuration` be split into smaller, more focused modules?**
  _Cohesion score 0.059429824561403506 - nodes in this community are weakly interconnected._
- **Why does `react` connect `Earth Service Entry Point` to `React Router Integration`, `Earth Test Fakes`, `Vercel Emulator Client`, `Questionnaire Status`, `Earth Handlers`, `Emulator Package`, `Event Ingest Store`, `Earth View Endpoints`, `Earth Test Fixtures`, `Dev Dependencies`?**
  _High betweenness centrality (0.010) - this node is a cross-community bridge._
- **Are the 5 inferred relationships involving `make_event()` (e.g. with `AlertPayload` and `EventType`) actually correct?**
  _`make_event()` has 5 INFERRED edges - model-reasoned connections that need verification._
- **Should `Crew API Fixtures` be split into smaller, more focused modules?**
  _Cohesion score 0.059125085440874914 - nodes in this community are weakly interconnected._