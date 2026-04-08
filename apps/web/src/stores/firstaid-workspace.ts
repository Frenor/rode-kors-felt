import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';
import type { TeamOperationalStatus, TeamPatientStatus } from '../lib/types';

interface FirstAidWorkspaceState {
  selectedTeamId: string | null;
  activePatientIdByTeam: Record<string, string>;
  latestStatusByTeam: Record<string, TeamOperationalStatus>;
  lastSyncedAtByTeam: Record<string, string>;
  /** Optimistic per-patient status. Key: `{eventId}:{teamId}:{patientId}` */
  patientStatusMap: Record<string, TeamPatientStatus>;
  setSelectedTeam: (teamId: string | null) => void;
  setActivePatient: (eventId: string, teamId: string, patientId: string) => void;
  clearActivePatient: (eventId: string, teamId: string) => void;
  setTeamStatus: (eventId: string, teamId: string, status: TeamOperationalStatus) => void;
  setTeamSyncedAt: (eventId: string, teamId: string, iso: string) => void;
  setPatientStatus: (eventId: string, teamId: string, patientId: string, status: TeamPatientStatus) => void;
  clearPatientStatus: (eventId: string, teamId: string, patientId: string) => void;
}

const keyFor = (eventId: string, teamId: string) => `${eventId}:${teamId}`;
const patientKeyFor = (eventId: string, teamId: string, patientId: string) => `${eventId}:${teamId}:${patientId}`;

export const useFirstAidWorkspaceStore = create<FirstAidWorkspaceState>()(
  persist(
    (set) => ({
      selectedTeamId: null,
      activePatientIdByTeam: {},
      latestStatusByTeam: {},
      lastSyncedAtByTeam: {},
      patientStatusMap: {},
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
      setPatientStatus: (eventId, teamId, patientId, status) =>
        set((state) => ({
          patientStatusMap: {
            ...state.patientStatusMap,
            [patientKeyFor(eventId, teamId, patientId)]: status,
          },
        })),
      clearPatientStatus: (eventId, teamId, patientId) =>
        set((state) => {
          const next = { ...state.patientStatusMap };
          delete next[patientKeyFor(eventId, teamId, patientId)];
          return { patientStatusMap: next };
        }),
    }),
    {
      name: 'rkf-firstaid-workspace',
      storage: createJSONStorage(() => localStorage),
    },
  ),
);

