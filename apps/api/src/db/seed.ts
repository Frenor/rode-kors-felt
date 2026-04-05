/**
 * Seed the database with demo data for local development and testing.
 *
 * Idempotent: skips seeding if any event already exists.
 * Demo credentials:
 *   First aider: 123456
 *   Sick bay:    654321
 *   Admin login: admin@rkf.no / admin123
 */

import { db } from './index.js';
import { accessCodes, events, teams, users } from './schema.js';
import { hashPassword } from '../middleware/auth.js';

export async function seedDatabase(): Promise<void> {
  const existing = await db.select().from(events).limit(1);
  if (existing.length > 0) return;

  const [event] = await db
    .insert(events)
    .values({
      name: 'Holmenkollen Skimaraton 2026',
      startDate: new Date('2026-03-21T08:00:00Z'),
      endDate: new Date('2026-03-21T18:00:00Z'),
      status: 'active',
    })
    .returning();

  const eventId = event!.id;

  await db.insert(teams).values([
    {
      eventId,
      name: 'Patrulje Alpha',
      size: 4,
      transport: 'foot',
      gear: ['AED', 'Førstehjelpssekk', 'Radio'],
      members: [],
    },
    {
      eventId,
      name: 'Patrulje Bravo',
      size: 3,
      transport: 'atv',
      gear: ['AED', 'Førstehjelpssekk', 'Båre', 'Radio'],
      members: [],
    },
  ]);

  await db.insert(accessCodes).values([
    {
      eventId,
      role: 'first_aider',
      code: '123456',
      expiresAt: new Date('2026-12-31T23:59:59Z'),
    },
    {
      eventId,
      role: 'sickbay',
      code: '654321',
      expiresAt: new Date('2026-12-31T23:59:59Z'),
    },
  ]);

  await db.insert(users).values({
    email: 'admin@rkf.no',
    passwordHash: hashPassword('admin123'),
    role: 'coordinator',
  });
}
