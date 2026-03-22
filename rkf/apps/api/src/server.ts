import Fastify from 'fastify';
import cors from '@fastify/cors';
import helmet from '@fastify/helmet';
import sensible from '@fastify/sensible';
import websocket from '@fastify/websocket';
import { pool } from './db/index.js';
import { runMigrations } from './db/migrate.js';
import { seedDatabase } from './db/seed.js';
import { authRoutes } from './routes/auth.js';
import { eventRoutes } from './routes/events.js';
import { incidentRoutes } from './routes/incidents.js';
import { patientRoutes } from './routes/patients.js';
import { wsHandler } from './routes/ws.js';

const PORT = parseInt(process.env.PORT || '4000', 10);
const HOST = process.env.HOST || '0.0.0.0';

async function buildServer() {
  const app = Fastify({
    logger: {
      level: process.env.LOG_LEVEL || 'info',
      transport:
        process.env.NODE_ENV !== 'production'
          ? { target: 'pino-pretty', options: { colorize: true } }
          : undefined,
    },
  });

  // Plugins
  await app.register(helmet, { contentSecurityPolicy: false });
  await app.register(cors, {
    origin: process.env.CORS_ORIGIN || 'http://localhost:3000',
    credentials: true,
  });
  await app.register(sensible);
  await app.register(websocket);

  // ── Request tracing — correlation ID header ───────────────────────
  // Adds X-Request-Id to every response; binds to Fastify's pino logger
  // so all log lines within a request share the same request id.
  app.addHook('onRequest', (request, _reply, done) => {
    const traceId = (request.headers['x-request-id'] as string | undefined)
      ?? crypto.randomUUID();
    (request as any).traceId = traceId;
    request.log = request.log.child({ traceId });
    done();
  });

  app.addHook('onSend', (_request, reply, _payload, done) => {
    reply.header('X-Request-Id', (_request as any).traceId ?? '');
    done();
  });

  // ── Latency logging ───────────────────────────────────────────────
  app.addHook('onResponse', (request, reply, done) => {
    request.log.info({
      method: request.method,
      url: request.url,
      status: reply.statusCode,
      durationMs: reply.elapsedTime,
    }, 'request completed');
    done();
  });

  // Health check — includes DB connectivity
  app.get('/health', async () => {
    let dbStatus = 'ok';
    try {
      const client = await pool.connect();
      await client.query('SELECT 1');
      client.release();
    } catch {
      dbStatus = 'error';
    }
    return {
      status: dbStatus === 'ok' ? 'ok' : 'degraded',
      db: dbStatus,
      timestamp: new Date().toISOString(),
      version: process.env.npm_package_version || '0.1.0',
    };
  });

  // Routes
  await app.register(authRoutes, { prefix: '/api/auth' });
  await app.register(eventRoutes, { prefix: '/api/events' });
  await app.register(incidentRoutes, { prefix: '/api/incidents' });
  await app.register(patientRoutes, { prefix: '/api/patients' });
  await app.register(wsHandler, { prefix: '/ws' });

  return app;
}

async function start() {
  const app = await buildServer();

  try {
    // Run migrations then seed demo data
    app.log.info('Kjører database-migrasjoner...');
    await runMigrations();
    app.log.info('Migrasjoner fullført');

    if (process.env.NODE_ENV !== 'production') {
      await seedDatabase();
    }

    await app.listen({ port: PORT, host: HOST });
    app.log.info(`RKF API running on ${HOST}:${PORT}`);
  } catch (err) {
    app.log.error(err);
    process.exit(1);
  }

  // Graceful shutdown
  const shutdown = async (signal: string) => {
    app.log.info(`${signal} mottatt — avslutter gracefully`);
    await app.close();
    await pool.end();
    process.exit(0);
  };

  process.on('SIGTERM', () => shutdown('SIGTERM'));
  process.on('SIGINT', () => shutdown('SIGINT'));
}

start();

export { buildServer };
