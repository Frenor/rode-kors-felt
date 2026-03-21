import { useAuthStore } from '../stores/auth';

const API_BASE = '/api';

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
    return this.request<{ events: any[] }>('/events');
  }

  async getEvent(id: string) {
    return this.request<{ event: any; teams: any[] }>(`/events/${id}`);
  }

  async getEventStats(eventId: string) {
    return this.request<Record<string, number>>(`/events/${eventId}/stats`);
  }

  // Incidents
  async getIncidents(eventId: string) {
    return this.request<{ incidents: any[] }>(`/incidents?eventId=${eventId}`);
  }

  async createIncident(data: Record<string, unknown>) {
    return this.request<{ incident: any }>('/incidents', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  async updateIncident(id: string, data: Record<string, unknown>) {
    return this.request<{ incident: any }>(`/incidents/${id}`, {
      method: 'PATCH',
      body: JSON.stringify(data),
    });
  }

  // Patients
  async getPatients(eventId: string) {
    return this.request<{ patients: any[] }>(`/patients?eventId=${eventId}`);
  }

  async createPatient(data: Record<string, unknown>) {
    return this.request<{ patient: any }>('/patients', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  async updatePatient(id: string, data: Record<string, unknown>) {
    return this.request<{ patient: any }>(`/patients/${id}`, {
      method: 'PATCH',
      body: JSON.stringify(data),
    });
  }

  async addPatientNote(patientId: string, text: string, author: string) {
    return this.request<{ patient: any }>(`/patients/${patientId}/notes`, {
      method: 'POST',
      body: JSON.stringify({ text, author }),
    });
  }

  async recordVitals(patientId: string, vitals: Record<string, number | undefined>) {
    return this.request<{ vitals: any }>(`/patients/${patientId}/vitals`, {
      method: 'POST',
      body: JSON.stringify(vitals),
    });
  }
}

export const api = new ApiClient();
