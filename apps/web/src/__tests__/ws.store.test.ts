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

describe('ws store — reconnect safety', () => {
  it('ignores the close event of a socket that was replaced by disconnect()+connect()', async () => {
    vi.useFakeTimers();
    try {
      const { useWsStore } = await import('../stores/ws');
      const store = useWsStore.getState();

      store.connect('token-1', 'evt-1');
      const first = MockWebSocket.instances[0]!;
      first.onopen?.(new Event('open'));
      expect(useWsStore.getState().status).toBe('connected');

      // AppShell re-runs its effect after a token refresh: disconnect + connect.
      store.disconnect();
      store.connect('token-2', 'evt-1');
      const second = MockWebSocket.instances[1]!;
      second.onopen?.(new Event('open'));
      expect(useWsStore.getState().status).toBe('connected');

      // The browser delivers the old socket's close asynchronously. Handlers
      // were detached, but even a stray call must not affect the new socket.
      first.onclose?.({ code: 1005 } as CloseEvent);
      vi.advanceTimersByTime(60_000);

      expect(useWsStore.getState().status).toBe('connected');
      expect(MockWebSocket.instances).toHaveLength(2);
      expect(useWsStore.getState().send({ type: 'team.position' })).toBe(true);
    } finally {
      vi.useRealTimers();
    }
  });

  it('reconnects with backoff when the live socket closes unexpectedly', async () => {
    vi.useFakeTimers();
    try {
      const { useWsStore } = await import('../stores/ws');
      useWsStore.getState().connect('token-1', 'evt-1');
      const first = MockWebSocket.instances[0]!;
      first.onopen?.(new Event('open'));

      first.onclose?.({ code: 1006 } as CloseEvent);
      await Promise.resolve();
      expect(useWsStore.getState().status).toBe('reconnecting');
      expect(useWsStore.getState().send({ type: 'x' })).toBe(false);

      vi.advanceTimersByTime(1_000);
      expect(MockWebSocket.instances).toHaveLength(2);
      expect(MockWebSocket.instances[1]!.protocols).toEqual(['rkf.v1', 'rkf-auth.token-1']);
    } finally {
      vi.useRealTimers();
    }
  });

  it('does not reconnect after an explicit disconnect()', async () => {
    vi.useFakeTimers();
    try {
      const { useWsStore } = await import('../stores/ws');
      useWsStore.getState().connect('token-1', 'evt-1');
      const first = MockWebSocket.instances[0]!;
      first.onopen?.(new Event('open'));

      useWsStore.getState().disconnect();
      first.onclose?.({ code: 1000 } as CloseEvent);
      vi.advanceTimersByTime(60_000);

      expect(useWsStore.getState().status).toBe('disconnected');
      expect(MockWebSocket.instances).toHaveLength(1);
    } finally {
      vi.useRealTimers();
    }
  });
});
