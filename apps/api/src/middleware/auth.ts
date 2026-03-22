import type { FastifyRequest, FastifyReply } from 'fastify';

const JWT_SECRET = process.env.JWT_SECRET || 'rkf-dev-secret-change-in-prod';

// Simple JWT-like token for MVP (swap to @fastify/jwt in production)
export function createToken(payload: Record<string, unknown>): string {
  const header = btoa(JSON.stringify({ alg: 'HS256', typ: 'JWT' }));
  const body = btoa(
    JSON.stringify({ ...payload, iat: Date.now(), exp: Date.now() + 15 * 60 * 1000 }),
  );
  const signature = btoa(`${header}.${body}.${JWT_SECRET}`);
  return `${header}.${body}.${signature}`;
}

export function verifyToken(token: string): Record<string, unknown> | null {
  try {
    const parts = token.split('.');
    if (parts.length !== 3) return null;
    const payload = JSON.parse(atob(parts[1]!));
    if (payload.exp && payload.exp < Date.now()) return null;
    return payload;
  } catch {
    return null;
  }
}

export async function requireAuth(request: FastifyRequest, reply: FastifyReply) {
  const authHeader = request.headers.authorization;
  if (!authHeader?.startsWith('Bearer ')) {
    return reply.code(401).send({ error: 'Mangler autorisasjon' });
  }

  const token = authHeader.slice(7);
  const payload = verifyToken(token);
  if (!payload) {
    return reply.code(401).send({ error: 'Ugyldig eller utløpt token' });
  }

  (request as any).user = payload;
}

export async function requireRole(roles: string[]) {
  return async (request: FastifyRequest, reply: FastifyReply) => {
    await requireAuth(request, reply);
    if (reply.sent) return;

    const user = (request as any).user;
    if (!roles.includes(user.role)) {
      return reply.code(403).send({ error: 'Ingen tilgang' });
    }
  };
}
