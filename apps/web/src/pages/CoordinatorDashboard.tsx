import { useState, useEffect, useCallback } from 'react';
import { useAuthStore } from '../stores/auth';
import { useWsStore } from '../stores/ws';
import { useNotificationStore } from '../stores/notifications';
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
import { ResourceAllocationBoard } from './Coordinator/ResourceAllocationBoard';
import { StatsGrid } from './Coordinator/StatsGrid';
import { IncidentFeed } from './Coordinator/IncidentFeed';
import { TeamMessageStreamPanel } from './Coordinator/TeamMessageStreamPanel';
import { PatientManagementPanel, type FieldPatient } from './Coordinator/PatientManagementPanel';
import type { EventIndoorLayout, MapRuntimeConfig, TeamPatientEngagement } from '../lib/types';

const filterIncidentsByStatKey = (incs: Incident[], key: string): Incident[] => {
  if (key === 'activeIncidents') return incs.filter((i) => !['resolved'].includes(i.status));
  if (key === 'resolvedIncidents') return incs.filter((i) => i.status === 'resolved');
  return incs;
};

export function CoordinatorDashboard() {
  const { eventId } = useAuthStore();
  const wsSend = useWsStore((s) => s.send);
  const onMessage = useWsStore((s) => s.onMessage);
  const addToast = useNotificationStore((s) => s.add);
  const [incidents, setIncidents] = useState<Incident[]>([]);
  const [teams, setTeams] = useState<any[]>([]);
  const [eventIndoorLayout, setEventIndoorLayout] = useState<EventIndoorLayout | null>(null);
  const [mapRuntimeConfig, setMapRuntimeConfig] = useState<MapRuntimeConfig | null>(null);
  const [mapProvider, setMapProvider] = useState<'leaflet' | 'maplibre'>('leaflet');
  const [presentation3d, setPresentation3d] = useState(false);
  const [stats, setStats] = useState<Record<string, number> | null>(null);
  const [loading, setLoading] = useState(true);
  const [escalateTarget, setEscalateTarget] = useState<string | null>(null);
  const [escalatePath, setEscalatePath] = useState<string>('path_a_rk_ambulance');
  const [escalateReason, setEscalateReason] = useState('');
  const [escalating, setEscalating] = useState(false);
  const [deteriorationAlerts, setDeteriorationAlerts] = useState<DeteriorationAlert[]>([]);
  const [mciActive, setMciActive] = useState(false);
  const [mciActivatedBy, setMciActivatedBy] = useState<string | null>(null);
  const [mciSectors, setMciSectors] = useState<string[]>([]);
  const [teamSectorAssignments, setTeamSectorAssignments] = useState<Record<string, { sector: string; assignedAt: string }>>({});
  const [togglingMci, setTogglingMci] = useState(false);
  const [downloadingMciSummary, setDownloadingMciSummary] = useState(false);
  const [flashIds, setFlashIds] = useState<Set<string>>(new Set());
  const [connectedUsers, setConnectedUsers] = useState<number | undefined>(undefined);
  const [lastStatsUpdatedAt, setLastStatsUpdatedAt] = useState<number | undefined>(undefined);
  const [prevStats, setPrevStats] = useState<Record<string, number> | null>(null);
  const [activeFilter, setActiveFilter] = useState<string | null>(null);
  const [fieldPatients, setFieldPatients] = useState<FieldPatient[]>([]);
  const [creatingPatient, setCreatingPatient] = useState(false);
  const [teamPatientEngagements, setTeamPatientEngagements] = useState<Record<string, TeamPatientEngagement[]>>({});

  const [teamMessages, setTeamMessages] = useState<Array<{
    id: string;
    text: string;
    fromTeamId?: string | null;
    toTeamId?: string | null;
    sentAt: string;
  }>>([]);
  const UNDO_WINDOW_MS = 10_000;

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
      api.getEventIndoorLayout(eventId),
      api.getEventMapConfig(eventId),
      ]).then(([incRes, statsRes, evtRes, indoorRes, mapConfigRes]) => {
        setIncidents(incRes.incidents);
        setStats((prev) => {
          setPrevStats(prev);
          return statsRes;
        });
        setLastStatsUpdatedAt(Date.now());
        setTeams(evtRes.teams ?? []);
        setEventIndoorLayout(indoorRes.layout ?? evtRes.event?.indoorLayout ?? null);
        setMapRuntimeConfig(mapConfigRes.config ?? evtRes.event?.mapRuntimeConfig ?? null);
        if (mapConfigRes.config?.provider) {
          setMapProvider(mapConfigRes.config.provider);
        } else if (evtRes.event?.mapRuntimeConfig?.provider) {
          setMapProvider(evtRes.event.mapRuntimeConfig.provider);
        }
        if (mapConfigRes.config?.enable3d !== undefined) {
          setPresentation3d(Boolean(mapConfigRes.config.enable3d));
        } else if (evtRes.event?.mapRuntimeConfig?.enable3d !== undefined) {
          setPresentation3d(Boolean(evtRes.event.mapRuntimeConfig.enable3d));
        }
        if (evtRes.event?.mciActive !== undefined) {
          setMciActive(evtRes.event.mciActive);
          setMciActivatedBy(evtRes.event.mciActivatedBy ?? null);
          setMciSectors(evtRes.event.mciSectors ?? []);
        }
      setLoading(false);
    }).catch(() => setLoading(false));

    api.getPatients(eventId).then((res) => {
      setFieldPatients(res.patients as FieldPatient[]);
    }).catch((err) => console.error('[coordinator] Failed to load field patients', err));

    api.getTeamPatientEngagements(eventId).then((res) => {
      setTeamPatientEngagements(res.engagements as Record<string, TeamPatientEngagement[]>);
    }).catch((err) => console.error('[coordinator] Failed to load team-patient engagements', err));
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
        setTeamSectorAssignments({});
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
      } else if (msg.type === 'team.sector_assigned') {
        const { teamId, sector, assignedAt } = (msg.payload as any) ?? {};
        if (typeof teamId === 'string') {
          if (typeof sector === 'string' && sector.trim()) {
            setTeamSectorAssignments((prev) => ({
              ...prev,
              [teamId]: { sector, assignedAt: assignedAt ?? new Date().toISOString() },
            }));
          } else {
            setTeamSectorAssignments((prev) => {
              const next = { ...prev };
              delete next[teamId];
              return next;
            });
          }
        }
      } else if (msg.type === 'team.message') {
        if (eventId && msg.eventId && msg.eventId !== eventId) {
          return;
        }
        const payload = (msg.payload as any) ?? {};
        if (typeof payload.text === 'string' && payload.text.trim()) {
          setTeamMessages((prev) => {
            const next = [
              {
                id: payload.id ?? crypto.randomUUID(),
                text: payload.text,
                fromTeamId: payload.fromTeamId ?? null,
                toTeamId: payload.toTeamId ?? null,
                sentAt: payload.sentAt ?? new Date().toISOString(),
              },
              ...prev,
            ];
            return next.slice(0, 100);
          });
        }
      } else if (msg.type === 'patient.created') {
        const p = (msg.payload as any)?.patient;
        if (p) setFieldPatients((prev) => [p as FieldPatient, ...prev]);
      } else if (msg.type === 'patient.updated') {
        const p = (msg.payload as any)?.patient;
        if (p) setFieldPatients((prev) => prev.map((fp) => fp.id === p.id ? p as FieldPatient : fp));
      } else if (msg.type === 'team.session_changed') {
        // A team changed their patient engagement status — re-fetch to keep coordinator in sync
        if (eventId) {
          api.getTeamPatientEngagements(eventId).then((res) => {
            setTeamPatientEngagements(res.engagements as Record<string, TeamPatientEngagement[]>);
          }).catch(() => {});
        }
      } else if (msg.type === 'system.connected_users') {
        const { count } = (msg.payload as any) ?? {};
        if (typeof count === 'number') setConnectedUsers(count);
      }
    });
    return off;
  }, [eventId, onMessage]);

  const pushUndoToast = (message: string, actionId?: string) => {
    if (!actionId) return;
    addToast({
      level: 'warning',
      message,
      autoDismissMs: UNDO_WINDOW_MS,
      actionLabel: 'Angre',
      onAction: async () => {
        await api.undoAction(actionId, 'Angret fra koordinatorgrensesnitt');
        fetchAll();
      },
    });
  };

  const handleStatusUpdate = async (id: string, status: string) => {
    const res = await api.executeIncidentAction(id, { type: 'status.set', status });
    if (res.incident) {
      setIncidents((prev) => prev.map((i) => (i.id === id ? res.incident : i)));
    }
    pushUndoToast('Status oppdatert. Du kan angre i 10 sekunder.', res.action?.id);
  };

  const handleEscalate = async () => {
    if (!escalateTarget) return;
    setEscalating(true);
    try {
      const res = await api.executeIncidentAction(escalateTarget, {
        type: 'escalation.raise',
        path: escalatePath,
        reason: escalateReason || undefined,
      });
      if (res.escalation) {
        setIncidents((prev) =>
          prev.map((i) => (i.id === escalateTarget ? { ...i, activeEscalation: res.escalation } : i)),
        );
      }
      pushUndoToast('Eskalering sendt. Du kan angre i 10 sekunder.', res.action?.id);
    } finally {
      setEscalating(false);
      setEscalateTarget(null);
      setEscalateReason('');
    }
  };

  const handleResolveEscalation = async (incidentId: string) => {
    const res = await api.executeIncidentAction(incidentId, { type: 'escalation.resolve' });
    pushUndoToast('Eskalering avsluttet. Du kan angre i 10 sekunder.', res.action?.id);
  };

  const handleReopenEscalation = async (incidentId: string, escalationId?: string) => {
    const res = await api.executeIncidentAction(incidentId, { type: 'escalation.reopen', escalationId });
    pushUndoToast('Eskalering gjenåpnet. Du kan angre i 10 sekunder.', res.action?.id);
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
    } catch (err) {
      addToast({ message: 'Nedlasting av rapport feilet.', level: 'urgent', autoDismissMs: 6_000 });
      console.error('[coordinator] Report download failed', err);
    }
  };

  const handleToggleMci = async () => {
    if (!eventId) return;
    setTogglingMci(true);
    try {
      const { event } = await api.toggleMci(eventId, !mciActive);
      setMciActive(!!event?.mciActive);
      setMciActivatedBy(event?.mciActivatedBy ?? null);
      setMciSectors(event?.mciSectors ?? []);
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

  const handleAssignTeamToSector = (teamId: string, sector: string | null) => {
    if (!eventId) return;
    const assignedAt = new Date().toISOString();

    if (sector) {
      setTeamSectorAssignments((prev) => ({ ...prev, [teamId]: { sector, assignedAt } }));
    } else {
      setTeamSectorAssignments((prev) => {
        const next = { ...prev };
        delete next[teamId];
        return next;
      });
    }

    wsSend({
      type: 'team.sector_assigned',
      eventId,
      payload: { teamId, sector, assignedAt },
      timestamp: assignedAt,
    });
  };

  const handleCreatePatient = async (data: Omit<FieldPatient, 'id' | 'updatedAt'>) => {
    if (!eventId) return;
    setCreatingPatient(true);
    try {
      const res = await api.createFieldPatient(eventId, {
        label: data.label ?? '',
        triageStatus: data.triageStatus,
        description: data.description,
        positionText: data.positionText,
        lat: data.lat,
        lon: data.lon,
        assignedTeamId: data.assignedTeamId,
      });
      setFieldPatients((prev) => [res.patient as FieldPatient, ...prev]);
    } finally {
      setCreatingPatient(false);
    }
  };

  const handleUpdatePatient = async (id: string, data: Partial<Omit<FieldPatient, 'id' | 'updatedAt'>>) => {
    const res = await api.updatePatient(id, data as Record<string, unknown>);
    setFieldPatients((prev) => prev.map((p) => p.id === id ? res.patient as FieldPatient : p));
  };

  const filteredIncidents = activeFilter ? filterIncidentsByStatKey(incidents, activeFilter) : incidents;
  const incidentsWithLocation = incidents.filter((inc): inc is Incident & { location: { lat: number; lng: number } } => !!inc.location);
  const sectors = mciSectors.length > 0 ? mciSectors : ['Nord', 'Sentrum', 'Sør', 'Vest'];

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
        <>
          <MCIOverviewPanel
            mciActivatedBy={mciActivatedBy}
            incidents={incidents}
            togglingMci={togglingMci}
            downloadingSummary={downloadingMciSummary}
            onToggleMci={handleToggleMci}
            onDownloadSummary={handleDownloadMciSummary}
          />
          <ResourceAllocationBoard
            teams={teams}
            incidents={incidents}
            sectors={sectors}
            assignments={teamSectorAssignments}
            onAssignTeam={handleAssignTeamToSector}
          />
        </>
      )}

      <PatientManagementPanel
        patients={fieldPatients}
        teams={teams}
        creating={creatingPatient}
        onCreatePatient={handleCreatePatient}
        onUpdatePatient={handleUpdatePatient}
        teamPatientEngagements={teamPatientEngagements}
      />

      <StatsGrid
        stats={stats}
        lastUpdatedAt={lastStatsUpdatedAt}
        prevStats={prevStats}
        onFilter={(key) => setActiveFilter(key)}
      />

      <TeamMessageStreamPanel messages={teamMessages} teams={teams} />

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
          onResolveEscalation={handleResolveEscalation}
          onReopenEscalation={handleReopenEscalation}
          onStatusUpdate={handleStatusUpdate}
          onTriageAssess={handleTriageAssess}
          onNewOppdrag={() => setShowNewOppdrag(true)}
          calcEta={calcEta}
        />

        <div className="card flex-col" style={{
          position: 'sticky',
          top: 72,
          height: 'calc(100dvh - 80px)',
          overflow: 'hidden',
        }}>
          <div
            className="flex-between flex-wrap gap-2"
            style={{
              padding: 'var(--space-3)',
              borderBottom: '1px solid var(--color-border)',
            }}
          >
            <div className="flex flex-wrap flex-align gap-2">
              <span className="mono-xs-muted">
                Kartmotor
              </span>
              <button
                type="button"
                onClick={() => setMapProvider('leaflet')}
                aria-pressed={mapProvider === 'leaflet'}
                className="fw-600"
                style={{
                  minHeight: 40,
                  padding: '0 var(--space-3)',
                  borderRadius: 'var(--radius-md)',
                  border: `1px solid ${mapProvider === 'leaflet' ? 'var(--color-brand)' : 'var(--color-border)'}`,
                  background: mapProvider === 'leaflet' ? 'var(--color-brand-dim)' : 'var(--color-surface)',
                  cursor: 'pointer',
                }}
              >
                Leaflet
              </button>
              <button
                type="button"
                onClick={() => setMapProvider('maplibre')}
                aria-pressed={mapProvider === 'maplibre'}
                className="fw-600"
                style={{
                  minHeight: 40,
                  padding: '0 var(--space-3)',
                  borderRadius: 'var(--radius-md)',
                  border: `1px solid ${mapProvider === 'maplibre' ? 'var(--color-brand)' : 'var(--color-border)'}`,
                  background: mapProvider === 'maplibre' ? 'var(--color-brand-dim)' : 'var(--color-surface)',
                  cursor: 'pointer',
                }}
              >
                MapLibre
              </button>
              {eventIndoorLayout && (
                <span className="mono-xs-subtle">
                  Innendørs: {eventIndoorLayout.venueName ?? eventIndoorLayout.venueId}
                </span>
              )}
            </div>

            <button
              type="button"
              onClick={() => setPresentation3d((value) => !value)}
              aria-pressed={presentation3d}
              className="fw-600"
              style={{
                minHeight: 40,
                padding: '0 var(--space-3)',
                borderRadius: 'var(--radius-md)',
                border: `1px solid ${presentation3d ? 'var(--color-brand)' : 'var(--color-border)'}`,
                background: presentation3d ? 'var(--color-brand-dim)' : 'var(--color-surface)',
                cursor: 'pointer',
              }}
            >
              3D-presentasjon {presentation3d ? 'på' : 'av'}
            </button>
          </div>

          <EventMap
            incidents={incidentsWithLocation}
            teams={teams}
            provider={mapProvider}
            presentation3d={presentation3d}
            mapRuntimeConfig={mapRuntimeConfig}
            onIncidentClick={handleScrollToIncident}
          />
        </div>
      </div>
    </div>
  );
}
