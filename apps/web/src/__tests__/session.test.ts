import { beforeEach, describe, expect, it, vi } from 'vitest';
import { useAuthStore } from '../stores/auth';
import {
  decodeTokenExp,
  isTokenExpiringSoon,
  refreshAccessToken,
  SESSION_EXPIRED_KEY,
} from '../lib/session';

const initialState = {
  accessToken: null,
  refreshToken: null,
  role: null,
  eventId: null,
  eventName: null,
  teams: [],
  isAuthenticated: false,
};

function b64url(value: unknown): string {
  return btoa(JSON.stringify(value)).replace(/=/g, '').replace(/\+/g, '-').replace(/\//g, '_');
}

export function makeJwt(expSecondsFromNow: number): string {
  const exp = Math.floor(Date.now() / 1000) + expSecondsFromNow;
  return `${b64url({ alg: 'HS256', typ: 'JWT' })}.${b64url({ role: 'first_aider', exp })}.signature`;
}

function makeFetchResponse(body: unknown, ok = true, status = 200): Response {
  return {
    ok,
    status,
    json: vi.fn().mockResolvedValue(body),
  } as unknown as Response;
}

beforeEach(() => {
  useAuthStore.setState(initialState);
  sessionStorage.clear();
  vi.restoreAllMocks();
});

describe('session — token inspection', () => {
  it('decodes the exp claim from a JWT and returns null for opaque tokens', () => {
    const token = makeJwt(600);
    const exp = decodeTokenExp(token);
    expect(exp).not.toBeNull();
    expect(exp! - Math.floor(Date.now() / 1000)).toBeGreaterThan(590);
    expect(decodeTokenExp('demo-token')).toBeNull();
    expect(decodeTokenExp(null)).toBeNull();
  });

  it('flags tokens that expire within the skew window', () => {
    expect(isTokenExpiringSoon(makeJwt(30))).toBe(true);
    expect(isTokenExpiringSoon(makeJwt(-10))).toBe(true);
    expect(isTokenExpiringSoon(makeJwt(600))).toBe(false);
    expect(isTokenExpiringSoon('demo-token')).toBe(false);
  });
});

describe('session — refreshAccessToken()', () => {
  it('returns null without calling the API when no refresh token is stored', async () => {
    const fetchMock = vi.spyOn(globalThis, 'fetch');
    expect(await refreshAccessToken()).toBeNull();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('stores the new access token and shares one in-flight request', async () => {
    useAuthStore.setState({ accessToken: 'old', refreshToken: 'refresh-1', isAuthenticated: true });
    const fetchMock = vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      makeFetchResponse({ accessToken: 'new-token' }),
    );

    const [a, b] = await Promise.all([refreshAccessToken(), refreshAccessToken()]);

    expect(a).toBe('new-token');
    expect(b).toBe('new-token');
    expect(fetchMock).toHaveBeenCalledOnce();
    expect(fetchMock.mock.calls[0]![0]).toBe('/api/auth/refresh');
    expect(JSON.parse(fetchMock.mock.calls[0]![1]?.body as string)).toEqual({ refreshToken: 'refresh-1' });
    expect(useAuthStore.getState().accessToken).toBe('new-token');
    expect(useAuthStore.getState().isAuthenticated).toBe(true);
  });

  it('logs out and flags the session as expired when the refresh token is rejected', async () => {
    useAuthStore.setState({ accessToken: 'old', refreshToken: 'stale', isAuthenticated: true, role: 'first_aider' });
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      makeFetchResponse({ error: 'Ugyldig refresh token' }, false, 401),
    );

    expect(await refreshAccessToken()).toBeNull();
    expect(useAuthStore.getState().isAuthenticated).toBe(false);
    expect(useAuthStore.getState().accessToken).toBeNull();
    expect(sessionStorage.getItem(SESSION_EXPIRED_KEY)).toBe('1');
  });

  it('keeps the session when the refresh request fails on the network', async () => {
    useAuthStore.setState({ accessToken: 'old', refreshToken: 'refresh-1', isAuthenticated: true });
    vi.spyOn(globalThis, 'fetch').mockRejectedValue(new TypeError('Failed to fetch'));

    expect(await refreshAccessToken()).toBeNull();
    expect(useAuthStore.getState().isAuthenticated).toBe(true);
    expect(useAuthStore.getState().accessToken).toBe('old');
    expect(sessionStorage.getItem(SESSION_EXPIRED_KEY)).toBeNull();
  });
});
