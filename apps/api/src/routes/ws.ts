import type { FastifyInstance } from 'fastify';
import { eq } from 'drizzle-orm';
import { TeamPositionPayload } from '@rkf/shared-types';
import { verifyToken } from '../middleware/auth.js';
import { db } from '../db/index.js';
import { teams } from '../db/schema.js';

// Connected coordinator clients
const clients = new Set<any>();

const HEARTBEAT_INTERVAL_MS = 30_000;
const HEARTBEAT_TIMEOUT_MS = 10_000;

export async function wsHandler(app: FastifyInstance) {
  app.get('/', { websocket: true }, (socket, request) => {
    const url = new URL(request.url, `http://${request.headers.host}`);
    const token = url.searchParams.get('token');

    if (!token) {
      socket.close(4001, 'Mangler token');
      return;
    }

    const payload = verifyToken(token);
    if (!payload) {
      socket.close(4001, 'Ugyldig token');
      return;
    }

    clients.add(socket);
    app.log.info(`WebSocket tilkoblet (${clients.size} klienter)`);
    broadcast({ type: 'system.connected_users', payload: { count: clients.size }, timestamp: new Date().toISOString() });

    // ── Heartbeat ────────────────────────────────────────────────
    let isAlive = true;
    let timeoutHandle: ReturnType<typeof setTimeout> | null = null;

    const heartbeat = setInterval(() => {
      if (!isAlive) {
        // No pong received in time — terminate stale connection
        app.log.warn('WebSocket heartbeat timeout — avslutter forbindelsen');
        clearInterval(heartbeat);
        socket.terminate();
        return;
      }
      isAlive = false;
      socket.ping();

      // If pong doesn't arrive within HEARTBEAT_TIMEOUT_MS, terminate on next tick
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

    // ── Message handling ─────────────────────────────────────────
    socket.on('message', (raw: Buffer) => {
      try {
        const message = JSON.parse(raw.toString());

        if (message.type === 'team.message') {
          // Relay team message to all clients in the same event
          broadcast({
            type: 'team.message',
            eventId: message.eventId,
            payload: {
              id: crypto.randomUUID(),
              fromTeamId: message.payload?.fromTeamId,
              toTeamId: message.payload?.toTeamId ?? null,
              text: message.payload?.text,
              sentAt: new Date().toISOString(),
            },
            timestamp: new Date().toISOString(),
          });
        } else if (message.type === 'team.position') {
          const parsed = TeamPositionPayload.safeParse(message.payload);
          if (parsed.success) {
            const { teamId, position } = parsed.data;
            db.update(teams)
              .set({ currentPosition: position, lastPositionUpdate: new Date() })
              .where(eq(teams.id, teamId))
              .catch((err) => app.log.error({ err }, 'Failed to update team position'));
          }
          broadcast({
            type: 'team.position',
            eventId: message.eventId,
            payload: message.payload,
            timestamp: new Date().toISOString(),
          });
        } else if (message.type === 'team.sector_assigned') {
          broadcast({
            type: 'team.sector_assigned',
            eventId: message.eventId,
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

    // ── Cleanup ──────────────────────────────────────────────────
    socket.on('close', () => {
      clearInterval(heartbeat);
      if (timeoutHandle) clearTimeout(timeoutHandle);
      clients.delete(socket);
      app.log.info(`WebSocket frakoblet (${clients.size} klienter)`);
      broadcast({ type: 'system.connected_users', payload: { count: clients.size }, timestamp: new Date().toISOString() });
    });
  });
}

export function broadcast(message: Record<string, unknown>) {
  const data = JSON.stringify(message);
  for (const client of clients) {
    try {
      client.send(data);
    } catch {
      clients.delete(client);
    }
  }
}
