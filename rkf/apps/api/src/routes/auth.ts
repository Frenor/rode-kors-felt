import type { FastifyInstance } from 'fastify';
import { store } from '../db/store.js';
import { createToken } from '../middleware/auth.js';

export async function authRoutes(app: FastifyInstance) {
  // Admin/coordinator login
  app.post('/login', async (request, reply) => {
    const { email, password } = request.body as { email: string; password: string };

    const user = Array.from(store.users.values()).find(
      (u) => u.email === email && u.passwordHash === password,
    );

    if (!user) {
      return reply.code(401).send({ error: 'Feil e-post eller passord' });
    }

    const accessToken = createToken({
      userId: user.id,
      role: user.role,
      email: user.email,
    });

    const refreshToken = createToken({
      userId: user.id,
      type: 'refresh',
    });

    return {
      accessToken,
      refreshToken,
      role: user.role,
      user: { id: user.id, email: user.email, role: user.role },
    };
  });

  // Event access code redemption (first aiders & sickbay)
  app.post('/code', async (request, reply) => {
    const { code } = request.body as { code: string };

    const accessCode = Array.from(store.accessCodes.values()).find(
      (ac) => ac.code === code && !ac.revokedAt && new Date(ac.expiresAt) > new Date(),
    );

    if (!accessCode) {
      return reply.code(401).send({ error: 'Ugyldig eller utløpt kode' });
    }

    const event = store.events.get(accessCode.eventId);
    if (!event || event.status !== 'active') {
      return reply.code(404).send({ error: 'Arrangement ikke funnet eller inaktivt' });
    }

    const accessToken = createToken({
      role: accessCode.role,
      eventId: accessCode.eventId,
      codeId: accessCode.id,
    });

    const refreshToken = createToken({
      eventId: accessCode.eventId,
      type: 'refresh',
    });

    // Get teams for this event
    const teams = Array.from(store.teams.values()).filter(
      (t) => t.eventId === accessCode.eventId,
    );

    return {
      accessToken,
      refreshToken,
      role: accessCode.role,
      eventId: accessCode.eventId,
      eventName: event.name,
      teams: teams.map((t) => ({ id: t.id, name: t.name })),
    };
  });

  // Token refresh
  app.post('/refresh', async (request, reply) => {
    // MVP: just issue a new token
    const { refreshToken } = request.body as { refreshToken: string };
    try {
      const parts = refreshToken.split('.');
      const payload = JSON.parse(atob(parts[1]!));
      const newToken = createToken({
        ...payload,
        type: undefined,
      });
      return { accessToken: newToken };
    } catch {
      return reply.code(401).send({ error: 'Ugyldig refresh token' });
    }
  });
}
