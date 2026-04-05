import { describe, expect, it } from 'vitest';
import { __testOnly } from '../routes/ws.js';

describe('ws event binding', () => {
  it('requires explicit event for privileged roles', () => {
    expect(__testOnly.resolveConnectionEventId({ role: 'coordinator' }, null)).toBeNull();
    expect(__testOnly.resolveConnectionEventId({ role: 'coordinator' }, 'evt-1')).toBe('evt-1');
  });

  it('binds non-privileged roles to token event and rejects spoofed event', () => {
    expect(__testOnly.resolveConnectionEventId({ role: 'first_aider', eventId: 'evt-1' }, null)).toBe('evt-1');
    expect(__testOnly.resolveConnectionEventId({ role: 'first_aider', eventId: 'evt-1' }, 'evt-1')).toBe('evt-1');
    expect(__testOnly.resolveConnectionEventId({ role: 'first_aider', eventId: 'evt-1' }, 'evt-2')).toBeNull();
  });

  it('extracts auth token from websocket subprotocol header', () => {
    expect(__testOnly.extractTokenFromProtocolHeader('rkf.v1, rkf-auth.jwt.token')).toBe('jwt.token');
    expect(__testOnly.extractTokenFromProtocolHeader('rkf.v1')).toBeNull();
    expect(__testOnly.extractTokenFromProtocolHeader(undefined)).toBeNull();
  });
});
