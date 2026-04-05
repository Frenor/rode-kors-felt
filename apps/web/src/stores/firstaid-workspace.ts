import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';
import type { TeamOperationalStatus } from '../lib/types';

interface FirstAidWorkspaceState {
  selectedTeamId: string | null;
  activePatientIdByTeam: Record<string, string>;
  latestStatusByTeam: Record<string, TeamOperationalStatus>;
  lastSyncedAtByTeam: Record<string, string>;
  setSelectedTeam: (teamId: string | null) => void;
  setActivePatient: (eventId: string, teamId: string, patientId: string) => void;
  clearActivePatient: (eventId: string, teamId: string) => void;
  setTeamStatus: (eventId: string, teamId: string, status: TeamOperationalStatus) => void;
  setTeamSyncedAt: (eventId: string, teamId: string, iso: string) => void;
}

const keyFor = (eventId: string, teamId: string) => `${eventId}:${teamId}`;

export const useFirstAidWorkspaceStore = create<FirstAidWorkspaceState>()(
  persist(
    (set) => ({
      selectedTeamId: null,
      activePatientIdByTeam: {},
      latestStatusByTeam: {},
      lastSyncedAtByTeam: {},
      setSelectedTeam: (teamId) => set({ selectedTeamId: teamId }),
      setActivePatient: (eventId, teamId, patientId) =>
        set((state) => ({
          activePatientIdByTeam: {
            ...state.activePatientIdByTeam,
            [keyFor(eventId, teamId)]: patientId,
          },
        })),
      clearActivePatient: (eventId, teamId) =>
        set((state) => {
          const next = { ...state.activePatientIdByTeam };
          delete next[keyFor(eventId, teamId)];
          return { activePatientIdByTeam: next };
        }),
      setTeamStatus: (eventId, teamId, status) =>
        set((state) => ({
          latestStatusByTeam: {
            ...state.latestStatusByTeam,
            [keyFor(eventId, teamId)]: status,
          },
        })),
      setTeamSyncedAt: (eventId, teamId, iso) =>
        set((state) => ({
          lastSyncedAtByTeam: {
            ...state.lastSyncedAtByTeam,
            [keyFor(eventId, teamId)]: iso,
          },
        })),
    }),
    {
      name: 'rkf-firstaid-workspace',
      storage: createJSONStorage(() => localStorage),
    },
  ),
);

