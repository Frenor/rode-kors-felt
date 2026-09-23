import { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { useAuthStore } from '../stores/auth';
import { useNotificationStore } from '../stores/notifications';
import { useFirstAidWorkspaceStore } from '../stores/firstaid-workspace';
import { useGeolocation, GPS_STALE_AFTER_MS } from '../hooks/useGeolocation';
import { useTeamPositionBroadcast } from '../hooks/useTeamPositionBroadcast';
import { useWsStore } from '../stores/ws';
import { useLiveQuery } from 'dexie-react-hooks';
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
import {
  FIELD_TRIAGE_ORDER,
  FIELD_TRIAGE_STYLE,
  PATIENT_CLOSE_REASONS,
  TEAM_OPERATIONAL_STATUS_LABELS,
  TEAM_OPERATIONAL_STATUS_STYLE,
  TEAM_PATIENT_STATUS_STYLE,
  type FieldTriageStatus,
} from '../lib/constants';

/** Patient statuses that still concern a field team. Closed patients drop out of every list. */
const OPEN_PATIENT_STATUSES = new Set(['incoming', 'in_treatment', 'observation']);
const isOpenPatient = (p: { status?: string | null }) => !p.status || OPEN_PATIENT_STATUSES.has(p.status);

export function FirstAiderDashboard() {
  const { eventId, teams, updateTeamTransport } = useAuthStore();
  const addToast = useNotificationStore((s) => s.add);
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
  const { position: gpsPosition, status: gpsStatus, accuracy: gpsAccuracy, updatedAt: gpsUpdatedAt } = useGeolocation();
  const wsSend = useWsStore((s) => s.send);
  const onMessage = useWsStore((s) => s.onMessage);
  const [messages, setMessages] = useState<Array<{ id: string; text: string; fromTeamId?: string; fromSelf: boolean; sentAt: string }>>([]);
  const [messageText, setMessageText] = useState('');
  const [showChat, setShowChat] = useState(false);
  // Messages that arrived while the chat was collapsed — shown as a badge and
  // announced with a vibration so a coordinator instruction is not missed.
  const [unreadChatCount, setUnreadChatCount] = useState(0);
  const showChatRef = useRef(showChat);
  showChatRef.current = showChat;
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
  const [perPatientSummaryEdit, setPerPatientSummaryEdit] = useState<Record<string, string>>({});
  const [perPatientSummaryError, setPerPatientSummaryError] = useState<Record<string, string>>({});
  const [perPatientPosEdit, setPerPatientPosEdit] = useState<Record<string, string>>({});
  const [perPatientPosError, setPerPatientPosError] = useState<Record<string, string>>({});
  // Secondary edits (summary text, position text) live behind a disclosure so
  // the card leads with status, vitals and help — not four "Lagre" buttons.
  const [perPatientDetailsOpen, setPerPatientDetailsOpen] = useState<Record<string, boolean>>({});
  const [geoLookupLoading, setGeoLookupLoading] = useState<Record<string, boolean>>({});
  // Patients assigned to other teams discovered via WS events (removed from unassigned list)
  const [wsRemovedPatientIds, setWsRemovedPatientIds] = useState<Set<string>>(new Set());
  const [otherTeamAssignedPatients, setOtherTeamAssignedPatients] = useState<TeamWorkspacePatient[]>([]);
  const [showOtherAssigned, setShowOtherAssigned] = useState(false);
  // Meld pasient inline form
  const [showReportPatient, setShowReportPatient] = useState(false);
  const [reportInjuryType, setReportInjuryType] = useState('');
  const [reportTriage, setReportTriage] = useState('');
  const [reportDescription, setReportDescription] = useState('');
  const [reportPositionText, setReportPositionText] = useState('');
  const [reportSubmitting, setReportSubmitting] = useState(false);
  const [reportError, setReportError] = useState('');
  // Re-render every 15 s while the report form is open so the GPS age stays honest.
  const [gpsAgeTick, setGpsAgeTick] = useState(0);
  // Close patient flow
  const [closingPatientId, setClosingPatientId] = useState<string | null>(null);
  const [perPatientCloseReason, setPerPatientCloseReason] = useState<Record<string, string>>({});
  const [perPatientCloseNote, setPerPatientCloseNote] = useState<Record<string, string>>({});
  const [perPatientCloseError, setPerPatientCloseError] = useState<Record<string, string>>({});
  const [closedPatients, setClosedPatients] = useState<Array<{ id: string; label: string; closedAt: string; note: string }>>([]);
  const [showClosedPatients, setShowClosedPatients] = useState(false);
  // Broadcast GPS position every 30s when team is selected
  useTeamPositionBroadcast(selectedTeam);

  // Live offline queue count from IndexedDB
  const queuedTeamActions = useLiveQuery(
    () => offlineFirstAiderQueueDb.queue.toArray(),
    [],
    [],
  );
  // Latest queue snapshot for async callbacks (reconciliation must not trust
  // the server for a patient whose local action has not been synced yet).
  const queuedTeamActionsRef = useRef(queuedTeamActions);
  queuedTeamActionsRef.current = queuedTeamActions;

  // A persisted team id that no longer exists in this event (new event, demo →
  // real, team removed) would otherwise leave the user stuck on "Ukjent lag"
  // with no way back to the team picker.
  useEffect(() => {
    if (selectedTeam && teams.length > 0 && !teams.some((t) => t.id === selectedTeam)) {
      setSelectedTeam(null);
    }
  }, [selectedTeam, teams, setSelectedTeam]);

  /**
   * Adopt the server's view of this team's per-patient engagement unless we
   * still have an unsynced local action for that patient. Without this, a
   * status set on one phone (or cleared by the coordinator) never reaches
   * the other phones in the same patrol because the optimistic local value
   * always wins.
   */
  const reconcilePatientStatuses = useCallback((ws: TeamWorkspaceResponse) => {
    if (!eventId || !selectedTeam) return;
    const pendingPatientIds = new Set(
      (queuedTeamActionsRef.current ?? [])
        .map((item) => item.payload)
        .filter((p): p is Extract<QueuedTeamActionPayload, { patientId: string }> => 'patientId' in p)
        .map((p) => p.patientId),
    );
    const serverStatus = new Map<string, TeamPatientStatus>();
    for (const p of [...ws.assignedPatients, ...ws.monitoredPatients, ...ws.unassignedPatients]) {
      if (p.teamPatientStatus) serverStatus.set(p.id, p.teamPatientStatus);
    }
    const prefix = `${eventId}:${selectedTeam}:`;
    const { patientStatusMap: localMap } = useFirstAidWorkspaceStore.getState();
    const seen = new Set<string>();
    for (const [key, localStatus] of Object.entries(localMap)) {
      if (!key.startsWith(prefix)) continue;
      const patientId = key.slice(prefix.length);
      seen.add(patientId);
      if (pendingPatientIds.has(patientId)) continue;
      const remote = serverStatus.get(patientId) ?? null;
      if (remote === null) clearPatientStatus(eventId, selectedTeam, patientId);
      else if (remote !== localStatus) setPatientStatus(eventId, selectedTeam, patientId, remote);
    }
    for (const [patientId, remote] of serverStatus) {
      if (!seen.has(patientId) && !pendingPatientIds.has(patientId)) {
        setPatientStatus(eventId, selectedTeam, patientId, remote);
      }
    }
  }, [eventId, selectedTeam, clearPatientStatus, setPatientStatus]);

  const loadWorkspace = useCallback(async () => {
    if (!eventId || !selectedTeam) return;
    setWorkspaceLoading(true);
    try {
      const [ws, patientsRes] = await Promise.all([
        api.getTeamWorkspace(selectedTeam),
        api.getPatients(eventId, { assignedTeamId: selectedTeam }).catch((err) => {
          console.error('[firstaid] Failed to load assigned patients', err);
          return null;
        }),
      ]);
      setWorkspace(ws);
      // Only reset the WS-derived bookkeeping once we have a fresh authoritative list.
      setWsRemovedPatientIds(new Set());
      setAssignedPatients(
        patientsRes?.patients
          ? patientsRes.patients.filter(isOpenPatient)
          : ws.assignedPatients,
      );
      reconcilePatientStatuses(ws);
      const hasPendingTeamStatus = (queuedTeamActionsRef.current ?? []).some((i) => i.payload.type === 'team.status_set');
      if (!hasPendingTeamStatus) setTeamStatus(eventId, selectedTeam, ws.latestStatus);
    } catch (err) {
      console.error('[firstaid] Failed to load team workspace', err);
      addToast({ level: 'urgent', message: 'Kunne ikke hente pasientlisten — viser siste kjente data.', autoDismissMs: 6_000 });
    } finally {
      setWorkspaceLoading(false);
    }
  }, [eventId, selectedTeam, reconcilePatientStatuses, setTeamStatus, addToast]);

  // Load on team change, and re-sync whenever we regain connectivity or the
  // user returns to the app (phones suspend background tabs for long periods).
  useEffect(() => {
    if (!eventId || !selectedTeam) {
      setWorkspace(null);
      setAssignedPatients([]);
      return;
    }
    void loadWorkspace();

    const onReconnect = () => { void loadWorkspace(); };
    const onVisible = () => {
      if (document.visibilityState === 'visible' && navigator.onLine) void loadWorkspace();
    };
    window.addEventListener('rkf:wsConnected', onReconnect);
    window.addEventListener('online', onReconnect);
    document.addEventListener('visibilitychange', onVisible);
    return () => {
      window.removeEventListener('rkf:wsConnected', onReconnect);
      window.removeEventListener('online', onReconnect);
      document.removeEventListener('visibilitychange', onVisible);
    };
  }, [eventId, selectedTeam, loadWorkspace]);

  useEffect(() => {
    const off = onMessage((msg) => {
      if (msg.type === 'patient.updated') {
        const payload = (msg.payload as any) ?? {};
        const patient = payload.patient;
        const changed: string[] = payload.changedFields ?? [];
        if (!patient || !patient.id) return;
        const patientId: string = patient.id;

        // Closed by sick bay or coordinator → gone from every field list.
        if (!isOpenPatient(patient)) {
          setAssignedPatients((prev) => prev.filter((p) => p.id !== patientId));
          setOtherTeamAssignedPatients((prev) => prev.filter((p) => p.id !== patientId));
          setWorkspace((prev) => prev ? {
            ...prev,
            assignedPatients: prev.assignedPatients.filter((p) => p.id !== patientId),
            monitoredPatients: prev.monitoredPatients.filter((p) => p.id !== patientId),
            unassignedPatients: prev.unassignedPatients.filter((p) => p.id !== patientId),
          } : prev);
          if (eventId && selectedTeam) clearPatientStatus(eventId, selectedTeam, patientId);
          return;
        }

        setAssignedPatients((prev) => {
          const exists = prev.some((p) => p.id === patientId);
          if (patient.assignedTeamId === selectedTeam) {
            return exists ? prev.map((p) => p.id === patientId ? patient : p) : [...prev, patient];
          }
          // Removed from this team
          return prev.filter((p) => p.id !== patientId);
        });

        // Track assignment changes so the unassigned list stays accurate
        if (patient.assignedTeamId) {
          setWsRemovedPatientIds((prev) => new Set([...prev, patientId]));
          setWorkspace((prev) => prev ? {
            ...prev,
            unassignedPatients: prev.unassignedPatients.filter((p) => p.id !== patientId),
          } : prev);
          if (patient.assignedTeamId !== selectedTeam) {
            setOtherTeamAssignedPatients((prev) => {
              const exists = prev.some((p) => p.id === patientId);
              return exists
                ? prev.map((p) => p.id === patientId ? patient as TeamWorkspacePatient : p)
                : [...prev, patient as TeamWorkspacePatient];
            });
          } else {
            setOtherTeamAssignedPatients((prev) => prev.filter((p) => p.id !== patientId));
          }
        } else {
          // Patient un-assigned — (re)appear in the unassigned list
          setWsRemovedPatientIds((prev) => {
            const next = new Set(prev);
            next.delete(patientId);
            return next;
          });
          setOtherTeamAssignedPatients((prev) => prev.filter((p) => p.id !== patientId));
          setWorkspace((prev) => {
            if (!prev) return prev;
            const exists = prev.unassignedPatients.some((p) => p.id === patientId);
            return {
              ...prev,
              unassignedPatients: exists
                ? prev.unassignedPatients.map((p) => p.id === patientId ? { ...p, ...(patient as TeamWorkspacePatient) } : p)
                : [patient as TeamWorkspacePatient, ...prev.unassignedPatients],
            };
          });
        }

        if (changed.length > 0 && patient.assignedTeamId === selectedTeam) {
          setHighlightedFields((prev) => {
            const next = new Map(prev);
            next.set(patientId, new Set(changed));
            return next;
          });
          // Clear existing timer for this patient
          const existing = highlightTimers.current.get(patientId);
          if (existing) clearTimeout(existing);
          const timer = setTimeout(() => {
            setHighlightedFields((prev) => {
              const next = new Map(prev);
              next.delete(patientId);
              return next;
            });
            highlightTimers.current.delete(patientId);
          }, 3000);
          highlightTimers.current.set(patientId, timer);
        }
      } else if (msg.type === 'patient.created') {
        const patient = (msg.payload as any)?.patient;
        if (!patient || !patient.id || !isOpenPatient(patient)) return;
        if (patient.assignedTeamId === selectedTeam) {
          setAssignedPatients((prev) => prev.some((p) => p.id === patient.id) ? prev : [patient, ...prev]);
        } else if (patient.assignedTeamId) {
          setWsRemovedPatientIds((prev) => new Set([...prev, patient.id as string]));
          setOtherTeamAssignedPatients((prev) => prev.some((p) => p.id === patient.id) ? prev : [...prev, patient as TeamWorkspacePatient]);
        } else {
          // New unassigned patient (reported by the coordinator or another
          // patrol) — previously this never showed up until a full reload.
          setWorkspace((prev) => {
            if (!prev || prev.unassignedPatients.some((p) => p.id === patient.id)) return prev;
            return { ...prev, unassignedPatients: [patient as TeamWorkspacePatient, ...prev.unassignedPatients] };
          });
        }
      }
    });
    return off;
  }, [onMessage, selectedTeam, eventId, clearPatientStatus]);

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

  // Receive team messages and own-team status changes via WebSocket
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
        if (!showChatRef.current) {
          setUnreadChatCount((count) => count + 1);
          navigator.vibrate?.([120, 60, 120]);
        }
        setTimeout(() => chatEndRef.current?.scrollIntoView({ behavior: 'smooth' }), 50);
      } else if (msg.type === 'team.status_changed' || msg.type === 'team.session_changed') {
        // Keep several phones in the same patrol (and server-derived
        // statuses) in sync. Skip while we still have unsynced local actions.
        const payload = (msg.payload as any) ?? {};
        if (!eventId || !selectedTeam || payload.teamId !== selectedTeam) return;
        const action = payload.action ?? {};
        const actionPayload = action.payload ?? {};
        const queued = queuedTeamActionsRef.current ?? [];
        if (queued.some((item) => item.clientActionId === actionPayload.clientActionId)) return;
        if (msg.type === 'team.status_changed' && actionPayload.status) {
          if (!queued.some((item) => item.payload.type === 'team.status_set')) {
            setTeamStatus(eventId, selectedTeam, actionPayload.status as TeamOperationalStatus);
          }
        } else if (msg.type === 'team.session_changed' && payload.actionType === 'team.patient_status_set' && actionPayload.patientId) {
          const patientId = actionPayload.patientId as string;
          const hasPending = queued.some((item) => 'patientId' in item.payload && item.payload.patientId === patientId);
          if (hasPending) return;
          if (actionPayload.status) setPatientStatus(eventId, selectedTeam, patientId, actionPayload.status as TeamPatientStatus);
          else clearPatientStatus(eventId, selectedTeam, patientId);
        }
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
  }, [onMessage, selectedTeam, eventId, setTeamStatus, setPatientStatus, clearPatientStatus]);

  const sendMessage = () => {
    if (!messageText.trim() || !eventId) return;
    const text = messageText.trim();
    const delivered = wsSend({
      type: 'team.message',
      eventId,
      payload: { fromTeamId: selectedTeam ?? undefined, text },
      timestamp: new Date().toISOString(),
    });
    if (!delivered) {
      // Chat is realtime-only: never pretend a message went out while offline.
      addToast({ level: 'urgent', message: 'Ikke tilkoblet — meldingen ble ikke sendt. Bruk samband.', autoDismissMs: 6_000 });
      return;
    }
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

  const toggleChat = () => {
    setShowChat((open) => {
      if (!open) setUnreadChatCount(0);
      return !open;
    });
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

  const setTeamOperationalStatus = async (status: TeamOperationalStatus, note?: string) => {
    if (!eventId || !selectedTeam) return;
    const payload = {
      type: 'team.status_set' as const,
      status,
      note,
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
      addToast({ level: 'info', message: 'Vitale tegn lagret', autoDismissMs: 2_500 });
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
      addToast({ level: 'info', message: 'Notat lagret', autoDismissMs: 2_500 });
    } catch {
      setPerPatientNoteError((prev) => ({ ...prev, [patientId]: 'Kunne ikke lagre notat — prøv igjen.' }));
    }
  };

  const togglePatientExpand = (patientId: string) => {
    setExpandedPatientId((prev) => (prev === patientId ? null : patientId));
  };

  const handleSaveSummary = async (patientId: string, currentLabel: string) => {
    const text = (perPatientSummaryEdit[patientId] ?? currentLabel).trim();
    try {
      await api.updatePatient(patientId, { label: text || null });
      setPerPatientSummaryError((prev) => { const n = { ...prev }; delete n[patientId]; return n; });
      addToast({ level: 'info', message: 'Sammendrag lagret', autoDismissMs: 2_500 });
    } catch {
      setPerPatientSummaryError((prev) => ({ ...prev, [patientId]: 'Kunne ikke lagre — prøv igjen.' }));
    }
  };

  const handleSavePosition = async (patientId: string) => {
    const text = (perPatientPosEdit[patientId] ?? '').trim();
    try {
      await api.updatePatient(patientId, { positionText: text || null });
      setPerPatientPosError((prev) => { const n = { ...prev }; delete n[patientId]; return n; });
      addToast({ level: 'info', message: 'Posisjon lagret', autoDismissMs: 2_500 });
    } catch {
      setPerPatientPosError((prev) => ({ ...prev, [patientId]: 'Kunne ikke lagre posisjon — prøv igjen.' }));
    }
  };

  const handleGeoLookup = async (patientId: string, lat: number, lon: number) => {
    setGeoLookupLoading((prev) => ({ ...prev, [patientId]: true }));
    try {
      const res = await fetch(
        `https://nominatim.openstreetmap.org/reverse?lat=${lat}&lon=${lon}&format=json`,
        { headers: { 'Accept-Language': 'nb' } },
      );
      if (res.ok) {
        const data = await res.json() as { display_name?: string };
        const addr = data.display_name ?? `${lat.toFixed(5)}, ${lon.toFixed(5)}`;
        setPerPatientPosEdit((prev) => ({ ...prev, [patientId]: addr }));
      }
    } catch {
      // ignore — user can type manually
    } finally {
      setGeoLookupLoading((prev) => ({ ...prev, [patientId]: false }));
    }
  };

  const handleClosePatient = async (patientId: string, patientLabel: string) => {
    const reason = PATIENT_CLOSE_REASONS.find((r) => r.id === perPatientCloseReason[patientId]);
    if (!reason) {
      setPerPatientCloseError((prev) => ({ ...prev, [patientId]: 'Velg årsak for avslutning.' }));
      return;
    }
    const extra = (perPatientCloseNote[patientId] ?? '').trim();
    const note = extra ? `${reason.label} — ${extra}` : reason.label;
    const author = selectedTeamData?.name ?? 'Ukjent lag';
    try {
      await api.addPatientNote(patientId, `Avsluttet: ${note}`, author);
      // Close on the server too — otherwise the coordinator and sick bay keep
      // the patient as active and it reappears here after a reload.
      await api.updatePatient(patientId, { status: 'discharged' });
      setAssignedPatients((prev) => prev.filter((p) => p.id !== patientId));
      setWorkspace((prev) => prev ? {
        ...prev,
        assignedPatients: prev.assignedPatients.filter((p) => p.id !== patientId),
        monitoredPatients: prev.monitoredPatients.filter((p) => p.id !== patientId),
        unassignedPatients: prev.unassignedPatients.filter((p) => p.id !== patientId),
      } : prev);
      clearPatientStatus(eventId!, selectedTeam!, patientId);
      await queueAndSyncTeamAction(selectedTeam!, {
        type: 'team.patient_status_set',
        patientId,
        status: null,
        clientActionId: crypto.randomUUID(),
      });
      setClosedPatients((prev) => [
        { id: patientId, label: patientLabel, closedAt: new Date().toISOString(), note },
        ...prev,
      ]);
      setClosingPatientId(null);
      setPerPatientCloseReason((prev) => { const n = { ...prev }; delete n[patientId]; return n; });
      setPerPatientCloseNote((prev) => { const n = { ...prev }; delete n[patientId]; return n; });
      setPerPatientCloseError((prev) => { const n = { ...prev }; delete n[patientId]; return n; });
      if (expandedPatientId === patientId) setExpandedPatientId(null);
      addToast({ level: 'info', message: 'Pasient avsluttet', autoDismissMs: 3_000 });
    } catch {
      setPerPatientCloseError((prev) => ({ ...prev, [patientId]: 'Kunne ikke avslutte pasient — prøv igjen.' }));
    }
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

  const filteredUnassigned = useMemo(() => {
    const assignedIds = new Set(combinedAssignedPatients.map((p) => p.id));
    const closedIds = new Set(closedPatients.map((p) => p.id));
    return (workspace?.unassignedPatients ?? []).filter(
      (p) => !wsRemovedPatientIds.has(p.id) && !assignedIds.has(p.id) && !closedIds.has(p.id),
    );
  }, [workspace?.unassignedPatients, wsRemovedPatientIds, combinedAssignedPatients, closedPatients]);

  const INJURY_TYPES = [
    'Brudd / skade',
    'Blødning',
    'Bevisstløshet',
    'Hjerteproblemer',
    'Pustevansker',
    'Forbrenning',
    'Hjerneslag',
    'Allergisk reaksjon',
    'Forgiftning',
    'Hypotermi',
    'Andre',
  ];

  useEffect(() => {
    if (!showReportPatient) return;
    const id = setInterval(() => setGpsAgeTick((t) => t + 1), 15_000);
    return () => clearInterval(id);
  }, [showReportPatient]);

  const gpsAgeMs = gpsUpdatedAt ? Date.now() - gpsUpdatedAt : null;
  const gpsIsStale = gpsAgeMs !== null && gpsAgeMs > GPS_STALE_AFTER_MS;
  void gpsAgeTick;

  const handleReportPatient = async () => {
    if (!eventId || !selectedTeam) return;
    const description = reportDescription.trim();
    const label = reportInjuryType
      || (description.length > 60 ? `${description.slice(0, 57).trimEnd()}…` : description)
      || 'Ny pasient';
    setReportSubmitting(true);
    setReportError('');
    try {
      const res = await api.createFieldPatient(eventId, {
        label,
        triageStatus: reportTriage || null,
        description: description || null,
        // Human-readable location only; coordinates travel in lat/lon so the
        // coordinator sees "Sektor B, ved scenen" instead of "59.96345, 10.66512".
        positionText: reportPositionText.trim() || null,
        lat: gpsPosition?.lat ?? null,
        lon: gpsPosition?.lng ?? null,
        assignedTeamId: selectedTeam,
      });
      setAssignedPatients((prev) => [res.patient, ...prev]);
      setReportInjuryType('');
      setReportTriage('');
      setReportDescription('');
      setReportPositionText('');
      setShowReportPatient(false);
      addToast({ level: 'info', message: 'Pasient meldt til koordinator', autoDismissMs: 3_000 });
    } catch {
      setReportError('Kunne ikke registrere pasient — prøv igjen.');
    } finally {
      setReportSubmitting(false);
    }
  };

  const handleCloseReportForm = () => {
    setShowReportPatient(false);
    setReportInjuryType('');
    setReportTriage('');
    setReportDescription('');
    setReportPositionText('');
    setReportError('');
  };

  const currentTeamTransport = (selectedTeamData?.transport ?? 'foot') as TeamTransport;

  const openMapsNav = (lat: number, lon: number) => {
    const mode = TRANSPORT_TRAVEL_MODE[currentTeamTransport];
    window.open(`https://maps.google.com/maps?daddr=${lat},${lon}&travelmode=${mode}`, '_blank', 'noopener');
  };

  const teamStatusLabel = TEAM_OPERATIONAL_STATUS_LABELS[selectedTeamStatus] ?? selectedTeamStatus;
  const teamStatusStyle = TEAM_OPERATIONAL_STATUS_STYLE[selectedTeamStatus as TeamOperationalStatus]
    ?? TEAM_OPERATIONAL_STATUS_STYLE.available;
  const isReportFormInvalid = !reportInjuryType && !reportDescription.trim();
  const chipStyle = (active: boolean, color = 'var(--color-brand)', bg = 'var(--color-brand-dim)') => ({
    minHeight: 48,
    padding: '0 var(--space-4)',
    borderRadius: 'var(--radius-md)',
    border: `2px solid ${active ? color : 'var(--color-border)'}`,
    background: active ? bg : 'transparent',
    color: active ? color : 'var(--color-text)',
    fontSize: 'var(--text-base)',
    fontWeight: active ? 700 : 500,
    cursor: 'pointer',
    fontFamily: 'inherit',
  });
  const inputStyle = {
    width: '100%',
    minHeight: 48,
    padding: 'var(--space-2) var(--space-3)',
    borderRadius: 'var(--radius-sm)',
    border: '1px solid var(--color-input-border)',
    background: 'var(--color-input-bg)',
    color: 'var(--color-text)',
    fontSize: 'var(--text-base)',
    fontFamily: 'inherit',
    boxSizing: 'border-box' as const,
  };
  const sectionLabelStyle = {
    fontSize: 'var(--text-xs)',
    color: 'var(--color-text-muted)',
    fontWeight: 700,
    textTransform: 'uppercase' as const,
    letterSpacing: '0.05em',
    marginBottom: 'var(--space-2)',
  };
  const smallSaveButtonStyle = {
    minHeight: 48,
    padding: '0 var(--space-4)',
    borderRadius: 'var(--radius-sm)',
    border: 'none',
    background: 'var(--color-brand)',
    color: 'white',
    fontSize: 'var(--text-sm)',
    fontWeight: 700,
    cursor: 'pointer',
    flexShrink: 0,
  };
  const errorTextStyle = { fontSize: 'var(--text-sm)', color: 'var(--color-status-critical)', fontWeight: 600 };

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
                type="button"
                onClick={() => setSelectedTeam(team.id)}
                style={{
                  width: '100%',
                  minHeight: 'var(--touch-comfortable)',
                  padding: 'var(--space-4)',
                  borderRadius: 'var(--radius-md)',
                  border: '1px solid var(--color-border)',
                  background: 'var(--color-surface)',
                  color: 'var(--color-text)',
                  fontSize: 'var(--text-lg)',
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
                  <span style={{ fontSize: 'var(--text-sm)', fontWeight: 400, color: 'var(--color-text-muted)', fontFamily: 'var(--font-mono)' }}>
                    {TRANSPORT_LABELS[team.transport as TeamTransport] ?? team.transport}
                  </span>
                )}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Sticky team header — offset by the 56 px app header so it does not slide underneath it */}
      {selectedTeam && (
        <header style={{
          display: 'flex', alignItems: 'center', gap: 'var(--space-2)',
          padding: 'var(--space-2) var(--space-3)',
          borderRadius: 'var(--radius-md)',
          border: `1px solid ${selectedTeamStatus === 'needs_assistance' ? 'var(--color-status-critical)' : 'var(--color-border)'}`,
          background: 'var(--color-surface)',
          position: 'sticky', top: 56, zIndex: 10,
          boxShadow: 'var(--shadow-sm)',
        }}>
          <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column' }}>
            <span style={{ fontWeight: 700, fontSize: 'var(--text-base)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {selectedTeamData?.name ?? 'Ukjent lag'}
            </span>
            <span
              aria-live="polite"
              style={{
                fontFamily: 'var(--font-mono)', fontSize: 'var(--text-xs)',
                color: pendingTeamActionCount > 0 ? 'var(--color-status-warning)' : failedTeamActionCount > 0 ? 'var(--color-status-critical)' : 'var(--color-text-subtle)',
              }}
            >
              {pendingTeamActionCount > 0
                ? `${pendingTeamActionCount} venter på sending`
                : failedTeamActionCount > 0
                  ? `${failedTeamActionCount} ikke sendt`
                  : 'Alt sendt'}
            </span>
          </div>
          <button
            type="button"
            onClick={() => setShowStatusPicker(true)}
            data-testid="firstaid-field-status-pill"
            aria-label={`Lagstatus: ${teamStatusLabel}. Trykk for å endre`}
            style={{
              minHeight: 48, padding: '0 var(--space-4)',
              borderRadius: 'var(--radius-full)',
              border: `2px solid ${teamStatusStyle.color}`,
              background: teamStatusStyle.bg,
              color: teamStatusStyle.color,
              fontSize: 'var(--text-sm)', fontWeight: 700,
              cursor: 'pointer',
              display: 'inline-flex', alignItems: 'center', gap: 'var(--space-2)',
              flexShrink: 0,
            }}
          >
            <span aria-hidden="true" style={{ width: 10, height: 10, borderRadius: '50%', background: teamStatusStyle.color }} />
            {teamStatusLabel}
          </button>
          <button
            type="button"
            onClick={() => setShowSettings((v) => !v)}
            aria-label="Innstillinger for patruljen"
            aria-expanded={showSettings}
            style={{
              minHeight: 48, minWidth: 48, padding: '0 var(--space-2)',
              borderRadius: 'var(--radius-sm)',
              border: `1px solid ${showSettings ? 'var(--color-brand)' : 'var(--color-border)'}`,
              background: showSettings ? 'var(--color-brand-dim)' : 'transparent',
              color: showSettings ? 'var(--color-brand)' : 'var(--color-text-muted)',
              fontSize: 'var(--text-lg)', cursor: 'pointer', flexShrink: 0,
            }}
          >
            ⚙
          </button>
        </header>
      )}

      {/* Persistent banner while the patrol has asked for help — one tap to stand down */}
      {selectedTeam && selectedTeamStatus === 'needs_assistance' && (
        <section
          role="alert"
          data-testid="firstaid-needs-assistance-banner"
          style={{
            padding: 'var(--space-3) var(--space-4)',
            borderRadius: 'var(--radius-md)',
            border: '2px solid var(--color-status-critical)',
            background: 'var(--color-status-critical-bg)',
            color: 'var(--color-status-critical)',
            display: 'flex', flexDirection: 'column', gap: 'var(--space-3)',
          }}
        >
          <div style={{ fontWeight: 700, fontSize: 'var(--text-base)' }}>
            Dere har meldt behov for bistand — koordinator og sykestue er varslet.
          </div>
          <button
            type="button"
            onClick={() => setTeamOperationalStatus('available')}
            style={{
              minHeight: 'var(--touch-min)',
              borderRadius: 'var(--radius-md)',
              border: '2px solid var(--color-status-critical)',
              background: 'var(--color-surface)',
              color: 'var(--color-status-critical)',
              fontSize: 'var(--text-base)', fontWeight: 700, cursor: 'pointer',
            }}
          >
            Avklart — vi er ledige igjen
          </button>
        </section>
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
          onChangeTeam={teams.length > 1 ? () => { setShowSettings(false); setSelectedTeam(null); } : undefined}
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
          <div style={{ fontWeight: 700, fontSize: 'var(--text-base)', color: 'var(--color-brand)' }}>
            Tildelt sektor: {sectorAssignments[selectedTeam]!.sector}
          </div>
          <div style={{ fontSize: 'var(--text-xs)', color: 'var(--color-text-muted)' }}>
            Oppdatert {new Date(sectorAssignments[selectedTeam]!.assignedAt).toLocaleTimeString('nb-NO', { hour: '2-digit', minute: '2-digit' })}
          </div>
        </section>
      )}

      {/* Meld pasient — first thing under the header; a new callout must be one tap away */}
      {selectedTeam && (
        <div>
          {!showReportPatient ? (
            <button
              type="button"
              onClick={() => setShowReportPatient(true)}
              style={{
                width: '100%',
                minHeight: 72,
                padding: 'var(--space-4)',
                borderRadius: 'var(--radius-lg)',
                border: 'none',
                background: 'var(--color-brand)',
                color: 'white',
                fontSize: 'var(--text-xl)',
                fontWeight: 700,
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 'var(--space-3)',
              }}
            >
              <span style={{ fontSize: '1.4em', lineHeight: 1 }} aria-hidden="true">+</span>
              Meld pasient
            </button>
          ) : (
            <div style={{
              borderRadius: 'var(--radius-lg)',
              border: '2px solid var(--color-brand)',
              background: 'var(--color-surface)',
              overflow: 'hidden',
            }}>
              <div style={{
                padding: 'var(--space-3) var(--space-4)',
                background: 'var(--color-brand)',
                display: 'flex', alignItems: 'center', justifyContent: 'space-between',
              }}>
                <span style={{ color: 'white', fontWeight: 700, fontSize: 'var(--text-lg)' }}>Meld pasient</span>
                <button
                  type="button"
                  onClick={handleCloseReportForm}
                  style={{
                    minHeight: 44, minWidth: 44,
                    background: 'transparent', border: 'none', color: 'white',
                    fontSize: 'var(--text-xl)', cursor: 'pointer', lineHeight: 1,
                  }}
                  aria-label="Lukk"
                >
                  ✕
                </button>
              </div>
              <div style={{ padding: 'var(--space-4)', display: 'flex', flexDirection: 'column', gap: 'var(--space-4)' }}>
                {/* Triage picker */}
                <div>
                  <div style={sectionLabelStyle}>Triagefarge</div>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 'var(--space-2)' }}>
                    {FIELD_TRIAGE_ORDER.map((value) => {
                      const style = FIELD_TRIAGE_STYLE[value];
                      const active = reportTriage === value;
                      return (
                        <button
                          key={value}
                          type="button"
                          onClick={() => setReportTriage((prev) => prev === value ? '' : value)}
                          aria-pressed={active}
                          style={{
                            ...chipStyle(active, style.text, style.bg),
                            border: `2px solid ${style.text}`,
                            color: style.text,
                            padding: 0,
                          }}
                        >
                          {style.label}{active ? ' ✓' : ''}
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* Injury type quick picker */}
                <div>
                  <div style={sectionLabelStyle}>Type skade</div>
                  <div style={{ display: 'flex', gap: 'var(--space-2)', flexWrap: 'wrap' }}>
                    {INJURY_TYPES.map((type) => (
                      <button
                        key={type}
                        type="button"
                        onClick={() => setReportInjuryType((prev) => prev === type ? '' : type)}
                        aria-pressed={reportInjuryType === type}
                        style={chipStyle(reportInjuryType === type)}
                      >
                        {type}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Free-text description */}
                <div>
                  <label htmlFor="report-description" style={{ display: 'block', ...sectionLabelStyle }}>
                    Tilleggsinformasjon
                  </label>
                  <textarea
                    id="report-description"
                    value={reportDescription}
                    onChange={(e) => setReportDescription(e.target.value)}
                    placeholder="Beskriv skaden, pasientens tilstand, ekstra opplysninger…"
                    rows={3}
                    style={{ ...inputStyle, resize: 'vertical' }}
                  />
                </div>

                {/* Where is the patient? Free text the coordinator can act on. */}
                <div>
                  <label htmlFor="report-position-text" style={{ display: 'block', ...sectionLabelStyle }}>
                    Hvor er pasienten?
                  </label>
                  <input
                    id="report-position-text"
                    value={reportPositionText}
                    onChange={(e) => setReportPositionText(e.target.value)}
                    placeholder="f.eks. Sektor B, ved drikkestasjon 3"
                    style={inputStyle}
                  />
                </div>

                <div
                  data-testid="report-gps-status"
                  style={{
                    fontSize: 'var(--text-sm)',
                    color: gpsPosition && !gpsIsStale ? 'var(--color-text-muted)' : 'var(--color-status-warning)',
                  }}
                >
                  {gpsPosition ? (
                    <>
                      GPS-posisjon legges ved automatisk
                      {gpsAccuracy != null ? ` (±${gpsAccuracy} m` : ' ('}
                      {gpsAgeMs != null ? `${gpsAccuracy != null ? ', ' : ''}oppdatert for ${Math.max(0, Math.round(gpsAgeMs / 1000))} s siden)` : ')'}
                      {gpsIsStale && ' — posisjonen kan være utdatert, beskriv stedet over.'}
                    </>
                  ) : gpsStatus === 'denied' ? (
                    'Posisjonstilgang er avslått — beskriv hvor pasienten er.'
                  ) : gpsStatus === 'acquiring' ? (
                    'Henter GPS-posisjon… beskriv gjerne stedet i tillegg.'
                  ) : (
                    'Ingen GPS-posisjon — beskriv hvor pasienten er.'
                  )}
                </div>

                {reportError && (
                  <div role="alert" style={errorTextStyle}>
                    {reportError}
                  </div>
                )}

                <button
                  type="button"
                  onClick={handleReportPatient}
                  disabled={reportSubmitting || isReportFormInvalid}
                  style={{
                    minHeight: 'var(--touch-comfortable)', width: '100%',
                    borderRadius: 'var(--radius-md)', border: 'none',
                    background: isReportFormInvalid || reportSubmitting ? 'var(--color-border)' : 'var(--color-brand)',
                    color: isReportFormInvalid || reportSubmitting ? 'var(--color-text-subtle)' : 'white',
                    fontSize: 'var(--text-lg)', fontWeight: 700,
                    cursor: reportSubmitting || isReportFormInvalid ? 'not-allowed' : 'pointer',
                  }}
                >
                  {reportSubmitting ? 'Registrerer…' : 'Registrer pasient'}
                </button>
                {isReportFormInvalid && (
                  <div style={{ fontSize: 'var(--text-sm)', color: 'var(--color-text-muted)', textAlign: 'center' }}>
                    Velg type skade eller skriv en kort beskrivelse.
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Patient list */}
      {selectedTeam && (
        <section aria-labelledby="patient-list-heading">
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
            {combinedAssignedPatients.length === 0 && !workspaceLoading && (
              <div style={{
                padding: 'var(--space-4)', textAlign: 'center',
                color: 'var(--color-text-muted)', fontSize: 'var(--text-sm)',
                background: 'var(--color-surface-sunken)', borderRadius: 'var(--radius-md)',
              }}>
                Ingen egne pasienter. Meld en ny over, eller ta en fra listen under.
              </div>
            )}
            {combinedAssignedPatients.map((p) => {
              const isExpanded = expandedPatientId === p.id;
              const highlighted = highlightedFields.get(p.id);
              const isFlashing = highlighted && highlighted.size > 0;
              const triageStatus = (p as TeamWorkspacePatient).triageStatus ?? ((p as any).triageStatus as string | undefined);
              const triage = triageStatus ? FIELD_TRIAGE_STYLE[triageStatus as FieldTriageStatus] ?? null : null;
              const label = (p as TeamWorkspacePatient).label || (p as any).label || (p as TeamWorkspacePatient).presentingComplaint || `Pasient ${p.id.slice(0, 8)}`;
              const posText = (p as TeamWorkspacePatient).positionText;
              const lat = (p as TeamWorkspacePatient).lat;
              const lon = (p as TeamWorkspacePatient).lon;
              const pKey = eventId && selectedTeam ? `${eventId}:${selectedTeam}:${p.id}` : null;
              const patientLocalStatus = pKey ? (patientStatusMap[pKey] ?? null) : null;
              const patientServerStatus = (p as TeamWorkspacePatient).teamPatientStatus ?? null;
              const activePatientStatus = patientLocalStatus ?? patientServerStatus;
              const statusStyle = activePatientStatus ? TEAM_PATIENT_STATUS_STYLE[activePatientStatus] : null;
              const hasPosition = posText || (lat != null && lon != null);
              const detailsOpen = !!perPatientDetailsOpen[p.id];
              const closeReason = perPatientCloseReason[p.id];
              return (
                <div
                  key={p.id}
                  data-testid={`firstaid-patient-${p.id}`}
                  style={{
                    borderRadius: 'var(--radius-md)',
                    border: `2px solid ${isFlashing ? 'var(--color-status-warning)' : isExpanded ? 'var(--color-brand)' : 'var(--color-border)'}`,
                    background: isFlashing ? 'var(--color-status-warning-bg)' : 'var(--color-surface)',
                    overflow: 'hidden',
                    transition: 'border-color 0.3s ease',
                  }}
                >
                  <button
                    type="button"
                    onClick={() => togglePatientExpand(p.id)}
                    aria-expanded={isExpanded}
                    style={{
                      width: '100%', minHeight: 'var(--touch-min)',
                      padding: 'var(--space-3)',
                      display: 'flex', flexDirection: 'column', alignItems: 'stretch', gap: 'var(--space-1)',
                      background: 'none', border: 'none', cursor: 'pointer', textAlign: 'left',
                      color: 'var(--color-text)',
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)' }}>
                      {triage && (
                        <span style={{
                          flexShrink: 0, display: 'inline-block', padding: '3px 10px',
                          borderRadius: 'var(--radius-full)',
                          background: triage.bg, color: triage.text,
                          fontSize: 'var(--text-xs)', fontWeight: 700, fontFamily: 'var(--font-mono)',
                        }}>
                          {triage.label}
                        </span>
                      )}
                      {statusStyle && (
                        <span style={{
                          flexShrink: 0, display: 'inline-block', padding: '3px 10px',
                          borderRadius: 'var(--radius-full)',
                          background: statusStyle.bg, color: statusStyle.color,
                          fontSize: 'var(--text-xs)', fontWeight: 700, fontFamily: 'var(--font-mono)',
                        }}>
                          {statusStyle.label}
                        </span>
                      )}
                      <span style={{ fontWeight: 700, fontSize: 'var(--text-base)', flex: 1, textAlign: 'left' }}>
                        {label}
                      </span>
                      {isFlashing && (
                        <span style={{ fontSize: 'var(--text-xs)', fontWeight: 700, color: 'var(--color-status-warning)', flexShrink: 0 }}>
                          Oppdatert
                        </span>
                      )}
                      <span aria-hidden="true" style={{ fontSize: 'var(--text-sm)', color: 'var(--color-text-subtle)', flexShrink: 0 }}>
                        {isExpanded ? '▲' : '▼'}
                      </span>
                    </div>
                    {hasPosition && (
                      <span style={{ fontSize: 'var(--text-sm)', color: 'var(--color-text-muted)', textAlign: 'left' }}>
                        {posText ?? `${lat!.toFixed(4)}, ${lon!.toFixed(4)}`}
                      </span>
                    )}
                  </button>

                  {/* Expanded content — ordered by how often a patrol needs it under pressure */}
                  {isExpanded && (
                    <div style={{
                      padding: 'var(--space-3)',
                      borderTop: '1px solid var(--color-border)',
                      display: 'flex', flexDirection: 'column', gap: 'var(--space-4)',
                    }}>
                      {/* 1. What are we doing with this patient */}
                      <PatientEngagementPicker
                        patientId={p.id}
                        localStatus={patientLocalStatus}
                        serverStatus={patientServerStatus}
                        onSetStatus={handleSetPatientStatus}
                      />

                      {/* 2. Where — with distance and navigation */}
                      {hasPosition && (
                        <PatientLocationRow
                          positionText={posText ?? null}
                          lat={lat ?? null}
                          lon={lon ?? null}
                          gpsPosition={gpsPosition}
                          onNavigate={openMapsNav}
                        />
                      )}

                      {/* 3. Vitals */}
                      <div>
                        <div style={sectionLabelStyle}>Vitale tegn</div>
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
                          <div role="alert" style={{ ...errorTextStyle, marginTop: 'var(--space-2)' }}>
                            {perPatientVitalsError[p.id]}
                          </div>
                        )}
                      </div>

                      {/* 4. Injury note */}
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-1)' }}>
                        <label htmlFor={`note-${p.id}`} style={sectionLabelStyle}>Skadenotat</label>
                        <div style={{ display: 'flex', gap: 'var(--space-2)', alignItems: 'flex-start' }}>
                          <textarea
                            id={`note-${p.id}`}
                            value={perPatientNoteText[p.id] ?? ''}
                            onChange={(e) => setPerPatientNoteText((prev) => ({ ...prev, [p.id]: e.target.value }))}
                            placeholder="Hva ser dere? Hva er gjort?"
                            rows={2}
                            style={{ ...inputStyle, flex: 1, resize: 'none' }}
                          />
                          <button
                            type="button"
                            onClick={() => handleSubmitNote(p.id)}
                            disabled={!perPatientNoteText[p.id]?.trim()}
                            style={{
                              ...smallSaveButtonStyle,
                              background: perPatientNoteText[p.id]?.trim() ? 'var(--color-brand)' : 'var(--color-border)',
                              color: perPatientNoteText[p.id]?.trim() ? 'white' : 'var(--color-text-subtle)',
                            }}
                          >
                            Lagre
                          </button>
                        </div>
                        {perPatientNoteError[p.id] && (
                          <div role="alert" style={errorTextStyle}>
                            {perPatientNoteError[p.id]}
                          </div>
                        )}
                      </div>

                      {/* 5. Rarely used edits, behind one disclosure */}
                      <div>
                        <button
                          type="button"
                          onClick={() => setPerPatientDetailsOpen((prev) => ({ ...prev, [p.id]: !prev[p.id] }))}
                          aria-expanded={detailsOpen}
                          data-testid={`firstaid-details-toggle-${p.id}`}
                          style={{
                            width: '100%', minHeight: 44,
                            display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                            padding: '0 var(--space-3)',
                            borderRadius: 'var(--radius-sm)',
                            border: '1px solid var(--color-border)',
                            background: detailsOpen ? 'var(--color-surface-sunken)' : 'transparent',
                            color: 'var(--color-text-muted)',
                            fontSize: 'var(--text-sm)', fontWeight: 600, cursor: 'pointer',
                          }}
                        >
                          <span>Rediger sammendrag / posisjon</span>
                          <span aria-hidden="true">{detailsOpen ? '▲' : '▼'}</span>
                        </button>
                        {detailsOpen && (
                          <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-3)', marginTop: 'var(--space-3)' }}>
                            {/* Editable summary */}
                            <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-1)' }}>
                              <label htmlFor={`summary-${p.id}`} style={sectionLabelStyle}>Sammendrag</label>
                              <div style={{ display: 'flex', gap: 'var(--space-2)', alignItems: 'center' }}>
                                <input
                                  id={`summary-${p.id}`}
                                  value={perPatientSummaryEdit[p.id] ?? label}
                                  onChange={(e) => setPerPatientSummaryEdit((prev) => ({ ...prev, [p.id]: e.target.value }))}
                                  placeholder="Sammendrag…"
                                  style={{ ...inputStyle, flex: 1 }}
                                />
                                <button type="button" onClick={() => handleSaveSummary(p.id, label)} style={smallSaveButtonStyle}>
                                  Lagre
                                </button>
                              </div>
                              {perPatientSummaryError[p.id] && (
                                <div role="alert" style={errorTextStyle}>{perPatientSummaryError[p.id]}</div>
                              )}
                            </div>

                            {/* Editable position text + reverse lookup */}
                            <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-1)' }}>
                              <label htmlFor={`position-${p.id}`} style={sectionLabelStyle}>Hvor er pasienten?</label>
                              <div style={{ display: 'flex', gap: 'var(--space-2)', alignItems: 'center', flexWrap: 'wrap' }}>
                                <input
                                  id={`position-${p.id}`}
                                  value={perPatientPosEdit[p.id] ?? (posText ?? '')}
                                  onChange={(e) => setPerPatientPosEdit((prev) => ({ ...prev, [p.id]: e.target.value }))}
                                  placeholder="f.eks. Sektor B, rad 5"
                                  style={{ ...inputStyle, flex: 1, minWidth: 160 }}
                                />
                                {lat != null && lon != null && (
                                  <button
                                    type="button"
                                    onClick={() => handleGeoLookup(p.id, lat!, lon!)}
                                    disabled={geoLookupLoading[p.id]}
                                    style={{
                                      ...smallSaveButtonStyle,
                                      border: '1px solid var(--color-brand)',
                                      background: 'transparent', color: 'var(--color-brand)',
                                    }}
                                  >
                                    {geoLookupLoading[p.id] ? '…' : 'Slå opp adresse'}
                                  </button>
                                )}
                                <button type="button" onClick={() => handleSavePosition(p.id)} style={smallSaveButtonStyle}>
                                  Lagre
                                </button>
                              </div>
                              {perPatientPosError[p.id] && (
                                <div role="alert" style={errorTextStyle}>{perPatientPosError[p.id]}</div>
                              )}
                            </div>
                          </div>
                        )}
                      </div>

                      {/* 6. Help */}
                      <button
                        type="button"
                        onClick={async () => { await setTeamOperationalStatus('needs_assistance', label); setExpandedPatientId(null); }}
                        data-testid={`firstaid-needs-assistance-${p.id}`}
                        style={{
                          minHeight: 'var(--touch-comfortable)', width: '100%',
                          borderRadius: 'var(--radius-md)',
                          border: '2px solid var(--color-status-critical)',
                          background: 'var(--color-status-critical-bg)',
                          color: 'var(--color-status-critical)',
                          fontSize: 'var(--text-lg)', fontWeight: 700, cursor: 'pointer',
                        }}
                      >
                        ! Trenger bistand her
                      </button>

                      {/* 7. Close */}
                      {closingPatientId !== p.id ? (
                        <button
                          type="button"
                          onClick={() => setClosingPatientId(p.id)}
                          style={{
                            minHeight: 'var(--touch-min)', width: '100%',
                            borderRadius: 'var(--radius-md)',
                            border: '1px solid var(--color-border)',
                            background: 'transparent',
                            color: 'var(--color-text-muted)',
                            fontSize: 'var(--text-base)', fontWeight: 600, cursor: 'pointer',
                          }}
                        >
                          Avslutt pasient
                        </button>
                      ) : (
                        <div
                          data-testid={`firstaid-close-form-${p.id}`}
                          style={{
                            display: 'flex', flexDirection: 'column', gap: 'var(--space-3)',
                            padding: 'var(--space-3)', borderRadius: 'var(--radius-md)',
                            background: 'var(--color-surface-sunken)',
                          }}
                        >
                          <div style={sectionLabelStyle}>Hvorfor avsluttes pasienten?</div>
                          <div role="radiogroup" aria-label="Årsak for avslutning" style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-2)' }}>
                            {PATIENT_CLOSE_REASONS.map((reason) => {
                              const active = closeReason === reason.id;
                              return (
                                <button
                                  key={reason.id}
                                  type="button"
                                  role="radio"
                                  aria-checked={active}
                                  onClick={() => {
                                    setPerPatientCloseReason((prev) => ({ ...prev, [p.id]: reason.id }));
                                    setPerPatientCloseError((prev) => { const n = { ...prev }; delete n[p.id]; return n; });
                                  }}
                                  style={{ ...chipStyle(active), textAlign: 'left', minHeight: 'var(--touch-min)' }}
                                >
                                  {active ? '✓ ' : ''}{reason.label}
                                </button>
                              );
                            })}
                          </div>
                          <textarea
                            value={perPatientCloseNote[p.id] ?? ''}
                            onChange={(e) => setPerPatientCloseNote((prev) => ({ ...prev, [p.id]: e.target.value }))}
                            placeholder="Tillegg (valgfritt)…"
                            aria-label="Tilleggsinformasjon ved avslutning"
                            rows={2}
                            style={{ ...inputStyle, resize: 'none' }}
                          />
                          {perPatientCloseError[p.id] && (
                            <div role="alert" style={errorTextStyle}>
                              {perPatientCloseError[p.id]}
                            </div>
                          )}
                          <div style={{ display: 'flex', gap: 'var(--space-2)' }}>
                            <button
                              type="button"
                              onClick={() => handleClosePatient(p.id, label)}
                              disabled={!closeReason}
                              style={{
                                flex: 1, minHeight: 'var(--touch-min)', padding: '0 var(--space-3)',
                                borderRadius: 'var(--radius-md)', border: 'none',
                                background: closeReason ? 'var(--color-status-critical)' : 'var(--color-border)',
                                color: closeReason ? 'white' : 'var(--color-text-subtle)',
                                fontSize: 'var(--text-base)', fontWeight: 700, cursor: closeReason ? 'pointer' : 'not-allowed',
                              }}
                            >
                              Bekreft avslutning
                            </button>
                            <button
                              type="button"
                              onClick={() => { setClosingPatientId(null); setPerPatientCloseError((prev) => { const n = { ...prev }; delete n[p.id]; return n; }); }}
                              style={{
                                minHeight: 'var(--touch-min)', padding: '0 var(--space-4)',
                                borderRadius: 'var(--radius-md)',
                                border: '1px solid var(--color-border)',
                                background: 'transparent', color: 'var(--color-text-muted)',
                                fontSize: 'var(--text-base)', cursor: 'pointer',
                              }}
                            >
                              Avbryt
                            </button>
                          </div>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              );
            })}

            {/* Unassigned patients — always rendered so the section is always discoverable */}
            <h3
              id="unassigned-patients-heading"
              style={{
                margin: 'var(--space-2) 0 0',
                fontSize: 'var(--text-sm)', fontFamily: 'var(--font-mono)',
                color: 'var(--color-text-muted)', textTransform: 'uppercase',
                letterSpacing: 'var(--tracking-mono)',
              }}
            >
              Utildelte pasienter ({filteredUnassigned.length})
            </h3>
            {filteredUnassigned.length === 0 && !workspaceLoading && (
              <div style={{
                padding: 'var(--space-4)', textAlign: 'center',
                color: 'var(--color-text-muted)', fontSize: 'var(--text-sm)',
                background: 'var(--color-surface-sunken)', borderRadius: 'var(--radius-md)',
              }}>
                Ingen utildelte pasienter
              </div>
            )}
            {filteredUnassigned.map((patient) => {
              const triage = patient.triageStatus ? FIELD_TRIAGE_STYLE[patient.triageStatus] ?? null : null;
              return (
                <div
                  key={patient.id}
                  data-testid={`firstaid-unassigned-${patient.id}`}
                  style={{
                    padding: 'var(--space-3)',
                    borderRadius: 'var(--radius-md)',
                    border: `2px solid ${patient.triageStatus === 'red' ? 'var(--color-triage-red)' : 'var(--color-border)'}`,
                    background: 'var(--color-surface)',
                    display: 'flex', flexDirection: 'column', gap: 'var(--space-3)',
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)' }}>
                    {triage && (
                      <span style={{
                        flexShrink: 0, display: 'inline-block', padding: '3px 10px',
                        borderRadius: 'var(--radius-full)',
                        background: triage.bg, color: triage.text,
                        fontSize: 'var(--text-xs)', fontWeight: 700, fontFamily: 'var(--font-mono)',
                      }}>
                        {triage.label}
                      </span>
                    )}
                    <div style={{ fontWeight: 700, fontSize: 'var(--text-base)' }}>
                      {patient.label || patient.presentingComplaint || 'Ukjent pasient'}
                    </div>
                  </div>
                  <PatientLocationRow
                    positionText={patient.positionText}
                    lat={patient.lat}
                    lon={patient.lon}
                    gpsPosition={gpsPosition}
                    onNavigate={openMapsNav}
                  />
                  <button
                    type="button"
                    onClick={() => handleSetPatientStatus(patient.id, 'en_route_to_patient')}
                    data-testid={`firstaid-claim-${patient.id}`}
                    style={{
                      minHeight: 'var(--touch-min)', width: '100%',
                      borderRadius: 'var(--radius-md)',
                      border: 'none',
                      background: 'var(--color-brand)',
                      color: 'white',
                      fontSize: 'var(--text-base)', fontWeight: 700, cursor: 'pointer',
                    }}
                  >
                    Vi drar til denne pasienten →
                  </button>
                </div>
              );
            })}

            {/* Patients other patrols are handling — read-only context */}
            {otherTeamAssignedPatients.length > 0 && (
              <div style={{ marginTop: 'var(--space-2)' }}>
                <button
                  type="button"
                  onClick={() => setShowOtherAssigned((v) => !v)}
                  aria-expanded={showOtherAssigned}
                  style={{
                    width: '100%', minHeight: 44,
                    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                    padding: 'var(--space-2) var(--space-3)',
                    borderRadius: 'var(--radius-sm)',
                    border: '1px solid var(--color-border)',
                    background: 'var(--color-surface-sunken)',
                    color: 'var(--color-text-muted)',
                    fontSize: 'var(--text-sm)', fontFamily: 'var(--font-mono)',
                    textTransform: 'uppercase', letterSpacing: 'var(--tracking-mono)',
                    cursor: 'pointer',
                  }}
                >
                  <span>Andre lags pasienter ({otherTeamAssignedPatients.length})</span>
                  <span aria-hidden="true">{showOtherAssigned ? '▲' : '▼'}</span>
                </button>
                {showOtherAssigned && (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-2)', marginTop: 'var(--space-2)' }}>
                    {otherTeamAssignedPatients.map((p) => {
                      const teamName = teams.find((t) => t.id === (p as any).assignedTeamId)?.name;
                      return (
                        <div key={p.id} style={{
                          padding: 'var(--space-2) var(--space-3)',
                          borderRadius: 'var(--radius-sm)',
                          border: '1px solid var(--color-border)',
                          background: 'var(--color-surface)',
                          fontSize: 'var(--text-sm)',
                          display: 'flex', justifyContent: 'space-between', gap: 'var(--space-2)',
                        }}>
                          <span style={{ fontWeight: 600 }}>
                            {p.label || p.presentingComplaint || `Pasient ${p.id.slice(0, 8)}`}
                          </span>
                          <span style={{ color: 'var(--color-text-muted)', flexShrink: 0 }}>
                            {teamName ?? 'annet lag'}
                          </span>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            )}

            {/* Avsluttede pasienter */}
            {closedPatients.length > 0 && (
              <div style={{ marginTop: 'var(--space-2)' }}>
                <button
                  type="button"
                  onClick={() => setShowClosedPatients((v) => !v)}
                  aria-expanded={showClosedPatients}
                  style={{
                    width: '100%', minHeight: 44,
                    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                    padding: 'var(--space-2) var(--space-3)',
                    borderRadius: 'var(--radius-sm)',
                    border: '1px solid var(--color-border)',
                    background: 'var(--color-surface-sunken)',
                    color: 'var(--color-text-muted)',
                    fontSize: 'var(--text-sm)', fontFamily: 'var(--font-mono)',
                    textTransform: 'uppercase', letterSpacing: 'var(--tracking-mono)',
                    cursor: 'pointer',
                  }}
                >
                  <span>Avsluttede pasienter ({closedPatients.length})</span>
                  <span aria-hidden="true">{showClosedPatients ? '▲' : '▼'}</span>
                </button>
                {showClosedPatients && (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-2)', marginTop: 'var(--space-2)' }}>
                    {closedPatients.map((cp) => (
                      <div key={cp.id} style={{
                        padding: 'var(--space-2) var(--space-3)',
                        borderRadius: 'var(--radius-sm)',
                        border: '1px solid var(--color-border)',
                        background: 'var(--color-surface-sunken)',
                        fontSize: 'var(--text-sm)',
                        display: 'flex', flexDirection: 'column', gap: 'var(--space-1)',
                      }}>
                        <div style={{ fontWeight: 600, color: 'var(--color-text-muted)' }}>
                          {cp.label}
                        </div>
                        <div style={{ color: 'var(--color-text-subtle)' }}>
                          {cp.note}
                        </div>
                        <div style={{ color: 'var(--color-text-subtle)', fontFamily: 'var(--font-mono)', fontSize: 'var(--text-xs)' }}>
                          {new Date(cp.closedAt).toLocaleTimeString('nb-NO', { hour: '2-digit', minute: '2-digit' })}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {workspaceLoading && (
              <p role="status" style={{ margin: 0, fontSize: 'var(--text-sm)', color: 'var(--color-text-subtle)' }}>
                Laster pasienter…
              </p>
            )}
          </div>
        </section>
      )}

      {/* Queued (offline) team actions section handled by useOfflineTeamSync */}

      {/* Team chat */}
      <TeamChatSection
        messages={messages}
        teams={teams}
        showChat={showChat}
        onToggleChat={toggleChat}
        messageText={messageText}
        onMessageTextChange={setMessageText}
        onSend={sendMessage}
        chatEndRef={chatEndRef}
        unreadCount={unreadChatCount}
      />
    </div>
  );
}
