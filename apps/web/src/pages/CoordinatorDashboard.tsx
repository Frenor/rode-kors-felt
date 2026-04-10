import { useState, useEffect, useCallback } from 'react';
import { useAuthStore } from '../stores/auth';
import { useWsStore } from '../stores/ws';
import { useNotificationStore } from '../stores/notifications';
import { api } from '../lib/api';
import { EventMap } from '../components/EventMap';
import { useLLMApiKey } from '../hooks/useLLMApiKey';
import type { DeteriorationAlert, GeoPoint } from '../lib/types';
import { CoordinatorHeader } from './Coordinator/CoordinatorHeader';
import { APIKeyModal } from './Coordinator/APIKeyModal';
import { DeteriorationAlertsPanel } from './Coordinator/DeteriorationAlertsPanel';
import { StatsGrid } from './Coordinator/StatsGrid';
import { TeamMessageStreamPanel } from './Coordinator/TeamMessageStreamPanel';
import { PatientManagementPanel, type FieldPatient } from './Coordinator/PatientManagementPanel';
import type { EventIndoorLayout, MapRuntimeConfig, TeamPatientEngagement } from '../lib/types';

export function CoordinatorDashboard() {
  const { eventId } = useAuthStore();
  const onMessage = useWsStore((s) => s.onMessage);
  const addToast = useNotificationStore((s) => s.add);
  const [teams, setTeams] = useState<any[]>([]);
  const [eventIndoorLayout, setEventIndoorLayout] = useState<EventIndoorLayout | null>(null);
  const [mapRuntimeConfig, setMapRuntimeConfig] = useState<MapRuntimeConfig | null>(null);
  const [mapProvider, setMapProvider] = useState<'leaflet' | 'maplibre'>('leaflet');
  const [presentation3d, setPresentation3d] = useState(false);
  const [stats, setStats] = useState<Record<string, number> | null>(null);
  const [loading, setLoading] = useState(true);
  const [deteriorationAlerts, setDeteriorationAlerts] = useState<DeteriorationAlert[]>([]);
  const [connectedUsers, setConnectedUsers] = useState<number | undefined>(undefined);
  const [lastStatsUpdatedAt, setLastStatsUpdatedAt] = useState<number | undefined>(undefined);
  const [prevStats, setPrevStats] = useState<Record<string, number> | null>(null);
  const [fieldPatients, setFieldPatients] = useState<FieldPatient[]>([]);
  const [creatingPatient, setCreatingPatient] = useState(false);
  const [teamPatientEngagements, setTeamPatientEngagements] = useState<Record<string, TeamPatientEngagement[]>>({});
  /** Per-team per-member live positions: teamId → memberId → GeoPoint */
  const [teamMemberPositions, setTeamMemberPositions] = useState<Record<string, Record<string, GeoPoint>>>({});
  /** ID of the patient whose location is being picked on the map (null = not picking) */
  const [pickingPatientId, setPickingPatientId] = useState<string | null>(null);

  const [teamMessages, setTeamMessages] = useState<Array<{
    id: string;
    text: string;
    fromTeamId?: string | null;
    toTeamId?: string | null;
    sentAt: string;
  }>>([]);

  const { apiKey, setApiKey, hasKey, isDemo } = useLLMApiKey();
  const [showApiKeyInput, setShowApiKeyInput] = useState(false);
  const [apiKeyDraft, setApiKeyDraft] = useState('');

  const fetchAll = useCallback(() => {
    if (!eventId) return;
    Promise.all([
      api.getEventStats(eventId),
      api.getEvent(eventId),
      api.getEventIndoorLayout(eventId),
      api.getEventMapConfig(eventId),
    ]).then(([statsRes, evtRes, indoorRes, mapConfigRes]) => {
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

  useEffect(() => {
    const off = onMessage((msg) => {
      if (msg.type === 'patient.deterioration_alert') {
        const { patientId, trend, news2Score } = (msg.payload as any) ?? {};
        if (patientId && trend) {
          setDeteriorationAlerts((prev) => {
            const filtered = prev.filter((a) => a.patientId !== patientId);
            return [{ patientId, news2Score, ratePerHour: trend.ratePerHour, receivedAt: new Date().toISOString() }, ...filtered];
          });
        }
      } else if (msg.type === 'team.position') {
        const { teamId, position, memberId } = (msg.payload as any) ?? {};
        if (teamId && position) {
          // Update the legacy single-position on the team object
          setTeams((prev) =>
            prev.map((t) => (t.id === teamId ? { ...t, currentPosition: position } : t)),
          );
          // Track per-member position when a memberId is present
          if (memberId) {
            setTeamMemberPositions((prev) => ({
              ...prev,
              [teamId]: { ...(prev[teamId] ?? {}), [memberId]: position },
            }));
          }
        }
      } else if (msg.type === 'team.message') {
        if (eventId && msg.eventId && msg.eventId !== eventId) return;
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

  const handleClosePatient = async (id: string, reason: 'false_alarm' | 'disappeared') => {
    const reasonText = reason === 'false_alarm' ? 'Lukket: Falsk alarm' : 'Lukket: Forsvunnet';
    try {
      // First persist the close reason in the description field
      await api.updatePatient(id, { description: reasonText });
    } catch (err) {
      console.error('[coordinator] Failed to set close reason', err);
    }
    // Then set status = discharged (triggers applyPatientAction which broadcasts patient.updated)
    const res = await api.updatePatient(id, { status: 'discharged' });
    setFieldPatients((prev) =>
      prev.map((p) => p.id === id ? { ...(res.patient as FieldPatient), description: reasonText } : p),
    );
  };

  const handleMapClick = pickingPatientId
    ? async (lat: number, lng: number) => {
        const posText = `${lat.toFixed(5)}, ${lng.toFixed(5)}`;
        await handleUpdatePatient(pickingPatientId, { lat, lon: lng, positionText: posText });
        setPickingPatientId(null);
      }
    : null;

  return (
    <div>
      <CoordinatorHeader
        onDownloadReport={handleDownloadReport}
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

      {deteriorationAlerts.length > 0 && (
        <DeteriorationAlertsPanel
          alerts={deteriorationAlerts}
          onDismiss={(patientId) => setDeteriorationAlerts((prev) => prev.filter((a) => a.patientId !== patientId))}
          onDismissAll={() => setDeteriorationAlerts([])}
        />
      )}

      <StatsGrid
        stats={stats}
        lastUpdatedAt={lastStatsUpdatedAt}
        prevStats={prevStats}
      />

      <TeamMessageStreamPanel messages={teamMessages} teams={teams} />

      {/* Two-column layout: patient list left, map right */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'minmax(0, 2fr) minmax(0, 3fr)',
        gap: 'var(--space-4)',
        alignItems: 'start',
      }}>
        <PatientManagementPanel
          patients={fieldPatients}
          teams={teams}
          creating={creatingPatient}
          loading={loading}
          onCreatePatient={handleCreatePatient}
          onUpdatePatient={handleUpdatePatient}
          teamPatientEngagements={teamPatientEngagements}
          onClosePatient={handleClosePatient}
          onPickLocation={(patientId) => setPickingPatientId(patientId)}
        />

        <div style={{
          position: 'sticky',
          top: 72,
          height: 'calc(100dvh - 80px)',
          borderRadius: 'var(--radius-md)',
          border: '1px solid var(--color-border)',
          overflow: 'hidden',
          display: 'flex',
          flexDirection: 'column',
          background: 'var(--color-surface)',
        }}>
          <div style={{
            display: 'flex',
            flexWrap: 'wrap',
            justifyContent: 'space-between',
            gap: 'var(--space-2)',
            padding: 'var(--space-3)',
            borderBottom: '1px solid var(--color-border)',
          }}>
            <div style={{ display: 'flex', gap: 'var(--space-2)', flexWrap: 'wrap', alignItems: 'center' }}>
              <span style={{ fontFamily: 'var(--font-mono)', fontSize: 'var(--text-xs)', color: 'var(--color-text-muted)' }}>
                Kartmotor
              </span>
              <button
                type="button"
                onClick={() => setMapProvider('leaflet')}
                aria-pressed={mapProvider === 'leaflet'}
                style={{
                  minHeight: 40, padding: '0 var(--space-3)', borderRadius: 'var(--radius-md)',
                  border: `1px solid ${mapProvider === 'leaflet' ? 'var(--color-brand)' : 'var(--color-border)'}`,
                  background: mapProvider === 'leaflet' ? 'var(--color-brand-dim)' : 'var(--color-surface)',
                  cursor: 'pointer', fontWeight: 600,
                }}
              >
                Leaflet
              </button>
              <button
                type="button"
                onClick={() => setMapProvider('maplibre')}
                aria-pressed={mapProvider === 'maplibre'}
                style={{
                  minHeight: 40, padding: '0 var(--space-3)', borderRadius: 'var(--radius-md)',
                  border: `1px solid ${mapProvider === 'maplibre' ? 'var(--color-brand)' : 'var(--color-border)'}`,
                  background: mapProvider === 'maplibre' ? 'var(--color-brand-dim)' : 'var(--color-surface)',
                  cursor: 'pointer', fontWeight: 600,
                }}
              >
                MapLibre
              </button>
              {eventIndoorLayout && (
                <span style={{ fontFamily: 'var(--font-mono)', fontSize: 'var(--text-xs)', color: 'var(--color-text-subtle)' }}>
                  Innendørs: {eventIndoorLayout.venueName ?? eventIndoorLayout.venueId}
                </span>
              )}
            </div>

            <button
              type="button"
              onClick={() => setPresentation3d((value) => !value)}
              aria-pressed={presentation3d}
              style={{
                minHeight: 40, padding: '0 var(--space-3)', borderRadius: 'var(--radius-md)',
                border: `1px solid ${presentation3d ? 'var(--color-brand)' : 'var(--color-border)'}`,
                background: presentation3d ? 'var(--color-brand-dim)' : 'var(--color-surface)',
                cursor: 'pointer', fontWeight: 600,
              }}
            >
              3D-presentasjon {presentation3d ? 'på' : 'av'}
            </button>
          </div>

          <EventMap
            teams={teams}
            provider={mapProvider}
            presentation3d={presentation3d}
            mapRuntimeConfig={mapRuntimeConfig}
            memberPositions={teamMemberPositions}
            patients={fieldPatients}
            onMapClick={handleMapClick}
            onCancelPick={pickingPatientId ? () => setPickingPatientId(null) : undefined}
          />
        </div>
      </div>
    </div>
  );
}
