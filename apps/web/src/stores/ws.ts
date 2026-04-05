/**
 * WebSocket store — manages native WS lifecycle with exponential backoff.
 *
 * States:
 *  disconnected  — not connected, not trying
 *  connecting    — first connection attempt in progress
 *  connected     — live connection, real-time updates flowing
 *  reconnecting  — connection dropped, retrying with backoff
 *
 * On successful reconnect, dispatches 'rkf:wsConnected' on window so
 * useOfflineSync can flush the pending queue.
 *
 * On close code 4001 (auth error), refreshes the access token via
 * the auth store before reconnecting.
 */

import { create } from 'zustand';

export type WsStatus = 'disconnected' | 'connecting' | 'connected' | 'reconnecting';

type MessageHandler = (msg: Record<string, unknown>) => void;

interface WsStore {
  status: WsStatus;
  connect: (token: string, eventId?: string | null) => void;
  disconnect: () => void;
  send: (msg: Record<string, unknown>) => void;
  onMessage: (handler: MessageHandler) => () => void;
}

let socket: WebSocket | null = null;
let attempt = 0;
let reconnectTimer: ReturnType<typeof setTimeout> | null = null;
const handlers = new Set<MessageHandler>();

// Backoff schedule: 1s, 2s, 4s, 8s, 30s (cap — keep retrying indefinitely)
const BACKOFF_DELAYS = [1_000, 2_000, 4_000, 8_000];
const MAX_DELAY_MS = 30_000;

function nextDelay(): number {
  return attempt < BACKOFF_DELAYS.length ? BACKOFF_DELAYS[attempt++]! : MAX_DELAY_MS;
}

function getWsUrl(eventId?: string | null) {
  const explicitWsUrl = import.meta.env.VITE_WS_URL as string | undefined;
  if (explicitWsUrl) {
    if (!eventId) return explicitWsUrl;
    const separator = explicitWsUrl.includes('?') ? '&' : '?';
    return `${explicitWsUrl}${separator}eventId=${encodeURIComponent(eventId)}`;
  }
  const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
  const base = `${protocol}//${window.location.host}/ws`;
  if (!eventId) return base;
  return `${base}?eventId=${encodeURIComponent(eventId)}`;
}

function getWsProtocols(token: string): string[] {
  return ['rkf.v1', `rkf-auth.${token}`];
}

async function tryRefreshToken(): Promise<string | null> {
  try {
    // Lazy-import to avoid circular deps with auth store
    const { useAuthStore } = await import('./auth');
    const { refreshToken } = useAuthStore.getState();
    if (!refreshToken) return null;

    const res = await fetch('/api/auth/refresh', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ refreshToken }),
    });

    if (!res.ok) return null;
    const { accessToken } = (await res.json()) as { accessToken: string };
    useAuthStore.setState({ accessToken });
    return accessToken;
  } catch {
    return null;
  }
}

export const useWsStore = create<WsStore>((set) => ({
  status: 'disconnected',

  connect(token: string, eventId?: string | null) {
    if (socket && socket.readyState === WebSocket.OPEN) return;
    if (reconnectTimer) clearTimeout(reconnectTimer);

    const isReconnect = attempt > 0;
    set({ status: isReconnect ? 'reconnecting' : 'connecting' });
    socket = new WebSocket(getWsUrl(eventId), getWsProtocols(token));

    socket.onopen = () => {
      attempt = 0;
      set({ status: 'connected' });

      // Signal successful reconnect so offline queue can flush
      window.dispatchEvent(new Event('rkf:wsConnected'));
    };

    socket.onmessage = (event) => {
      try {
        const msg = JSON.parse(event.data) as Record<string, unknown>;
        for (const handler of handlers) handler(msg);
      } catch {
        // ignore malformed
      }
    };

    socket.onerror = () => {
      // onerror is always followed by onclose — handle there
    };

    socket.onclose = async (event) => {
      socket = null;

      // Server closed with auth error → refresh token first
      if (event.code === 4001) {
        const newToken = await tryRefreshToken();
        set({ status: 'reconnecting' });
        const delay = nextDelay();
        reconnectTimer = setTimeout(
              () => useWsStore.getState().connect(newToken ?? token, eventId),
              delay,
            );
            return;
      }

      set({ status: 'reconnecting' });
      const delay = nextDelay();
      reconnectTimer = setTimeout(() => useWsStore.getState().connect(token, eventId), delay);
    };
  },

  disconnect() {
    if (reconnectTimer) clearTimeout(reconnectTimer);
    attempt = BACKOFF_DELAYS.length + 1; // prevent reconnect on next close
    socket?.close();
    socket = null;
    set({ status: 'disconnected' });
  },

  send(msg: Record<string, unknown>) {
    if (socket?.readyState === WebSocket.OPEN) {
      socket.send(JSON.stringify(msg));
    }
  },

  onMessage(handler: MessageHandler) {
    handlers.add(handler);
    return () => handlers.delete(handler);
  },
}));
