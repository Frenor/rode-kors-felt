import type { FastifyInstance } from 'fastify';
import { TeamPositionPayload } from '@rkf/shared-types';
import { verifyToken } from '../middleware/auth.js';
import { store } from '../db/store.js';

// Connected coordinator clients
const clients = new Set<any>();

export async function wsHandler(app: FastifyInstance) {
  app.get('/', { websocket: true }, (socket, request) => {
    // Verify token from query string
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
        // Handle team position updates — persist and broadcast
        if (message.type === 'team.position') {
          const parsed = TeamPositionPayload.safeParse(message.payload);
          if (parsed.success) {
            const { teamId, position } = parsed.data;
            const team = store.teams.get(teamId);
            if (team) {
              store.teams.set(teamId, {
                ...team,
                currentPosition: position,
                lastPositionUpdate: new Date().toISOString(),
              });
            }
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
