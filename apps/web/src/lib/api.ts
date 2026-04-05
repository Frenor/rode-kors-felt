import { useAuthStore } from '../stores/auth';
import { enqueue } from './offline-queue';
import { enqueueTeamAction } from './offline-firstaid-queue';
import { demoStore } from './demo-store';
import type {
  AmkAssistDraft,
  AmkCallLog,
  EventIndoorLayout,
  MapRuntimeConfig,
  SickbayIncomingItem,
  TeamOperationalStatus,
  TeamWorkspaceResponse,
} from './types';

const API_BASE = import.meta.env.VITE_API_BASE_URL ?? '/api';

// Demo mode: env var (build-time) OR ?demo URL parameter (runtime)
// Persist runtime flag to sessionStorage so it survives in-app navigation
function detectDemoMode(): boolean {
  if (import.meta.env.VITE_DEMO_MODE === 'true') return true;
  if (typeof window === 'undefined') return false;
  if (new URLSearchParams(window.location.search).has('demo')) {
    sessionStorage.setItem('rkf-demo', '1');
    return true;
  }
  return sessionStorage.getItem('rkf-demo') === '1';
}

const DEMO = detectDemoMode();

class ApiClient {
  private getToken(): string | null {
    return useAuthStore.getState().accessToken;
  }

  private async request<T>(path: string, options: RequestInit = {}): Promise<T> {
    const token = this.getToken();
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      ...((options.headers as Record<string, string>) || {}),
    };

    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }

    const res = await fetch(`${API_BASE}${path}`, {
      ...options,
      headers,
    });

    if (!res.ok) {
      const error = await res.json().catch(() => ({ error: 'Nettverksfeil' }));
      throw new Error(error.error || `HTTP ${res.status}`);
    }

    return res.json();
  }

  // Auth
  async login(email: string, password: string) {
    if (DEMO) {
      if (email === 'admin@rkf.no' && password === 'admin123') {
        return {
          accessToken: 'demo-token',
          refreshToken: 'demo-refresh',
          role: 'coordinator',
          user: { id: 'demo-admin', email, role: 'coordinator' },
        };
      }
      throw new Error('Ugyldig e-post eller passord (bruk admin@rkf.no / admin123)');
    }
    return this.request<{
      accessToken: string;
      refreshToken: string;
      role: string;
      user: { id: string; email: string; role: string };
    }>('/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email, password }),
    });
  }

  async redeemCode(code: string) {
    if (DEMO) {
      const demos: Record<string, { role: string; eventName: string }> = {
        '123456': { role: 'first_aider', eventName: 'Holmenkollen Skimaraton 2026' },
        '654321': { role: 'sickbay', eventName: 'Holmenkollen Skimaraton 2026' },
      };
      const demo = demos[code];
      if (!demo) throw new Error('Ugyldig kode (prøv 123456 eller 654321)');
      return {
        accessToken: 'demo-token',
        refreshToken: 'demo-refresh',
        role: demo.role,
        eventId: 'demo-event',
        eventName: demo.eventName,
        teams: [
          { id: 'team-alpha',   name: 'Alpha',   transport: 'foot' },
          { id: 'team-bravo',   name: 'Bravo',   transport: 'bike' },
          { id: 'team-charlie', name: 'Charlie', transport: 'foot' },
          { id: 'team-delta',   name: 'Delta',   transport: 'atv' },
          { id: 'team-echo',    name: 'Echo',    transport: 'vehicle' },
          { id: 'team-foxtrot', name: 'Foxtrot', transport: 'foot' },
        ],
      };
    }
    return this.request<{
      accessToken: string;
      refreshToken: string;
      role: string;
      eventId: string;
      eventName: string;
      teams: Array<{ id: string; name: string }>;
    }>('/auth/code', {
      method: 'POST',
      body: JSON.stringify({ code }),
    });
  }

  // Events
  async getEvents() {
    if (DEMO) return demoStore.getEvents();
    return this.request<{ events: any[] }>('/events');
  }

  async getEvent(id: string) {
    if (DEMO) return demoStore.getEvent(id);
    return this.request<{ event: any; teams: any[] }>(`/events/${id}`);
  }

  async getEventIndoorLayout(id: string) {
    if (DEMO) {
      const result = await demoStore.getEvent(id);
      return { layout: (result.event?.indoorLayout as EventIndoorLayout | null) ?? null };
    }
    return this.request<{ layout: EventIndoorLayout | null }>(`/events/${id}/indoor-layout`);
  }

  async getEventMapConfig(id: string) {
    if (DEMO) {
      const result = await demoStore.getEvent(id);
      return { config: (result.event?.mapRuntimeConfig as MapRuntimeConfig | null) ?? null };
    }
    return this.request<{ config: MapRuntimeConfig | null }>(`/events/${id}/map-config`);
  }

  async getEventStats(eventId: string) {
    if (DEMO) return demoStore.getEventStats(eventId);
    return this.request<Record<string, number>>(`/events/${eventId}/stats`);
  }

  // Incidents
  async getIncidents(eventId: string) {
    if (DEMO) return demoStore.getIncidents(eventId);
    return this.request<{ incidents: any[] }>(`/incidents?eventId=${eventId}`);
  }

  async createIncident(data: Record<string, unknown>) {
    if (DEMO) return demoStore.createIncident(data);
    if (!navigator.onLine) {
      const clientId = await enqueue(data);
      return { incident: { id: clientId, _queued: true, ...data } };
    }
    return this.request<{ incident: any }>('/incidents', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  async downloadReport(_eventId: string): Promise<Blob> {
    if (DEMO) {
      const text = 'Demo-rapport: ingen ekte data tilgjengelig i demomodus.';
      return new Blob([text], { type: 'text/plain' });
    }
    const token = this.getToken();
    const res = await fetch(`${API_BASE}/events/${_eventId}/report`, {
      headers: token ? { Authorization: `Bearer ${token}` } : {},
    });
    if (!res.ok) throw new Error('Kunne ikke laste ned rapport');
    return res.blob();
  }

  async downloadMciSummary(eventId: string): Promise<Blob> {
    if (DEMO) {
      return demoStore.downloadMciSummary(eventId);
    }
    const token = this.getToken();
    const res = await fetch(`${API_BASE}/events/${eventId}/mci-summary`, {
      headers: token ? { Authorization: `Bearer ${token}` } : {},
    });
    if (!res.ok) throw new Error('Kunne ikke laste ned MCI-overlevering');
    return res.blob();
  }

  async toggleMci(eventId: string, mciActive: boolean, mciSectors?: string[]) {
    if (DEMO) return demoStore.toggleMci(eventId, mciActive, mciSectors);
    return this.request<{ event: any }>(`/events/${eventId}/mci`, {
      method: 'PATCH',
      body: JSON.stringify({ mciActive, mciSectors }),
    });
  }

  async executeIncidentAction(
    incidentId: string,
    data:
      | { type: 'status.set'; status: string }
      | { type: 'escalation.raise'; path: string; reason?: string }
      | { type: 'escalation.resolve' }
      | { type: 'escalation.reopen'; escalationId?: string },
  ) {
    if (DEMO) return demoStore.executeIncidentAction(incidentId, data);
    return this.request<{ incident?: any; escalation?: any; action: any; ok?: boolean }>(`/incidents/${incidentId}/actions`, {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  async postTeamAction(
    teamId: string,
    data:
      | { type: 'team.status_set'; status: TeamOperationalStatus; incidentId?: string; note?: string; clientActionId: string }
      | { type: 'team.monitor_started'; patientId: string; clientActionId: string }
      | { type: 'team.monitor_stopped'; patientId: string; clientActionId: string },
    options?: { skipOfflineQueue?: boolean },
  ) {
    if (DEMO) return demoStore.postTeamAction(teamId, data);
    if (!options?.skipOfflineQueue && !navigator.onLine) {
      await enqueueTeamAction(teamId, data);
      return {
        action: {
          id: data.clientActionId,
          actionType: data.type,
          payload: data,
          createdAt: new Date().toISOString(),
          _queued: true,
        },
      };
    }
    return this.request<{ action: any; deduplicated?: boolean }>(`/teams/${teamId}/actions`, {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  async getTeamWorkspace(teamId: string) {
    if (DEMO) return demoStore.getTeamWorkspace(teamId);
    return this.request<TeamWorkspaceResponse>(`/teams/${teamId}/workspace`);
  }

  async getSickbayIncoming(eventId: string) {
    if (DEMO) return demoStore.getSickbayIncoming(eventId);
    return this.request<{ items: SickbayIncomingItem[] }>(`/events/${eventId}/sickbay-incoming`);
  }

  async executePatientAction(patientId: string, data: { type: 'status.set'; status: string }) {
    if (DEMO) return demoStore.executePatientAction(patientId, data);
    return this.request<{ patient: any; action: any }>(`/patients/${patientId}/actions`, {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  async undoAction(actionId: string, reason?: string) {
    if (DEMO) return demoStore.undoAction(actionId, reason);
    return this.request<{ undoneAction: any; undoAction: any; result: any }>(`/actions/${actionId}/undo`, {
      method: 'POST',
      body: JSON.stringify({ reason }),
    });
  }

  // Patients
  async getPatients(eventId: string) {
    if (DEMO) return demoStore.getPatients(eventId);
    return this.request<{ patients: any[] }>(`/patients?eventId=${eventId}`);
  }

  async createPatient(data: Record<string, unknown>) {
    if (DEMO) return demoStore.createPatient(data);
    return this.request<{ patient: any }>('/patients', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  async updatePatient(id: string, data: Record<string, unknown>) {
    if (DEMO) return demoStore.updatePatient(id, data);
    return this.request<{ patient: any }>(`/patients/${id}`, {
      method: 'PATCH',
      body: JSON.stringify(data),
    });
  }

  async addPatientNote(patientId: string, text: string, author: string) {
    if (DEMO) return demoStore.addPatientNote(patientId, text, author);
    return this.request<{ patient: any }>(`/patients/${patientId}/notes`, {
      method: 'POST',
      body: JSON.stringify({ text, author }),
    });
  }

  async getAmkCallLogs(patientId: string) {
    if (DEMO) return demoStore.getAmkCallLogs(patientId);
    return this.request<{ callLogs: AmkCallLog[] }>(`/patients/${patientId}/amk-calls`);
  }

  async createAmkCallLog(
    patientId: string,
    data: {
      summaryGiven: string;
      amkGuidance: string;
      followUpOwner: string;
      referenceId?: string;
      eta?: string;
      calledAt?: string;
    },
  ) {
    if (DEMO) return demoStore.createAmkCallLog(patientId, data);
    return this.request<{ callLog: AmkCallLog; action: any }>(`/patients/${patientId}/amk-calls`, {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  async generateAmkAssistDraft(patientId: string) {
    if (DEMO) return demoStore.generateAmkAssistDraft(patientId);
    return this.request<AmkAssistDraft>(`/patients/${patientId}/amk-assist/draft`, {
      method: 'POST',
      body: JSON.stringify({}),
    });
  }

  async confirmAmkAssist(
    patientId: string,
    draft: AmkAssistDraft,
    spokenScript: string,
  ) {
    if (DEMO) return demoStore.confirmAmkAssist(patientId, draft, spokenScript);
    return this.request<{ ok: boolean; action: any; confirmed: AmkAssistDraft & { confirmedAt: string; confirmedBy: string } }>(
      `/patients/${patientId}/amk-assist/confirm`,
      {
        method: 'POST',
        body: JSON.stringify({
          criticality: draft.criticality,
          spokenScript,
          rationale: draft.rationale,
          sayFirst: draft.sayFirst,
          sbarDraft: draft.sbarDraft,
        }),
      },
    );
  }

  async recordVitals(patientId: string, vitals: Record<string, number | undefined>) {
    if (DEMO) return demoStore.recordVitals(patientId, vitals);
    return this.request<{ vitals: any }>(`/patients/${patientId}/vitals`, {
      method: 'POST',
      body: JSON.stringify(vitals),
    });
  }

  async recordMedication(
    patientId: string,
    data: { drug: string; dose?: string; route?: string; givenBy?: string },
  ) {
    if (DEMO) return demoStore.recordMedication(patientId, data);
    return this.request<{ medication: any }>(`/patients/${patientId}/medications`, {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  async getMedications(patientId: string) {
    if (DEMO) return demoStore.getMedications(patientId);
    return this.request<{ medications: any[] }>(`/patients/${patientId}/medications`);
  }
}

export const api = new ApiClient();
