import { useState, useEffect, useCallback } from 'react';
import { useAuthStore } from '../stores/auth';
import { useWsStore } from '../stores/ws';
import { api } from '../lib/api';
import { EventMap } from '../components/EventMap';
import { assessTriage, type TriageAssessment } from '../lib/llm-triage';
import { useLLMApiKey } from '../hooks/useLLMApiKey';
import type { Incident, DeteriorationAlert } from '../lib/types';
import { CoordinatorHeader } from './Coordinator/CoordinatorHeader';
import { APIKeyModal } from './Coordinator/APIKeyModal';
import { EscalationModal } from './Coordinator/EscalationModal';
import { NewTaskModal } from './Coordinator/NewTaskModal';
import { DeteriorationAlertsPanel } from './Coordinator/DeteriorationAlertsPanel';
import { MCIOverviewPanel } from './Coordinator/MCIOverviewPanel';
import { StatsGrid } from './Coordinator/StatsGrid';
import { IncidentFeed } from './Coordinator/IncidentFeed';

const filterIncidentsByStatKey = (incs: Incident[], key: string): Incident[] => {
  if (key === 'activeIncidents') return incs.filter((i) => !['resolved'].includes(i.status));
  if (key === 'resolvedIncidents') return incs.filter((i) => i.status === 'resolved');
  return incs;
};

export function CoordinatorDashboard() {
  const { eventId } = useAuthStore();
  const onMessage = useWsStore((s) => s.onMessage);
  const [incidents, setIncidents] = useState<Incident[]>([]);
  const [teams, setTeams] = useState<any[]>([]);
  const [stats, setStats] = useState<Record<string, number> | null>(null);
  const [loading, setLoading] = useState(true);
  const [escalateTarget, setEscalateTarget] = useState<string | null>(null);
  const [escalatePath, setEscalatePath] = useState<string>('path_a_rk_ambulance');
  const [escalateReason, setEscalateReason] = useState('');
  const [escalating, setEscalating] = useState(false);
  const [deteriorationAlerts, setDeteriorationAlerts] = useState<DeteriorationAlert[]>([]);
  const [mciActive, setMciActive] = useState(false);
  const [mciActivatedBy, setMciActivatedBy] = useState<string | null>(null);
  const [togglingMci, setTogglingMci] = useState(false);
  const [downloadingMciSummary, setDownloadingMciSummary] = useState(false);
  const [flashIds, setFlashIds] = useState<Set<string>>(new Set());
  const [connectedUsers, setConnectedUsers] = useState<number | undefined>(undefined);
  const [lastStatsUpdatedAt, setLastStatsUpdatedAt] = useState<number | undefined>(undefined);
  const [prevStats, setPrevStats] = useState<Record<string, number> | null>(null);
  const [activeFilter, setActiveFilter] = useState<string | null>(null);

  // Nytt koordinatoroppdrag state
  const [showNewOppdrag, setShowNewOppdrag] = useState(false);
  const [newType, setNewType] = useState<string>('medical');
  const [newTeamId, setNewTeamId] = useState<string>('');
  const [newNote, setNewNote] = useState('');
  const [creating, setCreating] = useState(false);

  const handleCreateOppdrag = async () => {
    if (!eventId) return;
    setCreating(true);
    try {
      const { incident } = await api.createIncident({
        eventId,
        type: newType,
        source: 'coordinator',
        teamId: newTeamId || undefined,
        notes: newNote || undefined,
      });
      setIncidents((prev) => [incident, ...prev]);
      setShowNewOppdrag(false);
      setNewType('medical');
      setNewTeamId('');
      setNewNote('');
    } finally {
      setCreating(false);
    }
  };

  // LLM triage state
  const { apiKey, setApiKey, hasKey, isDemo } = useLLMApiKey();
  const [showApiKeyInput, setShowApiKeyInput] = useState(false);
  const [apiKeyDraft, setApiKeyDraft] = useState('');
  const [triageResults, setTriageResults] = useState<Record<string, TriageAssessment>>({});
  const [triageLoading, setTriageLoading] = useState<Record<string, boolean>>({});
  const [triageErrors, setTriageErrors] = useState<Record<string, string>>({});

  const handleTriageAssess = async (inc: any) => {
    if (!hasKey) { setShowApiKeyInput(true); return; }
    setTriageLoading((p) => ({ ...p, [inc.id]: true }));
    setTriageErrors((p) => { const n = { ...p }; delete n[inc.id]; return n; });
    try {
      const result = await assessTriage(inc, apiKey);
      setTriageResults((p) => ({ ...p, [inc.id]: result }));
    } catch (e: any) {
      setTriageErrors((p) => ({ ...p, [inc.id]: e.message ?? 'Feil ved AI-vurdering' }));
    } finally {
      setTriageLoading((p) => ({ ...p, [inc.id]: false }));
    }
  };

  const fetchAll = useCallback(() => {
    if (!eventId) return;
    Promise.all([
      api.getIncidents(eventId),
      api.getEventStats(eventId),
      api.getEvent(eventId),
    ]).then(([incRes, statsRes, evtRes]) => {
      setIncidents(incRes.incidents);
      setStats((prev) => {
        setPrevStats(prev);
        return statsRes;
      });
      setLastStatsUpdatedAt(Date.now());
      setTeams(evtRes.teams ?? []);
      if (evtRes.event?.mciActive !== undefined) {
        setMciActive(evtRes.event.mciActive);
        setMciActivatedBy(evtRes.event.mciActivatedBy ?? null);
      }
      setLoading(false);
    }).catch(() => setLoading(false));
  }, [eventId]);

  useEffect(() => {
    fetchAll();
  }, [fetchAll]);

  // Live WS updates — merge into state instead of polling
  useEffect(() => {
    const off = onMessage((msg) => {
      if (msg.type === 'incident.created') {
        const inc = (msg.payload as any)?.incident;
        if (inc) {
          setIncidents((prev) => [inc, ...prev.filter((i) => i.id !== inc.id)]);
          const id: string = inc.id;
          setFlashIds((prev) => new Set(prev).add(id));
          setTimeout(() => setFlashIds((prev) => { const n = new Set(prev); n.delete(id); return n; }), 2000);
        }
      } else if (msg.type === 'incident.updated') {
        const inc = (msg.payload as any)?.incident;
        if (inc) setIncidents((prev) => prev.map((i) => (i.id === inc.id ? inc : i)));
      } else if (msg.type === 'escalation.raised') {
        const { incidentId, escalation } = (msg.payload as any) ?? {};
        if (incidentId) {
          setIncidents((prev) =>
            prev.map((i) => (i.id === incidentId ? { ...i, activeEscalation: escalation } : i)),
          );
        }
      } else if (msg.type === 'escalation.resolved') {
        const { incidentId } = (msg.payload as any) ?? {};
        if (incidentId) {
          setIncidents((prev) =>
            prev.map((i) => (i.id === incidentId ? { ...i, activeEscalation: null } : i)),
          );
        }
      } else if (msg.type === 'event.mci_activated') {
        const { activatedBy } = (msg.payload as any) ?? {};
        setMciActive(true);
        setMciActivatedBy(activatedBy ?? null);
      } else if (msg.type === 'event.mci_deactivated') {
        setMciActive(false);
        setMciActivatedBy(null);
      } else if (msg.type === 'patient.deterioration_alert') {
        const { patientId, trend, news2Score } = (msg.payload as any) ?? {};
        if (patientId && trend) {
          setDeteriorationAlerts((prev) => {
            const filtered = prev.filter((a) => a.patientId !== patientId);
            return [{ patientId, news2Score, ratePerHour: trend.ratePerHour, receivedAt: new Date().toISOString() }, ...filtered];
          });
        }
      } else if (msg.type === 'team.position') {
        const { teamId, position } = (msg.payload as any) ?? {};
        if (teamId && position) {
          setTeams((prev) =>
            prev.map((t) => (t.id === teamId ? { ...t, currentPosition: position } : t)),
          );
        }
      } else if (msg.type === 'system.connected_users') {
        const { count } = (msg.payload as any) ?? {};
        if (typeof count === 'number') setConnectedUsers(count);
      }
    });
    return off;
  }, [onMessage]);

  const handleStatusUpdate = async (id: string, status: string) => {
    await api.updateIncident(id, { status });
    setIncidents((prev) => prev.map((i) => (i.id === id ? { ...i, status } : i)));
  };

  const handleEscalate = async () => {
    if (!escalateTarget) return;
    setEscalating(true);
    try {
      await api.escalateIncident(escalateTarget, { path: escalatePath, reason: escalateReason || undefined });
    } finally {
      setEscalating(false);
      setEscalateTarget(null);
      setEscalateReason('');
    }
  };

  const handleDownloadReport = async () => {
    if (!eventId) return;
    try {
      const blob = await api.downloadReport(eventId);
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `rkf-rapport-${eventId.slice(0, 8)}.md`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
    } catch {
      // silently fail — user will see nothing
    }
  };

  const handleToggleMci = async () => {
    if (!eventId) return;
    setTogglingMci(true);
    try {
      await api.toggleMci(eventId, !mciActive);
      if (mciActive) {
        const blob = await api.downloadMciSummary(eventId);
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `rkf-mci-overlevering-${eventId.slice(0, 8)}.html`;
        document.body.appendChild(a);
        a.click();
        a.remove();
        URL.revokeObjectURL(url);
      }
    } finally {
      setTogglingMci(false);
    }
  };

  const handleDownloadMciSummary = async () => {
    if (!eventId) return;
    setDownloadingMciSummary(true);
    try {
      const blob = await api.downloadMciSummary(eventId);
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `rkf-mci-overlevering-${eventId.slice(0, 8)}.html`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
    } finally {
      setDownloadingMciSummary(false);
    }
  };

  // ETA calculation — Haversine distance + transport-mode speed
  const calcEta = (team: any, incident: any): string | null => {
    if (!team?.currentPosition || !incident?.location) return null;
    const toRad = (d: number) => d * Math.PI / 180;
    const R = 6371; // km
    const dLat = toRad(incident.location.lat - team.currentPosition.lat);
    const dLng = toRad(incident.location.lng - team.currentPosition.lng);
    const a = Math.sin(dLat / 2) ** 2 +
      Math.cos(toRad(team.currentPosition.lat)) * Math.cos(toRad(incident.location.lat)) *
      Math.sin(dLng / 2) ** 2;
    const distKm = R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    const speedKmH: Record<string, number> = { foot: 5, bike: 15, vehicle: 40, atv: 20 };
    const speed = speedKmH[team.transport ?? 'foot'] ?? 5;
    const minutes = Math.round((distKm / speed) * 60);
    return minutes < 1 ? 'Under 1 min' : `ca. ${minutes} min`;
  };

  const handleScrollToIncident = (incidentId: string) => {
    document.getElementById(`inc-${incidentId}`)?.scrollIntoView({ behavior: 'smooth', block: 'center' });
  };


  const filteredIncidents = activeFilter ? filterIncidentsByStatKey(incidents, activeFilter) : incidents;

  return (
    <div>
      <CoordinatorHeader
        onDownloadReport={handleDownloadReport}
        mciActive={mciActive}
        togglingMci={togglingMci}
        onToggleMci={handleToggleMci}
        hasKey={hasKey}
        isDemo={isDemo}
        onOpenApiKey={() => { setApiKeyDraft(apiKey); setShowApiKeyInput(true); }}
        connectedUsers={connectedUsers}
      />

      {showApiKeyInput && (
        <APIKeyModal
          draft={apiKeyDraft}
          onChange={setApiKeyDraft}
          onSave={() => { setApiKey(apiKeyDraft); setShowApiKeyInput(false); }}
          onClose={() => setShowApiKeyInput(false)}
        />
      )}

      {escalateTarget && (
        <EscalationModal
          escalatePath={escalatePath}
          escalateReason={escalateReason}
          escalating={escalating}
          onPathChange={setEscalatePath}
          onReasonChange={setEscalateReason}
          onSubmit={handleEscalate}
          onClose={() => { setEscalateTarget(null); setEscalateReason(''); }}
        />
      )}

      {showNewOppdrag && (
        <NewTaskModal
          type={newType}
          teamId={newTeamId}
          note={newNote}
          teams={teams}
          creating={creating}
          onTypeChange={setNewType}
          onTeamChange={setNewTeamId}
          onNoteChange={setNewNote}
          onSubmit={handleCreateOppdrag}
          onClose={() => { setShowNewOppdrag(false); setNewNote(''); setNewTeamId(''); setNewType('medical'); }}
        />
      )}

      {deteriorationAlerts.length > 0 && (
        <DeteriorationAlertsPanel
          alerts={deteriorationAlerts}
          onEscalate={setEscalateTarget}
          onDismiss={(patientId) => setDeteriorationAlerts((prev) => prev.filter((a) => a.patientId !== patientId))}
          onDismissAll={() => setDeteriorationAlerts([])}
        />
      )}

      {mciActive && (
        <MCIOverviewPanel
          mciActivatedBy={mciActivatedBy}
          incidents={incidents}
          togglingMci={togglingMci}
          downloadingSummary={downloadingMciSummary}
          onToggleMci={handleToggleMci}
          onDownloadSummary={handleDownloadMciSummary}
        />
      )}

      <StatsGrid
        stats={stats}
        lastUpdatedAt={lastStatsUpdatedAt}
        prevStats={prevStats}
        onFilter={(key) => setActiveFilter(key)}
      />

      {/* Two-column layout: feed left, map right */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'minmax(0, 2fr) minmax(0, 3fr)',
        gap: 'var(--space-4)',
        alignItems: 'start',
      }}>
        <IncidentFeed
          incidents={filteredIncidents}
          teams={teams}
          loading={loading}
          flashIds={flashIds}
          triageResults={triageResults}
          triageLoading={triageLoading}
          triageErrors={triageErrors}
          activeFilter={activeFilter}
          onClearFilter={() => setActiveFilter(null)}
          onEscalate={setEscalateTarget}
          onStatusUpdate={handleStatusUpdate}
          onTriageAssess={handleTriageAssess}
          onNewOppdrag={() => setShowNewOppdrag(true)}
          calcEta={calcEta}
        />

        <div style={{
          position: 'sticky',
          top: 72,
          height: 'calc(100dvh - 80px)',
          borderRadius: 'var(--radius-md)',
          overflow: 'hidden',
          border: '1px solid var(--color-border)',
        }}>
          <EventMap
            incidents={incidents}
            teams={teams}
            onIncidentClick={handleScrollToIncident}
          />
        </div>
      </div>
    </div>
  );
}
