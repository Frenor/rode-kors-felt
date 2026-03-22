import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import type { FastifyInstance } from 'fastify';
import { buildApp } from './helpers.js';

let app: FastifyInstance;

beforeAll(async () => {
  app = await buildApp();
});

afterAll(async () => {
  await app.close();
});

describe('POST /api/auth/code', () => {
  it('returns 200 with tokens and role first_aider for code 123456', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/auth/code',
      payload: { code: '123456' },
    });

    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body).toHaveProperty('accessToken');
    expect(body).toHaveProperty('refreshToken');
    expect(body.role).toBe('first_aider');
    expect(body).toHaveProperty('eventId');
    expect(Array.isArray(body.teams)).toBe(true);
  });

  it('returns 200 with role sickbay for code 654321', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/auth/code',
      payload: { code: '654321' },
    });

    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.role).toBe('sickbay');
    expect(body).toHaveProperty('accessToken');
    expect(body).toHaveProperty('refreshToken');
  });

  it('returns 4xx for invalid code 000000', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/auth/code',
      payload: { code: '000000' },
    });

    expect(res.statusCode).toBeGreaterThanOrEqual(400);
  });
});

describe('POST /api/auth/login', () => {
  it('returns 200 with accessToken and role coordinator for valid admin credentials', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/auth/login',
      payload: { email: 'admin@rkf.no', password: 'admin123' },
    });

    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body).toHaveProperty('accessToken');
    // The seeded admin user has role 'coordinator'
    expect(body.role).toBe('coordinator');
  });

  it('returns 4xx for wrong password', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/auth/login',
      payload: { email: 'admin@rkf.no', password: 'wrongpassword' },
    });

    expect(res.statusCode).toBeGreaterThanOrEqual(400);
  });

  it('returns 4xx for unknown email', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/auth/login',
      payload: { email: 'nobody@rkf.no', password: 'admin123' },
    });

    expect(res.statusCode).toBeGreaterThanOrEqual(400);
  });
});

describe('POST /api/auth/refresh', () => {
  it('returns 200 with a new accessToken given a valid refresh token', async () => {
    // Obtain a real refresh token first
    const loginRes = await app.inject({
      method: 'POST',
      url: '/api/auth/login',
      payload: { email: 'admin@rkf.no', password: 'admin123' },
    });
    const { refreshToken } = loginRes.json();

    const res = await app.inject({
      method: 'POST',
      url: '/api/auth/refresh',
      payload: { refreshToken },
    });

    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body).toHaveProperty('accessToken');
    expect(typeof body.accessToken).toBe('string');
    expect(body.accessToken.length).toBeGreaterThan(0);
  });
});
