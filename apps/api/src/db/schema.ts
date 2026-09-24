/**
 * Drizzle ORM schema for RKF.
 *
 * Source of truth for table definitions. Used by:
 *  - drizzle-kit to generate/run migrations
 *  - Application code for type-safe queries
 */

import {
  boolean,
  date,
  integer,
  jsonb,
  pgEnum,
  pgTable,
  real,
  text,
  timestamp,
  uniqueIndex,
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
export const acvpuEnum = pgEnum('acvpu_level', ['alert', 'confused', 'voice', 'pain', 'unresponsive']);
export const patientStatusEnum = pgEnum('patient_status', [
  'incoming', 'in_treatment', 'observation', 'discharged', 'transferred',
]);
export const actionEntityTypeEnum = pgEnum('action_entity_type', ['patient', 'event', 'team']);

// ─── Tables ──────────────────────────────────────────────────────

export const events = pgTable('events', {
  id: uuid('id').primaryKey().defaultRandom(),
  name: varchar('name', { length: 200 }).notNull(),
  startDate: timestamp('start_date', { withTimezone: true }).notNull(),
  endDate: timestamp('end_date', { withTimezone: true }).notNull(),
  status: eventStatusEnum('status').notNull().default('draft'),
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
  /** Atomic counter for `patients.seq` — the shared, human-facing patient number. */
  patientCounter: integer('patient_counter').notNull().default(0),
  /** Capacity settings (gap B6): `{ sickbay?: { chairs?: number; beds?: number } }`. */
  settings: jsonb('settings').$type<{
    sickbay?: { chairs?: number; beds?: number };
  }>(),

  /** Retention (gap B8): set once PII has been scrubbed from this event's patients. */
  anonymisedAt: timestamp('anonymised_at', { withTimezone: true }),
});

export const fieldTriageStatusEnum = pgEnum('field_triage_status', ['green', 'yellow', 'red', 'black']);

export const teams = pgTable('teams', {
  id: uuid('id').primaryKey().defaultRandom(),
  eventId: uuid('event_id').notNull().references(() => events.id, { onDelete: 'cascade' }),
  name: varchar('name', { length: 100 }).notNull(),
  size: integer('size').notNull().default(1),
  transport: teamTransportEnum('transport').notNull().default('foot'),
  gear: text('gear').array().notNull().default([]),
  members: text('members').array().notNull().default([]),
  contactPhone: varchar('contact_phone', { length: 50 }),
  contactRadio: varchar('contact_radio', { length: 50 }),
  currentPosition: jsonb('current_position').$type<{ lat: number; lng: number }>(),
  lastPositionUpdate: timestamp('last_position_update', { withTimezone: true }),
  /** Event set-up (gap B5): a stood-down team is hidden unless asked for explicitly. */
  active: boolean('active').notNull().default(true),
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

export const patients = pgTable('patients', {
  id: uuid('id').primaryKey().defaultRandom(),
  eventId: uuid('event_id').notNull().references(() => events.id, { onDelete: 'cascade' }),
  incidentId: uuid('incident_id'),
  status: patientStatusEnum('status').notNull().default('incoming'),
  fullName: varchar('full_name', { length: 200 }),
  birthDate: date('birth_date'),
  ageGroup: varchar('age_group', { length: 50 }),
  gender: varchar('gender', { length: 50 }),
  placementType: varchar('placement_type', { length: 16 }),
  placementNumber: varchar('placement_number', { length: 20 }),
  presentingComplaint: text('presenting_complaint'),
  arrivalTime: timestamp('arrival_time', { withTimezone: true }).notNull().defaultNow(),
  assignedClinician: varchar('assigned_clinician', { length: 100 }),
  notes: jsonb('notes')
    .$type<Array<{ text: string; timestamp: string; author: string }>>()
    .notNull()
    .default([]),
  diagnosisFlags: text('diagnosis_flags').array().notNull().default([]),
  label: varchar('label', { length: 200 }),
  triageStatus: fieldTriageStatusEnum('triage_status'),
  description: text('description'),
  positionText: text('position_text'),
  lat: real('lat'),
  lon: real('lon'),
  assignedTeamId: uuid('assigned_team_id').references(() => teams.id, { onDelete: 'set null' }),
  /** Hand-over model (gap A1): set when the field team hands the patient off. */
  handedOverAt: timestamp('handed_over_at', { withTimezone: true }),
  handedOverByTeamId: uuid('handed_over_by_team_id').references(() => teams.id, { onDelete: 'set null' }),
  fieldOutcome: varchar('field_outcome', { length: 32 }),
  /** Shared patient number (gap A5): human-facing `#<seq>`, unique per event. */
  seq: integer('seq'),
  /** AMK notified (gap B2 data half). */
  amkNotifiedAt: timestamp('amk_notified_at', { withTimezone: true }),
  amkNotifiedBy: varchar('amk_notified_by', { length: 100 }),
  /** Transport request (gap B3): what/if a field team needs to move this patient. */
  transportNeed: varchar('transport_need', { length: 16 }),
  transportPickupText: text('transport_pickup_text'),
  transportRequestedAt: timestamp('transport_requested_at', { withTimezone: true }),
  transportRequestedBy: varchar('transport_requested_by', { length: 100 }),
  transportTeamId: uuid('transport_team_id').references(() => teams.id, { onDelete: 'set null' }),
  transportAssignedAt: timestamp('transport_assigned_at', { withTimezone: true }),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
}, (table) => [
  uniqueIndex('patients_event_id_seq_idx').on(table.eventId, table.seq),
]);

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

// ── Lane 8 batch 3 (B): chat history (gap B9) ──────────────────────
/**
 * Persisted `team.message` relay history so a dashboard that joins late (or
 * reloads) can fetch what it missed via `GET /events/:id/messages`.
 * `toTeamId` is a team uuid, the literal `coordinator`, or null for everyone —
 * not an FK, since it is not always a team.
 */
export const teamMessages = pgTable('team_messages', {
  id: uuid('id').primaryKey().defaultRandom(),
  eventId: uuid('event_id').notNull().references(() => events.id, { onDelete: 'cascade' }),
  fromTeamId: uuid('from_team_id').references(() => teams.id, { onDelete: 'set null' }),
  fromLabel: varchar('from_label', { length: 100 }),
  toTeamId: varchar('to_team_id', { length: 64 }),
  text: text('text').notNull(),
  ackOf: uuid('ack_of'),
  sentAt: timestamp('sent_at', { withTimezone: true }).notNull().defaultNow(),
});
