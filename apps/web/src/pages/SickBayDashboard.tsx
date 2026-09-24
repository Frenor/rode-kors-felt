import { useState, useEffect, useRef } from 'react';
import { useAuthStore } from '../stores/auth';
import { useNotificationStore } from '../stores/notifications';
import { useWsStore } from '../stores/ws';
import { api } from '../lib/api';
import {
  calculateNEWS2,
  calculateNEWS2Trend,
  news2MonitoringLabel,
  type News2Result,
} from '@rkf/shared-types';
import type { EventSettings, SickBayPatient, MedicationRecord, SickbayIncomingItem, Team, TeamPatientEngagement } from '../lib/types';
import { SickBayHeader } from './SickBay/SickBayHeader';
import { PatientIntakeModal, isIntakeFormValid, type IntakeFormShape } from './SickBay/PatientIntakeModal';
import { PatientDischargeModal, type DischargeFormShape, EMPTY_DISCHARGE_FORM, buildDischargeNote } from './SickBay/PatientDischargeModal';
import { AmkBriefModal } from './SickBay/AmkBriefModal';
import { PatientCard, type DemographicsFormShape } from './SickBay/PatientCard';
import { IncomingCriticalPanel } from './SickBay/IncomingCriticalPanel';
import type { VitalsFormShape } from './SickBay/VitalsEntryForm';
import type { MedFormShape } from './SickBay/MedicationPanel';
import {
  computeSickbayOccupancy,
  FIELD_TRIAGE_STYLE,
  formatPatientAge,
  formatSickbayPlacement,
  GENDER_LABELS,
  statusColors,
  statusLabels,
  TEAM_PATIENT_STATUS_STYLE,
  type FieldTriageStatus,
} from '../lib/constants';
import { patientNumber } from '../lib/patient-number';
import { nextObservationDue } from '../lib/observation';
import { useNow } from '../hooks/useNow';
import { Icon } from '../components/ui';
import { enqueueSickbayAction } from '../lib/offline-sickbay-queue';
import { useOfflineSickbaySync } from '../hooks/useOfflineSickbaySync';

const OFFLINE_TOAST_MESSAGE = 'Ingen nett — lagret lokalt og sendes når tilkoblingen er tilbake';

// In dev mode the monitoring timer fires after 1 min instead of the clinical interval.
const DEV_INTERVALS = import.meta.env.DEV && import.meta.env.VITE_NEWS2_DEV_INTERVALS === 'true';

type AcvpuLevel = 'alert' | 'confused' | 'voice' | 'pain' | 'unresponsive';
type PatientStatus = 'incoming' | 'in_treatment' | 'observation' | 'discharged' | 'transferred';

const STATUS_GROUP_ORDER: PatientStatus[] = ['incoming', 'in_treatment', 'observation', 'discharged', 'transferred'];
const CLOSED_STATUSES = new Set<PatientStatus>(['discharged', 'transferred']);

/** Engagement statuses that mean "a patrol is bringing this patient in" (gap A9). */
const APPROACHING_ENGAGEMENT_STATUSES = new Set(['en_route_to_patient', 'transporting']);

/** Sub-stack heading inside "Innkommende" — same style as the group heading
 *  (dot + title + count + rule), one size down. */
function StackHeading({ title, count, dotColor }: { title: string; count: number; dotColor: string }) {
  return (
    <div
      style={{
        display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: 'var(--space-2)',
        paddingBottom: 'var(--space-1)',
        borderBottom: '1px solid var(--color-border)',
      }}
    >
      <h3 style={{ fontSize: 'var(--text-sm)', fontWeight: 700, margin: 0, textWrap: 'balance', display: 'flex', alignItems: 'center', gap: 'var(--space-2)' }}>
        <span aria-hidden="true" style={{ width: 8, height: 8, borderRadius: '50%', background: dotColor, flexShrink: 0 }} />
        {title}
      </h3>
      <span style={{ fontSize: 'var(--text-xs)', fontWeight: 600, color: 'var(--color-text-muted)', whiteSpace: 'nowrap' }}>
        <span className="data">{count}</span> pasient{count === 1 ? '' : 'er'}
      </span>
    </div>
  );
}

export function SickBayDashboard() {
  const { eventId } = useAuthStore();
  const addToast = useNotificationStore((s) => s.add);
  const onMessage = useWsStore((s) => s.onMessage);
  const wsSend = useWsStore((s) => s.send);

  const [patients, setPatients] = useState<SickBayPatient[]>([]);
  const [loading, setLoading] = useState(true);
  const [showIntake, setShowIntake] = useState(false);
  const [intakeForm, setIntakeForm] = useState<IntakeFormShape>({
    fullName: '',
    gender: '',
    birthDate: '',
    placementType: '',
    placementNumber: '',
    ageGroup: 'adult',
    presentingComplaint: '',
    assignedClinician: '',
  });

  const [dischargeTarget, setDischargeTarget] = useState<{ patient: SickBayPatient; targetStatus: 'discharged' | 'transferred' } | null>(null);
  const [dischargeForm, setDischargeForm] = useState<DischargeFormShape>(EMPTY_DISCHARGE_FORM);
  const [dischargeSubmitting, setDischargeSubmitting] = useState(false);
  const [amkPatient, setAmkPatient] = useState<SickBayPatient | null>(null);

  const [medications, setMedications] = useState<Record<string, MedicationRecord[]>>({});
  const [incomingItems, setIncomingItems] = useState<SickbayIncomingItem[]>([]);
  /** Which patrol is with which patient (på vei / transporterer / overvåker), by patient id. */
  const [fieldEngagements, setFieldEngagements] = useState<Record<string, TeamPatientEngagement[]>>({});
  /** Teams in this event, with live position — the "på vei" distance line (gap A7/A9). */
  const [teams, setTeams] = useState<Team[]>([]);
  /** Sick bay capacity (gap B6) — feeds the occupancy strip (item 8.30). */
  const [eventSettings, setEventSettings] = useState<EventSettings | null>(null);
  /** Patients whose latest vitals were recorded offline and are not yet synced — the card's "lagret lokalt" marker (item 8.27). */
  const [locallyQueuedVitalsIds, setLocallyQueuedVitalsIds] = useState<Set<string>>(new Set());
  const [expandedClosedCards, setExpandedClosedCards] = useState<Record<string, boolean>>({});
  const now = useNow();
  const UNDO_WINDOW_MS = 10_000;

  // Offline write queue (item 8.27) — replays vitals/notes/status/card edits
  // recorded locally while offline, then tells this dashboard to refetch.
  useOfflineSickbaySync();

  const pushUndoToast = (message: string, actionId?: string) => {
    if (!actionId) return;
    addToast({
      message,
      level: 'warning',
      autoDismissMs: UNDO_WINDOW_MS,
      actionLabel: 'Angre',
      onAction: async () => {
        await api.undoAction(actionId, 'Angret fra sykestuegrensesnitt');
        fetchPatients();
      },
    });
  };

  const fetchPatients = () => {
    if (!eventId) return;
    Promise.all([
      api.getPatients(eventId),
      api.getSickbayIncoming(eventId).catch((err) => {
        console.error('[sickbay] Failed to load incoming items', err);
        addToast({ message: 'Kunne ikke laste innkommende pasienter.', level: 'urgent', autoDismissMs: 8_000 });
        return { items: [] as SickbayIncomingItem[] };
      }),
    ]).then(([patientRes, incomingRes]) => {
      setPatients(patientRes.patients);
      setIncomingItems(incomingRes.items.filter((item) => item.critical));
      setLoading(false);
    }).catch((err) => {
      console.error('[sickbay] Failed to load patients', err);
      setLoading(false);
    });
    api.getTeamPatientEngagements(eventId).then((res) => {
      setFieldEngagements(res.engagements as Record<string, TeamPatientEngagement[]>);
    }).catch((err) => console.error('[sickbay] Failed to load team engagements', err));
  };

  const fetchPatientsRef = useRef(fetchPatients);
  fetchPatientsRef.current = fetchPatients;
  const refetchTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  /** Coalesce bursts of WebSocket events into one refetch. */
  const scheduleRefetch = () => {
    if (refetchTimer.current) clearTimeout(refetchTimer.current);
    refetchTimer.current = setTimeout(() => {
      refetchTimer.current = null;
      fetchPatientsRef.current();
    }, 400);
  };

  useEffect(() => {
    fetchPatients();
  }, [eventId]);

  // Team positions for the "på vei" distance line (gap A7/A9) and sick bay
  // capacity settings (gap B6) — initial snapshot from getEvent, positions
  // kept live via the team.position WS handler below.
  useEffect(() => {
    if (!eventId) return;
    api.getEvent(eventId)
      .then((res) => {
        setTeams((res.teams ?? []) as Team[]);
        setEventSettings((res.event?.settings as EventSettings | undefined) ?? null);
      })
      .catch((err) => console.error('[sickbay] Failed to load team positions', err));
  }, [eventId]);

  // Re-sync when realtime comes back or the tablet wakes up — otherwise the
  // sick bay works from a list that silently stopped updating. Also refetches
  // once the offline queue (item 8.27) has flushed, so optimistic local state
  // is replaced by the server's own record.
  useEffect(() => {
    const onResync = () => fetchPatientsRef.current();
    const onQueueFlushed = () => {
      setLocallyQueuedVitalsIds(new Set());
      fetchPatientsRef.current();
    };
    const onVisible = () => {
      if (document.visibilityState === 'visible' && navigator.onLine) fetchPatientsRef.current();
    };
    window.addEventListener('rkf:wsConnected', onResync);
    window.addEventListener('online', onResync);
    window.addEventListener('rkf:sickbayQueueFlushed', onQueueFlushed);
    document.addEventListener('visibilitychange', onVisible);
    return () => {
      window.removeEventListener('rkf:wsConnected', onResync);
      window.removeEventListener('online', onResync);
      window.removeEventListener('rkf:sickbayQueueFlushed', onQueueFlushed);
      document.removeEventListener('visibilitychange', onVisible);
      if (refetchTimer.current) clearTimeout(refetchTimer.current);
    };
  }, []);

  // Live updates via WebSocket. Vitals patch the patient in place for speed;
  // everything that changes the patient list (new field reports, status or
  // assignment changes, a team calling for assistance) triggers a refetch.
  // Before this the sick bay never saw a new incoming patient without a reload.
  useEffect(() => {
    const off = onMessage((msg) => {
      if (msg.type === 'patient.vitals_updated') {
        const { patientId, vitals } = (msg.payload as { patientId: string; vitals: unknown }) ?? {};
        if (patientId && vitals) {
          setPatients((prev) =>
            prev.map((p) =>
              p.id === patientId
                ? { ...p, latestVitals: vitals as SickBayPatient['latestVitals'], vitalsHistory: [vitals as SickBayPatient['vitalsHistory'][0], ...(p.vitalsHistory ?? [])] }
                : p,
            ),
          );
          // NEWS2 may now put the patient in the critical incoming panel.
          scheduleRefetch();
        }
      } else if (
        msg.type === 'patient.created'
        || msg.type === 'patient.updated'
        || msg.type === 'team.status_changed'
        || msg.type === 'team.session_changed'
      ) {
        scheduleRefetch();
      } else if (msg.type === 'team.position') {
        const { teamId, position } = (msg.payload as { teamId?: string; position?: { lat: number; lng: number } }) ?? {};
        if (teamId && position) {
          setTeams((prev) => prev.map((t) => (t.id === teamId ? { ...t, currentPosition: position } : t)));
        }
      }
    });
    return off;
  }, [onMessage]);

  const handleIntake = async () => {
    if (!eventId) return;
    if (!isIntakeFormValid(intakeForm)) {
      addToast({ message: 'Skriv inn navn eller problemstilling før du registrerer.', level: 'warning', autoDismissMs: 5_000 });
      return;
    }
    const placementType = intakeForm.placementType || undefined;
    const placementNumber = intakeForm.placementNumber.trim();
    if ((placementType && !placementNumber) || (!placementType && placementNumber)) {
      addToast({
        message: 'Velg både plasseringstype og plasseringsnummer, eller la begge stå tomme.',
        level: 'warning',
        autoDismissMs: 6_000,
      });
      return;
    }
    const { patient: created } = await api.createPatient({
      eventId,
      fullName: intakeForm.fullName.trim() || undefined,
      gender: intakeForm.gender || undefined,
      birthDate: intakeForm.birthDate || undefined,
      placementType,
      placementNumber: placementType ? placementNumber : undefined,
      ageGroup: intakeForm.ageGroup,
      presentingComplaint: intakeForm.presentingComplaint.trim() || undefined,
      assignedClinician: intakeForm.assignedClinician.trim() || undefined,
    });
    setShowIntake(false);
    setIntakeForm({
      fullName: '',
      gender: '',
      birthDate: '',
      placementType: '',
      placementNumber: '',
      ageGroup: 'adult',
      presentingComplaint: '',
      assignedClinician: '',
    });
    // Shared patient number (gap A5) — server-allocated, so only shown once the create response has it.
    const numberLabel = patientNumber(created ?? {});
    addToast({
      message: numberLabel ? `Pasient ${numberLabel} registrert` : 'Pasient registrert',
      level: 'info',
      autoDismissMs: 4_000,
    });
    fetchPatients();
  };

  const scheduleMonitoringReminder = (patient: SickBayPatient, result: News2Result) => {
    const name = patient.presentingComplaint || 'Pasient';
    if (result.alertLevel === 'high') {
      addToast({
        patientId: patient.id,
        message: `${name}: NEWS2 ${result.total} — Kontinuerlig overvåkning påkrevd. Vurder eskalering — kontakt koordinator`,
        level: 'urgent',
        autoDismissMs: 0,
      });
      return;
    }
    const clinicalMs = result.monitoringMinutes * 60_000;
    const delayMs = DEV_INTERVALS ? 60_000 : clinicalMs;
    setTimeout(() => {
      addToast({
        patientId: patient.id,
        message: `Tid for ny vurdering: ${name} (NEWS2 ${result.total}) — ${news2MonitoringLabel(result)}`,
        level: result.alertLevel === 'medium' ? 'warning' : 'info',
        autoDismissMs: 120_000,
      });
    }, delayMs);
  };

  const handleStatusChange = async (patientId: string, status: string, patient?: SickBayPatient) => {
    if ((status === 'discharged' || status === 'transferred') && patient) {
      setAmkPatient(null);
      setDischargeTarget({ patient, targetStatus: status });
      setDischargeForm(EMPTY_DISCHARGE_FORM);
      return;
    }
    if (!navigator.onLine) {
      await enqueueSickbayAction(patientId, { type: 'status_set', status });
      setPatients((prev) => prev.map((p) => (p.id === patientId ? { ...p, status } : p)));
      addToast({ message: OFFLINE_TOAST_MESSAGE, level: 'warning', autoDismissMs: 6_000 });
      return;
    }
    const res = await api.executePatientAction(patientId, { type: 'status.set', status });
    pushUndoToast('Pasientstatus oppdatert. Du kan angre i 10 sekunder.', res.action?.id);
    fetchPatients();
  };

  const handleOpenAmk = async (patient: SickBayPatient) => {
    setDischargeTarget(null);
    setAmkPatient(patient);
    await handleLoadMedications(patient.id);
  };

  const handleDischargeSubmit = async () => {
    if (!dischargeTarget) return;
    const { patient, targetStatus } = dischargeTarget;
    setDischargeSubmitting(true);
    try {
      const noteText = buildDischargeNote(dischargeForm);
      const noteAuthor = targetStatus === 'transferred' ? 'Overføring' : 'Utskrivelse';
      if (!navigator.onLine) {
        await enqueueSickbayAction(patient.id, { type: 'note_add', text: noteText, author: noteAuthor });
        await enqueueSickbayAction(patient.id, { type: 'status_set', status: targetStatus });
        setPatients((prev) => prev.map((p) => (p.id === patient.id
          ? {
              ...p,
              status: targetStatus,
              notes: [{ id: `local-${crypto.randomUUID()}`, text: noteText, author: noteAuthor, createdAt: new Date().toISOString() }, ...(p.notes ?? [])],
            }
          : p)));
        addToast({ message: OFFLINE_TOAST_MESSAGE, level: 'warning', autoDismissMs: 6_000 });
        setDischargeTarget(null);
        setDischargeForm(EMPTY_DISCHARGE_FORM);
        return;
      }
      await api.addPatientNote(patient.id, noteText, noteAuthor);
      const statusAction = await api.executePatientAction(patient.id, { type: 'status.set', status: targetStatus });
      const msg = targetStatus === 'transferred'
        ? 'Pasienten er markert som overført. Du kan angre i 10 sekunder.'
        : 'Pasienten er skrevet ut. Du kan angre i 10 sekunder.';
      pushUndoToast(msg, statusAction.action?.id);
      setDischargeTarget(null);
      setDischargeForm(EMPTY_DISCHARGE_FORM);
      fetchPatients();
    } catch (err) {
      console.error('[sickbay] Discharge/transfer submit failed', err);
    } finally {
      setDischargeSubmitting(false);
    }
  };

  const handleLoadMedications = async (patientId: string) => {
    const { medications: meds } = await api.getMedications(patientId);
    setMedications((prev) => ({ ...prev, [patientId]: meds }));
  };

  const handleRecordMedication = async (patientId: string, form: MedFormShape) => {
    await api.recordMedication(patientId, form);
    await handleLoadMedications(patientId);
  };

  const handleRecordVitals = async (patient: SickBayPatient, form: VitalsFormShape) => {
    const vitalsPayload: Record<string, unknown> = {
      pulse: form.pulse ? parseInt(form.pulse) : undefined,
      spo2: form.spo2 ? parseInt(form.spo2) : undefined,
      respiratoryRate: form.rr ? parseInt(form.rr) : undefined,
      painScore: form.pain ? parseInt(form.pain) : undefined,
      systolicBP: form.bp ? parseInt(form.bp) : undefined,
      temperature: form.temp ? parseFloat(form.temp) : undefined,
      acvpu: form.acvpu || undefined,
    };

    const newReading = {
      timestamp: new Date().toISOString(),
      respiratoryRate: form.rr ? parseInt(form.rr) : undefined,
      spo2: form.spo2 ? parseInt(form.spo2) : undefined,
      systolicBP: form.bp ? parseInt(form.bp) : undefined,
      pulse: form.pulse ? parseInt(form.pulse) : undefined,
      acvpu: (form.acvpu || undefined) as AcvpuLevel | undefined,
      temperature: form.temp ? parseFloat(form.temp) : undefined,
      painScore: form.pain ? parseInt(form.pain) : undefined,
    };

    // NEWS2 trend detection is safety-critical and runs locally regardless of
    // connectivity (Safety > Offline) — only the server broadcast is skipped
    // while offline, since there is nothing to broadcast to.
    const news2Result = calculateNEWS2(newReading);
    scheduleMonitoringReminder(patient, news2Result);

    const allReadings = [newReading, ...(patient.vitalsHistory ?? [])];
    const trend = calculateNEWS2Trend(allReadings);
    if (trend.direction === 'rising' && trend.ratePerHour >= 2) {
      navigator.vibrate?.([200, 100, 200]);
      addToast({
        patientId: patient.id,
        message: `ADVARSEL: NEWS2 stiger raskt — umiddelbar vurdering påkrevd (${patient.presentingComplaint || 'Pasient'})`,
        level: 'urgent',
        autoDismissMs: 0,
      });
      if (navigator.onLine) {
        wsSend({
          type: 'patient.deterioration_alert',
          eventId,
          payload: { patientId: patient.id, trend, news2Score: news2Result.total },
          timestamp: new Date().toISOString(),
        });
      }
    }

    // No network: keep the reading locally and mark it "lagret lokalt" until
    // the offline queue (item 8.27) has replayed it.
    if (!navigator.onLine) {
      await enqueueSickbayAction(patient.id, { type: 'vitals_record', vitals: vitalsPayload as Record<string, number | undefined> });
      setPatients((prev) => prev.map((p) => (p.id === patient.id
        ? { ...p, latestVitals: newReading as SickBayPatient['latestVitals'], vitalsHistory: [newReading as SickBayPatient['vitalsHistory'][0], ...(p.vitalsHistory ?? [])] }
        : p)));
      setLocallyQueuedVitalsIds((prev) => new Set(prev).add(patient.id));
      addToast({ message: OFFLINE_TOAST_MESSAGE, level: 'warning', autoDismissMs: 6_000 });
      return;
    }

    await api.recordVitals(patient.id, vitalsPayload as Record<string, number | undefined>);
    fetchPatients();
  };

  const handleAddNote = async (patientId: string, text: string, author: string) => {
    if (!navigator.onLine) {
      await enqueueSickbayAction(patientId, { type: 'note_add', text, author });
      setPatients((prev) => prev.map((p) => (p.id === patientId
        ? { ...p, notes: [{ id: `local-${crypto.randomUUID()}`, text, author, createdAt: new Date().toISOString() }, ...(p.notes ?? [])] }
        : p)));
      addToast({ message: OFFLINE_TOAST_MESSAGE, level: 'warning', autoDismissMs: 6_000 });
      return;
    }
    await api.addPatientNote(patientId, text, author);
    fetchPatients();
  };

  const handleUpdatePlacement = async (
    patientId: string,
    placementType: 'chair' | 'bed' | '',
    placementNumber: string,
  ) => {
    const normalizedNumber = placementNumber.trim();
    if ((placementType && !normalizedNumber) || (!placementType && normalizedNumber)) {
      addToast({
        message: 'Velg både plasseringstype og plasseringsnummer, eller tøm begge feltene.',
        level: 'warning',
        autoDismissMs: 6_000,
      });
      return;
    }
    const data = { placementType: placementType || null, placementNumber: normalizedNumber || null };
    if (!navigator.onLine) {
      await enqueueSickbayAction(patientId, { type: 'patient_update', data });
      // The wire payload clears fields with `null`; SickBayPatient models an
      // absent placement as `undefined`, so the optimistic patch uses that instead.
      setPatients((prev) => prev.map((p) => (p.id === patientId
        ? { ...p, placementType: placementType || undefined, placementNumber: normalizedNumber || undefined }
        : p)));
      addToast({ message: OFFLINE_TOAST_MESSAGE, level: 'warning', autoDismissMs: 6_000 });
      return;
    }
    await api.updatePatient(patientId, data);
    addToast({ message: 'Plassering oppdatert', level: 'info', autoDismissMs: 3_000 });
    fetchPatients();
  };

  const handleUpdateDemographics = async (patientId: string, form: DemographicsFormShape) => {
    const data = {
      fullName: form.fullName.trim() || null,
      gender: form.gender || null,
      birthDate: form.birthDate || null,
      ageGroup: form.ageGroup,
    };
    if (!navigator.onLine) {
      await enqueueSickbayAction(patientId, { type: 'patient_update', data });
      setPatients((prev) => prev.map((p) => (p.id === patientId
        ? {
            ...p,
            fullName: form.fullName.trim() || undefined,
            gender: form.gender || undefined,
            birthDate: form.birthDate || undefined,
            ageGroup: form.ageGroup,
          }
        : p)));
      addToast({ message: OFFLINE_TOAST_MESSAGE, level: 'warning', autoDismissMs: 6_000 });
      return;
    }
    await api.updatePatient(patientId, data);
    addToast({ message: 'Pasientinfo oppdatert', level: 'info', autoDismissMs: 3_000 });
    fetchPatients();
  };

  const handleUpdateComplaint = async (patientId: string, complaint: string) => {
    const data = { presentingComplaint: complaint || null };
    if (!navigator.onLine) {
      await enqueueSickbayAction(patientId, { type: 'patient_update', data });
      setPatients((prev) => prev.map((p) => (p.id === patientId ? { ...p, presentingComplaint: complaint } : p)));
      addToast({ message: OFFLINE_TOAST_MESSAGE, level: 'warning', autoDismissMs: 6_000 });
      return;
    }
    await api.updatePatient(patientId, data);
    addToast({ message: 'Problemstilling oppdatert', level: 'info', autoDismissMs: 3_000 });
    fetchPatients();
  };

  const handleUpdateTriage = async (patient: SickBayPatient, next: FieldTriageStatus | null) => {
    const previous = (patient.triageStatus ?? null) as FieldTriageStatus | null;
    if (previous === next) return;
    const prevLabel = previous ? FIELD_TRIAGE_STYLE[previous].label.toLowerCase() : null;
    const nextLabel = next ? FIELD_TRIAGE_STYLE[next].label.toLowerCase() : null;
    const noteText = prevLabel && nextLabel
      ? `Triage endret ${prevLabel} → ${nextLabel}`
      : nextLabel
        ? `Triage satt til ${nextLabel}`
        : `Triage fjernet (var ${prevLabel})`;
    if (!navigator.onLine) {
      await enqueueSickbayAction(patient.id, { type: 'patient_update', data: { triageStatus: next } });
      await enqueueSickbayAction(patient.id, { type: 'note_add', text: noteText, author: 'Triage' });
      setPatients((prev) => prev.map((p) => (p.id === patient.id
        ? {
            ...p,
            triageStatus: next,
            notes: [{ id: `local-${crypto.randomUUID()}`, text: noteText, author: 'Triage', createdAt: new Date().toISOString() }, ...(p.notes ?? [])],
          }
        : p)));
      addToast({ message: OFFLINE_TOAST_MESSAGE, level: 'warning', autoDismissMs: 6_000 });
      return;
    }
    await api.updatePatient(patient.id, { triageStatus: next });
    await api.addPatientNote(patient.id, noteText, 'Triage');
    addToast({ message: 'Triage oppdatert', level: 'info', autoDismissMs: 3_000 });
    fetchPatients();
  };

  const handleStartTreatment = async (patientId: string) => {
    const patient = patients.find((row) => row.id === patientId);
    await handleStatusChange(patientId, 'in_treatment', patient);
  };

  // Urgency bucket: 0 = overdue re-assessment, 1 = continuous monitoring, 2 = everything else.
  // Inside a bucket the order is placement (walk order), then NEWS2.
  const urgencyOf = (p: SickBayPatient): { bucket: number; minutesOverdue: number } => {
    if (CLOSED_STATUSES.has(p.status as PatientStatus)) return { bucket: 2, minutesOverdue: 0 };
    const due = nextObservationDue(p.latestVitals, now);
    if (due.kind === 'overdue') return { bucket: 0, minutesOverdue: due.minutesOverdue };
    if (due.kind === 'continuous') return { bucket: 1, minutesOverdue: 0 };
    return { bucket: 2, minutesOverdue: 0 };
  };

  const openPatients = patients.filter((p) => !CLOSED_STATUSES.has(p.status as PatientStatus));
  const overdueCount = openPatients.filter((p) => urgencyOf(p).bucket === 0).length;
  const continuousCount = openPatients.filter((p) => urgencyOf(p).bucket === 1).length;
  /** Occupancy strip (gap B6 / item 8.30) — never invents a denominator. */
  const occupancy = computeSickbayOccupancy(eventSettings?.sickbay, openPatients);

  const sortedPatients = [...patients].sort((a, b) => {
    const aUrgency = urgencyOf(a);
    const bUrgency = urgencyOf(b);
    if (aUrgency.bucket !== bUrgency.bucket) return aUrgency.bucket - bUrgency.bucket;
    if (aUrgency.bucket === 0 && aUrgency.minutesOverdue !== bUrgency.minutesOverdue) {
      return bUrgency.minutesOverdue - aUrgency.minutesOverdue;
    }

    const aPlacement = a.placementNumber ? Number.parseInt(a.placementNumber, 10) : Number.NaN;
    const bPlacement = b.placementNumber ? Number.parseInt(b.placementNumber, 10) : Number.NaN;
    const aHasPlacement = Number.isFinite(aPlacement);
    const bHasPlacement = Number.isFinite(bPlacement);
    if (aHasPlacement && bHasPlacement && aPlacement !== bPlacement) {
      return aPlacement - bPlacement;
    }
    if (aHasPlacement !== bHasPlacement) {
      return aHasPlacement ? -1 : 1;
    }

    const placementTypeOrder: Record<'chair' | 'bed', number> = { chair: 0, bed: 1 };
    const aTypeRank = a.placementType ? placementTypeOrder[a.placementType] ?? 9 : 9;
    const bTypeRank = b.placementType ? placementTypeOrder[b.placementType] ?? 9 : 9;
    if (aTypeRank !== bTypeRank) {
      return aTypeRank - bTypeRank;
    }

    const order: Record<string, number> = { high: 0, medium: 1, low: 2, routine: 3 };
    const aLevel = a.latestVitals ? calculateNEWS2(a.latestVitals).alertLevel : 'none';
    const bLevel = b.latestVitals ? calculateNEWS2(b.latestVitals).alertLevel : 'none';
    const aRank = aLevel === 'none' ? 4 : (order[aLevel] ?? 4);
    const bRank = bLevel === 'none' ? 4 : (order[bLevel] ?? 4);
    return aRank - bRank;
  });

  const groupedPatients = STATUS_GROUP_ORDER
    .map((status) => ({
      status,
      patients: sortedPatients.filter((patient) => patient.status === status),
    }))
    .filter((group) => group.patients.length > 0);

  const toggleClosedCard = (patientId: string) => {
    setExpandedClosedCards((prev) => ({ ...prev, [patientId]: !prev[patientId] }));
  };

  /** True once a patrol is en route to or transporting this patient (gap A9). */
  const isOnTheWay = (patientId: string) =>
    (fieldEngagements[patientId] ?? []).some((eng) => APPROACHING_ENGAGEMENT_STATUSES.has(eng.status));

  const renderPatientCard = (patient: SickBayPatient) => (
    <PatientCard
      key={patient.id}
      patient={patient}
      medications={medications[patient.id] ?? []}
      fieldEngagements={fieldEngagements[patient.id] ?? []}
      teams={teams}
      openPatients={openPatients}
      localVitalsPending={locallyQueuedVitalsIds.has(patient.id)}
      onStatusChange={(status) => handleStatusChange(patient.id, status, patient)}
      onSubmitVitals={(form) => handleRecordVitals(patient, form)}
      onSubmitNote={(text, author) => handleAddNote(patient.id, text, author)}
      onSubmitMedication={(form) => handleRecordMedication(patient.id, form)}
      onLoadMedications={() => handleLoadMedications(patient.id)}
      onOpenAmk={() => handleOpenAmk(patient)}
      onUpdatePlacement={(placementType, placementNumber) =>
        handleUpdatePlacement(patient.id, placementType, placementNumber)}
      onUpdateDemographics={(form) => handleUpdateDemographics(patient.id, form)}
      onUpdateComplaint={(complaint) => handleUpdateComplaint(patient.id, complaint)}
      onUpdateTriage={(triage) => handleUpdateTriage(patient, triage)}
    />
  );

  return (
    <div className="animate-fade-in">
      <SickBayHeader
        onNewPatient={() => setShowIntake(true)}
        overdueCount={overdueCount}
        continuousCount={continuousCount}
        occupancy={occupancy}
      />

      <IncomingCriticalPanel
        items={incomingItems}
        engagements={fieldEngagements}
        onStartTreatment={handleStartTreatment}
        onAssignPlacement={(patientId, placementType, placementNumber) =>
          handleUpdatePlacement(patientId, placementType, placementNumber)}
      />

      {showIntake && (
        <PatientIntakeModal
          form={intakeForm}
          onChange={setIntakeForm}
          onSubmit={handleIntake}
          onClose={() => setShowIntake(false)}
          openPatients={openPatients}
        />
      )}

      {dischargeTarget && (
        <PatientDischargeModal
          patient={dischargeTarget.patient}
          targetStatus={dischargeTarget.targetStatus}
          form={dischargeForm}
          onChange={setDischargeForm}
          onSubmit={handleDischargeSubmit}
          onClose={() => setDischargeTarget(null)}
          submitting={dischargeSubmitting}
        />
      )}

      {amkPatient && (
        <AmkBriefModal
          patient={patients.find((p) => p.id === amkPatient.id) ?? amkPatient}
          medications={medications[amkPatient.id] ?? []}
          onClose={() => setAmkPatient(null)}
          onSaved={fetchPatients}
        />
      )}

      {loading ? (
        <p style={{ color: 'var(--color-text-subtle)' }}>Laster pasienter...</p>
      ) : patients.length === 0 ? (
        <div style={{
          padding: 'var(--space-8)', textAlign: 'center', color: 'var(--color-text-subtle)',
          background: 'var(--color-surface)', borderRadius: 'var(--radius-md)', border: '1px solid var(--color-border)',
        }}>
          Ingen pasienter registrert
        </div>
      ) : (
        <div className="sickbay-groups-grid">
          {groupedPatients.map((group) => {
            const isClosedGroup = CLOSED_STATUSES.has(group.status as PatientStatus);
            return (
              <section
                key={group.status}
                data-testid={`patient-section-${group.status}`}
                style={{
                  display: 'flex',
                  flexDirection: 'column',
                  gap: 'var(--space-3)',
                }}
              >
                <div
                  style={{
                    display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: 'var(--space-2)',
                    paddingBottom: 'var(--space-2)',
                    borderBottom: '1px solid var(--color-border)',
                  }}
                >
                  <h2 style={{ fontSize: 'var(--text-base)', fontWeight: 700, margin: 0, textWrap: 'balance', display: 'flex', alignItems: 'center', gap: 'var(--space-2)' }}>
                    <span
                      aria-hidden="true"
                      style={{ width: 8, height: 8, borderRadius: '50%', background: (statusColors[group.status] ?? { color: 'var(--color-border-strong)' }).color, flexShrink: 0 }}
                    />
                    {statusLabels[group.status] || group.status}
                  </h2>
                  <span
                    data-testid={`patient-section-count-${group.status}`}
                    style={{ fontSize: 'var(--text-xs)', fontWeight: 600, color: 'var(--color-text-muted)', whiteSpace: 'nowrap' }}
                  >
                    <span className="data">{group.patients.length}</span> pasient{group.patients.length === 1 ? '' : 'er'}
                  </span>
                </div>

                {group.status === 'incoming' ? (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-4)' }}>
                    {(() => {
                      const onTheWay = group.patients.filter((p) => isOnTheWay(p.id));
                      const waiting = group.patients.filter((p) => !isOnTheWay(p.id));
                      return (
                        <>
                          {onTheWay.length > 0 && (
                            <div
                              data-testid="sickbay-stack-on-the-way"
                              style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-3)' }}
                            >
                              <StackHeading
                                title="På vei"
                                count={onTheWay.length}
                                dotColor={TEAM_PATIENT_STATUS_STYLE.en_route_to_patient.color}
                              />
                              {onTheWay.map(renderPatientCard)}
                            </div>
                          )}
                          {waiting.length > 0 && (
                            <div
                              data-testid="sickbay-stack-waiting"
                              style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-3)' }}
                            >
                              <StackHeading
                                title="Venter i teltet"
                                count={waiting.length}
                                dotColor={(statusColors.incoming ?? { color: 'var(--color-border-strong)' }).color}
                              />
                              {waiting.map(renderPatientCard)}
                            </div>
                          )}
                        </>
                      );
                    })()}
                  </div>
                ) : (
                <div
                  style={{
                    display: 'flex',
                    flexDirection: 'column',
                    gap: 'var(--space-3)',
                  }}
                >
                  {group.patients.map((patient) => {
                    if (!isClosedGroup) {
                      return renderPatientCard(patient);
                    }

                    const expanded = !!expandedClosedCards[patient.id];
                    return (
                      <div
                        key={patient.id}
                        data-testid={`closed-patient-${patient.id}`}
                        className="card"
                        style={{
                          background: 'var(--color-surface-sunken)',
                          overflow: 'hidden',
                          height: 'fit-content',
                        }}
                      >
                        <button
                          type="button"
                          data-testid={`toggle-closed-${patient.id}`}
                          aria-expanded={expanded}
                          aria-controls={`closed-panel-${patient.id}`}
                          onClick={() => toggleClosedCard(patient.id)}
                          style={{
                            width: '100%',
                            minHeight: 56,
                            padding: 'var(--space-3)',
                            border: 'none',
                            background: 'transparent',
                            color: 'var(--color-text)',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'space-between',
                            gap: 'var(--space-3)',
                            cursor: 'pointer',
                          textAlign: 'left',
                          font: 'inherit',
                        }}
                      >
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 4, minWidth: 0 }}>
                          <span style={{ fontWeight: 600 }}>{patient.fullName ?? patient.label ?? patient.presentingComplaint ?? 'Ukjent pasient'}</span>
                          <span
                            style={{
                              fontSize: 'var(--text-xs)',
                              fontWeight: 700,
                              color: patient.placementType && patient.placementNumber ? 'var(--color-status-info)' : 'var(--color-text-subtle)',
                            }}
                          >
                            {patient.placementType && patient.placementNumber
                              ? `Plassering: ${formatSickbayPlacement(patient.placementType, patient.placementNumber)}`
                              : 'Plassering: Ikke satt'}
                          </span>
                          <span style={{ fontSize: 'var(--text-xs)', color: 'var(--color-text-subtle)' }}>
                            {patient.presentingComplaint ? `Problemstilling: ${patient.presentingComplaint}` : 'Problemstilling ikke registrert'}
                          </span>
                          <span style={{ fontSize: 'var(--text-xs)', color: 'var(--color-text-subtle)' }}>
                            {formatPatientAge({
                              birthDate: patient.birthDate ?? null,
                              ageGroup: patient.ageGroup ?? null,
                              ageYears: patient.ageYears ?? null,
                            })}
                            {patient.gender ? ` · ${GENDER_LABELS[patient.gender]}` : ''}
                            {' · '}{statusLabels[patient.status] || patient.status}
                          </span>
                        </div>
                        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, fontSize: 'var(--text-sm)', fontWeight: 600, color: 'var(--color-text-muted)', flexShrink: 0 }}>
                          {expanded ? 'Skjul detaljer' : 'Vis detaljer'}
                          <Icon name={expanded ? 'chevronUp' : 'chevronDown'} />
                        </span>
                      </button>

                        {expanded && (
                          <div id={`closed-panel-${patient.id}`} data-testid={`closed-panel-${patient.id}`} style={{ padding: 'var(--space-3)' }}>
                            {renderPatientCard(patient)}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
                )}
              </section>
            );
          })}
        </div>
      )}
    </div>
  );
}
