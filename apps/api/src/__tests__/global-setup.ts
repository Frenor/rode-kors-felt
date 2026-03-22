/**
 * Vitest global setup — runs once before all test files.
 *
 * Runs DB migrations so all tables exist before any test file starts.
 * Per-file seeding/truncation is handled in setup.ts.
 */

export async function setup() {
  const { runMigrations } = await import('../db/migrate.js');
  await runMigrations();
}

export async function teardown() {
  const { pool } = await import('../db/index.js');
  await pool.end();
}
