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

export const IncidentType = z.enum(['medical', 'trauma', 'psychiatric', 'other']);
export type IncidentType = z.infer<typeof IncidentType>;

export const AcvpuLevel = z.enum(['alert', 'confused', 'voice', 'pain', 'unresponsive']);
export type AcvpuLevel = z.infer<typeof AcvpuLevel>;

export const IncidentStatus = z.enum([
  'dispatched',
  'on_scene',
  'transporting',
  'at_sickbay',
  'handed_over',
  'resolved',
]);
export type IncidentStatus = z.infer<typeof IncidentStatus>;

export const IncidentSource = z.enum(['field', 'coordinator']);
export type IncidentSource = z.infer<typeof IncidentSource>;

export const PatientStatus = z.enum([
  'incoming',
  'in_treatment',
  'observation',
  'discharged',
  'transferred',
]);
export type PatientStatus = z.infer<typeof PatientStatus>;

export const TeamTransport = z.enum(['foot', 'bike', 'vehicle', 'atv']);
export type TeamTransport = z.infer<typeof TeamTransport>;

export const EscalationType = z.enum(['auto', 'manual']);
export type EscalationType = z.infer<typeof EscalationType>;

export const EscalationPath = z.enum(['path_a_rk_ambulance', 'path_b_113']);
export type EscalationPath = z.infer<typeof EscalationPath>;

// START triage tags (Mass Casualty Incident)
export const TriageTag = z.enum(['immediate', 'delayed', 'minor', 'expectant']);
export type TriageTag = z.infer<typeof TriageTag>;

// ═══════════════════════════════════════════════
// CORE SCHEMAS
// ═══════════════════════════════════════════════

export const GeoPoint = z.object({
  lat: z.number().min(-90).max(90),
  lng: z.number().min(-180).max(180),
});
export type GeoPoint = z.infer<typeof GeoPoint>;

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

export const Incident = z.object({
  id: z.string().uuid(),
  eventId: z.string().uuid(),
  teamId: z.string().uuid().optional(),
  type: IncidentType,
  status: IncidentStatus,
  source: IncidentSource.default('field'),
  location: GeoPoint,
  acvpu: AcvpuLevel.optional(),
  vitals: VitalReading.optional(),
  mist: MistForm.optional(),
  sbar: SbarForm.optional(),
  triageTag: TriageTag.optional(),
  notes: z.string().max(2000).optional(),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
  syncedAt: z.string().datetime().optional(),
});
export type Incident = z.infer<typeof Incident>;

export const MciMode = z.object({
  mciActive: z.boolean(),
  mciActivatedAt: z.string().datetime().optional(),
  mciActivatedBy: z.string().optional(),
  mciSectors: z.array(z.string()).default([]),
});
export type MciMode = z.infer<typeof MciMode>;

export const Patient = z.object({
  id: z.string().uuid(),
  eventId: z.string().uuid(),
  incidentId: z.string().uuid().optional(),
  status: PatientStatus,
  ageGroup: z.enum(['child', 'adolescent', 'adult', 'elderly']).optional(),
  gender: z.enum(['male', 'female', 'other']).optional(),
  presentingComplaint: z.string().max(500).optional(),
  arrivalTime: z.string().datetime(),
  assignedClinician: z.string().max(100).optional(),
  notes: z.array(z.object({
    text: z.string().max(2000),
    timestamp: z.string().datetime(),
    author: z.string().max(100),
  })),
  diagnosisFlags: z.array(z.string()),
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

export const CreateIncidentRequest = Incident.pick({
  type: true,
  location: true,
  acvpu: true,
  notes: true,
  source: true,
}).extend({
  teamId: z.string().uuid().optional(),
  vitals: VitalReading.omit({ id: true, patientId: true, timestamp: true }).optional(),
  mist: MistForm.optional(),
});

// ═══════════════════════════════════════════════
// ESCALATION SCHEMAS
// ═══════════════════════════════════════════════

export const Escalation = z.object({
  id: z.string().uuid(),
  incidentId: z.string().uuid(),
  eventId: z.string().uuid(),
  path: EscalationPath,
  reason: z.string().max(500).optional(),
  raisedAt: z.string().datetime(),
  resolvedAt: z.string().datetime().optional(),
  raisedBy: z.string(),
});
export type Escalation = z.infer<typeof Escalation>;

export const CreateEscalationRequest = z.object({
  path: EscalationPath,
  reason: z.string().max(500).optional(),
});
export type CreateEscalationRequest = z.infer<typeof CreateEscalationRequest>;

// ═══════════════════════════════════════════════
// WEBSOCKET PAYLOAD SCHEMAS
// ═══════════════════════════════════════════════

export const TeamPositionPayload = z.object({
  teamId: z.string().uuid(),
  position: GeoPoint,
});
export type TeamPositionPayload = z.infer<typeof TeamPositionPayload>;

// ═══════════════════════════════════════════════
// WEBSOCKET EVENT TYPES
// ═══════════════════════════════════════════════

export const WsEventType = z.enum([
  'incident.created',
  'incident.updated',
  'team.position',
  'team.sector_assigned',
  'team.message',
  'escalation.raised',
  'escalation.resolved',
  'patient.vitals_updated',
  'patient.deterioration_alert',
  'event.mci_activated',
  'event.mci_deactivated',
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
