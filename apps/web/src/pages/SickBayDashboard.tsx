import { useState, useEffect } from 'react';
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
import type { SickBayPatient, MedicationRecord, SickbayIncomingItem } from '../lib/types';
import { SickBayHeader } from './SickBay/SickBayHeader';
import { PatientIntakeModal, type IntakeFormShape } from './SickBay/PatientIntakeModal';
import { PatientDischargeModal, type DischargeFormShape, EMPTY_DISCHARGE_FORM, buildDischargeNote } from './SickBay/PatientDischargeModal';
import { AmkBriefModal } from './SickBay/AmkBriefModal';
import { PatientCard, type DemographicsFormShape } from './SickBay/PatientCard';
import { IncomingCriticalPanel } from './SickBay/IncomingCriticalPanel';
import type { VitalsFormShape } from './SickBay/VitalsEntryForm';
import type { MedFormShape } from './SickBay/MedicationPanel';
import { formatPatientAge, formatSickbayPlacement, GENDER_LABELS, statusLabels } from '../lib/constants';

// In dev mode the monitoring timer fires after 1 min instead of the clinical interval.
const DEV_INTERVALS = import.meta.env.DEV && import.meta.env.VITE_NEWS2_DEV_INTERVALS === 'true';

type AcvpuLevel = 'alert' | 'confused' | 'voice' | 'pain' | 'unresponsive';
type PatientStatus = 'incoming' | 'in_treatment' | 'observation' | 'discharged' | 'transferred';

const STATUS_GROUP_ORDER: PatientStatus[] = ['incoming', 'in_treatment', 'observation', 'discharged', 'transferred'];
const CLOSED_STATUSES = new Set<PatientStatus>(['discharged', 'transferred']);

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
  const [expandedClosedCards, setExpandedClosedCards] = useState<Record<string, boolean>>({});
  const UNDO_WINDOW_MS = 10_000;

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
  };

  useEffect(() => {
    fetchPatients();
  }, [eventId]);

  // Live vitals updates via WebSocket — update specific patient in state
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
        }
      }
    });
    return off;
  }, [onMessage]);

  const handleIntake = async () => {
    if (!eventId) return;
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
    await api.createPatient({
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

    await api.recordVitals(patient.id, vitalsPayload as Record<string, number | undefined>);

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
      wsSend({
        type: 'patient.deterioration_alert',
        eventId,
        payload: { patientId: patient.id, trend, news2Score: news2Result.total },
        timestamp: new Date().toISOString(),
      });
    }

    fetchPatients();
  };

  const handleAddNote = async (patientId: string, text: string, author: string) => {
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
    await api.updatePatient(patientId, {
      placementType: placementType || null,
      placementNumber: normalizedNumber || null,
    });
    addToast({ message: 'Plassering oppdatert', level: 'info', autoDismissMs: 3_000 });
    fetchPatients();
  };

  const handleUpdateDemographics = async (patientId: string, form: DemographicsFormShape) => {
    await api.updatePatient(patientId, {
      fullName: form.fullName.trim() || null,
      gender: form.gender || null,
      birthDate: form.birthDate || null,
      ageGroup: form.ageGroup,
    });
    addToast({ message: 'Pasientinfo oppdatert', level: 'info', autoDismissMs: 3_000 });
    fetchPatients();
  };

  const handleUpdateComplaint = async (patientId: string, complaint: string) => {
    await api.updatePatient(patientId, { presentingComplaint: complaint || null });
    addToast({ message: 'Problemstilling oppdatert', level: 'info', autoDismissMs: 3_000 });
    fetchPatients();
  };

  const handleStartTreatment = async (patientId: string) => {
    const patient = patients.find((row) => row.id === patientId);
    await handleStatusChange(patientId, 'in_treatment', patient);
  };

  const sortedPatients = [...patients].sort((a, b) => {
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

  const activeGroups = groupedPatients.filter((g) => !CLOSED_STATUSES.has(g.status as PatientStatus));
  const closedGroups = groupedPatients.filter((g) => CLOSED_STATUSES.has(g.status as PatientStatus));

  const toggleClosedCard = (patientId: string) => {
    setExpandedClosedCards((prev) => ({ ...prev, [patientId]: !prev[patientId] }));
  };

  const renderClosedPatientRow = (patient: SickBayPatient) => {
    const expanded = !!expandedClosedCards[patient.id];
    return (
      <div
        key={patient.id}
        data-testid={`closed-patient-${patient.id}`}
        style={{
          border: '1px solid var(--color-border)',
          borderRadius: 'var(--radius-md)',
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
          }}
        >
          <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
            <span style={{ fontWeight: 600 }}>{patient.fullName ?? patient.presentingComplaint ?? 'Ukjent pasient'}</span>
            <span
              style={{
                fontFamily: 'var(--font-mono)',
                fontSize: 'var(--text-xs)',
                fontWeight: 700,
                color: patient.placementType && patient.placementNumber ? 'var(--color-status-info)' : 'var(--color-text-subtle)',
              }}
            >
              {patient.placementType && patient.placementNumber
                ? `Plassering: ${formatSickbayPlacement(patient.placementType, patient.placementNumber)}`
                : 'Plassering: Ikke satt'}
            </span>
            <span style={{ fontFamily: 'var(--font-mono)', fontSize: 'var(--text-xs)', color: 'var(--color-text-subtle)' }}>
              {patient.presentingComplaint ? `Problemstilling: ${patient.presentingComplaint}` : 'Problemstilling ikke registrert'}
            </span>
            <span style={{ fontFamily: 'var(--font-mono)', fontSize: 'var(--text-xs)', color: 'var(--color-text-subtle)' }}>
              {formatPatientAge({
                birthDate: patient.birthDate ?? null,
                ageGroup: patient.ageGroup ?? null,
                ageYears: patient.ageYears ?? null,
              })}
              {patient.gender ? ` · ${GENDER_LABELS[patient.gender]}` : ''}
              {' · '}{statusLabels[patient.status] || patient.status}
            </span>
          </div>
          <span style={{ fontFamily: 'var(--font-mono)', fontSize: 'var(--text-xs)', color: 'var(--color-text-subtle)', flexShrink: 0 }}>
            {expanded ? 'Skjul detaljer' : 'Vis detaljer'}
            <span aria-hidden="true">{expanded ? ' ▲' : ' ▼'}</span>
          </span>
        </button>

        {expanded && (
          <div id={`closed-panel-${patient.id}`} data-testid={`closed-panel-${patient.id}`} style={{ padding: 'var(--space-3)' }}>
            <PatientCard
              patient={patient}
              medications={medications[patient.id] ?? []}
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
            />
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="animate-fade-in">
      <SickBayHeader onNewPatient={() => setShowIntake(true)} />

      <IncomingCriticalPanel
        items={incomingItems}
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
        <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-4)' }}>
          {/* Active patients — incoming / in_treatment / observation */}
          {activeGroups.length > 0 && (
            <div className="sickbay-groups-grid">
              {activeGroups.map((group) => (
                <section
                  key={group.status}
                  data-testid={`patient-section-${group.status}`}
                  style={{
                    display: 'flex',
                    flexDirection: 'column',
                    gap: 'var(--space-3)',
                    padding: 'var(--space-3)',
                    borderRadius: 'var(--radius-md)',
                    border: '1px solid var(--color-border)',
                    background: 'var(--color-surface)',
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 'var(--space-2)' }}>
                    <h2 style={{ fontSize: 'var(--text-base)', fontWeight: 700, margin: 0 }}>
                      {statusLabels[group.status] || group.status}
                    </h2>
                    <span
                      data-testid={`patient-section-count-${group.status}`}
                      style={{
                        fontFamily: 'var(--font-mono)',
                        fontSize: 'var(--text-xs)',
                        color: 'var(--color-text-subtle)',
                      }}
                    >
                      {group.patients.length} pasient{group.patients.length === 1 ? '' : 'er'}
                    </span>
                  </div>

                  <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-3)' }}>
                    {group.patients.map((patient) => (
                      <PatientCard
                        key={patient.id}
                        patient={patient}
                        medications={medications[patient.id] ?? []}
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
                      />
                    ))}
                  </div>
                </section>
              ))}
            </div>
          )}

          {/* Closed patients — discharged / transferred */}
          {closedGroups.length > 0 && (
            <div
              style={{
                borderTop: '1px solid var(--color-border)',
                paddingTop: 'var(--space-3)',
                display: 'flex',
                flexDirection: 'column',
                gap: 'var(--space-3)',
              }}
            >
              <h2 style={{ fontSize: 'var(--text-base)', fontWeight: 700, margin: 0, color: 'var(--color-text-subtle)' }}>
                Historikk
              </h2>
              {closedGroups.map((group) => (
                <section
                  key={group.status}
                  data-testid={`patient-section-${group.status}`}
                  style={{
                    display: 'flex',
                    flexDirection: 'column',
                    gap: 'var(--space-2)',
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)' }}>
                    <h3 style={{ fontSize: 'var(--text-sm)', fontWeight: 600, margin: 0, color: 'var(--color-text-subtle)' }}>
                      {statusLabels[group.status] || group.status}
                    </h3>
                    <span
                      data-testid={`patient-section-count-${group.status}`}
                      style={{
                        fontFamily: 'var(--font-mono)',
                        fontSize: 'var(--text-xs)',
                        color: 'var(--color-text-subtle)',
                      }}
                    >
                      {group.patients.length} pasient{group.patients.length === 1 ? '' : 'er'}
                    </span>
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-2)' }}>
                    {group.patients.map(renderClosedPatientRow)}
                  </div>
                </section>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
