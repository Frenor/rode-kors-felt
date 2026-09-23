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
 * useOfflineTeamSync can flush the pending queue and dashboards can refetch.
 *
 * On close code 4001 (auth error), refreshes the access token via
 * lib/session before reconnecting.
 *
 * Every handler checks that it still belongs to the *current* socket. When
 * AppShell reconnects (for example after a token refresh) the old socket's
 * close event must not null out the new socket or schedule a duplicate
 * connection — that silently dropped position broadcasts and chat messages.
 */

import { create } from 'zustand';
import { refreshAccessToken } from '../lib/session';

export type WsStatus = 'disconnected' | 'connecting' | 'connected' | 'reconnecting';

type MessageHandler = (msg: Record<string, unknown>) => void;

interface WsStore {
  status: WsStatus;
  connect: (token: string, eventId?: string | null) => void;
  disconnect: () => void;
  /** Returns true when the message was handed to an open socket. */
  send: (msg: Record<string, unknown>) => boolean;
  onMessage: (handler: MessageHandler) => () => void;
}

const READY_STATE_CONNECTING = 0;
const READY_STATE_OPEN = 1;

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

function clearReconnectTimer() {
  if (reconnectTimer) {
    clearTimeout(reconnectTimer);
    reconnectTimer = null;
  }
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

function detachHandlers(ws: WebSocket) {
  ws.onopen = null;
  ws.onmessage = null;
  ws.onerror = null;
  ws.onclose = null;
}

export const useWsStore = create<WsStore>((set) => ({
  status: 'disconnected',

  connect(token: string, eventId?: string | null) {
    if (
      socket &&
      (socket.readyState === READY_STATE_OPEN || socket.readyState === READY_STATE_CONNECTING)
    ) {
      return;
    }
    clearReconnectTimer();

    const isReconnect = attempt > 0;
    set({ status: isReconnect ? 'reconnecting' : 'connecting' });
    const ws = new WebSocket(getWsUrl(eventId), getWsProtocols(token));
    socket = ws;

    ws.onopen = () => {
      if (socket !== ws) return;
      attempt = 0;
      set({ status: 'connected' });

      // Signal successful (re)connect so the offline queue can flush and
      // dashboards can reconcile state they may have missed.
      window.dispatchEvent(new Event('rkf:wsConnected'));
    };

    ws.onmessage = (event) => {
      if (socket !== ws) return;
      try {
        const msg = JSON.parse(event.data) as Record<string, unknown>;
        for (const handler of handlers) handler(msg);
      } catch (err) {
        console.error('[ws] Failed to parse incoming message', err, event.data);
      }
    };

    ws.onerror = () => {
      // onerror is always followed by onclose — handle there
    };

    ws.onclose = async (event) => {
      // A socket that was replaced or explicitly disconnected must not
      // touch shared state or schedule a reconnect.
      if (socket !== ws) return;
      socket = null;

      let nextToken = token;
      // Server closed with auth error → refresh token first
      if (event.code === 4001) {
        nextToken = (await refreshAccessToken()) ?? token;
        // disconnect() or a newer connect() may have run while we awaited.
        if (socket !== null || useWsStore.getState().status === 'disconnected') return;
      }

      set({ status: 'reconnecting' });
      const delay = nextDelay();
      reconnectTimer = setTimeout(() => {
        reconnectTimer = null;
        useWsStore.getState().connect(nextToken, eventId);
      }, delay);
    };
  },

  disconnect() {
    clearReconnectTimer();
    attempt = 0;
    const ws = socket;
    socket = null;
    if (ws) {
      detachHandlers(ws);
      try {
        ws.close();
      } catch {
        // already closed
      }
    }
    set({ status: 'disconnected' });
  },

  send(msg: Record<string, unknown>) {
    if (socket?.readyState === READY_STATE_OPEN) {
      socket.send(JSON.stringify(msg));
      return true;
    }
    return false;
  },

  onMessage(handler: MessageHandler) {
    handlers.add(handler);
    return () => handlers.delete(handler);
  },
}));
