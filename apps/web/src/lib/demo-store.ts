import { calculateNEWS2 } from '@rkf/shared-types';
import type {
  AmkAssistDraft,
  AmkCallLog,
  AmkCriticality,
  TeamOperationalStatus,
  TeamWorkspaceResponse,
} from './types';
import { calculateAgeYears, normalizeAmkCriticality } from './constants';

/**
 * Demo mode — in-memory store
 *
 * Used when VITE_DEMO_MODE=true or ?demo=true URL parameter.
 * No API server required. State lives in module scope for the session.
 * Scenario: Holmenkollen Skimaraton 2026
 */

const BASE = Date.now();
const minsAgo = (n: number) => new Date(BASE - n * 60_000).toISOString();

// ─── Seed data ────────────────────────────────────────────────────────────────

let incidents: any[] = [
  {
    id: 'demo-inc-1',
    eventId: 'demo-event',
    type: 'trauma',
    status: 'on_scene',
    acvpu: 'voice',
    triageTag: 'immediate',
    teamId: 'team-alpha',
    source: 'field',
    location: { lat: 59.9645, lng: 10.6665 },
    vitals: { pulse: 112, spo2: 94, respiratoryRate: 24, painScore: 7 },
    mist: {
      mechanism: 'Fall under slalåm — høy hastighet',
      injury: 'Hode, bryst',
      signs: 'ACVPU: voice · Puls: 112 · SpO₂: 94% · RF: 24/min · Smerte: 7/10',
      treatment: 'Oksygen, nakke-krave, båre',
    },
    notes: 'Pasient falt i nedkjøringen, bevissthetsnivå redusert',
    createdAt: minsAgo(18),
    updatedAt: minsAgo(15),
  },
  {
    id: 'demo-inc-2',
    eventId: 'demo-event',
    type: 'medical',
    status: 'transporting',
    acvpu: 'alert',
    triageTag: 'delayed',
    teamId: 'team-bravo',
    source: 'field',
    location: { lat: 59.9658, lng: 10.6682 },
    vitals: { pulse: 88, spo2: 96, respiratoryRate: 18, painScore: 4 },
    mist: {
      mechanism: 'Hjerterelatert',
      injury: 'Ingen synlig',
      signs: 'ACVPU: alert · Puls: 88 · SpO₂: 96% · RF: 18/min · Smerte: 4/10',
      treatment: 'Aspirin, oksygen, ro/støtte',
    },
    activeEscalation: {
      id: 'demo-esc-1',
      path: 'path_b_113',
      reason: 'Mulig hjerteinfarkt — EKG-forandringer',
      createdAt: minsAgo(8),
    },
    notes: 'Eldre mann, brystsmerter under tilskuerområdet ved mål',
    createdAt: minsAgo(25),
    updatedAt: minsAgo(8),
  },
  {
    id: 'demo-inc-3',
    eventId: 'demo-event',
    type: 'psychiatric',
    status: 'dispatched',
    acvpu: 'alert',
    triageTag: null,
    teamId: 'team-charlie',
    source: 'field',
    location: { lat: 59.9622, lng: 10.6705 },
    vitals: null,
    mist: null,
    notes: 'Person i krise ved familieteltet — varslet av frivillige',
    createdAt: minsAgo(7),
    updatedAt: minsAgo(5),
  },
];

let patients: any[] = [
  {
    id: 'demo-pat-1',
    eventId: 'demo-event',
    fullName: 'Lea Hansen',
    gender: 'female',
    birthDate: '1993-09-14',
    ageYears: 32,
    ageGroup: 'adult',
    placementType: 'bed',
    placementNumber: '2',
    status: 'in_treatment',
    presentingComplaint: 'Brystsmerter, tungpust',
    assignedClinician: 'Lege Andersen',
    vitalsHistory: [
      {
        id: 'demo-v1-1',
        pulse: 82,
        spo2: 97,
        respiratoryRate: 16,
        painScore: 3,
        systolicBP: 148,
        temperature: 36.8,
        acvpu: 'alert',
        timestamp: minsAgo(45),
      },
      {
        id: 'demo-v1-2',
        pulse: 88,
        spo2: 96,
        respiratoryRate: 18,
        painScore: 4,
        systolicBP: 152,
        temperature: 37.0,
        acvpu: 'alert',
        timestamp: minsAgo(30),
      },
      {
        id: 'demo-v1-3',
        pulse: 96,
        spo2: 94,
        respiratoryRate: 20,
        painScore: 5,
        systolicBP: 158,
        temperature: 37.2,
        acvpu: 'alert',
        timestamp: minsAgo(10),
      },
    ],
    latestVitals: {
      id: 'demo-v1-3',
      pulse: 96,
      spo2: 94,
      respiratoryRate: 20,
      painScore: 5,
      systolicBP: 158,
      temperature: 37.2,
      acvpu: 'alert',
      timestamp: minsAgo(10),
    },
    notes: [
      {
        id: 'demo-n1-1',
        text: 'Pasient innbrakt fra tilskuerområdet ved mål. Våken og orientert. EKG viser ST-elevasjoner V2-V4.',
        author: 'Lege Andersen',
        createdAt: minsAgo(42),
      },
      {
        id: 'demo-n1-2',
        text: 'Aspirin 300mg gitt oralt. Oksygen 4L/min. AMK varslet — ambulanse ETA 12 min.',
        author: 'Sykepleier Bakke',
        createdAt: minsAgo(28),
      },
    ],
    createdAt: minsAgo(50),
    updatedAt: minsAgo(10),
  },
  {
    id: 'demo-pat-2',
    eventId: 'demo-event',
    fullName: 'Karianne Strøm',
    gender: 'female',
    birthDate: '1957-04-21',
    ageYears: 66,
    ageGroup: 'elderly',
    placementType: 'chair',
    placementNumber: '7',
    status: 'in_treatment',
    presentingComplaint: 'Hypoglykemi, svimmelhet',
    assignedClinician: 'Sykepleier Bakke',
    vitalsHistory: [
      {
        id: 'demo-v2-1',
        pulse: 78,
        spo2: 98,
        respiratoryRate: 14,
        painScore: 2,
        systolicBP: 122,
        temperature: 36.5,
        acvpu: 'confused',
        timestamp: minsAgo(20),
      },
      {
        id: 'demo-v2-2',
        pulse: 74,
        spo2: 99,
        respiratoryRate: 14,
        painScore: 1,
        systolicBP: 120,
        temperature: 36.6,
        acvpu: 'alert',
        timestamp: minsAgo(5),
      },
    ],
    latestVitals: {
      id: 'demo-v2-2',
      pulse: 74,
      spo2: 99,
      respiratoryRate: 14,
      painScore: 1,
      systolicBP: 120,
      temperature: 36.6,
      acvpu: 'alert',
      timestamp: minsAgo(5),
    },
    notes: [
      {
        id: 'demo-n2-1',
        text: 'Eldre kvinne fra publikum. Besvimte nær inngang. Blodsukker 2.8 mmol/L ved ankomst.',
        author: 'Sykepleier Bakke',
        createdAt: minsAgo(22),
      },
    ],
    createdAt: minsAgo(25),
    updatedAt: minsAgo(5),
  },
  {
    id: 'demo-pat-3',
    eventId: 'demo-event',
    fullName: 'Aksel Berg',
    gender: 'male',
    birthDate: '2007-02-14',
    ageYears: 19,
    ageGroup: 'adolescent',
    placementType: 'chair',
    placementNumber: '3',
    status: 'observation',
    presentingComplaint: 'Hypotermi, lett forfrysning',
    assignedClinician: 'Lege Andersen',
    vitalsHistory: [
      {
        id: 'demo-v3-1',
        pulse: 58,
        spo2: 98,
        respiratoryRate: 12,
        painScore: 1,
        systolicBP: 108,
        temperature: 35.2,
        acvpu: 'alert',
        timestamp: minsAgo(35),
      },
    ],
    latestVitals: {
      id: 'demo-v3-1',
      pulse: 58,
      spo2: 98,
      respiratoryRate: 12,
      painScore: 1,
      systolicBP: 108,
      temperature: 35.2,
      acvpu: 'alert',
      timestamp: minsAgo(35),
    },
    notes: [
      {
        id: 'demo-n3-1',
        text: 'Tenåring — ble funnet sittende i snøen etter å ha mistet gruppen. Varmes opp gradvis.',
        author: 'Lege Andersen',
        createdAt: minsAgo(33),
      },
    ],
    createdAt: minsAgo(38),
    updatedAt: minsAgo(35),
  },
  {
    id: 'demo-pat-4',
    eventId: 'demo-event',
    fullName: 'Sofia Nilsen',
    gender: 'female',
    birthDate: '1988-11-05',
    ageYears: 37,
    ageGroup: 'adult',
    placementType: 'chair',
    placementNumber: '11',
    status: 'incoming',
    presentingComplaint: 'Bruddmistanke ankel',
    assignedClinician: '',
    vitalsHistory: [],
    latestVitals: null,
    notes: [],
    createdAt: minsAgo(3),
    updatedAt: minsAgo(3),
  },
];

const medications: Record<string, any[]> = {
  'demo-pat-1': [
    {
      id: 'demo-med-1-1',
      drug: 'oxygen',
      dose: '4 L/min',
      route: 'inhaled',
      givenBy: 'Lege Andersen',
      givenAt: minsAgo(40),
    },
    {
      id: 'demo-med-1-2',
      drug: 'Aspirin',
      dose: '300 mg',
      route: 'oral',
      givenBy: 'Lege Andersen',
      givenAt: minsAgo(28),
    },
  ],
  'demo-pat-2': [
    {
      id: 'demo-med-2-1',
      drug: 'Glukose 50%',
      dose: '50 ml',
      route: 'iv',
      givenBy: 'Sykepleier Bakke',
      givenAt: minsAgo(18),
    },
  ],
};

const DEMO_TEAMS = [
  { id: 'team-alpha',   name: 'Alpha',   transport: 'foot',    currentPosition: { lat: 59.9645, lng: 10.6660 } },
  { id: 'team-bravo',   name: 'Bravo',   transport: 'bike',    currentPosition: { lat: 59.9655, lng: 10.6682 } },
  { id: 'team-charlie', name: 'Charlie', transport: 'foot',    currentPosition: { lat: 59.9622, lng: 10.6702 } },
  { id: 'team-delta',   name: 'Delta',   transport: 'atv',     currentPosition: { lat: 59.9608, lng: 10.6720 } },
  { id: 'team-echo',    name: 'Echo',    transport: 'vehicle', currentPosition: { lat: 59.9672, lng: 10.6638 } },
  { id: 'team-foxtrot', name: 'Foxtrot', transport: 'foot',    currentPosition: null },
];

const teamWorkspaceState: Record<string, {
  latestStatus: TeamOperationalStatus;
  monitoredPatientIds: string[];
  activePatientId: string | null;
}> = Object.fromEntries(
  DEMO_TEAMS.map((team) => [
    team.id,
    { latestStatus: 'available' as TeamOperationalStatus, monitoredPatientIds: [], activePatientId: null },
  ]),
);

let demoEvent: any = {
  id: 'demo-event',
  name: 'Holmenkollen Skimaraton 2026',
  mciActive: false,
  mciActivatedBy: null,
  mciSummaryHtml: null as string | null,
  createdAt: minsAgo(120),
};

let actionEvents: any[] = [];

const createAction = (params: {
  eventId: string;
  entityType: 'incident' | 'patient' | 'event' | 'team';
  entityId: string;
  actionType: string;
  payload: Record<string, unknown>;
  undoOfActionId?: string;
}) => {
  const action = {
    id: `demo-action-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    eventId: params.eventId,
    entityType: params.entityType,
    entityId: params.entityId,
    actionType: params.actionType,
    payload: params.payload,
    createdAt: new Date().toISOString(),
    createdBy: 'demo-user',
    undoOfActionId: params.undoOfActionId,
  };
  actionEvents = [action, ...actionEvents];
  return action;
};

const ensureTeamState = (teamId: string) => {
  if (!teamWorkspaceState[teamId]) {
    teamWorkspaceState[teamId] = {
      latestStatus: 'available',
      monitoredPatientIds: [],
      activePatientId: null,
    };
  }
  return teamWorkspaceState[teamId]!;
};

const mapWithHistory = (entityType: 'incident' | 'patient', entity: any) => ({
  ...entity,
  actionHistory: actionEvents.filter((a) => a.entityType === entityType && a.entityId === entity.id),
});

const mapCriticality = (score: number): AmkCriticality => {
  if (score >= 7) return 'critical';
  if (score >= 5) return 'high';
  if (score >= 3) return 'medium';
  return 'low';
};

const getLatestVitalsSummary = (patient: any) => {
  const latestVitals = patient.latestVitals ?? patient.vitalsHistory?.[0] ?? null;
  if (!latestVitals) {
    return {
      news2Text: 'NEWS2 ikke tilgjengelig',
      vitalsSummary: 'Ingen vitale tegn registrert ennå',
      criticality: 'low' as AmkCriticality,
    };
  }

  const news = calculateNEWS2({
    respiratoryRate: latestVitals.respiratoryRate ?? undefined,
    spo2: latestVitals.spo2 ?? undefined,
    systolicBP: latestVitals.systolicBP ?? undefined,
    pulse: latestVitals.pulse ?? undefined,
    acvpu: latestVitals.acvpu ?? undefined,
    temperature: latestVitals.temperature ?? undefined,
    onSupplementalOxygen: latestVitals.onSupplementalOxygen ?? undefined,
  });

  const vitalsSummary = [
    latestVitals.pulse != null ? `Puls ${latestVitals.pulse}` : null,
    latestVitals.spo2 != null ? `SpO₂ ${latestVitals.spo2}%` : null,
    latestVitals.respiratoryRate != null ? `RF ${latestVitals.respiratoryRate}` : null,
    latestVitals.systolicBP != null ? `BT ${latestVitals.systolicBP}` : null,
    latestVitals.temperature != null ? `Temp ${latestVitals.temperature}` : null,
    latestVitals.acvpu ? `ACVPU ${latestVitals.acvpu}` : null,
  ].filter(Boolean).join(', ');

  return {
    news2Text: `NEWS2 ${news.total}`,
    vitalsSummary,
    criticality: mapCriticality(news.total),
  };
};

// ─── Store ────────────────────────────────────────────────────────────────────

export const demoStore = {
  getIncidents: (_eventId: string) => ({
    incidents: incidents.map((i) => mapWithHistory('incident', i)),
  }),

  postTeamAction: (
    teamId: string,
    data:
      | { type: 'team.status_set'; status: TeamOperationalStatus; incidentId?: string; note?: string; clientActionId: string }
      | { type: 'team.monitor_started'; patientId: string; clientActionId: string }
      | { type: 'team.monitor_stopped'; patientId: string; clientActionId: string },
  ) => {
    const teamState = ensureTeamState(teamId);
    if (data.type === 'team.status_set') {
      teamState.latestStatus = data.status;
    } else if (data.type === 'team.monitor_started') {
      if (!teamState.monitoredPatientIds.includes(data.patientId)) {
        teamState.monitoredPatientIds.push(data.patientId);
      }
      teamState.activePatientId = data.patientId;
    } else if (data.type === 'team.monitor_stopped') {
      teamState.monitoredPatientIds = teamState.monitoredPatientIds.filter((id) => id !== data.patientId);
      if (teamState.activePatientId === data.patientId) {
        teamState.activePatientId = null;
      }
    }

    const action = createAction({
      eventId: 'demo-event',
      entityType: 'team',
      entityId: teamId,
      actionType: data.type,
      payload: { ...data },
    });
    return { action };
  },

  getTeamWorkspace: (teamId: string): TeamWorkspaceResponse => {
    const teamState = ensureTeamState(teamId);
    const teamIncidentIds = incidents.filter((incident) => incident.teamId === teamId).map((incident) => incident.id);
    const assignedPatients = patients.filter((patient) => patient.incidentId && teamIncidentIds.includes(patient.incidentId));
    const assignedSet = new Set(assignedPatients.map((patient) => patient.id));
    const monitoredPatients = patients.filter(
      (patient) => teamState.monitoredPatientIds.includes(patient.id) && !assignedSet.has(patient.id),
    );
    const monitoredSet = new Set(monitoredPatients.map((patient) => patient.id));
    const unassignedPatients = patients.filter((patient) => !assignedSet.has(patient.id) && !monitoredSet.has(patient.id));

    return {
      teamId,
      eventId: 'demo-event',
      latestStatus: teamState.latestStatus,
      activePatientId: teamState.activePatientId,
      assignedPatients: assignedPatients.map((patient) => ({
        id: patient.id,
        incidentId: patient.incidentId ?? null,
        status: patient.status,
        presentingComplaint: patient.presentingComplaint ?? null,
        updatedAt: patient.updatedAt,
      })),
      monitoredPatients: monitoredPatients.map((patient) => ({
        id: patient.id,
        incidentId: patient.incidentId ?? null,
        status: patient.status,
        presentingComplaint: patient.presentingComplaint ?? null,
        updatedAt: patient.updatedAt,
      })),
      unassignedPatients: unassignedPatients.map((patient) => ({
        id: patient.id,
        incidentId: patient.incidentId ?? null,
        status: patient.status,
        presentingComplaint: patient.presentingComplaint ?? null,
        updatedAt: patient.updatedAt,
      })),
      updatedAt: new Date().toISOString(),
    };
  },

  getSickbayIncoming: (_eventId: string) => {
    const incomingStatuses = new Set(['dispatched', 'on_scene', 'transporting', 'at_sickbay']);
    const items = incidents
      .filter((incident) => incomingStatuses.has(incident.status))
      .map((incident) => {
        const patient = patients.find((row) => row.incidentId === incident.id) ?? null;
        const latestVitals = patient?.latestVitals ?? null;
        const news2 = latestVitals ? calculateNEWS2(latestVitals) : null;
        const teamState = incident.teamId ? ensureTeamState(incident.teamId) : null;
        const criticalReasons: Array<'needs_assistance' | 'open_escalation' | 'triage_immediate' | 'news2_high'> = [];
        if (teamState?.latestStatus === 'needs_assistance') criticalReasons.push('needs_assistance');
        if (incident.activeEscalation) criticalReasons.push('open_escalation');
        if (incident.triageTag === 'immediate') criticalReasons.push('triage_immediate');
        if (news2?.alertLevel === 'high') criticalReasons.push('news2_high');

        return {
          incidentId: incident.id,
          patientId: patient?.id ?? null,
          teamId: incident.teamId ?? null,
          progressStage: incident.status,
          critical: criticalReasons.length > 0,
          criticalReasons,
          latestVitals,
          news2: news2 ? { total: news2.total, alertLevel: news2.alertLevel } : null,
          triageTag: incident.triageTag ?? null,
          updatedAt: incident.updatedAt,
        };
      })
      .sort((a, b) => Number(b.critical) - Number(a.critical) || new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime());
    return { items };
  },

  createIncident: (data: Record<string, unknown>) => {
    const incident = {
      id: `demo-inc-${Date.now()}`,
      status: 'on_scene',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      ...data,
    };
    incidents = [incident, ...incidents];
    return { incident };
  },

  getPatients: (_eventId: string) => ({
    patients: patients.map((p) => mapWithHistory('patient', p)),
  }),

  createPatient: (data: Record<string, unknown>) => {
    const fullName = typeof data.fullName === 'string'
      ? data.fullName
      : (typeof data.name === 'string' ? data.name : '');
    const birthDate = typeof data.birthDate === 'string' && data.birthDate ? data.birthDate : undefined;
    const ageYears = typeof data.ageYears === 'number'
      ? data.ageYears
      : (calculateAgeYears(birthDate) ?? undefined);
    const gender = data.gender === 'male' || data.gender === 'female' || data.gender === 'other'
      ? data.gender
      : undefined;
    const patient = {
      id: `demo-pat-${Date.now()}`,
      status: 'incoming',
      fullName,
      birthDate,
      ageYears,
      gender,
      vitalsHistory: [],
      latestVitals: null,
      notes: [],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      ...data,
    };
    patients = [patient, ...patients];
    return { patient };
  },

  updatePatient: (id: string, data: Record<string, unknown>) => {
    patients = patients.map((p) =>
      p.id === id ? { ...p, ...data, updatedAt: new Date().toISOString() } : p,
    );
    const patient = patients.find((p) => p.id === id);
    return { patient: patient ? mapWithHistory('patient', patient) : undefined };
  },

  executeIncidentAction: (
    incidentId: string,
    data:
      | { type: 'status.set'; status: string }
      | { type: 'escalation.raise'; path: string; reason?: string }
      | { type: 'escalation.resolve' }
      | { type: 'escalation.reopen'; escalationId?: string },
  ) => {
    const incident = incidents.find((i) => i.id === incidentId);
    if (!incident) throw new Error('Hendelse ikke funnet');

    if (data.type === 'status.set') {
      const previousStatus = incident.status;
      incidents = incidents.map((i) =>
        i.id === incidentId ? { ...i, status: data.status, updatedAt: new Date().toISOString() } : i,
      );
      const updated = incidents.find((i) => i.id === incidentId)!;
      const action = createAction({
        eventId: updated.eventId,
        entityType: 'incident',
        entityId: updated.id,
        actionType: 'incident.status_set',
        payload: { previousStatus, nextStatus: data.status },
      });
      return { incident: mapWithHistory('incident', updated), action };
    }

    if (data.type === 'escalation.raise') {
      const escalation = {
        id: `demo-esc-${Date.now()}`,
        incidentId,
        path: data.path,
        reason: data.reason,
        raisedAt: new Date().toISOString(),
      };
      incidents = incidents.map((i) =>
        i.id === incidentId ? { ...i, activeEscalation: escalation, updatedAt: new Date().toISOString() } : i,
      );
      const updated = incidents.find((i) => i.id === incidentId)!;
      const action = createAction({
        eventId: updated.eventId,
        entityType: 'incident',
        entityId: updated.id,
        actionType: 'incident.escalation_raised',
        payload: { escalationId: escalation.id, path: escalation.path, reason: escalation.reason ?? null },
      });
      return { escalation, action };
    }

    if (data.type === 'escalation.resolve') {
      const activeEscalation = incident.activeEscalation;
      if (!activeEscalation) throw new Error('Ingen aktiv eskalering funnet');
      incidents = incidents.map((i) =>
        i.id === incidentId ? { ...i, activeEscalation: null, updatedAt: new Date().toISOString() } : i,
      );
      const updated = incidents.find((i) => i.id === incidentId)!;
      const action = createAction({
        eventId: updated.eventId,
        entityType: 'incident',
        entityId: updated.id,
        actionType: 'incident.escalation_resolved',
        payload: { escalation: activeEscalation, escalationId: activeEscalation.id },
      });
      return { ok: true, action };
    }

    const latestEscalationAction = actionEvents.find((a) =>
      a.entityType === 'incident'
      && a.entityId === incidentId
      && a.actionType === 'incident.escalation_resolved',
    );
    const escalation = latestEscalationAction?.payload?.escalation;
    if (!escalation) throw new Error('Eskalering ikke funnet');
    incidents = incidents.map((i) =>
      i.id === incidentId ? { ...i, activeEscalation: escalation, updatedAt: new Date().toISOString() } : i,
    );
    const updated = incidents.find((i) => i.id === incidentId)!;
    const action = createAction({
      eventId: updated.eventId,
      entityType: 'incident',
      entityId: updated.id,
      actionType: 'incident.escalation_reopened',
      payload: { escalationId: escalation.id },
    });
    return { escalation, action };
  },

  executePatientAction: (patientId: string, data: { type: 'status.set'; status: string }) => {
    const patient = patients.find((p) => p.id === patientId);
    if (!patient) throw new Error('Pasient ikke funnet');
    const previousStatus = patient.status;
    patients = patients.map((p) =>
      p.id === patientId ? { ...p, status: data.status, updatedAt: new Date().toISOString() } : p,
    );
    const updated = patients.find((p) => p.id === patientId)!;
    const action = createAction({
      eventId: updated.eventId,
      entityType: 'patient',
      entityId: updated.id,
      actionType: 'patient.status_set',
      payload: { previousStatus, nextStatus: data.status },
    });
    return { patient: mapWithHistory('patient', updated), action };
  },

  undoAction: (actionId: string, reason?: string) => {
    const target = actionEvents.find((a) => a.id === actionId);
    if (!target) throw new Error('Handling ikke funnet');
    if (target.revertedAt) throw new Error('Handling er allerede angret');

    let undoResult: any;
    if (target.actionType === 'incident.status_set') {
      undoResult = demoStore.executeIncidentAction(target.entityId, {
        type: 'status.set',
        status: target.payload.previousStatus,
      });
      undoResult.action.actionType = 'incident.status_undo';
      undoResult.action.undoOfActionId = target.id;
    } else if (target.actionType === 'incident.escalation_raised') {
      undoResult = demoStore.executeIncidentAction(target.entityId, { type: 'escalation.resolve' });
      undoResult.action.actionType = 'incident.escalation_raise_undo';
      undoResult.action.undoOfActionId = target.id;
    } else if (target.actionType === 'incident.escalation_resolved') {
      undoResult = demoStore.executeIncidentAction(target.entityId, { type: 'escalation.reopen' });
      undoResult.action.actionType = 'incident.escalation_resolve_undo';
      undoResult.action.undoOfActionId = target.id;
    } else if (target.actionType === 'patient.status_set') {
      undoResult = demoStore.executePatientAction(target.entityId, {
        type: 'status.set',
        status: target.payload.previousStatus,
      });
      undoResult.action.actionType = 'patient.status_undo';
      undoResult.action.undoOfActionId = target.id;
    } else {
      throw new Error('Kan ikke angre denne handlingen');
    }

    target.revertedAt = new Date().toISOString();
    target.revertedBy = 'demo-user';
    target.revertReason = reason;

    return {
      undoneAction: target,
      undoAction: undoResult.action,
      result: undoResult,
    };
  },

  addPatientNote: (patientId: string, text: string, author: string) => {
    const note = { id: `demo-note-${Date.now()}`, text, author, createdAt: new Date().toISOString() };
    patients = patients.map((p) =>
      p.id === patientId
        ? { ...p, notes: [...(p.notes ?? []), note], updatedAt: new Date().toISOString() }
        : p,
    );
    return { patient: patients.find((p) => p.id === patientId) };
  },

  recordVitals: (patientId: string, vitals: Record<string, number | undefined>) => {
    const entry = { id: `demo-v-${Date.now()}`, ...vitals, timestamp: new Date().toISOString() };
    patients = patients.map((p) =>
      p.id === patientId
        ? {
            ...p,
            latestVitals: entry,
            vitalsHistory: [entry, ...(p.vitalsHistory ?? [])],
            updatedAt: new Date().toISOString(),
          }
        : p,
    );
    return { vitals: entry };
  },

  recordMedication: (patientId: string, data: Record<string, unknown>) => {
    const medication = { id: `demo-med-${Date.now()}`, ...data, givenAt: new Date().toISOString() };
    medications[patientId] = [medication, ...(medications[patientId] ?? [])];
    return { medication };
  },

  getMedications: (patientId: string) => ({
    medications: medications[patientId] ?? [],
  }),

  getAmkCallLogs: (patientId: string) => ({
    callLogs: actionEvents
      .filter((action) =>
        action.entityType === 'patient'
        && action.entityId === patientId
        && action.actionType === 'patient.amk_call_logged',
      )
      .map((action) => (action.payload as { callLog?: AmkCallLog }).callLog)
      .filter((callLog): callLog is AmkCallLog => Boolean(callLog))
      .sort((a, b) => new Date(b.calledAt).getTime() - new Date(a.calledAt).getTime()),
  }),

  createAmkCallLog: (
    patientId: string,
    data: {
      summaryGiven: string;
      amkGuidance: string;
      followUpOwner: string;
      referenceId?: string;
      eta?: string;
      calledAt?: string;
    },
  ) => {
    const patient = patients.find((p) => p.id === patientId);
    if (!patient) throw new Error('Pasient ikke funnet');
    const callLog: AmkCallLog = {
      id: `demo-amk-${Date.now()}`,
      eventId: patient.eventId,
      patientId,
      calledAt: (data.calledAt ? new Date(data.calledAt) : new Date()).toISOString(),
      summaryGiven: data.summaryGiven.trim(),
      amkGuidance: data.amkGuidance.trim(),
      followUpOwner: data.followUpOwner.trim(),
      referenceId: data.referenceId?.trim() || undefined,
      eta: data.eta?.trim() || undefined,
      recordedBy: 'demo-user',
    };
    const action = createAction({
      eventId: patient.eventId,
      entityType: 'patient',
      entityId: patientId,
      actionType: 'patient.amk_call_logged',
      payload: { callLog },
    });
    return { callLog, action };
  },

  generateAmkAssistDraft: (patientId: string) => {
    const patient = patients.find((p) => p.id === patientId);
    if (!patient) throw new Error('Pasient ikke funnet');
    const { news2Text, vitalsSummary, criticality } = getLatestVitalsSummary(patient);
    const condition = patient.presentingComplaint ?? 'Uavklart problemstilling';
    const draft: AmkAssistDraft = {
      criticality,
      rationale: `${news2Text}. Kliniske funn tilsier ${criticality} prioritet.`,
      sayFirst: [
        `Dette er sykestue på arrangement, pasient med ${condition}.`,
        `Kritikalitet vurderes som ${criticality.toUpperCase()} basert på ${news2Text}.`,
        `Siste vitale tegn: ${vitalsSummary}.`,
      ],
      spokenScript: [
        `Hei, dette er Røde Kors sykestue.`,
        `Vi ringer om en pasient med ${condition}.`,
        `Vi vurderer kritikalitet som ${criticality} (${news2Text}).`,
        `Siste observasjoner: ${vitalsSummary}.`,
        `Vi trenger AMK-råd for videre håndtering og transport.`,
      ].join(' '),
      sbarDraft: {
        situation: `Pasient med ${condition}.`,
        background: patient.notes?.length
          ? `Tidligere notater: ${patient.notes.slice(-1)[0]?.text ?? 'Ingen'}`
          : 'Ingen kjente tilleggsopplysninger.',
        assessment: `${news2Text}. ${vitalsSummary}.`,
        recommendation: 'Ønsker AMK-vurdering av hastegrad og transportnivå.',
      },
    };
    createAction({
      eventId: patient.eventId,
      entityType: 'patient',
      entityId: patientId,
      actionType: 'patient.amk_ai_draft_generated',
      payload: { draft },
    });
    return draft;
  },

  confirmAmkAssist: (patientId: string, draft: AmkAssistDraft, spokenScript: string) => {
    const patient = patients.find((p) => p.id === patientId);
    if (!patient) throw new Error('Pasient ikke funnet');
    const confirmed = {
      criticality: normalizeAmkCriticality(draft.criticality),
      spokenScript: spokenScript.trim(),
      rationale: draft.rationale,
      sayFirst: draft.sayFirst,
      sbarDraft: draft.sbarDraft,
      confirmedAt: new Date().toISOString(),
      confirmedBy: 'demo-user',
    };
    const action = createAction({
      eventId: patient.eventId,
      entityType: 'patient',
      entityId: patientId,
      actionType: 'patient.amk_ai_script_confirmed',
      payload: { confirmed },
    });
    return { ok: true, action, confirmed };
  },

  getEventStats: (_eventId: string) => ({
    totalIncidents: incidents.length,
    activeIncidents: incidents.filter((i) => i.status !== 'resolved').length,
    resolvedIncidents: incidents.filter((i) => i.status === 'resolved').length,
    totalPatients: patients.length,
    patientsInTreatment: patients.filter((p) => p.status === 'in_treatment').length,
    discharged: patients.filter((p) => p.status === 'discharged' || p.status === 'transferred').length,
  }),

  getEvent: (_id: string) => ({
    event: { ...demoEvent },
    teams: DEMO_TEAMS,
  }),

  getEvents: () => ({
    events: [{ id: demoEvent.id, name: demoEvent.name, active: demoEvent.active, createdAt: demoEvent.createdAt }],
  }),

  toggleMci: (eventId: string, mciActive: boolean, mciSectors?: string[]) => {
    if (!mciActive) {
      const triage = incidents.reduce(
        (acc, incident) => {
          const key = incident.triageTag ?? 'untagged';
          acc[key] = (acc[key] ?? 0) + 1;
          return acc;
        },
        { immediate: 0, delayed: 0, minor: 0, expectant: 0, untagged: 0 } as Record<string, number>,
      );

      demoEvent.mciSummaryHtml = `<!doctype html><html lang="nb"><head><meta charset="utf-8"><title>MCI-overlevering</title><style>body{font-family:Arial,sans-serif;margin:24px}table{border-collapse:collapse;width:100%}td,th{border:1px solid #ddd;padding:8px}</style></head><body><h1>MCI-overlevering (demo)</h1><p>Arrangement: ${demoEvent.name}</p><p>Generert: ${new Date().toLocaleString('nb-NO')}</p><table><thead><tr><th>Triage</th><th>Antall</th></tr></thead><tbody><tr><td>Umiddelbar</td><td>${triage.immediate}</td></tr><tr><td>Utsatt</td><td>${triage.delayed}</td></tr><tr><td>Mindre</td><td>${triage.minor}</td></tr><tr><td>Forventet</td><td>${triage.expectant}</td></tr><tr><td>Uklassifisert</td><td>${triage.untagged}</td></tr></tbody></table></body></html>`;
    }
    demoEvent = {
      ...demoEvent,
      id: eventId,
      mciActive,
      mciSectors: mciSectors ?? demoEvent.mciSectors,
      mciActivatedBy: mciActive ? 'Koordinator' : null,
    };
    return { event: { ...demoEvent } };
  },

  downloadMciSummary: (_eventId: string): Blob => {
    const html = demoEvent.mciSummaryHtml ?? '<html><body><h1>Ingen MCI-overlevering ennå</h1></body></html>';
    return new Blob([html], { type: 'text/html' });
  },
};
