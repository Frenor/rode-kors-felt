import type { FastifyInstance } from 'fastify';
import { and, eq, gt, isNull } from 'drizzle-orm';
import { db } from '../db/index.js';
import { accessCodes, events, teams, users } from '../db/schema.js';
import { createToken, verifyPassword, verifyToken } from '../middleware/auth.js';

export async function authRoutes(app: FastifyInstance) {
  // Admin/coordinator login
  app.post('/login', { config: { rateLimit: { max: 10, timeWindow: '1 minute' } } }, async (request, reply) => {
    const { email, password } = request.body as { email: string; password: string };

    const [user] = await db
      .select()
      .from(users)
      .where(eq(users.email, email))
      .limit(1);

    if (!user || !verifyPassword(password, user.passwordHash)) {
      return reply.code(401).send({ error: 'Feil e-post eller passord' });
    }

    const [activeEvent] = await db
      .select()
      .from(events)
      .where(eq(events.status, 'active'))
      .limit(1);

    const accessToken = createToken({
      userId: user.id,
      role: user.role,
      email: user.email,
      eventId: activeEvent?.id,
    });

    const refreshToken = createToken({ userId: user.id }, { type: 'refresh' });

    return {
      accessToken,
      refreshToken,
      role: user.role,
      eventId: activeEvent?.id,
      eventName: activeEvent?.name,
      user: { id: user.id, email: user.email, role: user.role },
    };
  });

  // Event access code redemption (first aiders & sickbay)
  app.post('/code', { config: { rateLimit: { max: 20, timeWindow: '1 minute' } } }, async (request, reply) => {
    const { code } = request.body as { code: string };

    const [accessCode] = await db
      .select()
      .from(accessCodes)
      .where(
        and(
          eq(accessCodes.code, code),
          isNull(accessCodes.revokedAt),
          gt(accessCodes.expiresAt, new Date()),
        ),
      )
      .limit(1);

    if (!accessCode) {
      return reply.code(401).send({ error: 'Ugyldig eller utløpt kode' });
    }

    const [event] = await db
      .select()
      .from(events)
      .where(and(eq(events.id, accessCode.eventId), eq(events.status, 'active')))
      .limit(1);

    if (!event) {
      return reply.code(404).send({ error: 'Arrangement ikke funnet eller inaktivt' });
    }

    const accessToken = createToken({
      role: accessCode.role,
      eventId: accessCode.eventId,
      codeId: accessCode.id,
    });

    const refreshToken = createToken(
      { role: accessCode.role, eventId: accessCode.eventId, codeId: accessCode.id },
      { type: 'refresh' },
    );

    const teamList = await db.select().from(teams).where(eq(teams.eventId, accessCode.eventId));

    return {
      accessToken,
      refreshToken,
      role: accessCode.role,
      eventId: accessCode.eventId,
      eventName: event.name,
      teams: teamList.map((t) => ({ id: t.id, name: t.name })),
    };
  });

  // Token refresh
  app.post('/refresh', { config: { rateLimit: { max: 30, timeWindow: '1 minute' } } }, async (request, reply) => {
    const { refreshToken } = request.body as { refreshToken: string };
    const payload = verifyToken(refreshToken);
    if (!payload || payload.type !== 'refresh') {
      return reply.code(401).send({ error: 'Ugyldig refresh token' });
    }

    const nextPayload: Record<string, unknown> = {};
    if (payload.userId) nextPayload.userId = payload.userId;
    if (payload.role) nextPayload.role = payload.role;
    if (payload.email) nextPayload.email = payload.email;
    if (payload.eventId) nextPayload.eventId = payload.eventId;
    if (payload.codeId) nextPayload.codeId = payload.codeId;

    return { accessToken: createToken(nextPayload, { type: 'access' }) };
  });
}
