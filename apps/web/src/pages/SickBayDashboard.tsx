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
import type { SickBayPatient, MedicationRecord } from '../lib/types';
import { SickBayHeader } from './SickBay/SickBayHeader';
import { PatientIntakeModal, type IntakeFormShape } from './SickBay/PatientIntakeModal';
import { SBARHandoverModal, type SbarFormShape } from './SickBay/SBARHandoverModal';
import { AmkBriefModal } from './SickBay/AmkBriefModal';
import { PatientCard } from './SickBay/PatientCard';
import type { VitalsFormShape } from './SickBay/VitalsEntryForm';
import type { MedFormShape } from './SickBay/MedicationPanel';

// In dev mode the monitoring timer fires after 1 min instead of the clinical interval.
const DEV_INTERVALS = import.meta.env.DEV && import.meta.env.VITE_NEWS2_DEV_INTERVALS === 'true';

type AcvpuLevel = 'alert' | 'confused' | 'voice' | 'pain' | 'unresponsive';

export function SickBayDashboard() {
  const { eventId } = useAuthStore();
  const addToast = useNotificationStore((s) => s.add);
  const onMessage = useWsStore((s) => s.onMessage);
  const wsSend = useWsStore((s) => s.send);

  const [patients, setPatients] = useState<SickBayPatient[]>([]);
  const [loading, setLoading] = useState(true);
  const [showIntake, setShowIntake] = useState(false);
  const [intakeForm, setIntakeForm] = useState<IntakeFormShape>({
    ageGroup: 'adult', presentingComplaint: '', assignedClinician: '',
  });

  const [sbarPatient, setSbarPatient] = useState<SickBayPatient | null>(null);
  const [amkPatient, setAmkPatient] = useState<SickBayPatient | null>(null);
  const [sbarForm, setSbarForm] = useState<SbarFormShape>({
    situation: '',
    background: '',
    assessment: '',
    recommendation: '',
    amkTidspunkt: '',
    amkReferanse: '',
    amkEta: '',
    amkFølger: '',
  });

  const [medications, setMedications] = useState<Record<string, MedicationRecord[]>>({});
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
    api.getPatients(eventId).then((res) => {
      setPatients(res.patients);
      setLoading(false);
    }).catch(() => setLoading(false));
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
    await api.createPatient({ eventId, ...intakeForm });
    setShowIntake(false);
    setIntakeForm({ ageGroup: 'adult', presentingComplaint: '', assignedClinician: '' });
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
    if (status === 'transferred' && patient) {
      setAmkPatient(null);
      setSbarPatient(patient);
      setSbarForm({
        situation: patient.presentingComplaint || '',
        background: '',
        assessment: patient.latestVitals
          ? `NEWS2 ${calculateNEWS2(patient.latestVitals).total}`
          : '',
        recommendation: '',
        amkTidspunkt: new Date().toLocaleTimeString('nb-NO', { hour: '2-digit', minute: '2-digit' }),
        amkReferanse: '',
        amkEta: '',
        amkFølger: '',
      });
      return;
    }
    const res = await api.executePatientAction(patientId, { type: 'status.set', status });
    pushUndoToast('Pasientstatus oppdatert. Du kan angre i 10 sekunder.', res.action?.id);
    fetchPatients();
  };

  const handleOpenAmk = async (patient: SickBayPatient) => {
    setSbarPatient(null);
    setAmkPatient(patient);
    await handleLoadMedications(patient.id);
  };

  const handleSbarSubmit = async () => {
    if (!sbarPatient) return;
    const amkLines = [
      sbarForm.amkTidspunkt ? `AMK-samtale: ${sbarForm.amkTidspunkt}` : null,
      sbarForm.amkReferanse ? `Ambulansenummer/AMK-ref: ${sbarForm.amkReferanse}` : null,
      sbarForm.amkEta ? `Forventet ankomst (ETA): ${sbarForm.amkEta}` : null,
      sbarForm.amkFølger ? `Følger pasienten: ${sbarForm.amkFølger}` : null,
    ].filter(Boolean);
    const sbarNote = [
      `S: ${sbarForm.situation}`,
      `B: ${sbarForm.background}`,
      `A: ${sbarForm.assessment}`,
      `R: ${sbarForm.recommendation}`,
      ...(amkLines.length > 0 ? ['', '--- AMK ---', ...amkLines] : []),
    ].join('\n');
    await api.addPatientNote(sbarPatient.id, sbarNote, 'SBAR-overlevering');
    const statusAction = await api.executePatientAction(sbarPatient.id, { type: 'status.set', status: 'transferred' });
    pushUndoToast('Pasienten er markert som overført. Du kan angre i 10 sekunder.', statusAction.action?.id);
    setSbarPatient(null);
    setSbarForm({ situation: '', background: '', assessment: '', recommendation: '', amkTidspunkt: '', amkReferanse: '', amkEta: '', amkFølger: '' });
    fetchPatients();
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

  const sortedPatients = [...patients].sort((a, b) => {
    const order: Record<string, number> = { high: 0, medium: 1, low: 2, routine: 3 };
    const aLevel = a.latestVitals ? calculateNEWS2(a.latestVitals).alertLevel : 'none';
    const bLevel = b.latestVitals ? calculateNEWS2(b.latestVitals).alertLevel : 'none';
    const aRank = aLevel === 'none' ? 4 : (order[aLevel] ?? 4);
    const bRank = bLevel === 'none' ? 4 : (order[bLevel] ?? 4);
    return aRank - bRank;
  });

  return (
    <div className="animate-fade-in">
      <SickBayHeader onNewPatient={() => setShowIntake(true)} />

      {showIntake && (
        <PatientIntakeModal
          form={intakeForm}
          onChange={setIntakeForm}
          onSubmit={handleIntake}
          onClose={() => setShowIntake(false)}
        />
      )}

      {sbarPatient && (
        <SBARHandoverModal
          patient={sbarPatient}
          form={sbarForm}
          onChange={setSbarForm}
          onSubmit={handleSbarSubmit}
          onClose={() => setSbarPatient(null)}
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
        <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-3)' }}>
          {sortedPatients.map((patient) => (
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
            />
          ))}
        </div>
      )}
    </div>
  );
}
