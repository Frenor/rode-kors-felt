/**
 * Demo mode — in-memory store
 *
 * Used when VITE_DEMO_MODE=true (GitHub Pages / offline demo).
 * No API server required. State lives in module scope for the session.
 */

const BASE = Date.now();
const minsAgo = (n: number) => new Date(BASE - n * 60_000).toISOString();

// ─── Seed data ────────────────────────────────────────────────────────────────

let incidents: any[] = [
  {
    id: 'demo-inc-1',
    eventId: 'demo-event',
    type: 'medical',
    status: 'on_scene',
    acvpu: 'alert',
    triageTag: 'delayed',
    teamId: 'team-1',
    location: { lat: 59.9139, lng: 10.7522 },
    vitals: { pulse: 88, spo2: 97, respiratoryRate: 18, painScore: 4 },
    mist: {
      mechanism: 'Hjerterelatert',
      injury: 'Ingen synlig',
      signs: 'ACVPU: alert · Puls: 88 · SpO₂: 97% · RF: 18/min · Smerte: 4/10',
      treatment: 'Ro / støtte',
    },
    createdAt: minsAgo(15),
    updatedAt: minsAgo(12),
  },
];

let patients: any[] = [
  {
    id: 'demo-pat-1',
    eventId: 'demo-event',
    ageGroup: 'adult',
    status: 'in_treatment',
    presentingComplaint: 'Brystsmerter, lett kvalme',
    assignedClinician: 'Lege Andersen',
    vitalsHistory: [
      {
        id: 'demo-v1',
        pulse: 92,
        spo2: 96,
        respiratoryRate: 20,
        painScore: 5,
        systolicBP: 135,
        temperature: 37.2,
        acvpu: 'alert',
        timestamp: minsAgo(30),
      },
      {
        id: 'demo-v2',
        pulse: 88,
        spo2: 97,
        respiratoryRate: 18,
        painScore: 4,
        systolicBP: 128,
        temperature: 37.1,
        acvpu: 'alert',
        timestamp: minsAgo(10),
      },
    ],
    latestVitals: {
      pulse: 88,
      spo2: 97,
      respiratoryRate: 18,
      painScore: 4,
      systolicBP: 128,
      temperature: 37.1,
      acvpu: 'alert',
      timestamp: minsAgo(10),
    },
    notes: [
      {
        id: 'demo-n1',
        text: 'Pasient innbrakt fra konsertområdet. Våken og orientert. EKG tatt — SR, ingen STEMI.',
        author: 'Lege Andersen',
        createdAt: minsAgo(28),
      },
    ],
    createdAt: minsAgo(35),
    updatedAt: minsAgo(10),
  },
];

const medications: Record<string, any[]> = {
  'demo-pat-1': [
    {
      id: 'demo-med-1',
      drug: 'oxygen',
      dose: '4 L/min',
      route: 'inhaled',
      givenBy: 'Lege Andersen',
      givenAt: minsAgo(25),
    },
  ],
};

const DEMO_TEAMS = [
  { id: 'team-1', name: 'Demo-lag 1' },
  { id: 'team-2', name: 'Demo-lag 2' },
];

// ─── Store ────────────────────────────────────────────────────────────────────

export const demoStore = {
  getIncidents: (_eventId: string) => ({
    incidents: [...incidents],
  }),

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

  updateIncident: (id: string, data: Record<string, unknown>) => {
    incidents = incidents.map((i) =>
      i.id === id ? { ...i, ...data, updatedAt: new Date().toISOString() } : i,
    );
    return { incident: incidents.find((i) => i.id === id) };
  },

  escalateIncident: (incidentId: string, data: { path: string; reason?: string }) => ({
    escalation: { id: `demo-esc-${Date.now()}`, incidentId, ...data, createdAt: new Date().toISOString() },
  }),

  resolveEscalation: (_incidentId: string) => ({ ok: true }),

  getPatients: (_eventId: string) => ({
    patients: [...patients],
  }),

  createPatient: (data: Record<string, unknown>) => {
    const patient = {
      id: `demo-pat-${Date.now()}`,
      status: 'incoming',
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
    return { patient: patients.find((p) => p.id === id) };
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

  getEventStats: (_eventId: string) => ({
    total: incidents.length,
    on_scene: incidents.filter((i) => i.status === 'on_scene').length,
    transporting: incidents.filter((i) => i.status === 'transporting').length,
    at_sickbay: incidents.filter((i) => i.status === 'at_sickbay').length,
    resolved: incidents.filter((i) => i.status === 'resolved').length,
  }),

  getEvent: (id: string) => ({
    event: { id, name: 'Demo-arrangement', mciActive: false, createdAt: minsAgo(120) },
    teams: DEMO_TEAMS,
  }),

  getEvents: () => ({
    events: [{ id: 'demo-event', name: 'Demo-arrangement', active: true, createdAt: minsAgo(120) }],
  }),

  toggleMci: (eventId: string, mciActive: boolean, mciSectors?: string[]) => ({
    event: { id: eventId, name: 'Demo-arrangement', mciActive, mciSectors },
  }),
};
