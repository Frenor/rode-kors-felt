/**
 * Database client — Drizzle ORM over node-postgres.
 *
 * Exports `db` (Drizzle) and `pool` (raw pg Pool) so routes use the
 * type-safe query builder and server.ts can manage lifecycle.
 */

import pg from 'pg';
import { drizzle } from 'drizzle-orm/node-postgres';
import * as schema from './schema.js';

const { Pool } = pg;

const DATABASE_URL =
  process.env.DATABASE_URL ?? 'postgresql://rkf_dev:rkf_dev_password@localhost:5432/rkf';

export const pool = new Pool({
  connectionString: DATABASE_URL,
  max: 10,
  idleTimeoutMillis: 30_000,
  connectionTimeoutMillis: 5_000,
});

export const db = drizzle(pool, { schema });
