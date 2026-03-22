/**
 * Vitest per-file setup — runs before each test file.
 *
 * Truncates all clinical data and re-seeds demo fixtures so every
 * test file starts from a known clean state.
 */

import { beforeAll } from 'vitest';
import { pool } from '../db/index.js';
import { seedDatabase } from '../db/seed.js';

beforeAll(async () => {
  // Truncate in FK-safe order (children first, then roots)
  await pool.query(`
    TRUNCATE vital_readings, escalations, incidents, patients,
             access_codes, teams, users, events RESTART IDENTITY CASCADE
  `);
  await seedDatabase();
});
