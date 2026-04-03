import { useAuthStore } from '../stores/auth';
import { enqueue } from './offline-queue';
import { demoStore } from './demo-store';

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

  async escalateIncident(incidentId: string, data: { path: string; reason?: string }) {
    if (DEMO) return demoStore.escalateIncident(incidentId, data);
    return this.request<{ escalation: any }>(`/incidents/${incidentId}/escalate`, {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  async resolveEscalation(incidentId: string) {
    if (DEMO) return demoStore.resolveEscalation(incidentId);
    return this.request<{ ok: boolean }>(`/incidents/${incidentId}/escalate`, {
      method: 'DELETE',
    });
  }

  async updateIncident(id: string, data: Record<string, unknown>) {
    if (DEMO) return demoStore.updateIncident(id, data);
    return this.request<{ incident: any }>(`/incidents/${id}`, {
      method: 'PATCH',
      body: JSON.stringify(data),
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
