/**
 * In-memory data store for MVP.
 * Replaces PostgreSQL + Drizzle until infra is provisioned.
 * Same interface — swap to DB later with no route changes.
 */

import { randomUUID } from 'node:crypto';

export interface StoredEvent {
  id: string;
  name: string;
  startDate: string;
  endDate: string;
  status: 'draft' | 'active' | 'archived';
  createdAt: string;
  updatedAt: string;
}

export interface StoredTeam {
  id: string;
  eventId: string;
  name: string;
  size: number;
  transport: string;
  gear: string[];
  members: string[];
}

export interface StoredAccessCode {
  id: string;
  eventId: string;
  role: string;
  code: string;
  expiresAt: string;
  revokedAt: string | null;
}

export interface StoredUser {
  id: string;
  email: string;
  passwordHash: string;
  role: string;
}

export interface StoredIncident {
  id: string;
  eventId: string;
  teamId?: string;
  type: string;
  status: string;
  location: { lat: number; lng: number };
  avpu?: string;
  vitals?: Record<string, unknown>;
  mist?: Record<string, unknown>;
  sbar?: Record<string, unknown>;
  notes?: string;
  createdAt: string;
  updatedAt: string;
  clientId?: string;
}

export interface StoredPatient {
  id: string;
  eventId: string;
  incidentId?: string;
  status: string;
  ageGroup?: string;
  gender?: string;
  presentingComplaint?: string;
  arrivalTime: string;
  assignedClinician?: string;
  notes: Array<{ text: string; timestamp: string; author: string }>;
  diagnosisFlags: string[];
  createdAt: string;
  updatedAt: string;
}

export interface StoredVitalReading {
  id: string;
  patientId: string;
  timestamp: string;
  pulse?: number;
  spo2?: number;
  respiratoryRate?: number;
  painScore?: number;
}

class Store {
  events: Map<string, StoredEvent> = new Map();
  teams: Map<string, StoredTeam> = new Map();
  accessCodes: Map<string, StoredAccessCode> = new Map();
  users: Map<string, StoredUser> = new Map();
  incidents: Map<string, StoredIncident> = new Map();
  patients: Map<string, StoredPatient> = new Map();
  vitals: Map<string, StoredVitalReading> = new Map();
  sessions: Map<string, { userId: string; role: string; eventId?: string }> = new Map();

  constructor() {
    this.seed();
  }

  private seed() {
    const now = new Date().toISOString();
    const eventId = randomUUID();

    // Demo event
    this.events.set(eventId, {
      id: eventId,
      name: 'Holmenkollen Skimaraton 2026',
      startDate: '2026-03-21T08:00:00Z',
      endDate: '2026-03-21T18:00:00Z',
      status: 'active',
      createdAt: now,
      updatedAt: now,
    });

    // Demo teams
    const team1Id = randomUUID();
    const team2Id = randomUUID();
    this.teams.set(team1Id, {
      id: team1Id,
      eventId,
      name: 'Patrulje Alpha',
      size: 4,
      transport: 'foot',
      gear: ['AED', 'Førstehjelpssekk', 'Radio'],
      members: [],
    });
    this.teams.set(team2Id, {
      id: team2Id,
      eventId,
      name: 'Patrulje Bravo',
      size: 3,
      transport: 'atv',
      gear: ['AED', 'Førstehjelpssekk', 'Båre', 'Radio'],
      members: [],
    });

    // Access code for first aiders
    this.accessCodes.set('demo-code', {
      id: randomUUID(),
      eventId,
      role: 'first_aider',
      code: '123456',
      expiresAt: '2026-12-31T23:59:59Z',
      revokedAt: null,
    });

    // Sickbay access code
    this.accessCodes.set('sickbay-code', {
      id: randomUUID(),
      eventId,
      role: 'sickbay',
      code: '654321',
      expiresAt: '2026-12-31T23:59:59Z',
      revokedAt: null,
    });

    // Admin user
    this.users.set('admin-user', {
      id: randomUUID(),
      email: 'admin@rkf.no',
      passwordHash: 'admin123', // MVP only — hash in production
      role: 'coordinator',
    });
  }
}

export const store = new Store();
