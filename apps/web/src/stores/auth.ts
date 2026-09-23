import { create } from 'zustand';
import { persist, createJSONStorage, type StateStorage } from 'zustand/middleware';

export type TeamTransport = 'foot' | 'bike' | 'vehicle' | 'atv';

interface AuthState {
  accessToken: string | null;
  refreshToken: string | null;
  role: string | null;
  eventId: string | null;
  eventName: string | null;
  teams: Array<{ id: string; name: string; transport?: TeamTransport }>;
  isAuthenticated: boolean;

  login: (data: {
    accessToken: string;
    refreshToken: string;
    role: string;
    eventId?: string;
    eventName?: string;
    teams?: Array<{ id: string; name: string; transport?: TeamTransport }>;
  }) => void;
  updateTeamTransport: (teamId: string, transport: TeamTransport) => void;
  logout: () => void;
}

/**
 * Roles that authenticate with a personal password. Their session is kept in
 * sessionStorage only (cleared when the tab/app closes).
 */
const PRIVILEGED_ROLES = new Set(['coordinator', 'admin']);

function getStorage(kind: 'local' | 'session'): Storage | null {
  try {
    return kind === 'local' ? window.localStorage : window.sessionStorage;
  } catch {
    return null;
  }
}

function extractRole(serialized: string): string | null {
  try {
    const parsed = JSON.parse(serialized) as { state?: { role?: unknown } };
    return typeof parsed.state?.role === 'string' ? parsed.state.role : null;
  } catch {
    return null;
  }
}

/**
 * Storage policy:
 *  - Field roles (first aider, sick bay) redeem a shared event code. Their
 *    session survives app restarts (localStorage) so a phone that kills the
 *    PWA in the background — or a first aider who opens the maps app for
 *    navigation — does not have to re-enter the code every time.
 *  - Coordinator/admin sessions stay in sessionStorage.
 * Reads check sessionStorage first so a coordinator login in the same browser
 * takes precedence over an older field session.
 */
export const roleAwareAuthStorage: StateStorage = {
  getItem: (name) => {
    const session = getStorage('session');
    const local = getStorage('local');
    return session?.getItem(name) ?? local?.getItem(name) ?? null;
  },
  setItem: (name, value) => {
    const role = extractRole(value);
    const durable = role !== null && !PRIVILEGED_ROLES.has(role);
    const target = getStorage(durable ? 'local' : 'session');
    const other = getStorage(durable ? 'session' : 'local');
    target?.setItem(name, value);
    other?.removeItem(name);
  },
  removeItem: (name) => {
    getStorage('session')?.removeItem(name);
    getStorage('local')?.removeItem(name);
  },
};

export const useAuthStore = create<AuthState>()(
  persist(
    (set) => ({
      accessToken: null,
      refreshToken: null,
      role: null,
      eventId: null,
      eventName: null,
      teams: [],
      isAuthenticated: false,

      login: (data) =>
        set({
          accessToken: data.accessToken,
          refreshToken: data.refreshToken,
          role: data.role,
          eventId: data.eventId || null,
          eventName: data.eventName || null,
          teams: data.teams || [],
          isAuthenticated: true,
        }),

      updateTeamTransport: (teamId, transport) =>
        set((state) => ({
          teams: state.teams.map((t) => t.id === teamId ? { ...t, transport } : t),
        })),

      logout: () =>
        set({
          accessToken: null,
          refreshToken: null,
          role: null,
          eventId: null,
          eventName: null,
          teams: [],
          isAuthenticated: false,
        }),
    }),
    {
      name: 'rkf-auth',
      storage: createJSONStorage(() => roleAwareAuthStorage),
    },
  ),
);
