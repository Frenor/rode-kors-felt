/**
 * @rkf/shared-types
 *
 * Canonical type definitions shared across web and API.
 * All Zod schemas live here — API validates with them,
 * frontend infers TypeScript types from them.
 */

import { z } from 'zod';

// ═══════════════════════════════════════════════
// ENUMS
// ═══════════════════════════════════════════════

export const UserRole = z.enum(['admin', 'coordinator', 'sickbay', 'first_aider']);
export type UserRole = z.infer<typeof UserRole>;

export const AcvpuLevel = z.enum(['alert', 'confused', 'voice', 'pain', 'unresponsive']);
export type AcvpuLevel = z.infer<typeof AcvpuLevel>;

export const PatientStatus = z.enum([
  'incoming',
  'in_treatment',
  'observation',
  'discharged',
  'transferred',
]);
export type PatientStatus = z.infer<typeof PatientStatus>;

export const FieldTriageStatus = z.enum(['green', 'yellow', 'red', 'black']);
export type FieldTriageStatus = z.infer<typeof FieldTriageStatus>;

export const TeamTransport = z.enum(['foot', 'bike', 'vehicle', 'atv']);
export type TeamTransport = z.infer<typeof TeamTransport>;

export const SickBayPlacementType = z.enum(['chair', 'bed']);
export type SickBayPlacementType = z.infer<typeof SickBayPlacementType>;

export const TeamOperationalStatus = z.enum([
  'available',
  'en_route',
  'on_scene',
  'needs_assistance',
  'unavailable',
]);
export type TeamOperationalStatus = z.infer<typeof TeamOperationalStatus>;

export const TeamPatientStatus = z.enum([
  'en_route_to_patient',
  'transporting',
  'monitoring',
]);
export type TeamPatientStatus = z.infer<typeof TeamPatientStatus>;

// ═══════════════════════════════════════════════
// CORE SCHEMAS
// ═══════════════════════════════════════════════

export const GeoPoint = z.object({
  lat: z.number().min(-90).max(90),
  lng: z.number().min(-180).max(180),
});
export type GeoPoint = z.infer<typeof GeoPoint>;

export const IndoorLocationContext = z.object({
  mode: z.enum(['gps', 'indoor_zone']),
  venueId: z.string().optional(),
  floorId: z.string().optional(),
  zoneId: z.string().optional(),
  zoneLabel: z.string().optional(),
});
export type IndoorLocationContext = z.infer<typeof IndoorLocationContext>;

export const IndoorZone = z.object({
  id: z.string(),
  label: z.string(),
  center: GeoPoint,
});
export type IndoorZone = z.infer<typeof IndoorZone>;

export const IndoorFloor = z.object({
  id: z.string(),
  label: z.string(),
  zones: z.array(IndoorZone),
});
export type IndoorFloor = z.infer<typeof IndoorFloor>;

export const IndoorLayout = z.object({
  venueId: z.string(),
  venueName: z.string().optional(),
  floors: z.array(IndoorFloor),
});
export type IndoorLayout = z.infer<typeof IndoorLayout>;

export const MapLayerConfig = z.object({
  id: z.string(),
  type: z.enum(['xyz', 'wmts']),
  url: z.string(),
  attribution: z.string().optional(),
  token: z.string().optional(),
  minZoom: z.number().optional(),
  maxZoom: z.number().optional(),
});
export type MapLayerConfig = z.infer<typeof MapLayerConfig>;

export const MapRuntimeConfig = z.object({
  provider: z.enum(['leaflet', 'maplibre']).optional(),
  styleUrl: z.string().optional(),
  layers: z.array(MapLayerConfig).optional(),
  enable3d: z.boolean().optional(),
});
export type MapRuntimeConfig = z.infer<typeof MapRuntimeConfig>;

export const VitalReading = z.object({
  id: z.string().uuid(),
  patientId: z.string().uuid(),
  timestamp: z.string().datetime(),
  pulse: z.number().int().min(0).max(300).optional(),
  spo2: z.number().int().min(0).max(100).optional(),
  respiratoryRate: z.number().int().min(0).max(80).optional(),
  painScore: z.number().int().min(0).max(10).optional(),
  // NEWS2 additional parameters
  systolicBP: z.number().int().min(0).max(300).optional(),
  temperature: z.number().min(25).max(45).optional(),
  onSupplementalOxygen: z.boolean().optional(),
  acvpu: AcvpuLevel.optional(),
});
export type VitalReading = z.infer<typeof VitalReading>;

export const MistForm = z.object({
  mechanism: z.string().max(500),
  injury: z.string().max(500),
  signs: z.string().max(500),
  treatment: z.string().max(500),
});
export type MistForm = z.infer<typeof MistForm>;

export const SbarForm = z.object({
  situation: z.string().max(500),
  background: z.string().max(500),
  assessment: z.string().max(500),
  recommendation: z.string().max(500),
});
export type SbarForm = z.infer<typeof SbarForm>;

export const Patient = z.object({
  id: z.string().uuid(),
  eventId: z.string().uuid(),
  status: PatientStatus,
  ageGroup: z.enum(['child', 'adolescent', 'adult', 'elderly']).optional(),
  presentingComplaint: z.string().max(500).optional(),
  fullName: z.string().max(200).optional(),
  gender: z.enum(['male', 'female', 'other']).optional(),
  birthDate: z.string().optional(),
  placementType: SickBayPlacementType.optional(),
  placementNumber: z.string().max(20).optional(),
  arrivalTime: z.string().datetime(),
  assignedClinician: z.string().max(100).optional(),
  notes: z.array(z.object({
    text: z.string().max(2000),
    timestamp: z.string().datetime(),
    author: z.string().max(100),
  })),
  diagnosisFlags: z.array(z.string()),
  ageYears: z.number().int().nonnegative().optional(),
  // Field / coordinator patient fields
  label: z.string().max(200).nullable().optional(),
  triageStatus: FieldTriageStatus.nullable().optional(),
  description: z.string().nullable().optional(),
  positionText: z.string().max(500).nullable().optional(),
  lat: z.number().nullable().optional(),
  lon: z.number().nullable().optional(),
  assignedTeamId: z.string().uuid().nullable().optional(),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
});
export type Patient = z.infer<typeof Patient>;

export const Event = z.object({
  id: z.string().uuid(),
  name: z.string().min(1).max(200),
  startDate: z.string().datetime(),
  endDate: z.string().datetime(),
  status: z.enum(['draft', 'active', 'archived']),
  location: GeoPoint.optional(),
  mapImageUrl: z.string().url().optional(),
  mapAnchors: z.array(GeoPoint).optional(),
  indoorLayout: IndoorLayout.optional(),
  mapRuntimeConfig: MapRuntimeConfig.optional(),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
});
export type Event = z.infer<typeof Event>;

export const Team = z.object({
  id: z.string().uuid(),
  eventId: z.string().uuid(),
  name: z.string().min(1).max(100),
  size: z.number().int().min(1).max(20),
  transport: TeamTransport,
  gear: z.array(z.string()),
  members: z.array(z.string()),
  contactPhone: z.string().max(50).nullable().optional(),
  contactRadio: z.string().max(50).nullable().optional(),
  currentPosition: GeoPoint.optional(),
  lastPositionUpdate: z.string().datetime().optional(),
});
export type Team = z.infer<typeof Team>;

// ═══════════════════════════════════════════════
// API REQUEST / RESPONSE SCHEMAS
// ═══════════════════════════════════════════════

export const LoginRequest = z.object({
  email: z.string().email(),
  password: z.string().min(8),
});

export const EventCodeRequest = z.object({
  code: z.string().length(6),
});

export const AuthResponse = z.object({
  accessToken: z.string(),
  refreshToken: z.string(),
  role: UserRole,
  eventId: z.string().uuid().optional(),
});

export const TeamStatusSetActionRequest = z.object({
  type: z.literal('team.status_set'),
  status: TeamOperationalStatus,
  note: z.string().max(500).optional(),
  clientActionId: z.string().uuid(),
});
export type TeamStatusSetActionRequest = z.infer<typeof TeamStatusSetActionRequest>;

export const TeamMonitorStartedActionRequest = z.object({
  type: z.literal('team.monitor_started'),
  patientId: z.string().uuid(),
  clientActionId: z.string().uuid(),
});
export type TeamMonitorStartedActionRequest = z.infer<typeof TeamMonitorStartedActionRequest>;

export const TeamMonitorStoppedActionRequest = z.object({
  type: z.literal('team.monitor_stopped'),
  patientId: z.string().uuid(),
  clientActionId: z.string().uuid(),
});
export type TeamMonitorStoppedActionRequest = z.infer<typeof TeamMonitorStoppedActionRequest>;

export const TeamPatientStatusSetActionRequest = z.object({
  type: z.literal('team.patient_status_set'),
  patientId: z.string().uuid(),
  /** null clears the team's engagement with this patient */
  status: TeamPatientStatus.nullable(),
  clientActionId: z.string().uuid(),
});
export type TeamPatientStatusSetActionRequest = z.infer<typeof TeamPatientStatusSetActionRequest>;

export const TeamActionRequest = z.discriminatedUnion('type', [
  TeamStatusSetActionRequest,
  TeamMonitorStartedActionRequest,
  TeamMonitorStoppedActionRequest,
  TeamPatientStatusSetActionRequest,
]);
export type TeamActionRequest = z.infer<typeof TeamActionRequest>;

export const TeamWorkspacePatient = z.object({
  id: z.string().uuid(),
  status: PatientStatus,
  presentingComplaint: z.string().nullable(),
  label: z.string().nullable().optional(),
  triageStatus: z.enum(['green', 'yellow', 'red', 'black']).nullable().optional(),
  updatedAt: z.string().datetime(),
  lat: z.number().nullable(),
  lon: z.number().nullable(),
  positionText: z.string().nullable(),
  teamPatientStatus: TeamPatientStatus.nullable().optional(),
});
export type TeamWorkspacePatient = z.infer<typeof TeamWorkspacePatient>;

export const TeamWorkspaceResponse = z.object({
  teamId: z.string().uuid(),
  eventId: z.string().uuid(),
  latestStatus: TeamOperationalStatus,
  activePatientId: z.string().uuid().nullable(),
  assignedPatients: z.array(TeamWorkspacePatient),
  monitoredPatients: z.array(TeamWorkspacePatient),
  unassignedPatients: z.array(TeamWorkspacePatient),
  updatedAt: z.string().datetime(),
});
export type TeamWorkspaceResponse = z.infer<typeof TeamWorkspaceResponse>;

/** Per-patient snapshot of all teams currently engaged with that patient. */
export const TeamPatientEngagement = z.object({
  teamId: z.string().uuid(),
  teamName: z.string(),
  patientId: z.string().uuid(),
  status: TeamPatientStatus,
});
export type TeamPatientEngagement = z.infer<typeof TeamPatientEngagement>;

export const TeamPatientEngagementsResponse = z.object({
  /** map of patientId → array of active team engagements */
  engagements: z.record(z.string().uuid(), z.array(TeamPatientEngagement)),
});
export type TeamPatientEngagementsResponse = z.infer<typeof TeamPatientEngagementsResponse>;

export const SickbayIncomingCriticalReason = z.enum([
  'needs_assistance',
  'triage_red',
  'news2_high',
]);
export type SickbayIncomingCriticalReason = z.infer<typeof SickbayIncomingCriticalReason>;

export const SickbayIncomingItem = z.object({
  patientId: z.string().uuid(),
  label: z.string().nullable(),
  triageStatus: z.enum(['green', 'yellow', 'red', 'black']).nullable(),
  teamId: z.string().uuid().nullable(),
  critical: z.boolean(),
  criticalReasons: z.array(SickbayIncomingCriticalReason),
  latestVitals: VitalReading.partial().nullable().optional(),
  news2: z.object({
    total: z.number(),
    alertLevel: z.enum(['routine', 'low', 'medium', 'high']),
  }).nullable().optional(),
  updatedAt: z.string().datetime(),
});
export type SickbayIncomingItem = z.infer<typeof SickbayIncomingItem>;

export const SickbayIncomingResponse = z.object({
  items: z.array(SickbayIncomingItem),
});
export type SickbayIncomingResponse = z.infer<typeof SickbayIncomingResponse>;

// ═══════════════════════════════════════════════
// WEBSOCKET PAYLOAD SCHEMAS
// ═══════════════════════════════════════════════

export const TeamPositionPayload = z.object({
  teamId: z.string().uuid(),
  position: GeoPoint,
  memberId: z.string().optional(),
});
export type TeamPositionPayload = z.infer<typeof TeamPositionPayload>;

// ═══════════════════════════════════════════════
// WEBSOCKET EVENT TYPES
// ═══════════════════════════════════════════════

export const WsEventType = z.enum([
  'team.position',
  'team.status_changed',
  'team.session_changed',
  'team.message',
  'team.transport_changed',
  'patient.created',
  'patient.updated',
  'patient.vitals_updated',
  'patient.deterioration_alert',
]);

export const TeamMessage = z.object({
  id: z.string().uuid(),
  eventId: z.string().uuid(),
  fromTeamId: z.string().uuid().optional(),
  toTeamId: z.string().uuid().optional(), // null = broadcast to all
  text: z.string().min(1).max(500),
  sentAt: z.string().datetime(),
});
export type TeamMessage = z.infer<typeof TeamMessage>;
export type WsEventType = z.infer<typeof WsEventType>;

// ═══════════════════════════════════════════════
// NEWS2 SCORING
// ═══════════════════════════════════════════════

// ═══════════════════════════════════════════════
// MEDICATION RECORD
// ═══════════════════════════════════════════════

export const MedicationDrug = z.enum([
  'oxygen', 'aspirin', 'GTN', 'morphine', 'naloxone', 'glucose', 'adrenaline', 'other',
]);

export const MedicationRoute = z.enum(['oral', 'IV', 'IM', 'inhaled', 'sublingual', 'other']);

export const MedicationRecord = z.object({
  id: z.string().uuid(),
  patientId: z.string().uuid(),
  eventId: z.string().uuid(),
  drug: MedicationDrug,
  dose: z.string().max(100).optional(),
  route: MedicationRoute.optional(),
  givenAt: z.string().datetime(),
  givenBy: z.string().max(100).optional(),
});
export type MedicationRecord = z.infer<typeof MedicationRecord>;

export const CreateMedicationRequest = MedicationRecord.pick({
  drug: true,
  dose: true,
  route: true,
  givenBy: true,
});
export type CreateMedicationRequest = z.infer<typeof CreateMedicationRequest>;

export const AmkCriticality = z.enum(['low', 'medium', 'high', 'critical']);
export type AmkCriticality = z.infer<typeof AmkCriticality>;

export const AmkCallLog = z.object({
  id: z.string(),
  eventId: z.string().uuid(),
  patientId: z.string().uuid(),
  calledAt: z.string().datetime(),
  summaryGiven: z.string().min(1).max(2000),
  amkGuidance: z.string().min(1).max(2000),
  followUpOwner: z.string().min(1).max(200),
  referenceId: z.string().max(100).optional(),
  eta: z.string().max(100).optional(),
  recordedBy: z.string().min(1).max(255),
});
export type AmkCallLog = z.infer<typeof AmkCallLog>;

export const CreateAmkCallLogRequest = AmkCallLog.pick({
  summaryGiven: true,
  amkGuidance: true,
  followUpOwner: true,
  referenceId: true,
  eta: true,
}).extend({
  calledAt: z.string().datetime().optional(),
});
export type CreateAmkCallLogRequest = z.infer<typeof CreateAmkCallLogRequest>;

export const AmkAssistDraft = z.object({
  criticality: AmkCriticality,
  rationale: z.string().min(1),
  sayFirst: z.array(z.string().min(1)).min(1),
  spokenScript: z.string().min(1),
  sbarDraft: SbarForm,
});
export type AmkAssistDraft = z.infer<typeof AmkAssistDraft>;

export const ConfirmAmkAssistRequest = z.object({
  criticality: AmkCriticality,
  spokenScript: z.string().min(1),
  rationale: z.string().optional(),
  sayFirst: z.array(z.string().min(1)).optional(),
  sbarDraft: SbarForm.optional(),
});
export type ConfirmAmkAssistRequest = z.infer<typeof ConfirmAmkAssistRequest>;

// ═══════════════════════════════════════════════
// NEWS2 SCORING
// ═══════════════════════════════════════════════

export type {
  News2Input,
  News2ParameterScores,
  News2Result,
  News2Trend,
} from './news2.js';

export {
  calculateNEWS2,
  calculateNEWS2Trend,
  news2MonitoringLabel,
  news2BadgeLabel,
} from './news2.js';

export const WsMessage = z.object({
  type: WsEventType,
  eventId: z.string().uuid(),
  payload: z.unknown(),
  timestamp: z.string().datetime(),
});
export type WsMessage = z.infer<typeof WsMessage>;
