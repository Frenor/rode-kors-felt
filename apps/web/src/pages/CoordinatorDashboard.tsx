import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuthStore } from '../stores/auth';
import { useWsStore } from '../stores/ws';
import { useNotificationStore } from '../stores/notifications';
import { api } from '../lib/api';
import { EventMap } from '../components/EventMap';
import { useLLMApiKey } from '../hooks/useLLMApiKey';
import { useNow } from '../hooks/useNow';
import { patientNumber } from '../lib/patient-number';
import type { DeteriorationAlert, EventSettings, GeoPoint, TeamMessage } from '../lib/types';
import { CoordinatorHeader } from './Coordinator/CoordinatorHeader';
import { APIKeyModal } from './Coordinator/APIKeyModal';
import { AttentionQueuePanel } from './Coordinator/AttentionQueuePanel';
import { StatsGrid } from './Coordinator/StatsGrid';
import { TeamMessageStreamPanel } from './Coordinator/TeamMessageStreamPanel';
import { TeamStatusPanel } from './Coordinator/TeamStatusPanel';
import { PatientManagementPanel, type FieldPatient } from './Coordinator/PatientManagementPanel';
import { mergeTeamMessages } from './Coordinator/teamMessages';
import { TEAM_OPERATIONAL_STATUS_LABELS } from '../lib/constants';
import { Button } from '../components/ui';
import type { EventIndoorLayout, MapRuntimeConfig, Team, TeamOperationalStatus, TeamPatientEngagement } from '../lib/types';

export function CoordinatorDashboard() {
  const { eventId } = useAuthStore();
  const navigate = useNavigate();
  const onMessage = useWsStore((s) => s.onMessage);
  const wsSend = useWsStore((s) => s.send);
  const addToast = useNotificationStore((s) => s.add);
  const now = useNow();
  const [teams, setTeams] = useState<Team[]>([]);
  const [eventSettings, setEventSettings] = useState<EventSettings | null>(null);
  const [eventIndoorLayout, setEventIndoorLayout] = useState<EventIndoorLayout | null>(null);
  const [mapRuntimeConfig, setMapRuntimeConfig] = useState<MapRuntimeConfig | null>(null);
  const [mapProvider, setMapProvider] = useState<'leaflet' | 'maplibre'>('leaflet');
  const [presentation3d, setPresentation3d] = useState(false);
  const [showMapSettings, setShowMapSettings] = useState(false);
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
  /** Sector/place last dispatched to each team (gap B4 / item 8.23) — shown on the row until changed. */
  const [teamSectors, setTeamSectors] = useState<Record<string, { sector: string; assignedAt: string }>>({});

  const [teamMessages, setTeamMessages] = useState<TeamMessage[]>([]);
  /** "Melding" on a team row: which team to preselect, and a nonce so the same team can be picked twice. */
  const [composeTeamId, setComposeTeamId] = useState<string | null>(null);
  const [composeNonce, setComposeNonce] = useState(0);

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
      setEventSettings(evtRes.event?.settings ?? null);
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

    // Chat history (gap B9 / item 8.29) — seeded once on load, then merged
    // (de-duplicated by id) with whatever arrives live or was already there.
    api.getTeamMessages(eventId).then((res) => {
      setTeamMessages((prev) => mergeTeamMessages(prev, res.messages));
    }).catch((err) => console.error('[coordinator] Failed to load team messages', err));
  }, [eventId]);

  useEffect(() => {
    fetchAll();
  }, [fetchAll]);

  // Re-sync after a realtime gap — events missed while disconnected or while
  // the laptop was asleep would otherwise leave the overview stale.
  useEffect(() => {
    const onResync = () => fetchAll();
    const onVisible = () => {
      if (document.visibilityState === 'visible' && navigator.onLine) fetchAll();
    };
    window.addEventListener('rkf:wsConnected', onResync);
    window.addEventListener('online', onResync);
    document.addEventListener('visibilitychange', onVisible);
    return () => {
      window.removeEventListener('rkf:wsConnected', onResync);
      window.removeEventListener('online', onResync);
      document.removeEventListener('visibilitychange', onVisible);
    };
  }, [fetchAll]);

  useEffect(() => {
    const off = onMessage((msg) => {
      if (msg.type === 'team.status_changed') {
        const payload = (msg.payload as any) ?? {};
        const teamId: string | undefined = payload.teamId;
        const action = payload.action ?? {};
        const status = action.payload?.status as TeamOperationalStatus | undefined;
        if (!teamId || !status) return;
        const note: string | null = action.payload?.note ?? null;
        const updatedAt: string = action.createdAt ?? new Date().toISOString();
        setTeams((prev) => {
          const current = prev.find((t) => t.id === teamId);
          if (current && current.operationalStatus !== 'needs_assistance' && status === 'needs_assistance') {
            navigator.vibrate?.([300, 100, 300]);
            addToast({
              level: 'urgent',
              autoDismissMs: 0,
              message: `${current.name} trenger bistand${note ? `: ${note}` : ''}`,
            });
          } else if (current && current.operationalStatus === 'needs_assistance' && status !== 'needs_assistance') {
            addToast({
              level: 'info',
              autoDismissMs: 6_000,
              message: `${current.name} er nå ${TEAM_OPERATIONAL_STATUS_LABELS[status]?.toLowerCase() ?? status}`,
            });
          }
          return prev.map((t) => (t.id === teamId
            ? { ...t, operationalStatus: status, statusNote: note, statusUpdatedAt: updatedAt }
            : t));
        });
      } else if (msg.type === 'team.transport_changed') {
        const { teamId, transport } = (msg.payload as any) ?? {};
        if (teamId && transport) {
          setTeams((prev) => prev.map((t) => (t.id === teamId ? { ...t, transport } : t)));
        }
      } else if (msg.type === 'patient.deterioration_alert') {
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
          // De-duplicated by id (gap B9 / item 8.29) — the same message can
          // otherwise arrive twice: once live, once from a resync seed.
          const incoming: TeamMessage = {
            id: payload.id ?? crypto.randomUUID(),
            text: payload.text,
            fromTeamId: payload.fromTeamId ?? null,
            fromLabel: typeof payload.fromLabel === 'string' ? payload.fromLabel : null,
            toTeamId: payload.toTeamId ?? null,
            ackOf: payload.ackOf ?? null,
            sentAt: payload.sentAt ?? new Date().toISOString(),
          };
          setTeamMessages((prev) => mergeTeamMessages(prev, [incoming]));
        }
      } else if (msg.type === 'patient.created') {
        const p = (msg.payload as any)?.patient;
        if (p) setFieldPatients((prev) => prev.some((fp) => fp.id === p.id) ? prev : [p as FieldPatient, ...prev]);
      } else if (msg.type === 'patient.updated') {
        const p = (msg.payload as any)?.patient;
        if (p) {
          setFieldPatients((prev) => prev.some((fp) => fp.id === p.id)
            ? prev.map((fp) => fp.id === p.id ? p as FieldPatient : fp)
            : [p as FieldPatient, ...prev]);
        }
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
  }, [eventId, onMessage, addToast]);

  const teamMemberCounts = Object.fromEntries(
    Object.entries(teamMemberPositions).map(([teamId, members]) => [teamId, Object.keys(members).length]),
  );

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

  const handleAssignTeam = async (patientId: string, teamId: string) => {
    try {
      const teamName = teams.find((t) => t.id === teamId)?.name ?? 'lag';
      // The patient's number does not change on assignment — read it from the
      // pre-update list so the toast can say "#12 tildelt Bravo" (gap A5).
      const number = patientNumber(fieldPatients.find((p) => p.id === patientId) ?? {});
      await handleUpdatePatient(patientId, { assignedTeamId: teamId });
      addToast({ level: 'info', autoDismissMs: 4_000, message: `${number ?? 'Pasient'} tildelt ${teamName}` });
    } catch (err) {
      console.error('[coordinator] Failed to assign team', err);
      addToast({ level: 'urgent', autoDismissMs: 6_000, message: 'Kunne ikke tildele lag — prøv igjen.' });
    }
  };

  // "Send til" on a team row (gap B4 / item 8.23) — dispatch to a sector or
  // place, distinct from assigning a specific patient. There is no server
  // echo of the coordinator's own dispatch, so the sector is kept locally
  // once the send has actually gone out (or always, in demo mode).
  const handleDispatchTeam = async (teamId: string, sector: string) => {
    const trimmed = sector.trim();
    if (!trimmed) return;
    const assignedAt = new Date().toISOString();
    if (isDemo) {
      addToast({ level: 'info', autoDismissMs: 4_000, message: 'Demo — sendt lokalt' });
    } else {
      const delivered = wsSend({
        type: 'team.sector_assigned',
        eventId,
        payload: { teamId, sector: trimmed, assignedBy: 'Koordinator', assignedAt },
        timestamp: assignedAt,
      });
      if (!delivered) {
        addToast({ level: 'urgent', autoDismissMs: 6_000, message: 'Ikke tilkoblet — bruk samband' });
        return;
      }
    }
    setTeamSectors((prev) => ({ ...prev, [teamId]: { sector: trimmed, assignedAt } }));
  };

  // Stand a patrol down from the desk. Optimistic so the realtime echo of our
  // own status change does not raise a second "er nå ledig" toast; reverted
  // if the API refuses.
  const handleClearTeamAssistance = async (teamId: string) => {
    const previous = teams.find((t) => t.id === teamId);
    if (!previous) return;
    const note = 'Avklart av koordinator';
    setTeams((prev) => prev.map((t) => (t.id === teamId
      ? { ...t, operationalStatus: 'available', statusNote: note, statusUpdatedAt: new Date().toISOString() }
      : t)));
    try {
      await api.postTeamAction(
        teamId,
        { type: 'team.status_set', status: 'available', note, clientActionId: crypto.randomUUID() },
        { skipOfflineQueue: true },
      );
      addToast({ level: 'info', autoDismissMs: 4_000, message: `${previous.name} er satt ledig` });
    } catch (err) {
      console.error('[coordinator] Failed to clear team assistance', err);
      setTeams((prev) => prev.map((t) => (t.id === teamId ? previous : t)));
      addToast({ level: 'urgent', autoDismissMs: 6_000, message: `Kunne ikke sette ${previous.name} ledig — prøv igjen.` });
    }
  };

  const handleMessageTeam = (teamId: string) => {
    setComposeTeamId(teamId);
    setComposeNonce((n) => n + 1);
  };

  // Chat is realtime-only: the server echoes the message back into the
  // stream, so nothing is added here unless there is no server (demo, where
  // `api.sendTeamMessage` appends to the same in-memory list `getTeamMessages`
  // reads — history and live stay one list, gap B9 / item 8.29).
  const handleSendTeamMessage = async (toTeamId: string | null, text: string): Promise<boolean> => {
    if (isDemo) {
      if (!eventId) return false;
      try {
        const { message } = await api.sendTeamMessage(eventId, { fromTeamId: null, fromLabel: 'Koordinator', toTeamId, text });
        setTeamMessages((prev) => mergeTeamMessages(prev, [message]));
        addToast({ level: 'info', autoDismissMs: 4_000, message: 'Demo — meldingen vises bare her' });
        return true;
      } catch (err) {
        console.error('[coordinator] Demo sendTeamMessage failed', err);
        addToast({ level: 'urgent', autoDismissMs: 6_000, message: 'Kunne ikke sende meldingen.' });
        return false;
      }
    }
    const delivered = wsSend({
      type: 'team.message',
      eventId,
      payload: { fromTeamId: null, fromLabel: 'Koordinator', toTeamId, text },
      timestamp: new Date().toISOString(),
    });
    if (!delivered) {
      addToast({ level: 'urgent', autoDismissMs: 6_000, message: 'Ikke tilkoblet — meldingen ble ikke sendt. Bruk samband.' });
      return false;
    }
    return true;
  };

  // Transport request (gap B3 / item 8.26).
  const handleAssignTransport = async (patientId: string, teamId: string) => {
    try {
      const teamNameForToast = teams.find((t) => t.id === teamId)?.name ?? 'lag';
      const res = await api.executePatientAction(patientId, { type: 'transport.assigned', teamId });
      setFieldPatients((prev) => prev.map((p) => (p.id === patientId ? (res.patient as FieldPatient) : p)));
      addToast({ level: 'info', autoDismissMs: 4_000, message: `Transport tildelt ${teamNameForToast}` });
    } catch (err) {
      console.error('[coordinator] Failed to assign transport', err);
      addToast({ level: 'urgent', autoDismissMs: 6_000, message: 'Kunne ikke tildele transport — prøv igjen.' });
    }
  };

  const handleClearTransport = async (patientId: string) => {
    try {
      const res = await api.executePatientAction(patientId, { type: 'transport.cleared' });
      setFieldPatients((prev) => prev.map((p) => (p.id === patientId ? (res.patient as FieldPatient) : p)));
    } catch (err) {
      console.error('[coordinator] Failed to clear transport', err);
      addToast({ level: 'urgent', autoDismissMs: 6_000, message: 'Kunne ikke fjerne transport — prøv igjen.' });
    }
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
        onOpenEventSetup={() => navigate('/coordinator/event')}
      />

      {showApiKeyInput && (
        <APIKeyModal
          draft={apiKeyDraft}
          onChange={setApiKeyDraft}
          onSave={() => { setApiKey(apiKeyDraft); setShowApiKeyInput(false); }}
          onClose={() => setShowApiKeyInput(false)}
        />
      )}

      {/* What needs a decision right now — always first. */}
      <AttentionQueuePanel
        teams={teams}
        patients={fieldPatients}
        alerts={deteriorationAlerts}
        onAssignTeam={handleAssignTeam}
        onDismissAlert={(patientId) => setDeteriorationAlerts((prev) => prev.filter((a) => a.patientId !== patientId))}
        onClearTeamAssistance={handleClearTeamAssistance}
        onMessageTeam={handleMessageTeam}
        onAssignTransport={handleAssignTransport}
        teamPatientEngagements={teamPatientEngagements}
        now={now}
      />

      <StatsGrid
        stats={stats}
        lastUpdatedAt={lastStatsUpdatedAt}
        prevStats={prevStats}
        sickbaySettings={eventSettings?.sickbay}
        patients={fieldPatients}
      />

      {/* Patients + teams + messages on the left, map on the right (stacked on tablets) */}
      <div className="coordinator-layout">
        <div>
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
            onClearTransport={handleClearTransport}
            now={now}
          />

          <TeamStatusPanel
            teams={teams}
            memberCounts={teamMemberCounts}
            onClearAssistance={handleClearTeamAssistance}
            onMessageTeam={handleMessageTeam}
            sectors={teamSectors}
            onDispatchTeam={handleDispatchTeam}
          />

          <TeamMessageStreamPanel
            messages={teamMessages}
            teams={teams}
            onSend={handleSendTeamMessage}
            composeTeamId={composeTeamId}
            composeNonce={composeNonce}
            now={now}
          />
        </div>

        <div
          className="coordinator-map"
          style={{
            borderRadius: 'var(--radius-md)',
            border: '1px solid var(--color-border)',
            overflow: 'hidden',
            display: 'flex',
            flexDirection: 'column',
            background: 'var(--color-surface)',
          }}
        >
          <div style={{
            display: 'flex',
            flexWrap: 'wrap',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: 'var(--space-2)',
            padding: 'var(--space-2) var(--space-3)',
            borderBottom: '1px solid var(--color-border)',
          }}>
            <div style={{ display: 'flex', gap: 'var(--space-3)', alignItems: 'center', flexWrap: 'wrap' }}>
              <span style={{ fontWeight: 700, fontSize: 'var(--text-base)' }}>Kart</span>
              {eventIndoorLayout && (
                <span style={{ fontSize: 'var(--text-xs)', color: 'var(--color-text-muted)' }}>
                  Innendørs: {eventIndoorLayout.venueName ?? eventIndoorLayout.venueId}
                </span>
              )}
              {pickingPatientId && (
                <span role="status" style={{ fontSize: 'var(--text-sm)', fontWeight: 600, color: 'var(--color-status-info)' }}>
                  Klikk i kartet for å plassere pasienten
                </span>
              )}
            </div>

            {/* Engine and 3D are developer/venue settings, not something a
                coordinator touches during an event — kept behind a disclosure. */}
            <Button
              variant="ghost"
              size="sm"
              iconEnd={showMapSettings ? 'chevronUp' : 'chevronDown'}
              data-testid="map-settings-toggle"
              aria-expanded={showMapSettings}
              onClick={() => setShowMapSettings((v) => !v)}
            >
              Kartinnstillinger
            </Button>

            {showMapSettings && (
              <div
                data-testid="map-settings"
                style={{ flexBasis: '100%', display: 'flex', flexWrap: 'wrap', gap: 'var(--space-2)', alignItems: 'center' }}
              >
                <span className="section-label">Kartmotor</span>
                <Button variant="secondary" size="sm" onClick={() => setMapProvider('leaflet')} aria-pressed={mapProvider === 'leaflet'}>
                  Leaflet
                </Button>
                <Button variant="secondary" size="sm" onClick={() => setMapProvider('maplibre')} aria-pressed={mapProvider === 'maplibre'}>
                  MapLibre
                </Button>
                <Button variant="secondary" size="sm" onClick={() => setPresentation3d((value) => !value)} aria-pressed={presentation3d}>
                  3D-presentasjon {presentation3d ? 'på' : 'av'}
                </Button>
              </div>
            )}
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
