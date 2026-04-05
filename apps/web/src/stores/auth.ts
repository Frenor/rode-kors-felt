import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';

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
      storage: createJSONStorage(() => sessionStorage),
    },
  ),
);
