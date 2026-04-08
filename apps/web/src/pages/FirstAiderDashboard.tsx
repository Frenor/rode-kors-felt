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
import type { TeamOperationalStatus, TeamPatientStatus, TeamWorkspacePatient, TeamWorkspaceResponse } from '../lib/types';
import type { TeamTransport } from '../stores/auth';
import { VitalsEntryForm, EMPTY_VITALS_FORM, type VitalsFormShape } from './SickBay/VitalsEntryForm';
import { PatientLocationRow } from './FirstAider/PatientLocationRow';
import { PatientEngagementPicker } from './FirstAider/PatientEngagementPicker';
import { TeamSettingsPanel, TRANSPORT_LABELS } from './FirstAider/TeamSettingsPanel';
import { TeamStatusPickerSheet } from './FirstAider/TeamStatusPickerSheet';
import { TeamChatSection } from './FirstAider/TeamChatSection';

export function FirstAiderDashboard() {
  const { eventId, teams, updateTeamTransport } = useAuthStore();
  const selectedTeam = useFirstAidWorkspaceStore((s) => s.selectedTeamId);
  const setSelectedTeam = useFirstAidWorkspaceStore((s) => s.setSelectedTeam);
  const activePatientIdByTeam = useFirstAidWorkspaceStore((s) => s.activePatientIdByTeam);
  const latestStatusByTeam = useFirstAidWorkspaceStore((s) => s.latestStatusByTeam);
  const setActivePatient = useFirstAidWorkspaceStore((s) => s.setActivePatient);
  const setTeamStatus = useFirstAidWorkspaceStore((s) => s.setTeamStatus);
  const setTeamSyncedAt = useFirstAidWorkspaceStore((s) => s.setTeamSyncedAt);
  const setPatientStatus = useFirstAidWorkspaceStore((s) => s.setPatientStatus);
  const clearPatientStatus = useFirstAidWorkspaceStore((s) => s.clearPatientStatus);
  const patientStatusMap = useFirstAidWorkspaceStore((s) => s.patientStatusMap);
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
  const [perPatientVitalsError, setPerPatientVitalsError] = useState<Record<string, string>>({});
  const [perPatientNoteError, setPerPatientNoteError] = useState<Record<string, string>>({});

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
    if (!eventId || !selectedTeam) {
      setWorkspace(null);
      return;
    }
    setWorkspaceLoading(true);
    api.getTeamWorkspace(selectedTeam)
      .then((res) => {
        setWorkspace(res);
        // Seed assignedPatients from workspace so the list is immediately
        // visible while the separate getPatients fetch is still in flight.
        if (res.assignedPatients.length > 0) {
          setAssignedPatients((prev) => (prev.length === 0 ? res.assignedPatients : prev));
        }
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
        // Skip server echo of our own messages — they were added optimistically in sendMessage.
        if (payload.fromTeamId === selectedTeam) return;
        setMessages((prev) => [
          ...prev,
          {
            id: payload.id ?? crypto.randomUUID(),
            text: payload.text ?? '',
            fromTeamId: payload.fromTeamId,
            fromSelf: false,
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
    const text = messageText.trim();
    // Add optimistically so the sender sees the message immediately.
    setMessages((prev) => [
      ...prev,
      {
        id: crypto.randomUUID(),
        text,
        fromTeamId: selectedTeam ?? undefined,
        fromSelf: true,
        sentAt: new Date().toISOString(),
      },
    ]);
    setTimeout(() => chatEndRef.current?.scrollIntoView({ behavior: 'smooth' }), 50);
    wsSend({
      type: 'team.message',
      eventId,
      payload: { fromTeamId: selectedTeam ?? undefined, text },
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

  const handleSetPatientStatus = async (patientId: string, status: TeamPatientStatus | null) => {
    if (!eventId || !selectedTeam) return;
    // Optimistic update
    if (status != null) {
      setPatientStatus(eventId, selectedTeam, patientId, status);
      setActivePatient(eventId, selectedTeam, patientId);
    } else {
      clearPatientStatus(eventId, selectedTeam, patientId);
    }
    // Derive new team operational status from updated map
    const key = `${eventId}:${selectedTeam}:${patientId}`;
    const updatedMap: Record<string, TeamPatientStatus> = { ...patientStatusMap };
    if (status != null) {
      updatedMap[key] = status;
    } else {
      delete updatedMap[key];
    }
    const currentStatuses = Object.entries(updatedMap)
      .filter(([k]) => k.startsWith(`${eventId}:${selectedTeam}:`))
      .map(([, v]) => v);
    const manualOnly = selectedTeamStatus === 'needs_assistance' || selectedTeamStatus === 'unavailable';
    if (!manualOnly) {
      let derived: TeamOperationalStatus = 'available';
      if (currentStatuses.some((s) => s === 'transporting' || s === 'monitoring')) derived = 'on_scene';
      else if (currentStatuses.some((s) => s === 'en_route_to_patient')) derived = 'en_route';
      if (derived !== selectedTeamStatus) {
        setTeamStatus(eventId, selectedTeam, derived);
        await queueAndSyncTeamAction(selectedTeam, {
          type: 'team.status_set',
          status: derived,
          clientActionId: crypto.randomUUID(),
        });
      }
    }
    await queueAndSyncTeamAction(selectedTeam, {
      type: 'team.patient_status_set',
      patientId,
      status,
      clientActionId: crypto.randomUUID(),
    });
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
    try {
      await api.recordVitals(patientId, payload as Record<string, number | undefined>);
      setPerPatientVitalsForm((prev) => ({ ...prev, [patientId]: EMPTY_VITALS_FORM }));
      setPerPatientVitalsError((prev) => { const n = { ...prev }; delete n[patientId]; return n; });
    } catch {
      setPerPatientVitalsError((prev) => ({ ...prev, [patientId]: 'Kunne ikke lagre vitals — prøv igjen.' }));
    }
  };

  const handleSubmitNote = async (patientId: string) => {
    const text = perPatientNoteText[patientId]?.trim();
    if (!text) return;
    const author = selectedTeamData?.name ?? 'Ukjent lag';
    try {
      await api.addPatientNote(patientId, text, author);
      setPerPatientNoteText((prev) => ({ ...prev, [patientId]: '' }));
      setPerPatientNoteError((prev) => { const n = { ...prev }; delete n[patientId]; return n; });
    } catch {
      setPerPatientNoteError((prev) => ({ ...prev, [patientId]: 'Kunne ikke lagre notat — prøv igjen.' }));
    }
  };

  const togglePatientExpand = (patientId: string) => {
    setExpandedPatientId((prev) => (prev === patientId ? null : patientId));
  };

  const TRIAGE_STYLE: Record<string, { bg: string; text: string; label: string }> = {
    red:    { bg: '#fee2e2', text: '#b91c1c', label: 'Rød' },
    yellow: { bg: '#fef9c3', text: '#854d0e', label: 'Gul' },
    green:  { bg: '#dcfce7', text: '#166534', label: 'Grønn' },
    black:  { bg: '#f1f5f9', text: '#1e293b', label: 'Svart' },
  };

  const selectedTeamData = useMemo(() => teams.find((t) => t.id === selectedTeam) ?? null, [teams, selectedTeam]);

  const combinedAssignedPatients = useMemo(() => {
    const assignedIds = new Set(assignedPatients.map((p) => p.id));
    // Include workspace-monitored patients + any patient with a local optimistic status
    const locallyTrackedIds = new Set(
      Object.keys(patientStatusMap)
        .filter((k) => eventId && selectedTeam && k.startsWith(`${eventId}:${selectedTeam}:`))
        .map((k) => k.split(':')[2]!),
    );
    const extras = (workspace?.unassignedPatients ?? []).filter(
      (p) => locallyTrackedIds.has(p.id) && !assignedIds.has(p.id),
    );
    return [
      ...assignedPatients,
      ...monitoredPatients.filter((p) => !assignedIds.has(p.id)),
      ...extras.filter((p) => !monitoredPatients.some((m) => m.id === p.id)),
    ];
  }, [assignedPatients, monitoredPatients, patientStatusMap, eventId, selectedTeam, workspace?.unassignedPatients]);

  const currentTeamTransport = (selectedTeamData?.transport ?? 'foot') as TeamTransport;

  const openMapsNav = (lat: number, lon: number) => {
    const mode = TRANSPORT_TRAVEL_MODE[currentTeamTransport];
    window.open(`https://maps.google.com/maps?daddr=${lat},${lon}&travelmode=${mode}`, '_blank', 'noopener');
  };

  const teamStatusLabel = teamStatusLabels[selectedTeamStatus as TeamOperationalStatus];

  return (
    <div data-testid="firstaid-patient-workspace" className="animate-fade-in" style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-4)', paddingBottom: '6.25rem' }}>
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
                    {TRANSPORT_LABELS[team.transport as TeamTransport] ?? team.transport}
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
            {teamStatusLabel}
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
        <TeamStatusPickerSheet
          currentStatus={selectedTeamStatus as TeamOperationalStatus}
          onSelect={setTeamOperationalStatus}
          onClose={() => setShowStatusPicker(false)}
        />
      )}

      {/* Settings panel */}
      {selectedTeam && showSettings && (
        <TeamSettingsPanel
          currentTransport={currentTeamTransport}
          onTransportChange={handleTransportChange}
          teamGear={teamGear}
          showGear={showGear}
          onToggleGear={() => setShowGear((v) => !v)}
          onGearToggle={handleGearToggle}
          contactPhone={contactPhone}
          contactRadio={contactRadio}
          contactsDirty={contactsDirty}
          showContacts={showContacts}
          onToggleContacts={() => setShowContacts((v) => !v)}
          onContactPhoneChange={(v) => { setContactPhone(v); setContactsDirty(true); }}
          onContactRadioChange={(v) => { setContactRadio(v); setContactsDirty(true); }}
          onContactsSave={handleContactsSave}
        />
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
            Egne pasienter ({combinedAssignedPatients.length})
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
              const pKey = eventId && selectedTeam ? `${eventId}:${selectedTeam}:${p.id}` : null;
              const patientLocalStatus = pKey ? (patientStatusMap[pKey] ?? null) : null;
              const patientServerStatus = (p as TeamWorkspacePatient).teamPatientStatus ?? null;
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
                      <PatientLocationRow
                        positionText={posText ?? null}
                        lat={lat ?? null}
                        lon={lon ?? null}
                        gpsPosition={gpsPosition}
                        onNavigate={openMapsNav}
                      />

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
                      {perPatientVitalsError[p.id] && (
                        <div role="alert" style={{ fontSize: 'var(--text-xs)', color: 'var(--color-status-critical)', marginTop: 'calc(-1 * var(--space-2))' }}>
                          {perPatientVitalsError[p.id]}
                        </div>
                      )}

                      {/* Injury note */}
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-1)' }}>
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
                        {perPatientNoteError[p.id] && (
                          <div role="alert" style={{ fontSize: 'var(--text-xs)', color: 'var(--color-status-critical)' }}>
                            {perPatientNoteError[p.id]}
                          </div>
                        )}
                      </div>

                      {/* Patient status picker */}
                      <PatientEngagementPicker
                        patientId={p.id}
                        localStatus={patientLocalStatus}
                        serverStatus={patientServerStatus}
                        onSetStatus={handleSetPatientStatus}
                      />

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

            {/* Unassigned patients — always rendered so the section is always discoverable */}
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
                Utildelte pasienter ({(workspace?.unassignedPatients ?? []).length})
              </h3>
              {(workspace?.unassignedPatients ?? []).length === 0 && !workspaceLoading && (
                <div style={{
                  padding: 'var(--space-4)', textAlign: 'center',
                  color: 'var(--color-text-subtle)', fontSize: 'var(--text-sm)',
                  background: 'var(--color-surface-sunken)', borderRadius: 'var(--radius-md)',
                }}>
                  Ingen utildelte pasienter
                </div>
              )}
              {(workspace?.unassignedPatients ?? []).map((patient) => {
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
                    <PatientLocationRow
                      positionText={patient.positionText}
                      lat={patient.lat}
                      lon={patient.lon}
                      gpsPosition={gpsPosition}
                      onNavigate={openMapsNav}
                    />
                    <button
                      onClick={() => handleSetPatientStatus(patient.id, 'en_route_to_patient')}
                      className="touch-target"
                      style={{
                        minHeight: 32, padding: '0 var(--space-3)',
                        borderRadius: 'var(--radius-sm)',
                        border: '1px solid var(--color-brand)',
                        background: 'transparent',
                        color: 'var(--color-brand)',
                        fontSize: 'var(--text-xs)', fontWeight: 600, cursor: 'pointer',
                        alignSelf: 'flex-start',
                      }}
                    >
                      På vei til pasient →
                    </button>
                  </div>
                );
              })}
            </>

            {workspaceLoading && (
              <p style={{ margin: 0, fontSize: 'var(--text-sm)', color: 'var(--color-text-subtle)' }}>
                Laster pasienter…
              </p>
            )}
          </div>
        </section>
      )}
      {selectedTeam && <button
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
      </button>}

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
      <TeamChatSection
        messages={messages}
        teams={teams}
        showChat={showChat}
        onToggleChat={() => setShowChat((v) => !v)}
        messageText={messageText}
        onMessageTextChange={setMessageText}
        onSend={sendMessage}
        chatEndRef={chatEndRef}
      />
    </div>
  );
}
