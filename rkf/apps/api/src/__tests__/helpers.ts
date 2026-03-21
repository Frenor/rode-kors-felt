import Fastify from 'fastify';
import sensible from '@fastify/sensible';
import { authRoutes } from '../routes/auth.js';
import { eventRoutes } from '../routes/events.js';
import { incidentRoutes } from '../routes/incidents.js';
import { patientRoutes } from '../routes/patients.js';
import { createToken } from '../middleware/auth.js';

export async function buildApp() {
  const app = Fastify({ logger: false });

  await app.register(sensible);
  await app.register(authRoutes, { prefix: '/api/auth' });
  await app.register(eventRoutes, { prefix: '/api/events' });
  await app.register(incidentRoutes, { prefix: '/api/incidents' });
  await app.register(patientRoutes, { prefix: '/api/patients' });

  await app.ready();
  return app;
}

/**
 * Returns a valid Bearer token for a first_aider role.
 * The eventId is taken from the seeded store at call time.
 */
export function getFirstAiderToken(eventId: string): string {
  return createToken({ role: 'first_aider', eventId });
}

/**
 * Returns a valid Bearer token for a sickbay role.
 */
export function getSickbayToken(eventId: string): string {
  return createToken({ role: 'sickbay', eventId });
}

/**
 * Returns a valid Bearer token for a coordinator role.
 */
export function getCoordinatorToken(): string {
  return createToken({ role: 'coordinator' });
}
