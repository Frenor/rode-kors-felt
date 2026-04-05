import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

class MockWebSocket {
  static instances: MockWebSocket[] = [];

  static readonly OPEN = 1;

  readonly url: string;
  readonly protocols?: string | string[];
  readyState = MockWebSocket.OPEN;

  onopen: ((event: Event) => void) | null = null;
  onmessage: ((event: MessageEvent) => void) | null = null;
  onerror: ((event: Event) => void) | null = null;
  onclose: ((event: CloseEvent) => void) | null = null;

  constructor(url: string | URL, protocols?: string | string[]) {
    this.url = String(url);
    this.protocols = protocols;
    MockWebSocket.instances.push(this);
  }

  close() {
    this.readyState = 3;
  }

  send() {
    // no-op for constructor-focused tests
  }
}

beforeEach(() => {
  MockWebSocket.instances = [];
  vi.resetModules();
  vi.unstubAllEnvs();
  vi.stubGlobal('WebSocket', MockWebSocket as unknown as typeof WebSocket);
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
});

describe('ws store — secure auth handshake', () => {
  it('connects without token in URL query and sends token via subprotocol', async () => {
    const { useWsStore } = await import('../stores/ws');

    useWsStore.getState().connect('jwt.token.value');

    const socket = MockWebSocket.instances[0];
    expect(socket).toBeDefined();
    expect(socket!.url).toBe('ws://localhost:3000/ws');
    expect(socket!.url.includes('token=')).toBe(false);
    expect(socket!.protocols).toEqual(['rkf.v1', 'rkf-auth.jwt.token.value']);
  });

  it('uses explicit ws url unchanged and does not append token query', async () => {
    vi.stubEnv('VITE_WS_URL', 'wss://example.test/ws');
    const { useWsStore } = await import('../stores/ws');

    useWsStore.getState().connect('secret-token');

    const socket = MockWebSocket.instances[0];
    expect(socket).toBeDefined();
    expect(socket!.url).toBe('wss://example.test/ws');
    expect(socket!.url.includes('token=')).toBe(false);
    expect(socket!.protocols).toEqual(['rkf.v1', 'rkf-auth.secret-token']);
  });

  it('appends eventId query parameter without leaking token when event scope is provided', async () => {
    const { useWsStore } = await import('../stores/ws');

    useWsStore.getState().connect('jwt.token.value', 'evt-123');

    const socket = MockWebSocket.instances[0];
    expect(socket).toBeDefined();
    expect(socket!.url).toBe('ws://localhost:3000/ws?eventId=evt-123');
    expect(socket!.url.includes('token=')).toBe(false);
    expect(socket!.protocols).toEqual(['rkf.v1', 'rkf-auth.jwt.token.value']);
  });
});
