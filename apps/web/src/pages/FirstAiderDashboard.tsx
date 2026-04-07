import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuthStore } from '../stores/auth';
import { useFirstAidWorkspaceStore } from '../stores/firstaid-workspace';
import { useGeolocation } from '../hooks/useGeolocation';
import { useTeamPositionBroadcast } from '../hooks/useTeamPositionBroadcast';
import { useWsStore } from '../stores/ws';
import { useLiveQuery } from 'dexie-react-hooks';
import { offlineQueueDb } from '../lib/offline-queue';
import { offlineFirstAiderQueueDb } from '../lib/offline-firstaid-queue';
import {
  enqueueTeamAction,
  markTeamActionFailed,
  markTeamActionSyncing,
  removeTeamAction,
  type QueuedTeamActionPayload,
} from '../lib/offline-firstaid-queue';
import { api } from '../lib/api';
import type { TeamOperationalStatus, TeamWorkspacePatient, TeamWorkspaceResponse } from '../lib/types';
import type { TeamTransport } from '../stores/auth';
import { VitalsEntryForm, type VitalsFormShape } from './SickBay/VitalsEntryForm';

export function FirstAiderDashboard() {
  const { eventId, teams, updateTeamTransport } = useAuthStore();
  const selectedTeam = useFirstAidWorkspaceStore((s) => s.selectedTeamId);
  const setSelectedTeam = useFirstAidWorkspaceStore((s) => s.setSelectedTeam);
  const activePatientIdByTeam = useFirstAidWorkspaceStore((s) => s.activePatientIdByTeam);
  const latestStatusByTeam = useFirstAidWorkspaceStore((s) => s.latestStatusByTeam);
  const lastSyncedAtByTeam = useFirstAidWorkspaceStore((s) => s.lastSyncedAtByTeam);
  const setActivePatient = useFirstAidWorkspaceStore((s) => s.setActivePatient);
  const clearActivePatient = useFirstAidWorkspaceStore((s) => s.clearActivePatient);
  const setTeamStatus = useFirstAidWorkspaceStore((s) => s.setTeamStatus);
  const setTeamSyncedAt = useFirstAidWorkspaceStore((s) => s.setTeamSyncedAt);
  const [incidents, setIncidents] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [workspaceLoading, setWorkspaceLoading] = useState(false);
  const [workspace, setWorkspace] = useState<TeamWorkspaceResponse | null>(null);
  const [teamGear, setTeamGear] = useState<string[]>([]);
  const [contactPhone, setContactPhone] = useState('');
  const [contactRadio, setContactRadio] = useState('');
  const [contactsDirty, setContactsDirty] = useState(false);
  const [showGear, setShowGear] = useState(false);
  const [showContacts, setShowContacts] = useState(false);
  // Assigned patients (via assigned_team_id)
  const [assignedPatients, setAssignedPatients] = useState<any[]>([]);
  // Map of patientId → Set of field names currently highlighted
  const [highlightedFields, setHighlightedFields] = useState<Map<string, Set<string>>>(new Map());
  const highlightTimers = useRef<Map<string, ReturnType<typeof setTimeout>>>(new Map());
  const navigate = useNavigate();
  const { position: gpsPosition } = useGeolocation();
  const wsSend = useWsStore((s) => s.send);
  const onMessage = useWsStore((s) => s.onMessage);
  const [messages, setMessages] = useState<Array<{ id: string; text: string; fromTeamId?: string; fromSelf: boolean; sentAt: string }>>([]);
  const [messageText, setMessageText] = useState('');
  const chatEndRef = useRef<HTMLDivElement>(null);
  type FirstAiderTab = 'pasienter' | 'hendelser' | 'lag' | 'chat';
  const [activeTab, setActiveTab] = useState<FirstAiderTab>('pasienter');
  const [sectorAssignments, setSectorAssignments] = useState<Record<string, { sector: string; assignedAt: string }>>({});
  const [vitalsForm, setVitalsForm] = useState<VitalsFormShape>({ pulse: '', spo2: '', rr: '', pain: '', bp: '', temp: '', acvpu: '' });

  // Broadcast GPS position every 30s when team is selected
  useTeamPositionBroadcast(selectedTeam);

  // Live offline queue count from IndexedDB
  const queuedIncidents = useLiveQuery(
    () => offlineQueueDb.queue.toArray(),
    [],
    [],
  );
  const queuedTeamActions = useLiveQuery(
    () => offlineFirstAiderQueueDb.queue.toArray(),
    [],
    [],
  );

  useEffect(() => {
    if (!eventId) return;
    api.getIncidents(eventId).then((res) => {
      setIncidents(res.incidents);
      setLoading(false);
    }).catch(() => setLoading(false));
  }, [eventId]);

  useEffect(() => {
    if (!eventId || !selectedTeam) {
      setWorkspace(null);
      return;
    }
    setWorkspaceLoading(true);
    api.getTeamWorkspace(selectedTeam)
      .then((res) => {
        setWorkspace(res);
      })
      .finally(() => setWorkspaceLoading(false));
  }, [eventId, selectedTeam]);

  useEffect(() => {
    if (!eventId || !selectedTeam) { setAssignedPatients([]); return; }
    api.getPatients(eventId, { assignedTeamId: selectedTeam }).then((res) => {
      setAssignedPatients(res.patients ?? []);
    }).catch((err) => console.error('[firstaid] Failed to load assigned patients', err));
  }, [eventId, selectedTeam]);

  useEffect(() => {
    const off = onMessage((msg) => {
      if (msg.type === 'patient.updated') {
        const payload = (msg.payload as any) ?? {};
        const patient = payload.patient;
        const changed: string[] = payload.changedFields ?? [];
        if (!patient || !patient.id) return;

        setAssignedPatients((prev) => {
          const exists = prev.some((p) => p.id === patient.id);
          if (patient.assignedTeamId === selectedTeam) {
            return exists ? prev.map((p) => p.id === patient.id ? patient : p) : [...prev, patient];
          }
          // Removed from this team
          return prev.filter((p) => p.id !== patient.id);
        });

        if (changed.length > 0 && patient.assignedTeamId === selectedTeam) {
          const id: string = patient.id;
          setHighlightedFields((prev) => {
            const next = new Map(prev);
            next.set(id, new Set(changed));
            return next;
          });
          // Clear existing timer for this patient
          const existing = highlightTimers.current.get(id);
          if (existing) clearTimeout(existing);
          const timer = setTimeout(() => {
            setHighlightedFields((prev) => {
              const next = new Map(prev);
              next.delete(id);
              return next;
            });
            highlightTimers.current.delete(id);
          }, 3000);
          highlightTimers.current.set(id, timer);
        }
      } else if (msg.type === 'patient.created') {
        const patient = (msg.payload as any)?.patient;
        if (patient && patient.assignedTeamId === selectedTeam) {
          setAssignedPatients((prev) => [patient, ...prev]);
        }
      }
    });
    return off;
  }, [onMessage, selectedTeam]);

  useEffect(() => {
    if (!selectedTeam) { setTeamGear([]); setContactPhone(''); setContactRadio(''); return; }
    api.getTeamProfile(selectedTeam).then((res) => {
      setTeamGear(res.team.gear ?? []);
      setContactPhone(res.team.contactPhone ?? '');
      setContactRadio(res.team.contactRadio ?? '');
    }).catch((err) => console.error('[firstaid] Failed to load team profile', err));
  }, [selectedTeam]);

  useEffect(() => {
    if (!eventId || !selectedTeam || !workspace) return;
    if (activePatientIdByTeam[`${eventId}:${selectedTeam}`]) return;
    if (workspace.activePatientId) {
      setActivePatient(eventId, selectedTeam, workspace.activePatientId);
    }
  }, [activePatientIdByTeam, eventId, selectedTeam, setActivePatient, workspace]);

  // Receive team messages via WebSocket
  useEffect(() => {
    const off = onMessage((msg) => {
      if (msg.type === 'team.message') {
        const payload = (msg.payload as any) ?? {};
        setMessages((prev) => [
          ...prev,
          {
            id: payload.id ?? crypto.randomUUID(),
            text: payload.text ?? '',
            fromTeamId: payload.fromTeamId,
            fromSelf: payload.fromTeamId === selectedTeam,
            sentAt: payload.sentAt ?? new Date().toISOString(),
          },
        ]);
        setTimeout(() => chatEndRef.current?.scrollIntoView({ behavior: 'smooth' }), 50);
      } else if (msg.type === 'team.sector_assigned') {
        const payload = (msg.payload as any) ?? {};
        if (typeof payload.teamId === 'string') {
          if (typeof payload.sector === 'string' && payload.sector.trim()) {
            setSectorAssignments((prev) => ({
              ...prev,
              [payload.teamId]: {
                sector: payload.sector,
                assignedAt: payload.assignedAt ?? new Date().toISOString(),
              },
            }));
          } else {
            setSectorAssignments((prev) => {
              const next = { ...prev };
              delete next[payload.teamId];
              return next;
            });
          }
        }
      }
    });
    return off;
  }, [onMessage, selectedTeam]);

  const sendMessage = () => {
    if (!messageText.trim() || !eventId) return;
    wsSend({
      type: 'team.message',
      eventId,
      payload: { fromTeamId: selectedTeam ?? undefined, text: messageText.trim() },
      timestamp: new Date().toISOString(),
    });
    setMessageText('');
  };

  const TRANSPORT_TRAVEL_MODE: Record<TeamTransport, string> = {
    foot: 'walking',
    bike: 'bicycling',
    vehicle: 'driving',
    atv: 'driving',
  };

  const navigateToIncident = (incident: any) => {
    const { lat, lng } = incident.location ?? {};
    if (lat == null || lng == null) return;
    const teamTransport = (teams.find((t) => t.id === selectedTeam)?.transport ?? 'foot') as TeamTransport;
    const travelMode = TRANSPORT_TRAVEL_MODE[teamTransport];
    window.open(`https://maps.google.com/maps?daddr=${lat},${lng}&travelmode=${travelMode}`, '_blank', 'noopener');
  };

  const handleTransportChange = async (transport: TeamTransport) => {
    if (!selectedTeam) return;
    const previous = (teams.find((t) => t.id === selectedTeam)?.transport ?? 'foot') as TeamTransport;
    updateTeamTransport(selectedTeam, transport);
    try {
      await api.patchTeamTransport(selectedTeam, transport);
    } catch (err) {
      console.error('[firstaid] Failed to save transport type', err);
      updateTeamTransport(selectedTeam, previous);
    }
  };

  const GEAR_CATALOG = [
    { id: 'first_aid_bag', label: 'Førstehjelpsveske' },
    { id: 'aed', label: 'Hjertestarter (AED)' },
    { id: 'stretcher', label: 'Båre' },
    { id: 'oxygen', label: 'Oksygen' },
    { id: 'emergency_blanket', label: 'Varmedekke' },
    { id: 'tourniquet', label: 'Tourniquet' },
    { id: 'vacuum_mattress', label: 'Vakuummadrass' },
    { id: 'spine_board', label: 'Ryggbrett' },
    { id: 'cervical_collar', label: 'Nakkekrage' },
  ] as const;

  const handleGearToggle = async (itemId: string) => {
    if (!selectedTeam) return;
    const next = teamGear.includes(itemId)
      ? teamGear.filter((g) => g !== itemId)
      : [...teamGear, itemId];
    setTeamGear(next);
    try {
      await api.patchTeamProfile(selectedTeam, { gear: next });
    } catch {
      // revert on failure
      setTeamGear(teamGear);
    }
  };

  const handleContactsSave = async () => {
    if (!selectedTeam) return;
    setContactsDirty(false);
    try {
      await api.patchTeamProfile(selectedTeam, {
        contactPhone: contactPhone.trim() || null,
        contactRadio: contactRadio.trim() || null,
      });
    } catch (err) {
      console.error('[firstaid] Failed to save contact details', err);
      setContactsDirty(true);
    }
  };

  const bearingTo = (lat: number, lng: number): string => {
    if (!gpsPosition) return '';
    const dLng = lng - gpsPosition.lng;
    const y = Math.sin(dLng) * Math.cos(lat * Math.PI / 180);
    const x = Math.cos(gpsPosition.lat * Math.PI / 180) * Math.sin(lat * Math.PI / 180) -
      Math.sin(gpsPosition.lat * Math.PI / 180) * Math.cos(lat * Math.PI / 180) * Math.cos(dLng);
    const brng = Math.round((Math.atan2(y, x) * 180 / Math.PI + 360) % 360);
    const dirs = ['N','NØ','Ø','SØ','S','SV','V','NV'];
    return dirs[Math.round(brng / 45) % 8]!;
  };

  const statusLabels: Record<string, string> = {
    on_scene: 'På stedet',
    transporting: 'Under transport',
    at_sickbay: 'På sykestue',
    handed_over: 'Overlevert',
    resolved: 'Løst',
  };

  const teamStatusLabels: Record<TeamOperationalStatus, string> = {
    available: 'Ledig',
    en_route: 'På vei',
    on_scene: 'Fremme på stedet',
    needs_assistance: 'Trenger bistand',
    unavailable: 'Utilgjengelig',
  };

  const workspaceKey = eventId && selectedTeam ? `${eventId}:${selectedTeam}` : null;
  const activePatientId = workspaceKey ? activePatientIdByTeam[workspaceKey] : undefined;
  const selectedTeamStatus = workspaceKey
    ? latestStatusByTeam[workspaceKey] ?? workspace?.latestStatus ?? 'available'
    : 'available';
  const lastSyncedAt = workspaceKey ? lastSyncedAtByTeam[workspaceKey] : undefined;
  const pendingTeamActionCount = (queuedTeamActions ?? []).filter((item) => item.status === 'pending').length;
  const failedTeamActionCount = (queuedTeamActions ?? []).filter((item) => item.status === 'failed').length;
  const syncLabel = !navigator.onLine
    ? 'Laget lokalt'
    : pendingTeamActionCount > 0
      ? 'Synkroniserer'
      : failedTeamActionCount > 0
        ? 'Ikke synkronisert'
        : 'Synkronisert';

  const allVisiblePatients: TeamWorkspacePatient[] = [
    ...(workspace?.assignedPatients ?? []),
    ...(workspace?.monitoredPatients ?? []),
    ...(workspace?.unassignedPatients ?? []),
  ];
  const monitoredPatients = (workspace?.monitoredPatients ?? []).filter(
    (p) => !assignedPatients.some((a) => a.id === p.id),
  );

  // Reset vitals form whenever the active patient changes
  useEffect(() => {
    setVitalsForm({ pulse: '', spo2: '', rr: '', pain: '', bp: '', temp: '', acvpu: '' });
  }, [activePatientId]);

  const queueAndSyncTeamAction = async (teamId: string, payload: QueuedTeamActionPayload) => {
    await enqueueTeamAction(teamId, payload);
    if (!navigator.onLine) return;
    try {
      await markTeamActionSyncing(payload.clientActionId);
      await api.postTeamAction(teamId, payload, { skipOfflineQueue: true });
      await removeTeamAction(payload.clientActionId);
      if (eventId) {
        setTeamSyncedAt(eventId, teamId, new Date().toISOString());
      }
    } catch {
      await markTeamActionFailed(payload.clientActionId);
    }
  };

  const setTeamOperationalStatus = async (status: TeamOperationalStatus) => {
    if (!eventId || !selectedTeam) return;
    const payload = {
      type: 'team.status_set' as const,
      status,
      clientActionId: crypto.randomUUID(),
    };
    setTeamStatus(eventId, selectedTeam, status);
    await queueAndSyncTeamAction(selectedTeam, payload);
  };

  const handleSetActivePatient = async (patientId: string) => {
    if (!eventId || !selectedTeam) return;
    setActivePatient(eventId, selectedTeam, patientId);
    const monitored = workspace?.monitoredPatients.some((patient) => patient.id === patientId)
      || workspace?.assignedPatients.some((patient) => patient.id === patientId);
    if (!monitored) {
      await queueAndSyncTeamAction(selectedTeam, {
        type: 'team.monitor_started',
        patientId,
        clientActionId: crypto.randomUUID(),
      });
    }
  };

  const handleDeactivatePatient = async () => {
    if (!eventId || !selectedTeam || !activePatientId) return;
    const patientId = activePatientId;
    clearActivePatient(eventId, selectedTeam);
    await queueAndSyncTeamAction(selectedTeam, {
      type: 'team.monitor_stopped',
      patientId,
      clientActionId: crypto.randomUUID(),
    });
  };

  const handleRecordVitals = async () => {
    if (!activePatientId) return;
    const payload = {
      pulse: vitalsForm.pulse ? parseInt(vitalsForm.pulse) : undefined,
      spo2: vitalsForm.spo2 ? parseInt(vitalsForm.spo2) : undefined,
      respiratoryRate: vitalsForm.rr ? parseInt(vitalsForm.rr) : undefined,
      painScore: vitalsForm.pain ? parseInt(vitalsForm.pain) : undefined,
      systolicBP: vitalsForm.bp ? parseInt(vitalsForm.bp) : undefined,
      temperature: vitalsForm.temp ? parseFloat(vitalsForm.temp) : undefined,
      acvpu: vitalsForm.acvpu || undefined,
    };
    await api.recordVitals(activePatientId, payload as Record<string, number | undefined>);
    setVitalsForm({ pulse: '', spo2: '', rr: '', pain: '', bp: '', temp: '', acvpu: '' });
  };

  const handleReportToCoordinator = () => {
    if (!activePatientId || !eventId) return;
    const fullPatient = assignedPatients.find((p) => p.id === activePatientId);
    const workspacePatient = allVisiblePatients.find((p) => p.id === activePatientId);
    const patientLabel = (fullPatient as any)?.label || workspacePatient?.presentingComplaint || `Pasient ${activePatientId.slice(0, 8)}`;
    const teamName = teams.find((t) => t.id === selectedTeam)?.name ?? 'Ukjent lag';
    wsSend({
      type: 'team.message',
      eventId,
      payload: { fromTeamId: selectedTeam ?? undefined, text: `${teamName} behandler: ${patientLabel}` },
      timestamp: new Date().toISOString(),
    });
  };

  const transportLabels: Record<TeamTransport, string> = {
    foot: 'Til fots',
    bike: 'Sykkel',
    vehicle: 'Kjøretøy',
    atv: 'ATV',
  };

  const TRIAGE_STYLE: Record<string, { bg: string; text: string; label: string }> = {
    red:    { bg: '#fee2e2', text: '#b91c1c', label: 'Rød' },
    yellow: { bg: '#fef9c3', text: '#854d0e', label: 'Gul' },
    green:  { bg: '#dcfce7', text: '#166534', label: 'Grønn' },
    black:  { bg: '#f1f5f9', text: '#1e293b', label: 'Svart' },
  };

  const typeLabels: Record<string, string> = {
    medical: 'Medisinsk',
    trauma: 'Traume',
    psychiatric: 'Psykiatrisk',
    other: 'Annet',
  };

  const patientBadgeCount = assignedPatients.length + (workspace?.monitoredPatients.length ?? 0);
  const hendelseBadgeCount = queuedIncidents?.length ?? 0;
  const chatBadgeCount = messages.length;

  return (
    <div className="animate-fade-in" style={{ paddingBottom: 'calc(64px + var(--space-2))' }}>

      {/* ── PASIENTER TAB ─────────────────────────────────────────── */}
      {activeTab === 'pasienter' && !selectedTeam && (
        <div style={{
          padding: 'var(--space-8)', textAlign: 'center',
          color: 'var(--color-text-subtle)', fontSize: 'var(--text-sm)',
        }}>
          Velg patrulje i <strong>Lag</strong>-fanen for å komme i gang.
        </div>
      )}

      {activeTab === 'pasienter' && selectedTeam && (
        <>
          {/* Sector assignment banner */}
          {sectorAssignments[selectedTeam] && (
            <section
              aria-live="polite"
              style={{
                marginBottom: 'var(--space-4)',
                padding: 'var(--space-3) var(--space-4)',
                borderRadius: 'var(--radius-md)',
                border: '1px solid var(--color-brand)',
                background: 'var(--color-brand-dim)',
              }}
            >
              <div style={{ fontWeight: 700, fontSize: 'var(--text-sm)', color: 'var(--color-brand)' }}>
                Tildelt sektor: {sectorAssignments[selectedTeam]!.sector}
              </div>
              <div style={{ fontSize: 'var(--text-xs)', color: 'var(--color-text-subtle)' }}>
                Oppdatert {new Date(sectorAssignments[selectedTeam]!.assignedAt).toLocaleTimeString('nb-NO', { hour: '2-digit', minute: '2-digit' })}
              </div>
            </section>
          )}

          {/* Assigned patients from coordinator */}
          {assignedPatients.length > 0 && (
            <section
              aria-labelledby="assigned-patients-heading"
              aria-live="polite"
              style={{ marginBottom: 'var(--space-4)' }}
            >
              <h2
                id="assigned-patients-heading"
                style={{
                  fontSize: 'var(--text-sm)', fontFamily: 'var(--font-mono)',
                  color: 'var(--color-text-muted)', textTransform: 'uppercase',
                  letterSpacing: 'var(--tracking-mono)', marginBottom: 'var(--space-3)',
                }}
              >
                Tildelte pasienter ({assignedPatients.length})
              </h2>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-2)' }}>
                {assignedPatients.map((p) => {
                  const highlighted = highlightedFields.get(p.id);
                  const isFlashing = highlighted && highlighted.size > 0;
                  const triage = p.triageStatus ? TRIAGE_STYLE[p.triageStatus] : null;
                  return (
                    <div
                      key={p.id}
                      style={{
                        padding: 'var(--space-3)',
                        borderRadius: 'var(--radius-md)',
                        border: `1px solid ${isFlashing ? 'var(--color-status-warning)' : 'var(--color-border)'}`,
                        background: isFlashing ? 'var(--color-status-warning-bg)' : 'var(--color-surface)',
                        transition: 'background 0.4s ease, border-color 0.4s ease',
                        display: 'flex',
                        flexDirection: 'column',
                        gap: 'var(--space-1)',
                      }}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)' }}>
                        {triage && (
                          <span style={{
                            display: 'inline-block', padding: '1px 8px',
                            borderRadius: 'var(--radius-full)',
                            background: highlighted?.has('triageStatus') ? 'var(--color-status-warning-bg)' : triage.bg,
                            color: triage.text, fontSize: 'var(--text-xs)', fontWeight: 700,
                            fontFamily: 'var(--font-mono)',
                            outline: highlighted?.has('triageStatus') ? '2px solid var(--color-status-warning)' : 'none',
                          }}>
                            {triage.label}
                          </span>
                        )}
                        <span style={{ fontWeight: 700, fontSize: 'var(--text-sm)' }}>
                          {p.label || 'Ukjent pasient'}
                        </span>
                        {isFlashing && (
                          <span style={{ marginLeft: 'auto', fontSize: 'var(--text-xs)', fontWeight: 700, color: 'var(--color-status-warning)' }}>
                            Oppdatert
                          </span>
                        )}
                      </div>
                      {p.positionText && (
                        <div style={{
                          fontSize: 'var(--text-xs)',
                          color: 'var(--color-text-subtle)',
                          background: highlighted?.has('positionText') ? 'var(--color-status-warning-bg)' : 'transparent',
                          borderRadius: 'var(--radius-sm)',
                          padding: highlighted?.has('positionText') ? '2px 4px' : '0',
                          transition: 'background 0.4s ease',
                        }}>
                          Posisjon: {p.positionText}
                        </div>
                      )}
                      {p.description && (
                        <div style={{
                          fontSize: 'var(--text-sm)',
                          color: 'var(--color-text)',
                          background: highlighted?.has('description') ? 'var(--color-status-warning-bg)' : 'transparent',
                          borderRadius: 'var(--radius-sm)',
                          padding: highlighted?.has('description') ? '2px 4px' : '0',
                          transition: 'background 0.4s ease',
                        }}>
                          {p.description}
                        </div>
                      )}
                      <div style={{ display: 'flex', gap: 'var(--space-2)', flexWrap: 'wrap' }}>
                        {p.lat != null && p.lon != null && (
                          <button
                            onClick={() => {
                              const mode = TRANSPORT_TRAVEL_MODE[(teams.find((t) => t.id === selectedTeam)?.transport ?? 'foot') as TeamTransport];
                              window.open(`https://maps.google.com/maps?daddr=${p.lat},${p.lon}&travelmode=${mode}`, '_blank', 'noopener');
                            }}
                            className="touch-target"
                            style={{
                              minHeight: 36, padding: '0 var(--space-3)',
                              borderRadius: 'var(--radius-sm)', border: '1px solid var(--color-brand)',
                              background: 'transparent', color: 'var(--color-brand)',
                              fontSize: 'var(--text-xs)', fontWeight: 600, cursor: 'pointer',
                            }}
                          >
                            Naviger hit
                          </button>
                        )}
                        <button
                          onClick={() => handleSetActivePatient(p.id)}
                          className="touch-target"
                          style={{
                            minHeight: 36, padding: '0 var(--space-3)',
                            borderRadius: 'var(--radius-sm)',
                            border: `1px solid ${activePatientId === p.id ? 'var(--color-brand)' : 'var(--color-border)'}`,
                            background: activePatientId === p.id ? 'var(--color-brand)' : 'transparent',
                            color: activePatientId === p.id ? 'white' : 'var(--color-text)',
                            fontSize: 'var(--text-xs)', fontWeight: 700, cursor: 'pointer',
                          }}
                        >
                          {activePatientId === p.id ? 'Aktiv' : 'Sett aktiv'}
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            </section>
          )}

          {/* Patient workspace */}
          <section
            data-testid="firstaid-patient-workspace"
            style={{
              marginBottom: 'var(--space-4)',
              padding: 'var(--space-3)',
              borderRadius: 'var(--radius-md)',
              border: '1px solid var(--color-border)',
              background: 'var(--color-surface)',
              display: 'flex',
              flexDirection: 'column',
              gap: 'var(--space-3)',
            }}
          >
            <header style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 'var(--space-2)' }}>
              <div>
                <h2 style={{ margin: 0, fontSize: 'var(--text-base)', fontWeight: 700 }}>Mine pasienter</h2>
                <p style={{ margin: 0, fontSize: 'var(--text-xs)', color: 'var(--color-text-subtle)' }}>
                  {syncLabel}
                  {lastSyncedAt ? ` · ${new Date(lastSyncedAt).toLocaleTimeString('nb-NO', { hour: '2-digit', minute: '2-digit' })}` : ''}
                  {pendingTeamActionCount > 0 ? ` · ${pendingTeamActionCount} i kø` : ''}
                </p>
              </div>
              <span
                style={{
                  fontFamily: 'var(--font-mono)',
                  fontSize: 'var(--text-xs)',
                  padding: '2px 8px',
                  borderRadius: 'var(--radius-full)',
                  background: selectedTeamStatus === 'needs_assistance'
                    ? 'var(--color-status-critical-bg)'
                    : 'var(--color-surface-sunken)',
                  color: selectedTeamStatus === 'needs_assistance'
                    ? 'var(--color-status-critical)'
                    : 'var(--color-text-subtle)',
                }}
              >
                {teamStatusLabels[selectedTeamStatus as TeamOperationalStatus]}
              </span>
            </header>

            {workspaceLoading ? (
              <p style={{ margin: 0, fontSize: 'var(--text-sm)', color: 'var(--color-text-subtle)' }}>Laster pasientarbeidsflate...</p>
            ) : (
              <>
                {activePatientId ? (
                  <section aria-labelledby="active-patient-heading" style={{
                    borderRadius: 'var(--radius-md)',
                    border: '2px solid var(--color-brand)',
                    background: 'var(--color-brand-dim)',
                    padding: 'var(--space-3)',
                    display: 'flex', flexDirection: 'column', gap: 'var(--space-2)',
                  }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 'var(--space-2)' }}>
                      <div>
                        <div style={{ fontSize: 'var(--text-xs)', fontFamily: 'var(--font-mono)', color: 'var(--color-text-subtle)', textTransform: 'uppercase', letterSpacing: 'var(--tracking-mono)' }}>
                          Aktiv pasient
                        </div>
                        <div id="active-patient-heading" style={{ fontWeight: 700, fontSize: 'var(--text-base)' }}>
                          {(assignedPatients.find((p) => p.id === activePatientId) as any)?.label
                            || allVisiblePatients.find((p) => p.id === activePatientId)?.presentingComplaint
                            || `Pasient ${activePatientId.slice(0, 8)}`}
                        </div>
                      </div>
                      <button
                        onClick={handleDeactivatePatient}
                        style={{
                          flexShrink: 0, padding: '4px var(--space-2)', borderRadius: 'var(--radius-sm)',
                          border: '1px solid var(--color-border)', background: 'transparent',
                          color: 'var(--color-text-subtle)', fontSize: 'var(--text-xs)', cursor: 'pointer',
                        }}
                      >
                        Lukk
                      </button>
                    </div>
                    <button
                      onClick={handleReportToCoordinator}
                      className="touch-target"
                      style={{
                        width: '100%', minHeight: 40, borderRadius: 'var(--radius-sm)',
                        border: '1px solid var(--color-brand)', background: 'transparent',
                        color: 'var(--color-brand)', fontSize: 'var(--text-sm)', fontWeight: 600, cursor: 'pointer',
                      }}
                    >
                      Rapporter til koordinator
                    </button>
                    <VitalsEntryForm
                      patientId={activePatientId}
                      form={vitalsForm}
                      onChange={setVitalsForm}
                      onSubmit={handleRecordVitals}
                    />
                  </section>
                ) : (
                  <div style={{ padding: 'var(--space-3)', borderRadius: 'var(--radius-sm)', background: 'var(--color-surface-sunken)', fontSize: 'var(--text-sm)', color: 'var(--color-text-subtle)' }}>
                    Ingen aktiv pasient – velg en fra listen over
                  </div>
                )}

                <div data-testid="firstaid-patient-list" style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-2)' }}>
                  <div style={{ fontSize: 'var(--text-xs)', color: 'var(--color-text-subtle)' }}>Egne pasienter</div>
                  {monitoredPatients.length === 0 ? (
                    <p style={{ margin: 0, fontSize: 'var(--text-sm)', color: 'var(--color-text-subtle)' }}>
                      Ingen egne pasienter ennå.
                    </p>
                  ) : (
                    monitoredPatients.map((patient) => (
                      <div
                        key={patient.id}
                        data-testid={`firstaid-patient-item-${patient.id}`}
                        style={{
                          border: '1px solid var(--color-border)',
                          borderRadius: 'var(--radius-sm)',
                          padding: 'var(--space-2)',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'space-between',
                          gap: 'var(--space-2)',
                        }}
                      >
                        <div>
                          <div style={{ fontWeight: 600, fontSize: 'var(--text-sm)' }}>
                            {patient.presentingComplaint || 'Ukjent problemstilling'}
                          </div>
                          <div style={{ fontSize: 'var(--text-xs)', color: 'var(--color-text-subtle)' }}>
                            Sist oppdatert {new Date(patient.updatedAt).toLocaleTimeString('nb-NO', { hour: '2-digit', minute: '2-digit' })}
                          </div>
                        </div>
                        <button
                          onClick={() => handleSetActivePatient(patient.id)}
                          className="touch-target"
                          style={{
                            minHeight: 'var(--touch-min)',
                            padding: '0 var(--space-3)',
                            borderRadius: 'var(--radius-sm)',
                            border: '1px solid var(--color-brand)',
                            background: activePatientId === patient.id ? 'var(--color-brand)' : 'transparent',
                            color: activePatientId === patient.id ? 'white' : 'var(--color-brand)',
                            fontSize: 'var(--text-xs)',
                            fontWeight: 700,
                            cursor: 'pointer',
                          }}
                        >
                          {activePatientId === patient.id ? 'Aktiv' : 'Sett aktiv'}
                        </button>
                      </div>
                    ))
                  )}
                </div>

                <section aria-labelledby="firstaid-unassigned-patients" style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-2)' }}>
                  <h3
                    id="firstaid-unassigned-patients"
                    style={{ margin: 0, fontSize: 'var(--text-xs)', color: 'var(--color-text-subtle)' }}
                  >
                    Utildelte pasienter
                  </h3>
                  {(workspace?.unassignedPatients ?? []).map((patient) => (
                    <div key={patient.id} style={{ padding: 'var(--space-2)', borderRadius: 'var(--radius-sm)', border: '1px solid var(--color-border)' }}>
                      <div style={{ fontWeight: 600, fontSize: 'var(--text-sm)' }}>
                        {patient.presentingComplaint || 'Ukjent problemstilling'}
                      </div>
                      <button
                        onClick={() => handleSetActivePatient(patient.id)}
                        className="touch-target"
                        style={{
                          marginTop: 'var(--space-2)',
                          minHeight: 44,
                          padding: '0 var(--space-3)',
                          borderRadius: 'var(--radius-sm)',
                          border: '1px solid var(--color-brand)',
                          background: 'transparent',
                          color: 'var(--color-brand)',
                          fontSize: 'var(--text-xs)',
                          cursor: 'pointer',
                        }}
                      >
                        Overvåk pasient
                      </button>
                    </div>
                  ))}
                  {(workspace?.unassignedPatients ?? []).length === 0 && (
                    <p style={{ margin: 0, fontSize: 'var(--text-sm)', color: 'var(--color-text-subtle)' }}>
                      Ingen utildelte pasienter tilgjengelig.
                    </p>
                  )}
                </section>
              </>
            )}
          </section>
        </>
      )}

      {/* ── HENDELSER TAB ─────────────────────────────────────────── */}
      {activeTab === 'hendelser' && (
        <>
          <button
            onClick={() => navigate('/firstaid/incident', {
              state: { teamId: selectedTeam, eventId },
            })}
            className="touch-target"
            aria-label="Meld ny hendelse"
            style={{
              width: '100%',
              minHeight: 80,
              padding: 'var(--space-5)',
              borderRadius: 'var(--radius-lg)',
              border: 'none',
              background: 'var(--color-brand)',
              color: 'white',
              fontSize: 'var(--text-xl)',
              fontWeight: 700,
              cursor: 'pointer',
              marginBottom: 'var(--space-6)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 'var(--space-3)',
            }}
          >
            <span style={{ fontSize: '1.5em' }} aria-hidden="true">+</span>
            Meld hendelse
          </button>

          {queuedIncidents && queuedIncidents.length > 0 && (
            <section aria-labelledby="queued-heading" style={{ marginBottom: 'var(--space-4)' }}>
              <h2
                id="queued-heading"
                style={{
                  fontSize: 'var(--text-sm)', fontFamily: 'var(--font-mono)',
                  color: 'var(--color-status-warning)', textTransform: 'uppercase',
                  letterSpacing: 'var(--tracking-mono)', marginBottom: 'var(--space-3)',
                }}
              >
                Venter på nettverk ({queuedIncidents.length})
              </h2>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-2)' }}>
                {queuedIncidents.map((item) => (
                  <div key={item.clientId} style={{
                    padding: 'var(--space-3)', borderRadius: 'var(--radius-md)',
                    border: '1px solid var(--color-status-warning-border)',
                    background: 'var(--color-status-warning-bg)',
                  }}>
                    <span style={{
                      fontFamily: 'var(--font-mono)', fontSize: 'var(--text-xs)',
                      color: 'var(--color-status-warning)',
                    }}>
                      ⏳ Lagret lokalt — synkroniseres automatisk
                    </span>
                  </div>
                ))}
              </div>
            </section>
          )}

          <section aria-labelledby="recent-heading">
            <h2
              id="recent-heading"
              style={{
                fontSize: 'var(--text-sm)',
                fontFamily: 'var(--font-mono)',
                color: 'var(--color-text-muted)',
                textTransform: 'uppercase',
                letterSpacing: 'var(--tracking-mono)',
                marginBottom: 'var(--space-3)',
              }}
            >
              Siste hendelser
            </h2>
            {loading ? (
              <p style={{ color: 'var(--color-text-subtle)', fontSize: 'var(--text-sm)' }}>Laster...</p>
            ) : incidents.length === 0 ? (
              <div style={{
                padding: 'var(--space-8)', textAlign: 'center',
                color: 'var(--color-text-subtle)', background: 'var(--color-surface)',
                borderRadius: 'var(--radius-md)', border: '1px solid var(--color-border)',
              }}>
                <p style={{ fontSize: 'var(--text-sm)' }}>Ingen hendelser ennå</p>
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-2)' }}>
                {incidents.slice(0, 10).map((incident) => (
                  <div
                    key={incident.id}
                    style={{
                      padding: 'var(--space-4)',
                      borderRadius: 'var(--radius-md)',
                      border: '1px solid var(--color-border)',
                      background: 'var(--color-surface)',
                    }}
                  >
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 'var(--space-2)' }}>
                      <span style={{ fontWeight: 600, fontSize: 'var(--text-sm)' }}>
                        {typeLabels[incident.type] || incident.type}
                      </span>
                      <span style={{
                        fontFamily: 'var(--font-mono)', fontSize: 'var(--text-xs)',
                        padding: '2px 8px', borderRadius: 'var(--radius-full)',
                        background: incident.status === 'resolved' ? 'var(--color-status-ok-bg)' : 'var(--color-status-warning-bg)',
                        color: incident.status === 'resolved' ? 'var(--color-status-ok)' : 'var(--color-status-warning)',
                      }}>
                        {statusLabels[incident.status] || incident.status}
                      </span>
                    </div>
                    {incident.acvpu && (
                      <span style={{ fontFamily: 'var(--font-mono)', fontSize: 'var(--text-xs)', color: 'var(--color-text-muted)' }}>
                        ACVPU: {incident.acvpu.toUpperCase()}
                      </span>
                    )}
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 'var(--space-2)' }}>
                      <span style={{ fontFamily: 'var(--font-mono)', fontSize: 'var(--text-xs)', color: 'var(--color-text-subtle)' }}>
                        {new Date(incident.createdAt).toLocaleTimeString('no-NO', { hour: '2-digit', minute: '2-digit' })}
                        {incident.location && gpsPosition && (
                          <span style={{ marginLeft: 8 }}>· {bearingTo(incident.location.lat, incident.location.lng)}</span>
                        )}
                      </span>
                      {incident.location && incident.status !== 'resolved' && (
                        <button
                          onClick={() => navigateToIncident(incident)}
                          className="touch-target"
                          style={{
                            minHeight: 36, padding: '0 var(--space-3)', borderRadius: 'var(--radius-sm)',
                            border: '1px solid var(--color-brand)', background: 'transparent',
                            color: 'var(--color-brand)', fontSize: 'var(--text-xs)', fontWeight: 600, cursor: 'pointer',
                          }}
                        >
                          Naviger hit
                        </button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </section>
        </>
      )}

      {/* ── LAG TAB ───────────────────────────────────────────────── */}
      {activeTab === 'lag' && (
        <>
          {!selectedTeam && teams.length > 0 && (
            <div style={{ marginBottom: 'var(--space-6)' }}>
              <h2 style={{ fontSize: 'var(--text-lg)', fontWeight: 600, marginBottom: 'var(--space-3)' }}>
                Velg patrulje
              </h2>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-2)' }}>
                {teams.map((team) => (
                  <button
                    key={team.id}
                    onClick={() => setSelectedTeam(team.id)}
                    className="touch-target"
                    style={{
                      width: '100%',
                      minHeight: 'var(--touch-min)',
                      padding: 'var(--space-4)',
                      borderRadius: 'var(--radius-md)',
                      border: '1px solid var(--color-border)',
                      background: 'var(--color-surface)',
                      color: 'var(--color-text)',
                      fontSize: 'var(--text-base)',
                      fontWeight: 600,
                      textAlign: 'left',
                      cursor: 'pointer',
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                    }}
                  >
                    <span>{team.name}</span>
                    {team.transport && (
                      <span style={{ fontSize: 'var(--text-xs)', fontWeight: 400, color: 'var(--color-text-subtle)', fontFamily: 'var(--font-mono)' }}>
                        {transportLabels[team.transport as TeamTransport] ?? team.transport}
                      </span>
                    )}
                  </button>
                ))}
              </div>
            </div>
          )}

          {selectedTeam && (
            <section
              data-testid="firstaid-team-settings"
              style={{
                marginBottom: 'var(--space-4)',
                padding: 'var(--space-3)',
                borderRadius: 'var(--radius-md)',
                border: '1px solid var(--color-border)',
                background: 'var(--color-surface)',
                display: 'flex',
                flexDirection: 'column',
                gap: 'var(--space-3)',
              }}
            >
              <header>
                <h2 style={{ margin: 0, fontSize: 'var(--text-base)', fontWeight: 700 }}>
                  {teams.find((t) => t.id === selectedTeam)?.name ?? 'Lag'}
                </h2>
                <p style={{ margin: 0, fontSize: 'var(--text-xs)', color: 'var(--color-text-subtle)' }}>
                  {syncLabel}
                  {lastSyncedAt ? ` · ${new Date(lastSyncedAt).toLocaleTimeString('nb-NO', { hour: '2-digit', minute: '2-digit' })}` : ''}
                  {pendingTeamActionCount > 0 ? ` · ${pendingTeamActionCount} i kø` : ''}
                </p>
              </header>

              {/* Transport type picker */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-1)' }}>
                <div style={{ fontSize: 'var(--text-xs)', color: 'var(--color-text-subtle)' }}>Fremkomstmiddel</div>
                <div
                  role="radiogroup"
                  aria-label="Velg fremkomstmiddel"
                  style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 'var(--space-1)' }}
                >
                  {(Object.keys(transportLabels) as TeamTransport[]).map((t) => {
                    const currentTransport = (teams.find((team) => team.id === selectedTeam)?.transport ?? 'foot') as TeamTransport;
                    return (
                      <button
                        key={t}
                        onClick={() => handleTransportChange(t)}
                        aria-pressed={currentTransport === t}
                        className="touch-target"
                        style={{
                          minHeight: 44,
                          padding: 'var(--space-1)',
                          borderRadius: 'var(--radius-sm)',
                          border: `1px solid ${currentTransport === t ? 'var(--color-brand)' : 'var(--color-border)'}`,
                          background: currentTransport === t ? 'var(--color-brand-dim)' : 'transparent',
                          color: 'var(--color-text)',
                          fontSize: 'var(--text-xs)',
                          fontWeight: currentTransport === t ? 700 : 400,
                          cursor: 'pointer',
                        }}
                      >
                        {transportLabels[t]}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Gear checklist */}
              <div>
                <button
                  onClick={() => setShowGear((v) => !v)}
                  style={{
                    width: '100%', display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                    padding: 'var(--space-2) 0', background: 'none', border: 'none',
                    color: 'var(--color-text)', cursor: 'pointer',
                  }}
                >
                  <span style={{ fontSize: 'var(--text-xs)', color: 'var(--color-text-subtle)' }}>
                    Utstyr ({teamGear.length}/{GEAR_CATALOG.length})
                  </span>
                  <span style={{ fontSize: 'var(--text-xs)', color: 'var(--color-text-subtle)' }}>{showGear ? '▲' : '▼'}</span>
                </button>
                {showGear && (
                  <div role="group" aria-label="Utstyrsliste" style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-1)' }}>
                    {GEAR_CATALOG.map((item) => {
                      const checked = teamGear.includes(item.id);
                      return (
                        <label
                          key={item.id}
                          style={{
                            display: 'flex', alignItems: 'center', gap: 'var(--space-2)',
                            padding: 'var(--space-2) var(--space-3)',
                            borderRadius: 'var(--radius-sm)',
                            border: `1px solid ${checked ? 'var(--color-brand)' : 'var(--color-border)'}`,
                            background: checked ? 'var(--color-brand-dim)' : 'transparent',
                            cursor: 'pointer',
                            minHeight: 44,
                          }}
                        >
                          <input
                            type="checkbox"
                            checked={checked}
                            onChange={() => handleGearToggle(item.id)}
                            style={{ width: 18, height: 18, accentColor: 'var(--color-brand)', flexShrink: 0 }}
                          />
                          <span style={{ fontSize: 'var(--text-sm)', fontWeight: checked ? 600 : 400 }}>
                            {item.label}
                          </span>
                        </label>
                      );
                    })}
                  </div>
                )}
              </div>

              {/* Contact numbers */}
              <div>
                <button
                  onClick={() => setShowContacts((v) => !v)}
                  style={{
                    width: '100%', display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                    padding: 'var(--space-2) 0', background: 'none', border: 'none',
                    color: 'var(--color-text)', cursor: 'pointer',
                  }}
                >
                  <span style={{ fontSize: 'var(--text-xs)', color: 'var(--color-text-subtle)' }}>
                    Kontaktinfo {(contactPhone || contactRadio) ? '·' : ''} {contactPhone || contactRadio ? `${[contactPhone, contactRadio].filter(Boolean).join(' / ')}` : 'Ikke satt'}
                  </span>
                  <span style={{ fontSize: 'var(--text-xs)', color: 'var(--color-text-subtle)' }}>{showContacts ? '▲' : '▼'}</span>
                </button>
                {showContacts && (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-2)' }}>
                    <div>
                      <label htmlFor="contact-phone" style={{ display: 'block', fontSize: 'var(--text-xs)', color: 'var(--color-text-subtle)', marginBottom: 'var(--space-1)' }}>
                        Mobilnummer
                      </label>
                      <input
                        id="contact-phone"
                        type="tel"
                        value={contactPhone}
                        onChange={(e) => { setContactPhone(e.target.value); setContactsDirty(true); }}
                        placeholder="f.eks. 900 12 345"
                        style={{
                          width: '100%', height: 44, padding: '0 var(--space-3)',
                          borderRadius: 'var(--radius-sm)', border: '1px solid var(--color-input-border)',
                          background: 'var(--color-input-bg)', color: 'var(--color-text)',
                          fontSize: 'var(--text-sm)', boxSizing: 'border-box',
                        }}
                      />
                    </div>
                    <div>
                      <label htmlFor="contact-radio" style={{ display: 'block', fontSize: 'var(--text-xs)', color: 'var(--color-text-subtle)', marginBottom: 'var(--space-1)' }}>
                        ISSI
                      </label>
                      <input
                        id="contact-radio"
                        type="text"
                        inputMode="numeric"
                        value={contactRadio}
                        onChange={(e) => { setContactRadio(e.target.value); setContactsDirty(true); }}
                        placeholder="f.eks. 1234567"
                        style={{
                          width: '100%', height: 44, padding: '0 var(--space-3)',
                          borderRadius: 'var(--radius-sm)', border: '1px solid var(--color-input-border)',
                          background: 'var(--color-input-bg)', color: 'var(--color-text)',
                          fontSize: 'var(--text-sm)', boxSizing: 'border-box',
                        }}
                      />
                    </div>
                    <button
                      onClick={handleContactsSave}
                      disabled={!contactsDirty}
                      className="touch-target"
                      style={{
                        height: 44, borderRadius: 'var(--radius-sm)', border: 'none',
                        background: contactsDirty ? 'var(--color-brand)' : 'var(--color-border)',
                        color: contactsDirty ? 'white' : 'var(--color-text-subtle)',
                        fontSize: 'var(--text-sm)', fontWeight: 600, cursor: contactsDirty ? 'pointer' : 'default',
                      }}
                    >
                      Lagre kontaktinfo
                    </button>
                  </div>
                )}
              </div>

              {/* Field status controls */}
              <div
                role="radiogroup"
                aria-label="Lagstatus i felt"
                data-testid="firstaid-field-status-controls"
                style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--space-2)' }}
              >
                {(Object.keys(teamStatusLabels) as TeamOperationalStatus[]).map((status) => (
                  <button
                    key={status}
                    data-testid={`firstaid-field-status-${status}`}
                    onClick={() => setTeamOperationalStatus(status)}
                    className="touch-target"
                    style={{
                      minHeight: 'var(--touch-min)',
                      padding: 'var(--space-2)',
                      borderRadius: 'var(--radius-sm)',
                      border: `1px solid ${selectedTeamStatus === status ? 'var(--color-brand)' : 'var(--color-border)'}`,
                      background: selectedTeamStatus === status ? 'var(--color-brand-dim)' : 'transparent',
                      color: 'var(--color-text)',
                      fontSize: 'var(--text-xs)',
                      fontWeight: 600,
                      cursor: 'pointer',
                    }}
                  >
                    {teamStatusLabels[status]}
                  </button>
                ))}
              </div>
            </section>
          )}
        </>
      )}

      {/* ── CHAT TAB ──────────────────────────────────────────────── */}
      {activeTab === 'chat' && (
        <section aria-labelledby="chat-heading" style={{ marginBottom: 'var(--space-4)' }}>
          <h2
            id="chat-heading"
            style={{
              fontSize: 'var(--text-sm)', fontFamily: 'var(--font-mono)',
              color: 'var(--color-text-muted)', textTransform: 'uppercase',
              letterSpacing: 'var(--tracking-mono)', marginBottom: 'var(--space-3)',
            }}
          >
            Lagmelding
          </h2>
          <div style={{
            borderRadius: 'var(--radius-md)',
            border: '1px solid var(--color-border)',
            background: 'var(--color-surface)',
            overflow: 'hidden',
          }}>
            <div style={{
              maxHeight: '60vh', overflowY: 'auto', padding: 'var(--space-3)',
              display: 'flex', flexDirection: 'column', gap: 'var(--space-2)',
            }}>
              {messages.length === 0 && (
                <p style={{ fontSize: 'var(--text-xs)', color: 'var(--color-text-subtle)', textAlign: 'center' }}>
                  Ingen meldinger ennå
                </p>
              )}
              {messages.map((msg) => (
                <div key={msg.id} style={{
                  display: 'flex', flexDirection: 'column',
                  alignItems: msg.fromSelf ? 'flex-end' : 'flex-start',
                }}>
                  <div style={{
                    maxWidth: '80%', padding: 'var(--space-2) var(--space-3)',
                    borderRadius: 'var(--radius-md)',
                    background: msg.fromSelf ? 'var(--color-brand)' : 'var(--color-surface-sunken)',
                    color: msg.fromSelf ? 'white' : 'var(--color-text)',
                    fontSize: 'var(--text-sm)',
                  }}>
                    {!msg.fromSelf && msg.fromTeamId && (
                      <div style={{ fontSize: 'var(--text-xs)', fontWeight: 600, marginBottom: 2, opacity: 0.7 }}>
                        {teams.find((t) => t.id === msg.fromTeamId)?.name ?? 'Ukjent lag'}
                      </div>
                    )}
                    {msg.text}
                  </div>
                  <div style={{ fontSize: 10, color: 'var(--color-text-subtle)', marginTop: 2 }}>
                    {new Date(msg.sentAt).toLocaleTimeString('nb-NO', { hour: '2-digit', minute: '2-digit' })}
                  </div>
                </div>
              ))}
              <div ref={chatEndRef} />
            </div>
            <div style={{
              display: 'flex', gap: 'var(--space-2)', padding: 'var(--space-2)',
              borderTop: '1px solid var(--color-border)',
            }}>
              <input
                type="text"
                value={messageText}
                onChange={(e) => setMessageText(e.target.value)}
                onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendMessage(); } }}
                placeholder="Skriv melding..."
                style={{
                  flex: 1, height: 44, padding: '0 var(--space-3)',
                  borderRadius: 'var(--radius-sm)', border: '1px solid var(--color-input-border)',
                  background: 'var(--color-input-bg)', color: 'var(--color-text)', fontSize: 'var(--text-sm)',
                }}
              />
              <button
                onClick={sendMessage}
                disabled={!messageText.trim()}
                style={{
                  height: 44, padding: '0 var(--space-3)', borderRadius: 'var(--radius-sm)',
                  border: 'none', background: 'var(--color-brand)', color: 'white',
                  fontSize: 'var(--text-sm)', fontWeight: 600, cursor: 'pointer',
                  opacity: !messageText.trim() ? 0.5 : 1,
                }}
              >
                Send
              </button>
            </div>
          </div>
        </section>
      )}

      {/* ── BOTTOM TAB BAR ────────────────────────────────────────── */}
      <nav
        aria-label="Navigasjon"
        style={{
          position: 'fixed',
          bottom: 0,
          left: 0,
          right: 0,
          height: 64,
          background: 'var(--color-surface)',
          borderTop: '1px solid var(--color-border)',
          display: 'grid',
          gridTemplateColumns: 'repeat(4, 1fr)',
        }}
      >
        {(
          [
            {
              id: 'pasienter' as FirstAiderTab,
              icon: '🫀',
              label: 'Pasienter',
              badge: patientBadgeCount,
            },
            {
              id: 'hendelser' as FirstAiderTab,
              icon: '🚨',
              label: 'Hendelser',
              badge: hendelseBadgeCount,
            },
            {
              id: 'lag' as FirstAiderTab,
              icon: '👥',
              label: 'Lag',
              badge: 0,
            },
            {
              id: 'chat' as FirstAiderTab,
              icon: '💬',
              label: 'Chat',
              badge: chatBadgeCount,
            },
          ] as const
        ).map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            aria-current={activeTab === tab.id ? 'page' : undefined}
            style={{
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 2,
              background: 'none',
              border: 'none',
              cursor: 'pointer',
              color: activeTab === tab.id ? 'var(--color-brand)' : 'var(--color-text-muted)',
              position: 'relative',
              padding: 0,
            }}
          >
            <span style={{ fontSize: 20, lineHeight: 1 }} aria-hidden="true">{tab.icon}</span>
            <span style={{ fontSize: 10, fontWeight: activeTab === tab.id ? 700 : 400 }}>{tab.label}</span>
            {tab.badge > 0 && (
              <span
                aria-label={`${tab.badge} varsler`}
                style={{
                  position: 'absolute',
                  top: 6,
                  right: '50%',
                  transform: 'translateX(8px)',
                  minWidth: 16,
                  height: 16,
                  padding: '0 4px',
                  borderRadius: 'var(--radius-full)',
                  background: 'var(--color-brand)',
                  color: 'white',
                  fontSize: 10,
                  fontWeight: 700,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  lineHeight: 1,
                  boxSizing: 'border-box',
                }}
              >
                {tab.badge}
              </span>
            )}
          </button>
        ))}
      </nav>
    </div>
  );
}
