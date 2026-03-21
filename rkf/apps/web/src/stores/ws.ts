/**
 * WebSocket store — manages native WS lifecycle with exponential backoff.
 * Messages are NOT stored here; they are dispatched to registered handlers.
 */

import { create } from 'zustand';

type MessageHandler = (msg: Record<string, unknown>) => void;

interface WsStore {
  status: 'disconnected' | 'connecting' | 'connected' | 'error';
  connect: (token: string) => void;
  disconnect: () => void;
  send: (msg: Record<string, unknown>) => void;
  onMessage: (handler: MessageHandler) => () => void;
}

let socket: WebSocket | null = null;
let attempt = 0;
let reconnectTimer: ReturnType<typeof setTimeout> | null = null;
const handlers = new Set<MessageHandler>();

const DELAYS = [1000, 2000, 4000, 8000, 16000];

function getWsUrl(token: string) {
  const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
  return `${protocol}//${window.location.host}/ws?token=${encodeURIComponent(token)}`;
}

export const useWsStore = create<WsStore>((set) => ({
  status: 'disconnected',

  connect(token: string) {
    if (socket && socket.readyState === WebSocket.OPEN) return;

    if (reconnectTimer) clearTimeout(reconnectTimer);

    set({ status: 'connecting' });
    socket = new WebSocket(getWsUrl(token));

    socket.onopen = () => {
      attempt = 0;
      set({ status: 'connected' });
    };

    socket.onmessage = (event) => {
      try {
        const msg = JSON.parse(event.data) as Record<string, unknown>;
        for (const handler of handlers) handler(msg);
      } catch {
        // ignore malformed
      }
    };

    socket.onerror = () => set({ status: 'error' });

    socket.onclose = () => {
      set({ status: 'disconnected' });
      socket = null;
      if (attempt < DELAYS.length) {
        const delay = DELAYS[attempt++];
        reconnectTimer = setTimeout(() => useWsStore.getState().connect(token), delay);
      }
    };
  },

  disconnect() {
    if (reconnectTimer) clearTimeout(reconnectTimer);
    attempt = DELAYS.length; // prevent reconnect
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
