/**
 * Database migration runner.
 *
 * Creates all enums and tables if they do not exist. Idempotent — safe
 * to call on every server startup. Keeps in sync with schema.ts.
 *
 * For production releases, supplement this with drizzle-kit generated
 * SQL migrations (pnpm db:generate → pnpm db:migrate).
 */

import { pool } from './index.js';

export async function runMigrations(): Promise<void> {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    // ── Enums (DO blocks for idempotency) ──────────────────────────
    await client.query(`
      DO $$ BEGIN
        CREATE TYPE event_status AS ENUM ('draft', 'active', 'archived');
      EXCEPTION WHEN duplicate_object THEN NULL; END $$;

      DO $$ BEGIN
        CREATE TYPE user_role AS ENUM ('admin', 'coordinator', 'sickbay', 'first_aider');
      EXCEPTION WHEN duplicate_object THEN NULL; END $$;

      DO $$ BEGIN
        CREATE TYPE team_transport AS ENUM ('foot', 'bike', 'vehicle', 'atv');
      EXCEPTION WHEN duplicate_object THEN NULL; END $$;

      DO $$ BEGIN
        CREATE TYPE incident_type AS ENUM ('medical', 'trauma', 'psychiatric', 'other');
      EXCEPTION WHEN duplicate_object THEN NULL; END $$;

      DO $$ BEGIN
        CREATE TYPE incident_status AS ENUM (
          'dispatched', 'on_scene', 'transporting', 'at_sickbay', 'handed_over', 'resolved'
        );
      EXCEPTION WHEN duplicate_object THEN NULL; END $$;

      DO $$ BEGIN
        CREATE TYPE incident_source AS ENUM ('field', 'coordinator');
      EXCEPTION WHEN duplicate_object THEN NULL; END $$;

      DO $$ BEGIN
        CREATE TYPE acvpu_level AS ENUM ('alert', 'confused', 'voice', 'pain', 'unresponsive');
      EXCEPTION WHEN duplicate_object THEN NULL; END $$;

      DO $$ BEGIN
        CREATE TYPE patient_status AS ENUM (
          'incoming', 'in_treatment', 'observation', 'discharged', 'transferred'
        );
      EXCEPTION WHEN duplicate_object THEN NULL; END $$;

      DO $$ BEGIN
        CREATE TYPE escalation_path AS ENUM ('path_a_rk_ambulance', 'path_b_113');
      EXCEPTION WHEN duplicate_object THEN NULL; END $$;
    `);

    // ── Tables ─────────────────────────────────────────────────────
    await client.query(`
      CREATE TABLE IF NOT EXISTS events (
        id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        name        VARCHAR(200) NOT NULL,
        start_date  TIMESTAMPTZ NOT NULL,
        end_date    TIMESTAMPTZ NOT NULL,
        status      event_status NOT NULL DEFAULT 'draft',
        created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );

      CREATE TABLE IF NOT EXISTS users (
        id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        email         VARCHAR(255) NOT NULL UNIQUE,
        password_hash VARCHAR(255) NOT NULL,
        role          user_role NOT NULL
      );

      CREATE TABLE IF NOT EXISTS teams (
        id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        event_id              UUID NOT NULL REFERENCES events(id) ON DELETE CASCADE,
        name                  VARCHAR(100) NOT NULL,
        size                  INTEGER NOT NULL DEFAULT 1,
        transport             team_transport NOT NULL DEFAULT 'foot',
        gear                  TEXT[] NOT NULL DEFAULT '{}',
        members               TEXT[] NOT NULL DEFAULT '{}',
        current_position      JSONB,
        last_position_update  TIMESTAMPTZ
      );

      CREATE TABLE IF NOT EXISTS access_codes (
        id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        event_id    UUID NOT NULL REFERENCES events(id) ON DELETE CASCADE,
        role        user_role NOT NULL,
        code        VARCHAR(6) NOT NULL,
        expires_at  TIMESTAMPTZ NOT NULL,
        revoked_at  TIMESTAMPTZ
      );

      CREATE TABLE IF NOT EXISTS incidents (
        id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        event_id    UUID NOT NULL REFERENCES events(id) ON DELETE CASCADE,
        team_id     UUID REFERENCES teams(id),
        type        incident_type NOT NULL,
        status      incident_status NOT NULL DEFAULT 'on_scene',
        source      incident_source NOT NULL DEFAULT 'field',
        location    JSONB NOT NULL,
        acvpu       acvpu_level,
        vitals      JSONB,
        mist        JSONB,
        sbar        JSONB,
        notes       TEXT,
        client_id   VARCHAR(255) UNIQUE,
        created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );

      CREATE TABLE IF NOT EXISTS escalations (
        id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        incident_id  UUID NOT NULL REFERENCES incidents(id) ON DELETE CASCADE,
        event_id     UUID NOT NULL REFERENCES events(id) ON DELETE CASCADE,
        path         escalation_path NOT NULL,
        reason       TEXT,
        raised_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        resolved_at  TIMESTAMPTZ,
        raised_by    VARCHAR(255) NOT NULL
      );

      CREATE TABLE IF NOT EXISTS patients (
        id                   UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        event_id             UUID NOT NULL REFERENCES events(id) ON DELETE CASCADE,
        incident_id          UUID REFERENCES incidents(id),
        status               patient_status NOT NULL DEFAULT 'incoming',
        age_group            VARCHAR(50),
        gender               VARCHAR(50),
        presenting_complaint TEXT,
        arrival_time         TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        assigned_clinician   VARCHAR(100),
        notes                JSONB NOT NULL DEFAULT '[]',
        diagnosis_flags      TEXT[] NOT NULL DEFAULT '{}',
        created_at           TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at           TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );

      CREATE TABLE IF NOT EXISTS vital_readings (
        id                      UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        patient_id              UUID NOT NULL REFERENCES patients(id) ON DELETE CASCADE,
        timestamp               TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        pulse                   INTEGER,
        spo2                    INTEGER,
        respiratory_rate        INTEGER,
        pain_score              INTEGER,
        systolic_bp             INTEGER,
        temperature             REAL,
        on_supplemental_oxygen  BOOLEAN,
        acvpu                   acvpu_level
      );
    `);

    await client.query('COMMIT');
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}
