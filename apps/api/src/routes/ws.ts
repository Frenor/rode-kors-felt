import type { FastifyInstance } from 'fastify';
import { and, eq } from 'drizzle-orm';
import { TeamPositionPayload } from '@rkf/shared-types';
import { verifyToken } from '../middleware/auth.js';
import { db } from '../db/index.js';
import { teams, teamMessages } from '../db/schema.js';

type TokenPayload = {
  role?: string;
  eventId?: string;
  userId?: string;
};

type WsClient = {
  socket: any;
  eventId: string;
  userId?: string;
};

const PRIVILEGED_ROLES = new Set(['admin', 'coordinator']);
const clients = new Set<WsClient>();

const HEARTBEAT_INTERVAL_MS = 30_000;
const HEARTBEAT_TIMEOUT_MS = 10_000;

function resolveConnectionEventId(payload: TokenPayload, requestedEventId: string | null): string | null {
  if (payload.role && PRIVILEGED_ROLES.has(payload.role)) {
    if (requestedEventId) return requestedEventId;
    if (payload.eventId) return payload.eventId;
    return null;
  }

  if (!payload.eventId) return null;
  if (requestedEventId && requestedEventId !== payload.eventId) return null;
  return payload.eventId;
}

function extractTokenFromProtocolHeader(headerValue: string | string[] | undefined): string | null {
  const raw = Array.isArray(headerValue) ? headerValue.join(',') : (headerValue ?? '');
  if (!raw.trim()) return null;
  const protocols = raw.split(',').map((part) => part.trim());
  const authProtocol = protocols.find((part) => part.startsWith('rkf-auth.'));
  if (!authProtocol) return null;
  const token = authProtocol.slice('rkf-auth.'.length);
  return token || null;
}

function getEventClientCount(eventId: string): number {
  let count = 0;
  for (const client of clients) {
    if (client.eventId === eventId) count += 1;
  }
  return count;
}

function broadcastConnectionCount(eventId: string) {
  broadcast({
    type: 'system.connected_users',
    eventId,
    payload: { count: getEventClientCount(eventId) },
    timestamp: new Date().toISOString(),
  });
}

export async function wsHandler(app: FastifyInstance) {
  app.get('/', { websocket: true, config: { rateLimit: { max: 80, timeWindow: '1 minute' } } }, (socket, request) => {
    const url = new URL(request.url, `http://${request.headers.host}`);
    const token = extractTokenFromProtocolHeader(request.headers['sec-websocket-protocol']);
    const requestedEventId = url.searchParams.get('eventId');

    if (!token) {
      socket.close(4001, 'Mangler token');
      return;
    }

    const verified = verifyToken(token) as TokenPayload | null;
    if (!verified) {
      socket.close(4001, 'Ugyldig token');
      return;
    }

    const connectionEventId = resolveConnectionEventId(verified, requestedEventId);
    if (!connectionEventId) {
      socket.close(4003, 'Mangler eller ugyldig event-tilgang');
      return;
    }

    const client: WsClient = {
      socket,
      eventId: connectionEventId,
      userId: typeof verified.userId === 'string' ? verified.userId : undefined,
    };

    clients.add(client);
    app.log.info(`WebSocket tilkoblet (${clients.size} klienter)`);
    broadcastConnectionCount(connectionEventId);

    let isAlive = true;
    let timeoutHandle: ReturnType<typeof setTimeout> | null = null;

    const heartbeat = setInterval(() => {
      if (!isAlive) {
        app.log.warn('WebSocket heartbeat timeout — avslutter forbindelsen');
        clearInterval(heartbeat);
        socket.terminate();
        return;
      }
      isAlive = false;
      socket.ping();

      timeoutHandle = setTimeout(() => {
        if (!isAlive) {
          app.log.warn('WebSocket pong timeout — avslutter forbindelsen');
          clearInterval(heartbeat);
          socket.terminate();
        }
      }, HEARTBEAT_TIMEOUT_MS);
    }, HEARTBEAT_INTERVAL_MS);

    socket.on('pong', () => {
      isAlive = true;
      if (timeoutHandle) {
        clearTimeout(timeoutHandle);
        timeoutHandle = null;
      }
    });

    socket.on('message', async (raw: Buffer) => {
      try {
        const message = JSON.parse(raw.toString()) as {
          type?: string;
          payload?: Record<string, unknown>;
        };

        if (message.type === 'team.message') {
          const id = crypto.randomUUID();
          const fromTeamId = typeof message.payload?.fromTeamId === 'string' ? message.payload.fromTeamId : null;
          // Who sent it when it was not a patrol (the coordinator desk).
          const fromLabel = typeof message.payload?.fromLabel === 'string' ? message.payload.fromLabel : null;
          const toTeamId = typeof message.payload?.toTeamId === 'string' ? message.payload.toTeamId : null;
          // A receipt for an earlier directed message ("Mottatt").
          const ackOf = typeof message.payload?.ackOf === 'string' ? message.payload.ackOf : null;
          const text = typeof message.payload?.text === 'string' ? message.payload.text : '';
          const sentAt = new Date().toISOString();

          broadcast({
            type: 'team.message',
            eventId: connectionEventId,
            payload: { id, fromTeamId, fromLabel, toTeamId, ackOf, text, sentAt },
            timestamp: sentAt,
          });

          // Chat history (gap B9): persist so a dashboard that joins late or
          // reloads can fetch what it missed. Fire-and-forget — a DB hiccup
          // must never block the live relay.
          if (text) {
            persistTeamMessage({ id, eventId: connectionEventId, fromTeamId, fromLabel, toTeamId, ackOf, text, sentAt })
              .catch((err) => app.log.error({ err }, 'Kunne ikke lagre teammelding'));
          }
        } else if (message.type === 'team.position') {
          const parsed = TeamPositionPayload.safeParse(message.payload);
          if (parsed.success) {
            const { teamId, position } = parsed.data;
            const [matchingTeam] = await db
              .select({ id: teams.id })
              .from(teams)
              .where(and(eq(teams.id, teamId), eq(teams.eventId, connectionEventId)))
              .limit(1);

            if (!matchingTeam) return;

            db.update(teams)
              .set({ currentPosition: position, lastPositionUpdate: new Date() })
              .where(and(eq(teams.id, teamId), eq(teams.eventId, connectionEventId)))
              .catch((err) => app.log.error({ err }, 'Failed to update team position'));

            broadcast({
              type: 'team.position',
              eventId: connectionEventId,
              payload: message.payload,
              timestamp: new Date().toISOString(),
            });
          }
        } else if (message.type === 'team.sector_assigned') {
          broadcast({
            type: 'team.sector_assigned',
            eventId: connectionEventId,
            payload: {
              teamId: message.payload?.teamId,
              sector: message.payload?.sector ?? null,
              assignedBy: message.payload?.assignedBy,
              assignedAt: message.payload?.assignedAt ?? new Date().toISOString(),
            },
            timestamp: new Date().toISOString(),
          });
        }
      } catch {
        // ignore malformed messages
      }
    });

    socket.on('close', () => {
      clearInterval(heartbeat);
      if (timeoutHandle) clearTimeout(timeoutHandle);
      clients.delete(client);
      app.log.info(`WebSocket frakoblet (${clients.size} klienter)`);
      broadcastConnectionCount(connectionEventId);
    });
  });
}

// ── Lane 8 batch 3 (B): chat history (gap B9) ──────────────────────
/**
 * Persists one relayed `team.message`, using the same `id` the broadcast
 * used, so `GET /events/:id/messages` returns exactly what clients saw live.
 * Callers should fire-and-forget this and log rejections — a DB hiccup must
 * never block the live relay.
 */
export async function persistTeamMessage(row: {
  id: string;
  eventId: string;
  fromTeamId: string | null;
  fromLabel: string | null;
  toTeamId: string | null;
  ackOf: string | null;
  text: string;
  sentAt: string;
}): Promise<void> {
  await db.insert(teamMessages).values({
    id: row.id,
    eventId: row.eventId,
    fromTeamId: row.fromTeamId,
    fromLabel: row.fromLabel,
    toTeamId: row.toTeamId,
    ackOf: row.ackOf,
    text: row.text,
    sentAt: new Date(row.sentAt),
  });
}

export function broadcast(message: Record<string, unknown>) {
  const eventId = typeof message.eventId === 'string' ? message.eventId : undefined;
  const data = JSON.stringify(message);

  for (const client of clients) {
    if (eventId && client.eventId !== eventId) continue;

    try {
      client.socket.send(data);
    } catch {
      clients.delete(client);
    }
  }
}

export const __testOnly = {
  resolveConnectionEventId,
  extractTokenFromProtocolHeader,
};
