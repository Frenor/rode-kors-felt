import { useState, useEffect, useRef, useMemo } from 'react';
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
import { VitalsEntryForm, EMPTY_VITALS_FORM, type VitalsFormShape } from './SickBay/VitalsEntryForm';

export function FirstAiderDashboard() {
  const { eventId, teams, updateTeamTransport } = useAuthStore();
  const selectedTeam = useFirstAidWorkspaceStore((s) => s.selectedTeamId);
  const setSelectedTeam = useFirstAidWorkspaceStore((s) => s.setSelectedTeam);
  const activePatientIdByTeam = useFirstAidWorkspaceStore((s) => s.activePatientIdByTeam);
  const latestStatusByTeam = useFirstAidWorkspaceStore((s) => s.latestStatusByTeam);
  const setActivePatient = useFirstAidWorkspaceStore((s) => s.setActivePatient);
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
  const [showChat, setShowChat] = useState(false);
  const chatEndRef = useRef<HTMLDivElement>(null);
  const [sectorAssignments, setSectorAssignments] = useState<Record<string, { sector: string; assignedAt: string }>>({});
  // Per-patient state — accordion expand, vitals forms, and injury notes
  const [expandedPatientId, setExpandedPatientId] = useState<string | null>(null);
  const [perPatientVitalsForm, setPerPatientVitalsForm] = useState<Record<string, VitalsFormShape>>({});
  const [perPatientNoteText, setPerPatientNoteText] = useState<Record<string, string>>({});
  const [showSettings, setShowSettings] = useState(false);
  const [showStatusPicker, setShowStatusPicker] = useState(false);

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
    const travelMode = TRANSPORT_TRAVEL_MODE[currentTeamTransport];
    window.open(`https://maps.google.com/maps?daddr=${lat},${lng}&travelmode=${travelMode}`, '_blank', 'noopener');
  };

  const handleTransportChange = async (transport: TeamTransport) => {
    if (!selectedTeam) return;
    const previous = (selectedTeamData?.transport ?? 'foot') as TeamTransport;
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
  const selectedTeamStatus = workspaceKey
    ? latestStatusByTeam[workspaceKey] ?? workspace?.latestStatus ?? 'available'
    : 'available';
  const pendingTeamActionCount = (queuedTeamActions ?? []).filter((item) => item.status === 'pending').length;
  const failedTeamActionCount = (queuedTeamActions ?? []).filter((item) => item.status === 'failed').length;

  const monitoredPatients = (workspace?.monitoredPatients ?? []).filter(
    (p) => !assignedPatients.some((a) => a.id === p.id),
  );

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

  const getPatientVitalsForm = (patientId: string): VitalsFormShape =>
    perPatientVitalsForm[patientId] ?? EMPTY_VITALS_FORM;

  const handleSubmitVitals = async (patientId: string) => {
    const form = getPatientVitalsForm(patientId);
    const payload = {
      pulse: form.pulse ? parseInt(form.pulse) : undefined,
      spo2: form.spo2 ? parseInt(form.spo2) : undefined,
      respiratoryRate: form.rr ? parseInt(form.rr) : undefined,
      painScore: form.pain ? parseInt(form.pain) : undefined,
      systolicBP: form.bp ? parseInt(form.bp) : undefined,
      temperature: form.temp ? parseFloat(form.temp) : undefined,
      acvpu: form.acvpu || undefined,
    };
    await api.recordVitals(patientId, payload as Record<string, number | undefined>);
    setPerPatientVitalsForm((prev) => ({ ...prev, [patientId]: EMPTY_VITALS_FORM }));
  };

  const handleSubmitNote = async (patientId: string) => {
    const text = perPatientNoteText[patientId]?.trim();
    if (!text) return;
    const author = selectedTeamData?.name ?? 'Ukjent lag';
    await api.addPatientNote(patientId, text, author);
    setPerPatientNoteText((prev) => ({ ...prev, [patientId]: '' }));
  };

  const togglePatientExpand = (patientId: string) => {
    setExpandedPatientId((prev) => (prev === patientId ? null : patientId));
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

  const selectedTeamData = useMemo(() => teams.find((t) => t.id === selectedTeam) ?? null, [teams, selectedTeam]);

  const combinedAssignedPatients = useMemo(() => {
    const assignedIds = new Set(assignedPatients.map((p) => p.id));
    return [...assignedPatients, ...monitoredPatients.filter((p) => !assignedIds.has(p.id))];
  }, [assignedPatients, monitoredPatients]);

  const currentTeamTransport = (selectedTeamData?.transport ?? 'foot') as TeamTransport;

  const openMapsNav = (lat: number, lon: number) => {
    const mode = TRANSPORT_TRAVEL_MODE[currentTeamTransport];
    window.open(`https://maps.google.com/maps?daddr=${lat},${lon}&travelmode=${mode}`, '_blank', 'noopener');
  };

  return (
    <div className="animate-fade-in" style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-4)', paddingBottom: '6.25rem' }}>
      {/* Team selection */}
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

      {/* Sticky team header */}
      {selectedTeam && (
        <header style={{
          display: 'flex', alignItems: 'center', gap: 'var(--space-2)',
          padding: 'var(--space-3) var(--space-4)',
          borderRadius: 'var(--radius-md)',
          border: '1px solid var(--color-border)',
          background: 'var(--color-surface)',
          position: 'sticky', top: 0, zIndex: 10,
        }}>
          <span style={{ fontWeight: 700, fontSize: 'var(--text-base)', flex: 1 }}>
            {selectedTeamData?.name ?? 'Ukjent lag'}
          </span>
          <span style={{
            fontFamily: 'var(--font-mono)', fontSize: 'var(--text-xs)',
            color: pendingTeamActionCount > 0 ? 'var(--color-status-warning)' : failedTeamActionCount > 0 ? 'var(--color-status-critical)' : 'var(--color-text-subtle)',
          }}>
            {pendingTeamActionCount > 0 ? `↑${pendingTeamActionCount}` : failedTeamActionCount > 0 ? '!' : '✓'}
          </span>
          <button
            onClick={() => setShowStatusPicker(true)}
            data-testid="firstaid-field-status-pill"
            style={{
              minHeight: 32, padding: '0 var(--space-3)',
              borderRadius: 'var(--radius-full)',
              border: `1px solid ${selectedTeamStatus === 'needs_assistance' ? 'var(--color-status-critical-border)' : 'var(--color-border)'}`,
              background: selectedTeamStatus === 'needs_assistance' ? 'var(--color-status-critical-bg)' : 'var(--color-surface-sunken)',
              color: selectedTeamStatus === 'needs_assistance' ? 'var(--color-status-critical)' : 'var(--color-text-subtle)',
              fontFamily: 'var(--font-mono)', fontSize: 'var(--text-xs)', fontWeight: 600,
              cursor: 'pointer',
            }}
          >
            {teamStatusLabels[selectedTeamStatus as TeamOperationalStatus]}
          </button>
          <button
            onClick={() => setShowSettings((v) => !v)}
            aria-label="Innstillinger"
            aria-expanded={showSettings}
            style={{
              minHeight: 32, minWidth: 32, padding: '0 var(--space-2)',
              borderRadius: 'var(--radius-sm)',
              border: `1px solid ${showSettings ? 'var(--color-brand)' : 'var(--color-border)'}`,
              background: showSettings ? 'var(--color-brand-dim)' : 'transparent',
              color: showSettings ? 'var(--color-brand)' : 'var(--color-text-subtle)',
              fontSize: 'var(--text-base)', cursor: 'pointer',
            }}
          >
            ⚙
          </button>
        </header>
      )}

      {/* Status picker bottom sheet */}
      {showStatusPicker && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label="Velg lagstatus"
          style={{
            position: 'fixed', inset: 0, zIndex: 50,
            background: 'rgba(0,0,0,0.4)',
            display: 'flex', flexDirection: 'column', justifyContent: 'flex-end',
          }}
          onClick={() => setShowStatusPicker(false)}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            style={{
              background: 'var(--color-surface)',
              borderRadius: 'var(--radius-md) var(--radius-md) 0 0',
              padding: 'var(--space-4)',
              display: 'flex', flexDirection: 'column', gap: 'var(--space-2)',
            }}
          >
            <div style={{ fontWeight: 700, fontSize: 'var(--text-sm)', marginBottom: 'var(--space-1)' }}>
              Lagstatus
            </div>
            <div
              role="radiogroup"
              aria-label="Lagstatus i felt"
              data-testid="firstaid-field-status-controls"
              style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-2)' }}
            >
              {(Object.keys(teamStatusLabels) as TeamOperationalStatus[]).map((status) => (
                <button
                  key={status}
                  data-testid={`firstaid-field-status-${status}`}
                  onClick={async () => { await setTeamOperationalStatus(status); setShowStatusPicker(false); }}
                  className="touch-target"
                  style={{
                    minHeight: 'var(--touch-min)',
                    padding: 'var(--space-3)',
                    borderRadius: 'var(--radius-sm)',
                    border: `1px solid ${selectedTeamStatus === status ? 'var(--color-brand)' : 'var(--color-border)'}`,
                    background: selectedTeamStatus === status ? 'var(--color-brand-dim)' : 'transparent',
                    color: 'var(--color-text)',
                    fontSize: 'var(--text-sm)', fontWeight: 600,
                    cursor: 'pointer', textAlign: 'left',
                  }}
                >
                  {teamStatusLabels[status]}
                </button>
              ))}
            </div>
            <button
              onClick={() => setShowStatusPicker(false)}
              style={{
                marginTop: 'var(--space-2)', padding: 'var(--space-3)',
                border: 'none', background: 'var(--color-surface-sunken)',
                borderRadius: 'var(--radius-sm)', color: 'var(--color-text-subtle)',
                fontSize: 'var(--text-sm)', cursor: 'pointer',
              }}
            >
              Avbryt
            </button>
          </div>
        </div>
      )}

      {/* Settings panel */}
      {selectedTeam && showSettings && (
        <section
          aria-label="Lagets innstillinger"
          style={{
            padding: 'var(--space-4)',
            borderRadius: 'var(--radius-md)',
            border: '1px solid var(--color-border)',
            background: 'var(--color-surface)',
            display: 'flex', flexDirection: 'column', gap: 'var(--space-4)',
          }}
        >
          {/* Transport type */}
          <div>
            <div style={{ fontSize: 'var(--text-xs)', color: 'var(--color-text-subtle)', marginBottom: 'var(--space-1)' }}>Fremkomstmiddel</div>
            <div
              role="radiogroup"
              aria-label="Velg fremkomstmiddel"
              style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 'var(--space-1)' }}
            >
              {(Object.keys(transportLabels) as TeamTransport[]).map((t) => (
                <button
                  key={t}
                  onClick={() => handleTransportChange(t)}
                  aria-pressed={currentTeamTransport === t}
                  className="touch-target"
                  style={{
                    minHeight: 44, padding: 'var(--space-1)',
                    borderRadius: 'var(--radius-sm)',
                    border: `1px solid ${currentTeamTransport === t ? 'var(--color-brand)' : 'var(--color-border)'}`,
                    background: currentTeamTransport === t ? 'var(--color-brand-dim)' : 'transparent',
                    color: 'var(--color-text)',
                    fontSize: 'var(--text-xs)', fontWeight: currentTeamTransport === t ? 700 : 400,
                    cursor: 'pointer',
                  }}
                >
                  {transportLabels[t]}
                </button>
              ))}
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
                        cursor: 'pointer', minHeight: 44,
                      }}
                    >
                      <input
                        type="checkbox"
                        checked={checked}
                        onChange={() => handleGearToggle(item.id)}
                        style={{ width: 18, height: 18, accentColor: 'var(--color-brand)', flexShrink: 0 }}
                      />
                      <span style={{ fontSize: 'var(--text-sm)', fontWeight: checked ? 600 : 400 }}>{item.label}</span>
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
                Kontaktinfo {(contactPhone || contactRadio) ? `· ${[contactPhone, contactRadio].filter(Boolean).join(' / ')}` : '· Ikke satt'}
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
                    id="contact-phone" type="tel" value={contactPhone}
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
                    id="contact-radio" type="text" inputMode="numeric" value={contactRadio}
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
                    fontSize: 'var(--text-sm)', fontWeight: 600,
                    cursor: contactsDirty ? 'pointer' : 'default',
                  }}
                >
                  Lagre kontaktinfo
                </button>
              </div>
            )}
          </div>
        </section>
      )}

      {/* Sector assignment badge */}
      {selectedTeam && sectorAssignments[selectedTeam] && (
        <section
          aria-live="polite"
          style={{
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

      {/* Patient list */}
      {selectedTeam && (
        <section aria-labelledby="patient-list-heading" aria-live="polite">
          <h2
            id="patient-list-heading"
            style={{
              fontSize: 'var(--text-sm)', fontFamily: 'var(--font-mono)',
              color: 'var(--color-text-muted)', textTransform: 'uppercase',
              letterSpacing: 'var(--tracking-mono)', marginBottom: 'var(--space-3)',
            }}
          >
            Tildelte pasienter ({combinedAssignedPatients.length})
          </h2>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-3)' }}>
            {combinedAssignedPatients.map((p) => {
              const isExpanded = expandedPatientId === p.id;
              const highlighted = highlightedFields.get(p.id);
              const isFlashing = highlighted && highlighted.size > 0;
              const triageStatus = (p as any).triageStatus as string | undefined;
              const triage = triageStatus ? TRIAGE_STYLE[triageStatus] : null;
              const label = (p as any).label || (p as TeamWorkspacePatient).presentingComplaint || `Pasient ${p.id.slice(0, 8)}`;
              const posText = (p as TeamWorkspacePatient).positionText;
              const lat = (p as TeamWorkspacePatient).lat;
              const lon = (p as TeamWorkspacePatient).lon;
              const hasCoords = lat != null && lon != null;
              return (
                <div
                  key={p.id}
                  style={{
                    borderRadius: 'var(--radius-md)',
                    border: `1px solid ${isFlashing ? 'var(--color-status-warning)' : isExpanded ? 'var(--color-brand)' : 'var(--color-border)'}`,
                    background: isFlashing ? 'var(--color-status-warning-bg)' : 'var(--color-surface)',
                    overflow: 'hidden',
                    transition: 'border-color 0.3s ease',
                  }}
                >
                  <button
                    onClick={() => togglePatientExpand(p.id)}
                    style={{
                      width: '100%', minHeight: 'var(--touch-min)',
                      padding: 'var(--space-3)',
                      display: 'flex', alignItems: 'center', gap: 'var(--space-2)',
                      background: 'none', border: 'none', cursor: 'pointer', textAlign: 'left',
                    }}
                  >
                    {triage && (
                      <span style={{
                        flexShrink: 0, display: 'inline-block', padding: '2px 10px',
                        borderRadius: 'var(--radius-full)',
                        background: triage.bg, color: triage.text,
                        fontSize: 'var(--text-xs)', fontWeight: 700, fontFamily: 'var(--font-mono)',
                      }}>
                        {triage.label}
                      </span>
                    )}
                    <span style={{ fontWeight: 700, fontSize: 'var(--text-sm)', flex: 1, textAlign: 'left' }}>
                      {label}
                    </span>
                    {isFlashing && (
                      <span style={{ fontSize: 'var(--text-xs)', fontWeight: 700, color: 'var(--color-status-warning)', flexShrink: 0 }}>
                        Oppdatert
                      </span>
                    )}
                    <span style={{ fontSize: 'var(--text-xs)', color: 'var(--color-text-subtle)', flexShrink: 0 }}>
                      {isExpanded ? '▲' : '▼'}
                    </span>
                  </button>

                  {/* Expanded content */}
                  {isExpanded && (
                    <div style={{
                      padding: 'var(--space-3)',
                      borderTop: '1px solid var(--color-border)',
                      display: 'flex', flexDirection: 'column', gap: 'var(--space-3)',
                    }}>
                      {/* Position + navigate */}
                      {(posText || hasCoords) && (
                        <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)', flexWrap: 'wrap' }}>
                          <span style={{ fontSize: 'var(--text-sm)', color: 'var(--color-text-subtle)', flex: 1 }}>
                            {posText
                              ? `📍 ${posText}`
                              : `📍 ${lat!.toFixed(4)}, ${lon!.toFixed(4)}${gpsPosition ? ` · ${bearingTo(lat!, lon!)}` : ''}`}
                          </span>
                          {hasCoords && (
                            <button
                              onClick={() => openMapsNav(lat!, lon!)}
                              className="touch-target"
                              style={{
                                minHeight: 36, padding: '0 var(--space-3)',
                                borderRadius: 'var(--radius-sm)',
                                border: '1px solid var(--color-brand)', background: 'transparent',
                                color: 'var(--color-brand)', fontSize: 'var(--text-xs)', fontWeight: 600,
                                cursor: 'pointer', flexShrink: 0,
                              }}
                            >
                              Naviger hit
                            </button>
                          )}
                        </div>
                      )}

                      {/* Vitals entry */}
                      <VitalsEntryForm
                        patientId={p.id}
                        form={getPatientVitalsForm(p.id)}
                        onChange={(updater) => setPerPatientVitalsForm((prev) => ({
                          ...prev,
                          [p.id]: updater(prev[p.id] ?? EMPTY_VITALS_FORM),
                        }))}
                        onSubmit={() => handleSubmitVitals(p.id)}
                      />

                      {/* Injury note */}
                      <div style={{ display: 'flex', gap: 'var(--space-2)', alignItems: 'flex-start' }}>
                        <textarea
                          value={perPatientNoteText[p.id] ?? ''}
                          onChange={(e) => setPerPatientNoteText((prev) => ({ ...prev, [p.id]: e.target.value }))}
                          placeholder="Skadenotater…"
                          rows={2}
                          style={{
                            flex: 1, padding: 'var(--space-2)',
                            borderRadius: 'var(--radius-sm)', border: '1px solid var(--color-input-border)',
                            background: 'var(--color-input-bg)', color: 'var(--color-text)',
                            fontSize: 'var(--text-sm)', resize: 'none', fontFamily: 'inherit',
                          }}
                        />
                        <button
                          onClick={() => handleSubmitNote(p.id)}
                          disabled={!perPatientNoteText[p.id]?.trim()}
                          className="touch-target"
                          style={{
                            minHeight: 44, padding: '0 var(--space-3)',
                            borderRadius: 'var(--radius-sm)', border: 'none',
                            background: perPatientNoteText[p.id]?.trim() ? 'var(--color-brand)' : 'var(--color-border)',
                            color: perPatientNoteText[p.id]?.trim() ? 'white' : 'var(--color-text-subtle)',
                            fontSize: 'var(--text-xs)', fontWeight: 600, cursor: 'pointer', flexShrink: 0,
                          }}
                        >
                          Lagre
                        </button>
                      </div>

                      {/* Trenger bistand */}
                      <button
                        onClick={async () => { await setTeamOperationalStatus('needs_assistance'); setExpandedPatientId(null); }}
                        className="touch-target"
                        style={{
                          minHeight: 'var(--touch-min)', width: '100%',
                          borderRadius: 'var(--radius-sm)', border: 'none',
                          background: 'var(--color-status-critical-bg)',
                          color: 'var(--color-status-critical)',
                          fontSize: 'var(--text-sm)', fontWeight: 700, cursor: 'pointer',
                        }}
                      >
                        ! Trenger bistand
                      </button>
                    </div>
                  )}
                </div>
              );
            })}

            {/* Unassigned patients */}
            {(workspace?.unassignedPatients ?? []).length > 0 && (
              <>
                <h3
                  id="unassigned-patients-heading"
                  style={{
                    margin: 'var(--space-2) 0 0',
                    fontSize: 'var(--text-sm)', fontFamily: 'var(--font-mono)',
                    color: 'var(--color-text-muted)', textTransform: 'uppercase',
                    letterSpacing: 'var(--tracking-mono)',
                  }}
                >
                  Utildelte pasienter ({workspace!.unassignedPatients.length})
                </h3>
                {workspace!.unassignedPatients.map((patient) => {
                  const hasCoords = patient.lat != null && patient.lon != null;
                  return (
                    <div
                      key={patient.id}
                      style={{
                        padding: 'var(--space-3)',
                        borderRadius: 'var(--radius-md)',
                        border: '1px solid var(--color-border)',
                        background: 'var(--color-surface)',
                        display: 'flex', flexDirection: 'column', gap: 'var(--space-2)',
                      }}
                    >
                      <div style={{ fontWeight: 600, fontSize: 'var(--text-sm)' }}>
                        {patient.presentingComplaint || 'Ukjent problemstilling'}
                      </div>
                      {(patient.positionText || hasCoords) && (
                        <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)', flexWrap: 'wrap' }}>
                          <span style={{ fontSize: 'var(--text-xs)', color: 'var(--color-text-subtle)', flex: 1 }}>
                            {patient.positionText
                              ? `📍 ${patient.positionText}`
                              : `📍 ${patient.lat!.toFixed(4)}, ${patient.lon!.toFixed(4)}${gpsPosition ? ` · ${bearingTo(patient.lat!, patient.lon!)}` : ''}`}
                          </span>
                          {hasCoords && (
                            <button
                              onClick={() => openMapsNav(patient.lat!, patient.lon!)}
                              className="touch-target"
                              style={{
                                minHeight: 36, padding: '0 var(--space-3)',
                                borderRadius: 'var(--radius-sm)',
                                border: '1px solid var(--color-brand)', background: 'transparent',
                                color: 'var(--color-brand)', fontSize: 'var(--text-xs)', fontWeight: 600,
                                cursor: 'pointer', flexShrink: 0,
                              }}
                            >
                              Naviger hit
                            </button>
                          )}
                        </div>
                      )}
                      <button
                        onClick={() => handleSetActivePatient(patient.id)}
                        className="touch-target"
                        style={{
                          minHeight: 'var(--touch-min)', width: '100%',
                          borderRadius: 'var(--radius-sm)', border: 'none',
                          background: 'var(--color-brand)', color: 'white',
                          fontSize: 'var(--text-sm)', fontWeight: 700, cursor: 'pointer',
                        }}
                      >
                        Ta over pasient →
                      </button>
                    </div>
                  );
                })}
              </>
            )}

            {combinedAssignedPatients.length === 0 && (workspace?.unassignedPatients ?? []).length === 0 && !workspaceLoading && (
              <div style={{
                padding: 'var(--space-6)', textAlign: 'center',
                color: 'var(--color-text-subtle)', fontSize: 'var(--text-sm)',
                background: 'var(--color-surface-sunken)', borderRadius: 'var(--radius-md)',
              }}>
                Ingen pasienter ennå
              </div>
            )}
            {workspaceLoading && (
              <p style={{ margin: 0, fontSize: 'var(--text-sm)', color: 'var(--color-text-subtle)' }}>
                Laster pasienter…
              </p>
            )}
          </div>
        </section>
      )}
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

      {/* Queued (offline) incidents */}
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

      {/* Team chat */}
      <section style={{ marginBottom: 'var(--space-4)' }}>
        <button
          onClick={() => setShowChat((v) => !v)}
          style={{
            width: '100%', display: 'flex', justifyContent: 'space-between', alignItems: 'center',
            padding: 'var(--space-3) var(--space-4)', borderRadius: 'var(--radius-md)',
            border: '1px solid var(--color-border)', background: 'var(--color-surface)',
            color: 'var(--color-text)', cursor: 'pointer',
          }}
        >
          <span style={{ fontWeight: 600, fontSize: 'var(--text-sm)' }}>Lagmelding</span>
          <span style={{ fontFamily: 'var(--font-mono)', fontSize: 'var(--text-xs)', color: 'var(--color-text-subtle)' }}>
            {messages.length > 0 ? `${messages.length} meldinger` : 'Ingen meldinger'} {showChat ? '▲' : '▼'}
          </span>
        </button>

        {showChat && (
          <div style={{
            marginTop: 'var(--space-2)', borderRadius: 'var(--radius-md)',
            border: '1px solid var(--color-border)', background: 'var(--color-surface)',
            overflow: 'hidden',
          }}>
            {/* Message list */}
            <div style={{
              maxHeight: 220, overflowY: 'auto', padding: 'var(--space-3)',
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

            {/* Input row */}
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
        )}
      </section>

      {/* Recent incidents */}
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
          <p style={{ color: 'var(--color-text-subtle)', fontSize: 'var(--text-sm)' }}>
            Laster...
          </p>
        ) : incidents.length === 0 ? (
          <div style={{
            padding: 'var(--space-8)',
            textAlign: 'center',
            color: 'var(--color-text-subtle)',
            background: 'var(--color-surface)',
            borderRadius: 'var(--radius-md)',
            border: '1px solid var(--color-border)',
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
                  <span style={{
                    fontWeight: 600,
                    fontSize: 'var(--text-sm)',
                  }}>
                    {typeLabels[incident.type] || incident.type}
                  </span>
                  <span style={{
                    fontFamily: 'var(--font-mono)',
                    fontSize: 'var(--text-xs)',
                    padding: '2px 8px',
                    borderRadius: 'var(--radius-full)',
                    background: incident.status === 'resolved' ? 'var(--color-status-ok-bg)' : 'var(--color-status-warning-bg)',
                    color: incident.status === 'resolved' ? 'var(--color-status-ok)' : 'var(--color-status-warning)',
                  }}>
                    {statusLabels[incident.status] || incident.status}
                  </span>
                </div>
                {incident.acvpu && (
                  <span style={{
                    fontFamily: 'var(--font-mono)',
                    fontSize: 'var(--text-xs)',
                    color: 'var(--color-text-muted)',
                  }}>
                    ACVPU: {incident.acvpu.toUpperCase()}
                  </span>
                )}
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 'var(--space-2)' }}>
                  <span style={{
                    fontFamily: 'var(--font-mono)',
                    fontSize: 'var(--text-xs)',
                    color: 'var(--color-text-subtle)',
                  }}>
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
                        color: 'var(--color-brand)', fontSize: 'var(--text-xs)', fontWeight: 600,
                        cursor: 'pointer',
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
    </div>
  );
}
