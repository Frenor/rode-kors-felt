import type { FastifyInstance } from 'fastify';
import { eq } from 'drizzle-orm';
import { TeamPositionPayload } from '@rkf/shared-types';
import { verifyToken } from '../middleware/auth.js';
import { db } from '../db/index.js';
import { teams } from '../db/schema.js';

// Connected coordinator clients
const clients = new Set<any>();

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

    socket.on('message', (raw: Buffer) => {
      try {
        const message = JSON.parse(raw.toString());

        if (message.type === 'team.position') {
          const parsed = TeamPositionPayload.safeParse(message.payload);
          if (parsed.success) {
            const { teamId, position } = parsed.data;
            // Persist to DB (fire-and-forget — position loss on failure is acceptable)
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
        }
      } catch {
        // ignore malformed messages
      }
    });

    socket.on('close', () => {
      clients.delete(socket);
      app.log.info(`WebSocket frakoblet (${clients.size} klienter)`);
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
