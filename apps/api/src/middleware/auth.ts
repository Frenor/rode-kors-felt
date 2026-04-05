import type { FastifyRequest, FastifyReply } from 'fastify';
import { createHmac, randomBytes, scryptSync, timingSafeEqual } from 'node:crypto';

const JWT_SECRET = process.env.JWT_SECRET || 'rkf-dev-secret-change-in-prod';
const ACCESS_TOKEN_TTL_SECONDS = 15 * 60;
const REFRESH_TOKEN_TTL_SECONDS = 7 * 24 * 60 * 60;
const PASSWORD_SCRYPT_N = 16384;
const PASSWORD_SCRYPT_R = 8;
const PASSWORD_SCRYPT_P = 1;
const PASSWORD_KEYLEN = 64;
const PRIVILEGED_ROLES = new Set(['admin', 'coordinator']);

type TokenPayloadInput = Record<string, unknown> & { type?: 'access' | 'refresh' };

function base64UrlEncode(input: Buffer | string): string {
  const data = typeof input === 'string' ? Buffer.from(input, 'utf8') : input;
  return data.toString('base64url');
}

function base64UrlDecode(input: string): string {
  return Buffer.from(input, 'base64url').toString('utf8');
}

function signTokenSegment(header: string, payload: string): string {
  return createHmac('sha256', JWT_SECRET).update(`${header}.${payload}`).digest('base64url');
}

export function createToken(
  payload: TokenPayloadInput,
  options?: { type?: 'access' | 'refresh' },
): string {
  const type = options?.type ?? payload.type ?? 'access';
  const now = Math.floor(Date.now() / 1000);
  const ttl = type === 'refresh' ? REFRESH_TOKEN_TTL_SECONDS : ACCESS_TOKEN_TTL_SECONDS;

  const header = base64UrlEncode(JSON.stringify({ alg: 'HS256', typ: 'JWT' }));
  const tokenPayload = base64UrlEncode(
    JSON.stringify({
      ...payload,
      type,
      iat: now,
      exp: now + ttl,
    }),
  );
  const signature = signTokenSegment(header, tokenPayload);
  return `${header}.${tokenPayload}.${signature}`;
}

export function verifyToken(token: string): Record<string, unknown> | null {
  try {
    const parts = token.split('.');
    if (parts.length !== 3) return null;
    const [header, body, signature] = parts;
    if (!header || !body || !signature) return null;

    const expectedSignature = signTokenSegment(header, body);
    const actualBuffer = Buffer.from(signature, 'base64url');
    const expectedBuffer = Buffer.from(expectedSignature, 'base64url');
    if (actualBuffer.length !== expectedBuffer.length) return null;
    if (!timingSafeEqual(actualBuffer, expectedBuffer)) return null;

    const payload = JSON.parse(base64UrlDecode(body));
    if (!payload || typeof payload !== 'object') return null;
    if (typeof payload.exp === 'number' && payload.exp < Math.floor(Date.now() / 1000)) return null;

    return payload;
  } catch {
    return null;
  }
}

export function hashPassword(password: string): string {
  const salt = randomBytes(16);
  const hash = scryptSync(password, salt, PASSWORD_KEYLEN, {
    N: PASSWORD_SCRYPT_N,
    r: PASSWORD_SCRYPT_R,
    p: PASSWORD_SCRYPT_P,
  });
  return `scrypt$${PASSWORD_SCRYPT_N}$${PASSWORD_SCRYPT_R}$${PASSWORD_SCRYPT_P}$${salt.toString('base64url')}$${hash.toString('base64url')}`;
}

export function verifyPassword(password: string, passwordHash: string): boolean {
  try {
    const [algorithm, nStr, rStr, pStr, saltB64, hashB64] = passwordHash.split('$');
    if (algorithm !== 'scrypt' || !nStr || !rStr || !pStr || !saltB64 || !hashB64) return false;

    const salt = Buffer.from(saltB64, 'base64url');
    const expected = Buffer.from(hashB64, 'base64url');
    const candidate = scryptSync(password, salt, expected.length, {
      N: Number(nStr),
      r: Number(rStr),
      p: Number(pStr),
    });

    if (candidate.length !== expected.length) return false;
    return timingSafeEqual(candidate, expected);
  } catch {
    return false;
  }
}

export function canAccessEvent(
  user: { role?: string; eventId?: string },
  eventId: string,
): boolean {
  if (user.role && PRIVILEGED_ROLES.has(user.role)) return true;
  if (!user.eventId) return false;
  return user.eventId === eventId;
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

export function requireRole(roles: string[]) {
  return async (request: FastifyRequest, reply: FastifyReply) => {
    await requireAuth(request, reply);
    if (reply.sent) return;

    const user = (request as any).user;
    if (!roles.includes(user.role)) {
      return reply.code(403).send({ error: 'Ingen tilgang' });
    }
  };
}
