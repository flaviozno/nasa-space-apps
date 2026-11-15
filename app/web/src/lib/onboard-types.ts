// Short names for the onboard API schemas. The source of truth is src/generated/onboard-api.d.ts,
// generated from the onboard OpenAPI with `npm run gen:api`; never edit that file by hand.

import type { components } from '@/generated/onboard-api'

type Schemas = components['schemas']

export type CrewMember = Schemas['CrewMemberOut']
export type Baseline = Schemas['BaselineOut']
export type CrewSummary = Schemas['CrewSummaryOut']
export type MetricSummary = Schemas['MetricSummaryOut']
export type MetricTrend = Schemas['MetricTrendOut']
export type TrendPoint = Schemas['TrendPointOut']
export type Alert = Schemas['AlertOut']
export type MissionReadiness = Schemas['MissionReadinessOut']
export type ActionPlan = Schemas['ActionPlanOut']
export type ActionStep = Schemas['ActionStepOut']
export type Observation = Schemas['ObservationOut']
export type ObservationInput = Schemas['ObservationIn']
export type ObservationBatchInput = Schemas['ObservationBatchIn']
export type ObservationBatchResult = Schemas['ObservationBatchOut']
export type ManualEntryInput = Schemas['ManualEntryIn']
export type ManualEntryResult = Schemas['ManualEntryOut']
export type DailyCheckinInput = Schemas['DailyCheckinIn']
export type Phq4Input = Schemas['Phq4In']
export type TeamClimateInput = Schemas['TeamClimateIn']
export type QuestionnaireResult = Schemas['QuestionnaireResponseOut']
