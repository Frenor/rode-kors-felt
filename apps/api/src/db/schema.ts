/**
 * Drizzle ORM schema for RKF.
 *
 * Source of truth for table definitions. Used by:
 *  - drizzle-kit to generate/run migrations
 *  - Application code for type-safe queries
 */

import {
  boolean,
  integer,
  jsonb,
  pgEnum,
  pgTable,
  real,
  text,
  timestamp,
  uuid,
  varchar,
} from 'drizzle-orm/pg-core';

// ─── Enums ───────────────────────────────────────────────────────

export const eventStatusEnum = pgEnum('event_status', ['draft', 'active', 'archived']);
export const userRoleEnum = pgEnum('user_role', ['admin', 'coordinator', 'sickbay', 'first_aider']);
export const teamTransportEnum = pgEnum('team_transport', ['foot', 'bike', 'vehicle', 'atv']);
export const teamOperationalStatusEnum = pgEnum('team_operational_status', [
  'available',
  'en_route',
  'on_scene',
  'needs_assistance',
  'unavailable',
]);
export const incidentTypeEnum = pgEnum('incident_type', ['medical', 'trauma', 'psychiatric', 'other']);
export const incidentStatusEnum = pgEnum('incident_status', [
  'dispatched', 'on_scene', 'transporting', 'at_sickbay', 'handed_over', 'resolved',
]);
export const incidentSourceEnum = pgEnum('incident_source', ['field', 'coordinator']);
export const acvpuEnum = pgEnum('acvpu_level', ['alert', 'confused', 'voice', 'pain', 'unresponsive']);
export const patientStatusEnum = pgEnum('patient_status', [
  'incoming', 'in_treatment', 'observation', 'discharged', 'transferred',
]);
export const escalationPathEnum = pgEnum('escalation_path', ['path_a_rk_ambulance', 'path_b_113']);
export const triageTagEnum = pgEnum('triage_tag', ['immediate', 'delayed', 'minor', 'expectant']);
export const actionEntityTypeEnum = pgEnum('action_entity_type', ['incident', 'patient', 'event', 'team']);

// ─── Tables ──────────────────────────────────────────────────────

export const events = pgTable('events', {
  id: uuid('id').primaryKey().defaultRandom(),
  name: varchar('name', { length: 200 }).notNull(),
  startDate: timestamp('start_date', { withTimezone: true }).notNull(),
  endDate: timestamp('end_date', { withTimezone: true }).notNull(),
  status: eventStatusEnum('status').notNull().default('draft'),
  mciActive: boolean('mci_active').notNull().default(false),
  mciActivatedAt: timestamp('mci_activated_at', { withTimezone: true }),
  mciActivatedBy: varchar('mci_activated_by', { length: 255 }),
  mciSectors: text('mci_sectors').array().notNull().default([]),
  mciSummaryHtml: text('mci_summary_html'),
  mciSummaryGeneratedAt: timestamp('mci_summary_generated_at', { withTimezone: true }),
  mciSummaryGeneratedBy: varchar('mci_summary_generated_by', { length: 255 }),
  indoorLayout: jsonb('indoor_layout').$type<{
    venueId: string;
    venueName?: string;
    floors: Array<{
      id: string;
      label: string;
      zones: Array<{
        id: string;
        label: string;
        center: { lat: number; lng: number };
      }>;
    }>;
  }>(),
  mapRuntimeConfig: jsonb('map_runtime_config').$type<{
    provider?: 'leaflet' | 'maplibre';
    styleUrl?: string;
    layers?: Array<{
      id: string;
      type: 'xyz' | 'wmts';
      url: string;
      attribution?: string;
      token?: string;
      minZoom?: number;
      maxZoom?: number;
    }>;
    enable3d?: boolean;
  }>(),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
});

export const teams = pgTable('teams', {
  id: uuid('id').primaryKey().defaultRandom(),
  eventId: uuid('event_id').notNull().references(() => events.id, { onDelete: 'cascade' }),
  name: varchar('name', { length: 100 }).notNull(),
  size: integer('size').notNull().default(1),
  transport: teamTransportEnum('transport').notNull().default('foot'),
  gear: text('gear').array().notNull().default([]),
  members: text('members').array().notNull().default([]),
  currentPosition: jsonb('current_position').$type<{ lat: number; lng: number }>(),
  lastPositionUpdate: timestamp('last_position_update', { withTimezone: true }),
});

export const users = pgTable('users', {
  id: uuid('id').primaryKey().defaultRandom(),
  email: varchar('email', { length: 255 }).notNull().unique(),
  passwordHash: varchar('password_hash', { length: 255 }).notNull(),
  role: userRoleEnum('role').notNull(),
});

export const accessCodes = pgTable('access_codes', {
  id: uuid('id').primaryKey().defaultRandom(),
  eventId: uuid('event_id').notNull().references(() => events.id, { onDelete: 'cascade' }),
  role: userRoleEnum('role').notNull(),
  code: varchar('code', { length: 6 }).notNull(),
  expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
  revokedAt: timestamp('revoked_at', { withTimezone: true }),
});

export const incidents = pgTable('incidents', {
  id: uuid('id').primaryKey().defaultRandom(),
  eventId: uuid('event_id').notNull().references(() => events.id, { onDelete: 'cascade' }),
  teamId: uuid('team_id').references(() => teams.id),
  type: incidentTypeEnum('type').notNull(),
  status: incidentStatusEnum('status').notNull().default('on_scene'),
  source: incidentSourceEnum('source').notNull().default('field'),
  location: jsonb('location').$type<{ lat: number; lng: number }>().notNull(),
  acvpu: acvpuEnum('acvpu'),
  vitals: jsonb('vitals').$type<Record<string, unknown>>(),
  mist: jsonb('mist').$type<Record<string, unknown>>(),
  sbar: jsonb('sbar').$type<Record<string, unknown>>(),
  locationContext: jsonb('location_context').$type<{
    mode: 'gps' | 'indoor_zone';
    venueId?: string;
    floorId?: string;
    zoneId?: string;
    zoneLabel?: string;
  }>(),
  triageTag: triageTagEnum('triage_tag'),
  notes: text('notes'),
  clientId: varchar('client_id', { length: 255 }).unique(),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
});

export const escalations = pgTable('escalations', {
  id: uuid('id').primaryKey().defaultRandom(),
  incidentId: uuid('incident_id').notNull().references(() => incidents.id, { onDelete: 'cascade' }),
  eventId: uuid('event_id').notNull().references(() => events.id, { onDelete: 'cascade' }),
  path: escalationPathEnum('path').notNull(),
  reason: text('reason'),
  raisedAt: timestamp('raised_at', { withTimezone: true }).notNull().defaultNow(),
  resolvedAt: timestamp('resolved_at', { withTimezone: true }),
  raisedBy: varchar('raised_by', { length: 255 }).notNull(),
});

export const patients = pgTable('patients', {
  id: uuid('id').primaryKey().defaultRandom(),
  eventId: uuid('event_id').notNull().references(() => events.id, { onDelete: 'cascade' }),
  incidentId: uuid('incident_id').references(() => incidents.id),
  status: patientStatusEnum('status').notNull().default('incoming'),
  ageGroup: varchar('age_group', { length: 50 }),
  gender: varchar('gender', { length: 50 }),
  presentingComplaint: text('presenting_complaint'),
  arrivalTime: timestamp('arrival_time', { withTimezone: true }).notNull().defaultNow(),
  assignedClinician: varchar('assigned_clinician', { length: 100 }),
  notes: jsonb('notes')
    .$type<Array<{ text: string; timestamp: string; author: string }>>()
    .notNull()
    .default([]),
  diagnosisFlags: text('diagnosis_flags').array().notNull().default([]),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
});

export const medicationRecords = pgTable('medication_records', {
  id: uuid('id').primaryKey().defaultRandom(),
  patientId: uuid('patient_id').notNull().references(() => patients.id, { onDelete: 'cascade' }),
  eventId: uuid('event_id').notNull().references(() => events.id, { onDelete: 'cascade' }),
  drug: varchar('drug', { length: 100 }).notNull(),
  dose: varchar('dose', { length: 100 }),
  route: varchar('route', { length: 50 }),
  givenAt: timestamp('given_at', { withTimezone: true }).notNull().defaultNow(),
  givenBy: varchar('given_by', { length: 100 }),
});

export const vitalReadings = pgTable('vital_readings', {
  id: uuid('id').primaryKey().defaultRandom(),
  patientId: uuid('patient_id').notNull().references(() => patients.id, { onDelete: 'cascade' }),
  timestamp: timestamp('timestamp', { withTimezone: true }).notNull().defaultNow(),
  pulse: integer('pulse'),
  spo2: integer('spo2'),
  respiratoryRate: integer('respiratory_rate'),
  painScore: integer('pain_score'),
  systolicBp: integer('systolic_bp'),
  temperature: real('temperature'),
  onSupplementalOxygen: boolean('on_supplemental_oxygen'),
  acvpu: acvpuEnum('acvpu'),
});

export const actionEvents = pgTable('action_events', {
  id: uuid('id').primaryKey().defaultRandom(),
  eventId: uuid('event_id').notNull().references(() => events.id, { onDelete: 'cascade' }),
  entityType: actionEntityTypeEnum('entity_type').notNull(),
  entityId: uuid('entity_id').notNull(),
  actionType: varchar('action_type', { length: 80 }).notNull(),
  payload: jsonb('payload').$type<Record<string, unknown>>().notNull().default({}),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  createdBy: varchar('created_by', { length: 255 }).notNull(),
  revertedAt: timestamp('reverted_at', { withTimezone: true }),
  revertedBy: varchar('reverted_by', { length: 255 }),
  revertReason: text('revert_reason'),
  undoOfActionId: uuid('undo_of_action_id'),
});
