import { beforeEach, describe, expect, it, vi } from 'vitest';
import { useAuthStore } from '../stores/auth';
import { api } from '../lib/api';

const initialState = {
  accessToken: null,
  refreshToken: null,
  role: null,
  eventId: null,
  eventName: null,
  teams: [],
  isAuthenticated: false,
};

function makeFetchResponse(body: unknown, ok = true, status = 200): Response {
  return {
    ok,
    status,
    json: vi.fn().mockResolvedValue(body),
  } as unknown as Response;
}

beforeEach(() => {
  useAuthStore.setState(initialState);
  vi.restoreAllMocks();
});

describe('ApiClient — Authorization header', () => {
  it('does NOT include Authorization header when accessToken is null', async () => {
    const fetchMock = vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      makeFetchResponse({ ok: true })
    );

    await api.getEvents();

    const calledHeaders = fetchMock.mock.calls[0]![1]?.headers as Record<string, string>;
    expect(calledHeaders['Authorization']).toBeUndefined();
  });

  it('includes Authorization: Bearer <token> header when accessToken is set', async () => {
    useAuthStore.setState({ accessToken: 'my-token' });

    const fetchMock = vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      makeFetchResponse({ events: [] })
    );

    await api.getEvents();

    const calledHeaders = fetchMock.mock.calls[0]![1]?.headers as Record<string, string>;
    expect(calledHeaders['Authorization']).toBe('Bearer my-token');
  });
});

describe('ApiClient — response handling', () => {
  it('returns parsed JSON when response is ok', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      makeFetchResponse({ events: [{ id: '1' }] })
    );

    const result = await api.getEvents();
    expect(result).toEqual({ events: [{ id: '1' }] });
  });

  it('throws with the error message from JSON body when response is not ok', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      makeFetchResponse({ error: 'some message' }, false, 400)
    );

    await expect(api.getEvents()).rejects.toThrow('some message');
  });

  it('throws with "Nettverksfeil" when response is not ok and body is not JSON', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue({
      ok: false,
      status: 500,
      json: vi.fn().mockRejectedValue(new SyntaxError('not JSON')),
    } as unknown as Response);

    await expect(api.getEvents()).rejects.toThrow('Nettverksfeil');
  });
});

describe('ApiClient — redeemCode()', () => {
  it('calls POST /api/auth/code with the provided code in the body', async () => {
    const fetchMock = vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      makeFetchResponse({
        accessToken: 'tok',
        refreshToken: 'ref',
        role: 'first_aider',
        eventId: 'e1',
        eventName: 'Event',
        teams: [],
      })
    );

    await api.redeemCode('123456');

    expect(fetchMock).toHaveBeenCalledOnce();
    const [url, init] = fetchMock.mock.calls[0]!;
    expect(url).toBe('/api/auth/code');
    expect(init?.method).toBe('POST');
    expect(JSON.parse(init?.body as string)).toEqual({ code: '123456' });
  });
});

// createIncident has been removed (incident management removed from the app)

describe('ApiClient — access token refresh', () => {
  function b64url(value: unknown): string {
    return btoa(JSON.stringify(value)).replace(/=/g, '').replace(/\+/g, '-').replace(/\//g, '_');
  }
  function jwt(expSecondsFromNow: number): string {
    const exp = Math.floor(Date.now() / 1000) + expSecondsFromNow;
    return `${b64url({ alg: 'HS256' })}.${b64url({ exp })}.sig`;
  }

  it('refreshes once and replays the request when the API answers 401', async () => {
    const oldToken = jwt(600);
    useAuthStore.setState({ accessToken: oldToken, refreshToken: 'refresh-1', isAuthenticated: true });

    const fetchMock = vi.spyOn(globalThis, 'fetch')
      .mockResolvedValueOnce(makeFetchResponse({ error: 'Ugyldig eller utløpt token' }, false, 401))
      .mockResolvedValueOnce(makeFetchResponse({ accessToken: 'fresh-token' }))
      .mockResolvedValueOnce(makeFetchResponse({ events: [{ id: 'e1' }] }));

    const result = await api.getEvents();

    expect(result).toEqual({ events: [{ id: 'e1' }] });
    expect(fetchMock).toHaveBeenCalledTimes(3);
    expect(fetchMock.mock.calls[1]![0]).toBe('/api/auth/refresh');
    const retryHeaders = fetchMock.mock.calls[2]![1]?.headers as Record<string, string>;
    expect(retryHeaders['Authorization']).toBe('Bearer fresh-token');
    expect(useAuthStore.getState().accessToken).toBe('fresh-token');
  });

  it('logs the user out and throws when the refresh is rejected', async () => {
    useAuthStore.setState({ accessToken: jwt(600), refreshToken: 'stale', isAuthenticated: true });

    vi.spyOn(globalThis, 'fetch')
      .mockResolvedValueOnce(makeFetchResponse({ error: 'Ugyldig eller utløpt token' }, false, 401))
      .mockResolvedValueOnce(makeFetchResponse({ error: 'Ugyldig refresh token' }, false, 401));

    await expect(api.getEvents()).rejects.toThrow('Ugyldig eller utløpt token');
    expect(useAuthStore.getState().isAuthenticated).toBe(false);
  });

  it('refreshes proactively before sending when the token is about to expire', async () => {
    useAuthStore.setState({ accessToken: jwt(20), refreshToken: 'refresh-1', isAuthenticated: true });

    const fetchMock = vi.spyOn(globalThis, 'fetch')
      .mockResolvedValueOnce(makeFetchResponse({ accessToken: 'fresh-token' }))
      .mockResolvedValueOnce(makeFetchResponse({ events: [] }));

    await api.getEvents();

    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(fetchMock.mock.calls[0]![0]).toBe('/api/auth/refresh');
    const headers = fetchMock.mock.calls[1]![1]?.headers as Record<string, string>;
    expect(headers['Authorization']).toBe('Bearer fresh-token');
  });

  it('does not attempt a refresh for unauthenticated requests that fail with 401', async () => {
    const fetchMock = vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      makeFetchResponse({ error: 'Ugyldig eller utløpt kode' }, false, 401),
    );

    await expect(api.redeemCode('000000')).rejects.toThrow('Ugyldig eller utløpt kode');
    expect(fetchMock).toHaveBeenCalledOnce();
  });
});
