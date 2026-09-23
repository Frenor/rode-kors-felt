import type { AcvpuLevel as SharedAcvpuLevel, FieldOutcome as SharedFieldOutcome } from '@rkf/shared-types';

/**
 * Shared frontend types — replaces `any` in both dashboards.
 * Enums are re-exported from @rkf/shared-types where available.
 */

export type { AcvpuLevel, PatientStatus as PatientStatusKey, FieldOutcome } from '@rkf/shared-types';

export interface VitalsReading {
  id?: string;
  pulse?: number;
  spo2?: number;
  respiratoryRate?: number;
  painScore?: number;
  systolicBP?: number;
  temperature?: number;
  acvpu?: SharedAcvpuLevel;
  timestamp: string;
}

export interface PatientNote {
  id: string;
  text: string;
  author: string;
  createdAt: string;
}

export interface MedicationRecord {
  id: string;
  drug: string;
  dose?: string;
  route?: string;
  givenBy?: string;
  givenAt: string;
}

export interface ActionHistoryEntry {
  id: string;
  eventId: string;
  entityType: 'patient' | 'event' | 'team';
  entityId: string;
  actionType: string;
  payload: Record<string, unknown>;
  createdAt: string;
  createdBy: string;
  revertedAt?: string;
  revertedBy?: string;
  revertReason?: string;
  undoOfActionId?: string;
}

export type AmkCriticality = 'low' | 'medium' | 'high' | 'critical';

export type TeamOperationalStatus =
  | 'available'
  | 'en_route'
  | 'on_scene'
  | 'needs_assistance'
  | 'unavailable';

export type TeamPatientStatus = 'en_route_to_patient' | 'transporting' | 'monitoring';

export type SickBayPlacementType = 'chair' | 'bed';

export interface AmkCallLog {
  id: string;
  eventId?: string;
  patientId?: string;
  calledAt: string;
  summaryGiven: string;
  amkGuidance: string;
  followUpOwner: string;
  referenceId?: string;
  eta?: string;
  recordedBy?: string;
}

export interface AmkAssistDraft {
  criticality: AmkCriticality;
  rationale: string;
  sayFirst: string[];
  spokenScript: string;
  sbarDraft: {
    situation: string;
    background: string;
    assessment: string;
    recommendation: string;
  };
}

export interface IndoorZone {
  id: string;
  label: string;
  center: GeoPoint;
}

export interface IndoorFloor {
  id: string;
  label: string;
  zones: IndoorZone[];
}

export interface EventIndoorLayout {
  venueId: string;
  venueName?: string;
  floors: IndoorFloor[];
}

export interface MapLayerConfig {
  id: string;
  type: 'xyz' | 'wmts';
  url: string;
  attribution?: string;
  token?: string;
  minZoom?: number;
  maxZoom?: number;
}

export interface MapRuntimeConfig {
  provider?: 'leaflet' | 'maplibre';
  styleUrl?: string;
  layers?: MapLayerConfig[];
  enable3d?: boolean;
}

export interface SickBayPatient {
  id: string;
  eventId: string;
  ageGroup: string;
  fullName?: string;
  birthDate?: string;
  gender?: 'male' | 'female' | 'other';
  placementType?: SickBayPlacementType;
  placementNumber?: string;
  ageYears?: number;
  status: string;
  presentingComplaint: string;
  assignedClinician: string;
  /** Field-report fields — set when the patient was reported by a patrol or the coordinator. */
  label?: string | null;
  description?: string | null;
  triageStatus?: 'green' | 'yellow' | 'red' | 'black' | null;
  positionText?: string | null;
  /** Patient position (gap A7/A9 distance line) — set from a field report. */
  lat?: number | null;
  lon?: number | null;
  assignedTeamId?: string | null;
  /** Hand-over model (gap A1) — set once the field team has handed the patient off. */
  handedOverAt?: string | null;
  handedOverByTeamId?: string | null;
  fieldOutcome?: SharedFieldOutcome | null;
  /** Shared patient number (gap A5) — human-facing `#<seq>`, see lib/patient-number.ts. */
  seq?: number | null;
  /** AMK notified (gap B2 data half). */
  amkNotifiedAt?: string | null;
  amkNotifiedBy?: string | null;
  vitalsHistory: VitalsReading[];
  latestVitals: VitalsReading | null;
  notes: PatientNote[];
  actionHistory?: ActionHistoryEntry[];
  createdAt: string;
  updatedAt: string;
}

export interface GeoPoint {
  lat: number;
  lng: number;
}

export interface Team {
  id: string;
  name: string;
  transport?: string;
  gear?: string[];
  contactPhone?: string | null;
  contactRadio?: string | null;
  currentPosition?: GeoPoint | null;
  lastPositionUpdate?: string | null;
  /** Latest team.status_set — provided by GET /events/:id and kept live via team.status_changed. */
  operationalStatus?: TeamOperationalStatus;
  statusNote?: string | null;
  statusUpdatedAt?: string | null;
  /** Event set-up (gap B5) — a stood-down team is excluded from GET /events/:id by default. */
  active?: boolean;
}

export interface TeamWorkspacePatient {
  id: string;
  status: string;
  presentingComplaint: string | null;
  label?: string | null;
  triageStatus?: 'green' | 'yellow' | 'red' | 'black' | null;
  updatedAt: string;
  lat: number | null;
  lon: number | null;
  positionText: string | null;
  teamPatientStatus?: TeamPatientStatus | null;
  latestVitals?: VitalsReading | null;
  seq?: number | null;
  handedOverAt?: string | null;
  handedOverByTeamId?: string | null;
  fieldOutcome?: SharedFieldOutcome | null;
  /** AMK notified (gap B2) — set once the field team has called 113/AMK. */
  amkNotifiedAt?: string | null;
  amkNotifiedBy?: string | null;
}

export interface TeamWorkspaceResponse {
  teamId: string;
  eventId: string;
  latestStatus: TeamOperationalStatus;
  activePatientId: string | null;
  assignedPatients: TeamWorkspacePatient[];
  monitoredPatients: TeamWorkspacePatient[];
  unassignedPatients: TeamWorkspacePatient[];
  updatedAt: string;
}

export interface TeamPatientEngagement {
  teamId: string;
  teamName: string;
  patientId: string;
  status: TeamPatientStatus;
}

export type SickbayIncomingCriticalReason =
  | 'needs_assistance'
  | 'triage_red'
  | 'news2_high';

export interface SickbayIncomingItem {
  patientId: string;
  label: string | null;
  triageStatus: 'green' | 'yellow' | 'red' | 'black' | null;
  teamId: string | null;
  critical: boolean;
  criticalReasons: SickbayIncomingCriticalReason[];
  latestVitals?: VitalsReading | null;
  news2?: { total: number; alertLevel: 'routine' | 'low' | 'medium' | 'high' } | null;
  updatedAt: string;
  seq?: number | null;
  handedOverAt?: string | null;
  handedOverByTeamId?: string | null;
  fieldOutcome?: SharedFieldOutcome | null;
  /** AMK notified (gap B2) — set once the sick bay (or the field) has called 113. */
  amkNotifiedAt?: string | null;
  amkNotifiedBy?: string | null;
}

export interface DeteriorationAlert {
  patientId: string;
  news2Score: number;
  ratePerHour: number;
  receivedAt: string;
}
export interface EventStats {
  totalPatients: number;
  patientsIncoming: number;
  patientsInTreatment: number;
  patientsObservation: number;
  discharged: number;
  transferred: number;
  [key: string]: number;
}

// ── Lane 8 batch 3 (B): chat history (gap B9 / 8.29) ────────────────────────

export interface TeamMessage {
  id: string;
  fromTeamId?: string | null;
  fromLabel?: string | null;
  /** A team uuid, the literal `'coordinator'`, or null/undefined for everyone. */
  toTeamId?: string | null;
  text: string;
  /** Set on a receipt: the id of the message it acknowledges. */
  ackOf?: string | null;
  sentAt: string;
}

// ── Lane 8 batch 3 (B): capacity settings (gap B6 / 8.30) ───────────────────

export interface EventSickbaySettings {
  chairs?: number;
  beds?: number;
}

export interface EventSettings {
  sickbay?: EventSickbaySettings;
}

// ── Lane 8 batch 3 (B): event set-up (gap B5 / 8.31) ─────────────────────────

export interface AccessCode {
  id: string;
  role: 'admin' | 'coordinator' | 'sickbay' | 'first_aider';
  code: string;
  expiresAt: string;
  revokedAt?: string | null;
}
