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

describe('ApiClient — createIncident()', () => {
  it('calls POST /api/incidents with the provided data', async () => {
    const fetchMock = vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      makeFetchResponse({ incident: { id: 'inc-1' } })
    );

    await api.createIncident({ type: 'medical', eventId: 'evt-1' });

    expect(fetchMock).toHaveBeenCalledOnce();
    const [url, init] = fetchMock.mock.calls[0]!;
    expect(url).toBe('/api/incidents');
    expect(init?.method).toBe('POST');
    expect(JSON.parse(init?.body as string)).toEqual({ type: 'medical', eventId: 'evt-1' });
  });
});
