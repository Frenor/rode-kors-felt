import { useAuthStore } from '../stores/auth';
import { enqueueTeamAction } from './offline-firstaid-queue';
import { demoStore } from './demo-store';
import { API_BASE, isTokenExpiringSoon, refreshAccessToken } from './session';
import type {
  AmkAssistDraft,
  AmkCallLog,
  EventIndoorLayout,
  MapRuntimeConfig,
  SickbayIncomingItem,
  TeamOperationalStatus,
  TeamPatientEngagement,
  TeamPatientStatus,
  TeamWorkspaceResponse,
} from './types';
// Lane 8 batch 3 (B): a second import block, appended rather than merged into
// the one above, so this change never collides with edits to it elsewhere.
import type { AccessCode, EventSettings, TeamMessage } from './types';

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

  private async request<T>(path: string, options: RequestInit = {}, allowRetry = true): Promise<T> {
    let token = this.getToken();

    // Access tokens expire after 15 minutes. Refresh proactively so a field
    // user who has had the app open for an hour never sees a failed save.
    if (token && isTokenExpiringSoon(token)) {
      token = (await refreshAccessToken()) ?? token;
    }

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

    // Expired/invalid access token: refresh once and replay the request.
    if (res.status === 401 && token && allowRetry) {
      const fresh = await refreshAccessToken();
      if (fresh && fresh !== token) {
        return this.request<T>(path, options, false);
      }
    }

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
      teams: Array<{ id: string; name: string; transport?: string }>;
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

  async postTeamAction(
    teamId: string,
    data:
      | { type: 'team.status_set'; status: TeamOperationalStatus; note?: string; clientActionId: string }
      | { type: 'team.monitor_started'; patientId: string; clientActionId: string }
      | { type: 'team.monitor_stopped'; patientId: string; clientActionId: string }
      | { type: 'team.patient_status_set'; patientId: string; status: TeamPatientStatus | null; clientActionId: string },
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

  async getTeamProfile(teamId: string) {
    if (DEMO) {
      // In demo mode return the team from the demo store if available
      const event = demoStore.getEvent('demo-event');
      const team = (event.teams as any[]).find((t) => t.id === teamId);
      return { team: { id: teamId, gear: (team?.gear as string[] | undefined) ?? [], contactPhone: null, contactRadio: null } };
    }
    return this.request<{ team: { id: string; gear: string[]; contactPhone: string | null; contactRadio: string | null } }>(`/teams/${teamId}`);
  }

  async patchTeamProfile(teamId: string, data: { gear?: string[]; contactPhone?: string | null; contactRadio?: string | null }) {
    if (DEMO) return { team: { id: teamId, ...data } };
    return this.request<{ team: { id: string; gear: string[]; contactPhone: string | null; contactRadio: string | null } }>(`/teams/${teamId}/profile`, {
      method: 'PATCH',
      body: JSON.stringify(data),
    });
  }

  async patchTeamTransport(teamId: string, transport: string) {
    if (DEMO) return { team: { id: teamId, transport } };
    return this.request<{ team: { id: string; transport: string } }>(`/teams/${teamId}/transport`, {
      method: 'PATCH',
      body: JSON.stringify({ transport }),
    });
  }

  async getTeamWorkspace(teamId: string) {
    if (DEMO) return demoStore.getTeamWorkspace(teamId);
    return this.request<TeamWorkspaceResponse>(`/teams/${teamId}/workspace`);
  }

  async getTeamPatientEngagements(eventId: string) {
    if (DEMO) return demoStore.getTeamPatientEngagements(eventId);
    return this.request<{ engagements: Record<string, TeamPatientEngagement[]> }>(`/events/${eventId}/team-patient-engagements`);
  }

  async getSickbayIncoming(eventId: string) {
    if (DEMO) return demoStore.getSickbayIncoming(eventId);
    return this.request<{ items: SickbayIncomingItem[] }>(`/events/${eventId}/sickbay-incoming`);
  }

  async executePatientAction(
    patientId: string,
    data:
      | { type: 'status.set'; status: string }
      | { type: 'amk.notified'; by?: string }
      | { type: 'amk.cleared' },
  ) {
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
  async getPatients(eventId: string, opts?: { assignedTeamId?: string }) {
    if (DEMO) return demoStore.getPatients(eventId, opts);
    const params = new URLSearchParams({ eventId });
    if (opts?.assignedTeamId) params.set('assignedTeamId', opts.assignedTeamId);
    return this.request<{ patients: any[] }>(`/patients?${params}`);
  }

  async createPatient(data: Record<string, unknown>) {
    if (DEMO) return demoStore.createPatient(data);
    return this.request<{ patient: any }>('/patients', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  async createFieldPatient(eventId: string, data: {
    label: string;
    triageStatus?: string | null;
    description?: string | null;
    positionText?: string | null;
    lat?: number | null;
    lon?: number | null;
    assignedTeamId?: string | null;
  }) {
    if (DEMO) return demoStore.createPatient({ ...data, eventId });
    return this.request<{ patient: any }>(`/events/${eventId}/patients`, {
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

  // ── Lane 8 batch 3 (B): chat history (gap B9 / 8.29) ──────────────────────
  async getTeamMessages(eventId: string, limit?: number) {
    if (DEMO) return demoStore.getTeamMessages(eventId);
    const query = limit ? `?limit=${limit}` : '';
    return this.request<{ messages: TeamMessage[] }>(`/events/${eventId}/messages${query}`);
  }

  // Demo-only: production sends chat through the WebSocket's `team.message`
  // relay (routes/ws.ts persists it); the demo has no socket, so this appends
  // straight to the in-memory list `getTeamMessages` reads.
  async sendTeamMessage(
    eventId: string,
    payload: { fromTeamId?: string | null; fromLabel?: string | null; toTeamId?: string | null; text: string; ackOf?: string | null },
  ) {
    if (DEMO) return demoStore.sendTeamMessage(eventId, payload);
    throw new Error('sendTeamMessage er kun tilgjengelig i demo-modus — send via WebSocket team.message ellers');
  }

  // ── Lane 8 batch 3 (B): capacity settings (gap B6 / 8.30) ─────────────────
  async updateEventSettings(eventId: string, settings: EventSettings) {
    if (DEMO) return demoStore.updateEventSettings(eventId, settings);
    return this.request<{ settings: EventSettings }>(`/events/${eventId}/settings`, {
      method: 'PATCH',
      body: JSON.stringify(settings),
    });
  }

  // ── Lane 8 batch 3 (B): event set-up (gap B5 / 8.31) ──────────────────────
  async updateEvent(eventId: string, data: { name?: string; startDate?: string; endDate?: string; status?: string }) {
    if (DEMO) return demoStore.updateEvent(eventId, data);
    return this.request<{ event: any }>(`/events/${eventId}`, {
      method: 'PATCH',
      body: JSON.stringify(data),
    });
  }

  async createTeam(
    eventId: string,
    data: { name: string; transport?: string; contactPhone?: string | null; contactRadio?: string | null },
  ) {
    if (DEMO) return demoStore.createTeam(eventId, data);
    return this.request<{ team: any }>(`/events/${eventId}/teams`, {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  async updateTeam(
    teamId: string,
    data: { name?: string; transport?: string; contactPhone?: string | null; contactRadio?: string | null; active?: boolean },
  ) {
    if (DEMO) return demoStore.updateTeam(teamId, data);
    return this.request<{ team: any }>(`/teams/${teamId}`, {
      method: 'PATCH',
      body: JSON.stringify(data),
    });
  }

  async getAccessCodes(eventId: string) {
    if (DEMO) return demoStore.getAccessCodes(eventId);
    return this.request<{ codes: AccessCode[] }>(`/events/${eventId}/access-codes`);
  }

  async createAccessCode(eventId: string, data: { role: string; hours?: number }) {
    if (DEMO) return demoStore.createAccessCode(eventId, data);
    return this.request<{ code: AccessCode }>(`/events/${eventId}/access-codes`, {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  async revokeAccessCode(codeId: string) {
    if (DEMO) return demoStore.revokeAccessCode(codeId);
    return this.request<{ code: AccessCode }>(`/access-codes/${codeId}/revoke`, {
      method: 'POST',
    });
  }
}

export const api = new ApiClient();
