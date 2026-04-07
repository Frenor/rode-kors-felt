import type { AcvpuLevel as SharedAcvpuLevel } from '@rkf/shared-types';

/**
 * Shared frontend types — replaces `any` in both dashboards.
 * Enums are re-exported from @rkf/shared-types where available.
 */

export type { AcvpuLevel, PatientStatus as PatientStatusKey } from '@rkf/shared-types';

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
  entityType: 'incident' | 'patient' | 'event' | 'team';
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

export interface IncidentEscalation {
  id?: string;
  path: string;
  reason?: string;
  createdAt?: string;
}

export interface IncidentMist {
  mechanism: string;
  injury: string;
  signs: string;
  treatment: string;
}

export interface Incident {
  id: string;
  eventId: string;
  type: string;
  status: string;
  acvpu?: string;
  triageTag?: string;
  teamId?: string;
  source?: string;
  location: GeoPoint;
  locationContext?: {
    mode: 'gps' | 'indoor_zone';
    venueId?: string;
    floorId?: string;
    zoneId?: string;
    zoneLabel?: string;
  };
  notes?: string;
  activeEscalation?: IncidentEscalation | null;
  actionHistory?: ActionHistoryEntry[];
  mist?: IncidentMist;
  createdAt: string;
  updatedAt: string;
}

export interface Team {
  id: string;
  name: string;
  transport?: string;
  gear?: string[];
  contactPhone?: string | null;
  contactRadio?: string | null;
  currentPosition?: GeoPoint | null;
}

export interface TeamWorkspacePatient {
  id: string;
  incidentId: string | null;
  status: string;
  presentingComplaint: string | null;
  updatedAt: string;
  lat: number | null;
  lon: number | null;
  positionText: string | null;
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

export type SickbayIncomingCriticalReason =
  | 'needs_assistance'
  | 'open_escalation'
  | 'triage_immediate'
  | 'news2_high';

export interface SickbayIncomingItem {
  incidentId: string;
  patientId: string | null;
  teamId: string | null;
  progressStage: string;
  critical: boolean;
  criticalReasons: SickbayIncomingCriticalReason[];
  latestVitals?: VitalsReading | null;
  news2?: { total: number; alertLevel: 'routine' | 'low' | 'medium' | 'high' } | null;
  triageTag?: string | null;
  updatedAt: string;
}

export interface DeteriorationAlert {
  patientId: string;
  news2Score: number;
  ratePerHour: number;
  receivedAt: string;
}

export interface EventStats {
  totalIncidents: number;
  activeIncidents: number;
  resolvedIncidents: number;
  totalPatients: number;
  patientsInTreatment: number;
  discharged: number;
  [key: string]: number;
}
