import { useState, useEffect } from 'react';
import { useAuthStore } from '../stores/auth';
import { useNotificationStore } from '../stores/notifications';
import { useWsStore } from '../stores/ws';
import { api } from '../lib/api';
import {
  calculateNEWS2,
  calculateNEWS2Trend,
  news2MonitoringLabel,
  news2BadgeLabel,
  type News2Result,
} from '@rkf/shared-types';

// In dev mode the monitoring timer fires after 1 min instead of the clinical interval.
const DEV_INTERVALS = import.meta.env.DEV && import.meta.env.VITE_NEWS2_DEV_INTERVALS === 'true';

type AcvpuLevel = 'alert' | 'confused' | 'voice' | 'pain' | 'unresponsive';

const ACVPU_OPTIONS: { value: AcvpuLevel; label: string; short: string }[] = [
  { value: 'alert', label: 'Alert', short: 'A' },
  { value: 'confused', label: 'Forvirret', short: 'C' },
  { value: 'voice', label: 'Voice', short: 'V' },
  { value: 'pain', label: 'Pain', short: 'P' },
  { value: 'unresponsive', label: 'Ingen respons', short: 'U' },
];

const news2Colors: Record<News2Result['alertLevel'], { color: string; bg: string }> = {
  routine: { color: 'var(--color-status-ok)', bg: 'var(--color-status-ok-bg)' },
  low: { color: 'var(--color-status-info)', bg: 'var(--color-status-info-bg)' },
  medium: { color: 'var(--color-status-warning)', bg: 'var(--color-status-warning-bg)' },
  high: { color: 'var(--color-status-critical)', bg: 'var(--color-status-critical-bg)' },
};

const statusLabels: Record<string, string> = {
  incoming: 'Innkommende',
  in_treatment: 'Under behandling',
  observation: 'Observasjon',
  discharged: 'Utskrevet',
  transferred: 'Overført',
};

const statusColors: Record<string, { color: string; bg: string }> = {
  incoming: { color: 'var(--color-status-warning)', bg: 'var(--color-status-warning-bg)' },
  in_treatment: { color: 'var(--color-status-info)', bg: 'var(--color-status-info-bg)' },
  observation: { color: 'var(--color-status-ok)', bg: 'var(--color-status-ok-bg)' },
  discharged: { color: 'var(--color-text-subtle)', bg: 'var(--color-surface-sunken)' },
  transferred: { color: 'var(--color-status-critical)', bg: 'var(--color-status-critical-bg)' },
};

const ageLabels: Record<string, string> = {
  child: 'Barn', adolescent: 'Ungdom', adult: 'Voksen', elderly: 'Eldre',
};

const routeLabels: Record<string, string> = {
  inhaled: 'Inhalasjon',
  oral: 'Per os (svelget)',
  iv: 'Intravenøst (IV)',
  im: 'Intramuskulært (IM)',
  sublingual: 'Under tungen (SL)',
};

export function SickBayDashboard() {
  const { eventId } = useAuthStore();
  const addToast = useNotificationStore((s) => s.add);
  const onMessage = useWsStore((s) => s.onMessage);
  const wsSend = useWsStore((s) => s.send);
  const [patients, setPatients] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [showIntake, setShowIntake] = useState(false);
  const [selectedPatient, setSelectedPatient] = useState<string | null>(null);
  type VitalsFormShape = {
    pulse: string; spo2: string; rr: string; pain: string; bp: string; temp: string; acvpu: AcvpuLevel | '';
  };
  const EMPTY_VITALS_FORM: VitalsFormShape = {
    pulse: '', spo2: '', rr: '', pain: '', bp: '', temp: '', acvpu: '',
  };
  // Keyed by patientId so each patient gets its own isolated form state.
  const [vitalsFormMap, setVitalsFormMap] = useState<Record<string, VitalsFormShape>>({});
  const getVitalsForm = (patientId: string): VitalsFormShape =>
    vitalsFormMap[patientId] ?? EMPTY_VITALS_FORM;
  const setPatientVitalsForm = (patientId: string, updater: (prev: VitalsFormShape) => VitalsFormShape) =>
    setVitalsFormMap((prev) => ({ ...prev, [patientId]: updater(prev[patientId] ?? EMPTY_VITALS_FORM) }));
  const clearPatientVitalsForm = (patientId: string) =>
    setVitalsFormMap((prev) => { const next = { ...prev }; delete next[patientId]; return next; });
  const [intakeForm, setIntakeForm] = useState({
    ageGroup: 'adult', presentingComplaint: '', assignedClinician: '',
  });

  // SBAR handover state
  const [sbarPatient, setSbarPatient] = useState<any | null>(null);
  const [sbarForm, setSbarForm] = useState({
    situation: '',
    background: '',
    assessment: '',
    recommendation: '',
    // AMK fields (Issue 4)
    amkTidspunkt: '',
    amkReferanse: '',
    amkEta: '',
    amkFølger: '',
  });

  // Note state (Issue 3)
  const [notePatientId, setNotePatientId] = useState<string | null>(null);
  const [noteForm, setNoteForm] = useState({ text: '', author: '' });

  // History timeline toggle
  const [showHistoryFor, setShowHistoryFor] = useState<Set<string>>(new Set());
  const toggleHistory = (patientId: string) =>
    setShowHistoryFor((prev) => {
      const next = new Set(prev);
      if (next.has(patientId)) next.delete(patientId);
      else next.add(patientId);
      return next;
    });

  const handleAddNote = async (patientId: string) => {
    if (!noteForm.text.trim()) return;
    await api.addPatientNote(patientId, noteForm.text.trim(), noteForm.author.trim() || 'Ukjent');
    setNoteForm({ text: '', author: '' });
    setNotePatientId(null);
    fetchPatients();
  };

  // Medication state
  const [medPatientId, setMedPatientId] = useState<string | null>(null);
  const [medForm, setMedForm] = useState({ drug: 'oxygen', dose: '', route: 'inhaled', givenBy: '' });
  const [medications, setMedications] = useState<Record<string, any[]>>({}); // keyed by patientId

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
        const { patientId, vitals } = (msg.payload as any) ?? {};
        if (patientId && vitals) {
          setPatients((prev) =>
            prev.map((p) =>
              p.id === patientId
                ? { ...p, latestVitals: vitals, vitalsHistory: [vitals, ...(p.vitalsHistory ?? [])] }
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

  const scheduleMonitoringReminder = (patient: any, result: News2Result) => {
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

  const handleStatusChange = async (patientId: string, status: string, patient?: any) => {
    // Require SBAR before transferring
    if (status === 'transferred' && patient) {
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
      return; // Show SBAR modal first
    }
    await api.updatePatient(patientId, { status });
    fetchPatients();
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
    await api.updatePatient(sbarPatient.id, { status: 'transferred' });
    setSbarPatient(null);
    setSbarForm({ situation: '', background: '', assessment: '', recommendation: '', amkTidspunkt: '', amkReferanse: '', amkEta: '', amkFølger: '' });
    fetchPatients();
  };

  const handleLoadMedications = async (patientId: string) => {
    const { medications: meds } = await api.getMedications(patientId);
    setMedications((prev) => ({ ...prev, [patientId]: meds }));
  };

  const handleRecordMedication = async (patientId: string) => {
    await api.recordMedication(patientId, medForm);
    await handleLoadMedications(patientId);
    setMedForm({ drug: 'oxygen', dose: '', route: 'inhaled', givenBy: '' });
    setMedPatientId(null);
  };

  const handleRecordVitals = async (patient: any) => {
    const vf = getVitalsForm(patient.id);
    const vitalsPayload: Record<string, unknown> = {
      pulse: vf.pulse ? parseInt(vf.pulse) : undefined,
      spo2: vf.spo2 ? parseInt(vf.spo2) : undefined,
      respiratoryRate: vf.rr ? parseInt(vf.rr) : undefined,
      painScore: vf.pain ? parseInt(vf.pain) : undefined,
      systolicBP: vf.bp ? parseInt(vf.bp) : undefined,
      temperature: vf.temp ? parseFloat(vf.temp) : undefined,
      acvpu: vf.acvpu || undefined,
    };

    await api.recordVitals(patient.id, vitalsPayload as Record<string, number | undefined>);

    // Build the new reading in the same shape as vitalsHistory entries
    const newReading = {
      timestamp: new Date().toISOString(),
      respiratoryRate: vf.rr ? parseInt(vf.rr) : undefined,
      spo2: vf.spo2 ? parseInt(vf.spo2) : undefined,
      systolicBP: vf.bp ? parseInt(vf.bp) : undefined,
      pulse: vf.pulse ? parseInt(vf.pulse) : undefined,
      acvpu: (vf.acvpu || undefined) as AcvpuLevel | undefined,
      temperature: vf.temp ? parseFloat(vf.temp) : undefined,
      painScore: vf.pain ? parseInt(vf.pain) : undefined,
    };

    // Calculate NEWS2 from the submitted values and schedule monitoring reminder
    const news2Result = calculateNEWS2(newReading);
    scheduleMonitoringReminder(patient, news2Result);

    // Detect deterioration trend from vitals history
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

    clearPatientVitalsForm(patient.id);
    setSelectedPatient(null);
    fetchPatients();
  };

  return (
    <div className="animate-fade-in">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 'var(--space-4)' }}>
        <h1 style={{ fontSize: 'var(--text-xl)', fontWeight: 700 }}>Sykestue</h1>
        <button onClick={() => setShowIntake(true)} className="touch-target" style={{
          minHeight: 'var(--touch-min)', padding: '0 var(--space-5)', borderRadius: 'var(--radius-md)',
          border: 'none', background: 'var(--color-brand)', color: 'white',
          fontSize: 'var(--text-sm)', fontWeight: 600, cursor: 'pointer',
        }}>
          + Ny pasient
        </button>
      </div>

      {/* Intake modal */}
      {showIntake && (
        <div
          role="dialog"
          aria-label="Registrer ny pasient"
          aria-modal="true"
          style={{
            position: 'fixed', inset: 0, zIndex: 'var(--z-modal)',
            background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center',
            padding: 'var(--space-4)',
          }}
        >
          <div style={{
            background: 'var(--color-surface)', borderRadius: 'var(--radius-lg)',
            padding: 'var(--space-6)', maxWidth: 480, width: '100%',
          }}>
            <h2 style={{ fontSize: 'var(--text-lg)', fontWeight: 700, marginBottom: 'var(--space-4)' }}>
              Ny pasient
            </h2>

            <div style={{ marginBottom: 'var(--space-4)' }}>
              <label htmlFor="ageGroup" style={{ display: 'block', fontSize: 'var(--text-sm)', fontWeight: 500, marginBottom: 'var(--space-1)' }}>
                Aldersgruppe
              </label>
              <select id="ageGroup" value={intakeForm.ageGroup}
                onChange={(e) => setIntakeForm(f => ({ ...f, ageGroup: e.target.value }))}
                style={{
                  width: '100%', height: 'var(--touch-min)', padding: '0 var(--space-3)',
                  borderRadius: 'var(--radius-md)', border: '1px solid var(--color-input-border)',
                  background: 'var(--color-input-bg)', color: 'var(--color-text)', fontSize: 'var(--text-base)',
                }}>
                <option value="child">Barn</option>
                <option value="adolescent">Ungdom</option>
                <option value="adult">Voksen</option>
                <option value="elderly">Eldre</option>
              </select>
            </div>

            <div style={{ marginBottom: 'var(--space-4)' }}>
              <label htmlFor="complaint" style={{ display: 'block', fontSize: 'var(--text-sm)', fontWeight: 500, marginBottom: 'var(--space-1)' }}>
                Problemstilling
              </label>
              <input id="complaint" type="text" value={intakeForm.presentingComplaint}
                onChange={(e) => setIntakeForm(f => ({ ...f, presentingComplaint: e.target.value }))}
                placeholder="Kort beskrivelse..."
                style={{
                  width: '100%', height: 'var(--touch-min)', padding: '0 var(--space-3)',
                  borderRadius: 'var(--radius-md)', border: '1px solid var(--color-input-border)',
                  background: 'var(--color-input-bg)', color: 'var(--color-text)', fontSize: 'var(--text-base)',
                }} />
            </div>

            <div style={{ marginBottom: 'var(--space-6)' }}>
              <label htmlFor="clinician" style={{ display: 'block', fontSize: 'var(--text-sm)', fontWeight: 500, marginBottom: 'var(--space-1)' }}>
                Behandler
              </label>
              <input id="clinician" type="text" value={intakeForm.assignedClinician}
                onChange={(e) => setIntakeForm(f => ({ ...f, assignedClinician: e.target.value }))}
                placeholder="Navn..."
                style={{
                  width: '100%', height: 'var(--touch-min)', padding: '0 var(--space-3)',
                  borderRadius: 'var(--radius-md)', border: '1px solid var(--color-input-border)',
                  background: 'var(--color-input-bg)', color: 'var(--color-text)', fontSize: 'var(--text-base)',
                }} />
            </div>

            <div style={{ display: 'flex', gap: 'var(--space-2)' }}>
              <button onClick={() => setShowIntake(false)} className="touch-target" style={{
                flex: 1, minHeight: 'var(--touch-min)', borderRadius: 'var(--radius-md)',
                border: '1px solid var(--color-border)', background: 'transparent', color: 'var(--color-text)',
                cursor: 'pointer',
              }}>
                Avbryt
              </button>
              <button onClick={handleIntake} className="touch-target" style={{
                flex: 1, minHeight: 'var(--touch-min)', borderRadius: 'var(--radius-md)',
                border: 'none', background: 'var(--color-brand)', color: 'white', fontWeight: 600,
                cursor: 'pointer',
              }}>
                Registrer
              </button>
            </div>
          </div>
        </div>
      )}

      {/* SBAR handover modal */}
      {sbarPatient && (
        <div
          role="dialog"
          aria-label="SBAR-overlevering"
          aria-modal="true"
          style={{
            position: 'fixed', inset: 0, zIndex: 'var(--z-modal)',
            background: 'rgba(0,0,0,0.6)', display: 'flex', alignItems: 'center', justifyContent: 'center',
            padding: 'var(--space-4)',
          }}
        >
          <div style={{
            background: 'var(--color-surface)', borderRadius: 'var(--radius-lg)',
            padding: 'var(--space-6)', maxWidth: 520, width: '100%',
          }}>
            <h2 style={{ fontSize: 'var(--text-lg)', fontWeight: 700, marginBottom: 'var(--space-1)' }}>
              SBAR-overlevering
            </h2>
            <p style={{ fontSize: 'var(--text-sm)', color: 'var(--color-text-subtle)', marginBottom: 'var(--space-4)' }}>
              Alle felt må fylles ut før pasienten kan overføres.
            </p>

            {(['situation', 'background', 'assessment', 'recommendation'] as const).map((field) => {
              const labels = { situation: 'S — Situasjon', background: 'B — Bakgrunn', assessment: 'A — Vurdering', recommendation: 'R — Anbefaling' };
              return (
                <div key={field} style={{ marginBottom: 'var(--space-3)' }}>
                  <label htmlFor={`sbar-${field}`} style={{ display: 'block', fontSize: 'var(--text-sm)', fontWeight: 600, marginBottom: 'var(--space-1)' }}>
                    {labels[field]}
                  </label>
                  <textarea
                    id={`sbar-${field}`}
                    value={sbarForm[field]}
                    onChange={(e) => setSbarForm(f => ({ ...f, [field]: e.target.value }))}
                    rows={2}
                    style={{
                      width: '100%', padding: 'var(--space-2)', borderRadius: 'var(--radius-md)',
                      border: '1px solid var(--color-input-border)', background: 'var(--color-input-bg)',
                      color: 'var(--color-text)', fontSize: 'var(--text-sm)', resize: 'vertical',
                      fontFamily: 'inherit',
                    }}
                  />
                </div>
              );
            })}

            {/* Issue 4: AMK fields */}
            <div style={{ marginTop: 'var(--space-3)', marginBottom: 'var(--space-3)', padding: 'var(--space-3)', background: 'var(--color-surface-sunken)', borderRadius: 'var(--radius-md)' }}>
              <p style={{ fontSize: 'var(--text-xs)', fontWeight: 600, color: 'var(--color-text-subtle)', marginBottom: 'var(--space-2)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                AMK (113) — valgfritt
              </p>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--space-2)' }}>
                <div>
                  <label htmlFor="sbar-amk-tid" style={{ display: 'block', fontSize: 'var(--text-xs)', fontWeight: 500, marginBottom: 'var(--space-1)' }}>
                    Tidspunkt for AMK-samtale
                  </label>
                  <div style={{ display: 'flex', gap: 'var(--space-1)' }}>
                    <input
                      id="sbar-amk-tid"
                      type="text"
                      value={sbarForm.amkTidspunkt}
                      onChange={(e) => setSbarForm(f => ({ ...f, amkTidspunkt: e.target.value }))}
                      style={{ flex: 1, height: 36, padding: '0 var(--space-2)', borderRadius: 'var(--radius-sm)', border: '1px solid var(--color-input-border)', background: 'var(--color-input-bg)', color: 'var(--color-text)', fontSize: 'var(--text-xs)' }}
                    />
                    <button
                      type="button"
                      onClick={() => setSbarForm(f => ({ ...f, amkTidspunkt: new Date().toLocaleTimeString('nb-NO', { hour: '2-digit', minute: '2-digit' }) }))}
                      title="Sett til nå"
                      style={{ height: 36, padding: '0 var(--space-2)', borderRadius: 'var(--radius-sm)', border: '1px solid var(--color-input-border)', background: 'var(--color-surface)', color: 'var(--color-text-muted)', fontSize: 'var(--text-xs)', cursor: 'pointer', whiteSpace: 'nowrap' }}
                    >
                      Nå
                    </button>
                  </div>
                </div>
                <div>
                  <label htmlFor="sbar-amk-ref" style={{ display: 'block', fontSize: 'var(--text-xs)', fontWeight: 500, marginBottom: 'var(--space-1)' }}>
                    Ambulansenummer / AMK-referanse
                  </label>
                  <input
                    id="sbar-amk-ref"
                    type="text"
                    value={sbarForm.amkReferanse}
                    placeholder="f.eks. AMB-42"
                    onChange={(e) => setSbarForm(f => ({ ...f, amkReferanse: e.target.value }))}
                    style={{ width: '100%', height: 36, padding: '0 var(--space-2)', borderRadius: 'var(--radius-sm)', border: '1px solid var(--color-input-border)', background: 'var(--color-input-bg)', color: 'var(--color-text)', fontSize: 'var(--text-xs)' }}
                  />
                </div>
                <div>
                  <label htmlFor="sbar-amk-eta" style={{ display: 'block', fontSize: 'var(--text-xs)', fontWeight: 500, marginBottom: 'var(--space-1)' }}>
                    Forventet ankomsttid (ETA)
                  </label>
                  <input
                    id="sbar-amk-eta"
                    type="text"
                    value={sbarForm.amkEta}
                    placeholder="f.eks. 14:35"
                    onChange={(e) => setSbarForm(f => ({ ...f, amkEta: e.target.value }))}
                    style={{ width: '100%', height: 36, padding: '0 var(--space-2)', borderRadius: 'var(--radius-sm)', border: '1px solid var(--color-input-border)', background: 'var(--color-input-bg)', color: 'var(--color-text)', fontSize: 'var(--text-xs)' }}
                  />
                </div>
                <div>
                  <label htmlFor="sbar-amk-følger" style={{ display: 'block', fontSize: 'var(--text-xs)', fontWeight: 500, marginBottom: 'var(--space-1)' }}>
                    Hvem følger pasienten
                  </label>
                  <input
                    id="sbar-amk-følger"
                    type="text"
                    value={sbarForm.amkFølger}
                    placeholder="Navn / funksjon"
                    onChange={(e) => setSbarForm(f => ({ ...f, amkFølger: e.target.value }))}
                    style={{ width: '100%', height: 36, padding: '0 var(--space-2)', borderRadius: 'var(--radius-sm)', border: '1px solid var(--color-input-border)', background: 'var(--color-input-bg)', color: 'var(--color-text)', fontSize: 'var(--text-xs)' }}
                  />
                </div>
              </div>
            </div>

            <div style={{ display: 'flex', gap: 'var(--space-2)' }}>
              <button onClick={() => setSbarPatient(null)} className="touch-target" style={{
                flex: 1, minHeight: 'var(--touch-min)', borderRadius: 'var(--radius-md)',
                border: '1px solid var(--color-border)', background: 'transparent', color: 'var(--color-text)', cursor: 'pointer',
              }}>
                Avbryt
              </button>
              <button
                onClick={handleSbarSubmit}
                disabled={!sbarForm.situation || !sbarForm.background || !sbarForm.assessment || !sbarForm.recommendation}
                className="touch-target"
                style={{
                  flex: 1, minHeight: 'var(--touch-min)', borderRadius: 'var(--radius-md)',
                  border: 'none', background: 'var(--color-status-critical)', color: 'white',
                  fontWeight: 600, cursor: 'pointer', opacity: (!sbarForm.situation || !sbarForm.background || !sbarForm.assessment || !sbarForm.recommendation) ? 0.5 : 1,
                }}
              >
                Bekreft overføring
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Patient list */}
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
          {[...patients].sort((a, b) => {
            const order: Record<string, number> = { high: 0, medium: 1, low: 2, routine: 3 };
            const aLevel = a.latestVitals ? calculateNEWS2(a.latestVitals).alertLevel : 'none';
            const bLevel = b.latestVitals ? calculateNEWS2(b.latestVitals).alertLevel : 'none';
            const aRank = aLevel === 'none' ? 4 : (order[aLevel] ?? 4);
            const bRank = bLevel === 'none' ? 4 : (order[bLevel] ?? 4);
            return aRank - bRank;
          }).map((patient) => {
            const sc = statusColors[patient.status] || { color: 'var(--color-text-subtle)', bg: 'var(--color-surface-sunken)' };
            const news2 = patient.latestVitals ? calculateNEWS2(patient.latestVitals) : null;
            const n2colors = news2 ? news2Colors[news2.alertLevel] : null;
            // Identify which NEWS2 sub-scores are null (parameter not recorded).
            // Used to render a "lower bound" warning next to the badge.
            const news2MissingLabels: string[] = news2 ? ([
              ['respiratoryRate', 'RF'],
              ['spo2', 'SpO₂'],
              ['systolicBP', 'BT'],
              ['pulse', 'Puls'],
              ['consciousness', 'Bevissthet'],
              ['temperature', 'Temp'],
            ] as [keyof News2Result['scores'], string][])
              .filter(([key]) => news2.scores[key] === null)
              .map(([, label]) => label) : [];
            const trend = patient.vitalsHistory?.length >= 2 ? calculateNEWS2Trend(patient.vitalsHistory) : null;
            const trendArrow = trend?.direction === 'rising' ? '↑' : trend?.direction === 'falling' ? '↓' : trend ? '→' : null;
            const trendColor = trend?.direction === 'rising' ? 'var(--color-status-critical)' : trend?.direction === 'falling' ? 'var(--color-status-ok)' : 'var(--color-text-subtle)';

            return (
              <article
                key={patient.id}
                aria-label={`Pasient ${patient.ageGroup ? ageLabels[patient.ageGroup] : ''}`}
                style={{
                  padding: 'var(--space-4)', borderRadius: 'var(--radius-md)',
                  border: '1px solid var(--color-border)', background: 'var(--color-surface)',
                }}
              >
                {/* Header row */}
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 'var(--space-3)', flexWrap: 'wrap', gap: 'var(--space-2)' }}>
                  <div>
                    <span style={{ fontWeight: 600 }}>{patient.presentingComplaint || 'Ukjent problemstilling'}</span>
                    <span style={{ fontFamily: 'var(--font-mono)', fontSize: 'var(--text-xs)', color: 'var(--color-text-subtle)', marginLeft: 'var(--space-2)' }}>
                      {ageLabels[patient.ageGroup] || ''}
                    </span>
                  </div>
                  <div style={{ display: 'flex', gap: 'var(--space-2)', alignItems: 'center' }}>
                    {/* NEWS2 badge + trend arrow */}
                    {news2 && n2colors && (
                      <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                        <span style={{ display: 'inline-flex', flexDirection: 'column', alignItems: 'flex-end', gap: 2 }}>
                          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                            <span
                              aria-label={`${news2BadgeLabel(news2)}${news2MissingLabels.length > 0 ? ' (ufullstendig score)' : ''}: ${news2MonitoringLabel(news2)}`}
                              style={{
                                fontFamily: 'var(--font-mono)', fontSize: 'var(--text-xs)', fontWeight: 700,
                                padding: '2px 8px', borderRadius: 'var(--radius-full)',
                                background: n2colors.bg, color: n2colors.color,
                              }}
                            >
                              {news2BadgeLabel(news2)}{news2MissingLabels.length > 0 ? '*' : ''}
                            </span>
                            {trendArrow && (
                              <span
                                aria-label={`Trend: ${trend?.direction}`}
                                style={{ fontWeight: 700, fontSize: 'var(--text-sm)', color: trendColor }}
                              >
                                {trendArrow}
                              </span>
                            )}
                          </span>
                          {news2MissingLabels.length > 0 && (
                            <span style={{
                              fontSize: 'var(--text-xs)', fontFamily: 'var(--font-mono)',
                              color: 'var(--color-text-subtle)', fontStyle: 'italic',
                            }}>
                              * {news2MissingLabels.join(', ')} ikke målt
                            </span>
                          )}
                          {/* Issue 6: monitoring interval visible on card, not only as tooltip */}
                          <span style={{
                            fontSize: 'var(--text-xs)', fontFamily: 'var(--font-mono)',
                            color: n2colors.color,
                          }}>
                            {news2MonitoringLabel(news2)}
                          </span>
                        </span>
                      </span>
                    )}
                    {/* Status badge */}
                    <span style={{
                      fontFamily: 'var(--font-mono)', fontSize: 'var(--text-xs)',
                      padding: '2px 8px', borderRadius: 'var(--radius-full)',
                      background: sc.bg, color: sc.color,
                    }}>
                      {statusLabels[patient.status] || patient.status}
                    </span>
                  </div>
                </div>

                {/* Latest vitals display — responsive wrap */}
                {patient.latestVitals && (
                  <div style={{
                    display: 'grid',
                    gridTemplateColumns: 'repeat(auto-fit, minmax(80px, 1fr))',
                    gap: 'var(--space-2)',
                    marginBottom: 'var(--space-3)',
                  }}>
                    {[
                      { label: 'Puls', value: patient.latestVitals.pulse, unit: 'bpm' },
                      { label: 'SpO₂', value: patient.latestVitals.spo2, unit: '%' },
                      { label: 'RF', value: patient.latestVitals.respiratoryRate, unit: '/min' },
                      { label: 'BT', value: patient.latestVitals.systolicBP, unit: 'mmHg' },
                      { label: 'Temp', value: patient.latestVitals.temperature, unit: '°C' },
                      { label: 'Smerte', value: patient.latestVitals.painScore, unit: '/10' },
                    ].map((v) => v.value != null && (
                      <div key={v.label} style={{
                        textAlign: 'center', padding: 'var(--space-2)',
                        background: 'var(--color-surface-sunken)', borderRadius: 'var(--radius-sm)',
                      }}>
                        <div style={{ fontFamily: 'var(--font-mono)', fontSize: 'var(--text-xs)', color: 'var(--color-text-subtle)' }}>
                          {v.label}
                        </div>
                        <div style={{ fontFamily: 'var(--font-mono)', fontSize: 'var(--text-lg)', fontWeight: 700 }}>
                          {v.value}<span style={{ fontSize: 'var(--text-xs)', color: 'var(--color-text-muted)' }}>{v.unit}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                )}

                {/* Actions */}
                <div style={{ display: 'flex', gap: 'var(--space-2)', flexWrap: 'wrap' }}>
                  <button onClick={() => setSelectedPatient(selectedPatient === patient.id ? null : patient.id)}
                    className="touch-target" style={{
                      minHeight: 40, padding: '0 var(--space-3)', borderRadius: 'var(--radius-sm)',
                      border: '1px solid var(--color-border)', background: 'transparent',
                      fontSize: 'var(--text-xs)', fontFamily: 'var(--font-mono)', color: 'var(--color-text-muted)', cursor: 'pointer',
                    }}>
                    {selectedPatient === patient.id ? '✕ Lukk' : '+ Vitale tegn'}
                  </button>
                  <button onClick={() => { setMedPatientId(medPatientId === patient.id ? null : patient.id); if (medPatientId !== patient.id) handleLoadMedications(patient.id); }}
                    className="touch-target" style={{
                      minHeight: 40, padding: '0 var(--space-3)', borderRadius: 'var(--radius-sm)',
                      border: '1px solid var(--color-border)', background: 'transparent',
                      fontSize: 'var(--text-xs)', fontFamily: 'var(--font-mono)', color: 'var(--color-text-muted)', cursor: 'pointer',
                    }}>
                    {medPatientId === patient.id ? '✕ Lukk' : '+ Medikament'}
                  </button>
                  {/* Issue 3: direct note-adding */}
                  <button
                    onClick={() => {
                      if (notePatientId === patient.id) {
                        setNotePatientId(null);
                        setNoteForm({ text: '', author: '' });
                      } else {
                        setNotePatientId(patient.id);
                        setNoteForm({ text: '', author: '' });
                      }
                    }}
                    className="touch-target"
                    style={{
                      minHeight: 40, padding: '0 var(--space-3)', borderRadius: 'var(--radius-sm)',
                      border: '1px solid var(--color-border)', background: 'transparent',
                      fontSize: 'var(--text-xs)', fontFamily: 'var(--font-mono)', color: 'var(--color-text-muted)', cursor: 'pointer',
                    }}
                  >
                    {notePatientId === patient.id ? '✕ Lukk' : '+ Notat'}
                  </button>
                  <button
                    onClick={() => { toggleHistory(patient.id); if (medPatientId !== patient.id) handleLoadMedications(patient.id); }}
                    className="touch-target"
                    style={{
                      minHeight: 40, padding: '0 var(--space-3)', borderRadius: 'var(--radius-sm)',
                      border: `1px solid ${showHistoryFor.has(patient.id) ? 'var(--color-brand)' : 'var(--color-border)'}`,
                      background: showHistoryFor.has(patient.id) ? 'var(--color-brand-dim)' : 'transparent',
                      fontSize: 'var(--text-xs)', fontFamily: 'var(--font-mono)', color: 'var(--color-text-muted)', cursor: 'pointer',
                    }}
                  >
                    Logg
                  </button>
                  {patient.status !== 'discharged' && patient.status !== 'transferred' && (
                    <button onClick={() => handleStatusChange(patient.id, 'discharged')}
                      className="touch-target" style={{
                        minHeight: 40, padding: '0 var(--space-3)', borderRadius: 'var(--radius-sm)',
                        border: '1px solid var(--color-border)', background: 'transparent',
                        fontSize: 'var(--text-xs)', fontFamily: 'var(--font-mono)', color: 'var(--color-status-ok)', cursor: 'pointer',
                      }}>
                      Skriv ut
                    </button>
                  )}
                  {patient.status !== 'discharged' && patient.status !== 'transferred' && (
                    <button onClick={() => handleStatusChange(patient.id, 'transferred', patient)}
                      className="touch-target" style={{
                        minHeight: 40, padding: '0 var(--space-3)', borderRadius: 'var(--radius-sm)',
                        border: '1px solid var(--color-status-critical)', background: 'transparent',
                        fontSize: 'var(--text-xs)', fontFamily: 'var(--font-mono)', color: 'var(--color-status-critical)', cursor: 'pointer',
                      }}>
                      Overfør
                    </button>
                  )}
                </div>

                {/* Medication panel (inline) */}
                {medPatientId === patient.id && (
                  <div style={{
                    marginTop: 'var(--space-3)', padding: 'var(--space-3)',
                    background: 'var(--color-surface-sunken)', borderRadius: 'var(--radius-md)',
                  }}>
                    <h4 style={{ fontSize: 'var(--text-sm)', fontWeight: 600, marginBottom: 'var(--space-2)' }}>Medikamentlogg</h4>

                    {/* Existing medication records */}
                    {(medications[patient.id] ?? []).length > 0 && (
                      <div style={{ marginBottom: 'var(--space-3)' }}>
                        {(medications[patient.id] ?? []).map((med: any, i: number) => (
                          <div key={i} style={{
                            display: 'flex', gap: 'var(--space-2)', fontSize: 'var(--text-xs)',
                            fontFamily: 'var(--font-mono)', color: 'var(--color-text-subtle)',
                            padding: 'var(--space-1) 0', borderBottom: '1px solid var(--color-border)',
                          }}>
                            <span style={{ color: 'var(--color-text)', fontWeight: 600 }}>{med.drug}</span>
                            {med.dose && <span>{med.dose}</span>}
                            {med.route && <span>({routeLabels[med.route] ?? med.route})</span>}
                            {med.givenBy && <span>— {med.givenBy}</span>}
                            <span style={{ marginLeft: 'auto' }}>{new Date(med.givenAt).toLocaleTimeString('nb-NO', { hour: '2-digit', minute: '2-digit' })}</span>
                          </div>
                        ))}
                      </div>
                    )}

                    {/* New medication form */}
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--space-2)', marginBottom: 'var(--space-2)' }}>
                      <div>
                        <label htmlFor={`med-drug-${patient.id}`} style={{ fontSize: 'var(--text-xs)', color: 'var(--color-text-subtle)' }}>Medikament</label>
                        <select id={`med-drug-${patient.id}`} value={medForm.drug}
                          onChange={(e) => setMedForm(f => ({ ...f, drug: e.target.value }))}
                          style={{ width: '100%', height: 36, borderRadius: 'var(--radius-sm)', border: '1px solid var(--color-input-border)', background: 'var(--color-input-bg)', color: 'var(--color-text)', fontSize: 'var(--text-xs)' }}>
                          {['oxygen', 'aspirin', 'gtn', 'morfin', 'nalokson', 'glukose', 'adrenalin', 'annet'].map(d => (
                            <option key={d} value={d}>{d.charAt(0).toUpperCase() + d.slice(1)}</option>
                          ))}
                        </select>
                      </div>
                      <div>
                        <label htmlFor={`med-route-${patient.id}`} style={{ fontSize: 'var(--text-xs)', color: 'var(--color-text-subtle)' }}>Administrasjonsvei</label>
                        <select id={`med-route-${patient.id}`} value={medForm.route}
                          onChange={(e) => setMedForm(f => ({ ...f, route: e.target.value }))}
                          style={{ width: '100%', height: 36, borderRadius: 'var(--radius-sm)', border: '1px solid var(--color-input-border)', background: 'var(--color-input-bg)', color: 'var(--color-text)', fontSize: 'var(--text-xs)' }}>
                          {(Object.keys(routeLabels) as Array<keyof typeof routeLabels>).map(r => (
                            <option key={r} value={r}>{routeLabels[r]}</option>
                          ))}
                        </select>
                      </div>
                      <div>
                        <label htmlFor={`med-dose-${patient.id}`} style={{ fontSize: 'var(--text-xs)', color: 'var(--color-text-subtle)' }}>Dose</label>
                        <input id={`med-dose-${patient.id}`} type="text" value={medForm.dose} placeholder="f.eks. 5 mg"
                          onChange={(e) => setMedForm(f => ({ ...f, dose: e.target.value }))}
                          style={{ width: '100%', height: 36, padding: '0 var(--space-2)', borderRadius: 'var(--radius-sm)', border: '1px solid var(--color-input-border)', background: 'var(--color-input-bg)', color: 'var(--color-text)', fontSize: 'var(--text-xs)' }} />
                      </div>
                      <div>
                        <label htmlFor={`med-by-${patient.id}`} style={{ fontSize: 'var(--text-xs)', color: 'var(--color-text-subtle)' }}>Gitt av</label>
                        <input id={`med-by-${patient.id}`} type="text" value={medForm.givenBy} placeholder="Navn"
                          onChange={(e) => setMedForm(f => ({ ...f, givenBy: e.target.value }))}
                          style={{ width: '100%', height: 36, padding: '0 var(--space-2)', borderRadius: 'var(--radius-sm)', border: '1px solid var(--color-input-border)', background: 'var(--color-input-bg)', color: 'var(--color-text)', fontSize: 'var(--text-xs)' }} />
                      </div>
                    </div>
                    <button onClick={() => handleRecordMedication(patient.id)} style={{
                      width: '100%', minHeight: 36, borderRadius: 'var(--radius-sm)',
                      border: 'none', background: 'var(--color-brand)', color: 'white',
                      fontSize: 'var(--text-xs)', fontWeight: 600, cursor: 'pointer',
                    }}>
                      Registrer medikament
                    </button>
                  </div>
                )}

                {/* Note panel (Issue 3) */}
                {notePatientId === patient.id && (
                  <div style={{
                    marginTop: 'var(--space-3)', padding: 'var(--space-3)',
                    background: 'var(--color-surface-sunken)', borderRadius: 'var(--radius-md)',
                  }}>
                    <h4 style={{ fontSize: 'var(--text-sm)', fontWeight: 600, marginBottom: 'var(--space-2)' }}>Nytt notat</h4>
                    <div style={{ marginBottom: 'var(--space-2)' }}>
                      <label htmlFor={`note-author-${patient.id}`} style={{ fontSize: 'var(--text-xs)', color: 'var(--color-text-subtle)' }}>
                        Forfatter
                      </label>
                      <input
                        id={`note-author-${patient.id}`}
                        type="text"
                        value={noteForm.author}
                        placeholder="Navn (valgfritt)"
                        onChange={(e) => setNoteForm((f) => ({ ...f, author: e.target.value }))}
                        style={{
                          width: '100%', height: 36, padding: '0 var(--space-2)',
                          borderRadius: 'var(--radius-sm)', border: '1px solid var(--color-input-border)',
                          background: 'var(--color-input-bg)', color: 'var(--color-text)', fontSize: 'var(--text-xs)',
                        }}
                      />
                    </div>
                    <div style={{ marginBottom: 'var(--space-2)' }}>
                      <label htmlFor={`note-text-${patient.id}`} style={{ fontSize: 'var(--text-xs)', color: 'var(--color-text-subtle)' }}>
                        Notat
                      </label>
                      <textarea
                        id={`note-text-${patient.id}`}
                        value={noteForm.text}
                        placeholder="Skriv notat her..."
                        rows={3}
                        onChange={(e) => setNoteForm((f) => ({ ...f, text: e.target.value }))}
                        style={{
                          width: '100%', padding: 'var(--space-2)',
                          borderRadius: 'var(--radius-sm)', border: '1px solid var(--color-input-border)',
                          background: 'var(--color-input-bg)', color: 'var(--color-text)',
                          fontSize: 'var(--text-xs)', resize: 'vertical', fontFamily: 'inherit',
                        }}
                      />
                    </div>
                    <button
                      onClick={() => handleAddNote(patient.id)}
                      disabled={!noteForm.text.trim()}
                      style={{
                        width: '100%', minHeight: 36, borderRadius: 'var(--radius-sm)',
                        border: 'none', background: 'var(--color-brand)', color: 'white',
                        fontSize: 'var(--text-xs)', fontWeight: 600, cursor: 'pointer',
                        opacity: noteForm.text.trim() ? 1 : 0.5,
                      }}
                    >
                      Lagre notat
                    </button>
                  </div>
                )}

                {/* Vitals entry (expanded) */}
                {selectedPatient === patient.id && (
                  <div style={{
                    marginTop: 'var(--space-3)', padding: 'var(--space-3)',
                    background: 'var(--color-surface-sunken)', borderRadius: 'var(--radius-md)',
                  }}>
                    {/* 2×3 grid: Puls, SpO₂, RF / BT, Temp, Smerte */}
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 'var(--space-2)', marginBottom: 'var(--space-3)' }}>
                      {[
                        { key: 'pulse', label: 'Puls', placeholder: 'bpm', inputMode: 'numeric' as const },
                        { key: 'spo2', label: 'SpO₂', placeholder: '%', inputMode: 'numeric' as const },
                        { key: 'rr', label: 'RF', placeholder: '/min', inputMode: 'numeric' as const },
                        { key: 'bp', label: 'Syst. BT', placeholder: 'mmHg', inputMode: 'numeric' as const },
                        { key: 'temp', label: 'Temp', placeholder: '°C', inputMode: 'decimal' as const },
                        { key: 'pain', label: 'Smerte', placeholder: '0-10', inputMode: 'numeric' as const },
                      ].map((f) => (
                        <div key={f.key}>
                          <label htmlFor={`v-${patient.id}-${f.key}`} style={{ fontSize: 'var(--text-xs)', fontFamily: 'var(--font-mono)', color: 'var(--color-text-subtle)' }}>
                            {f.label}
                          </label>
                          <input
                            id={`v-${patient.id}-${f.key}`}
                            type="number"
                            inputMode={f.inputMode}
                            value={getVitalsForm(patient.id)[f.key as keyof VitalsFormShape]}
                            onChange={(e) => setPatientVitalsForm(patient.id, (v) => ({ ...v, [f.key]: e.target.value }))}
                            placeholder={f.placeholder}
                            style={{
                              width: '100%', height: 44, textAlign: 'center',
                              borderRadius: 'var(--radius-sm)', border: '1px solid var(--color-input-border)',
                              background: 'var(--color-input-bg)', color: 'var(--color-text)',
                              fontFamily: 'var(--font-mono)', fontSize: 'var(--text-base)', fontWeight: 600,
                            }} />
                        </div>
                      ))}
                    </div>

                    {/* ACVPU selector */}
                    <fieldset style={{ border: 'none', padding: 0, marginBottom: 'var(--space-3)' }}>
                      <legend style={{ fontSize: 'var(--text-xs)', fontFamily: 'var(--font-mono)', color: 'var(--color-text-subtle)', marginBottom: 'var(--space-1)' }}>
                        Bevissthet (ACVPU)
                      </legend>
                      <div style={{ display: 'flex', gap: 'var(--space-1)', flexWrap: 'wrap' }}>
                        {ACVPU_OPTIONS.map((opt) => (
                          <button
                            key={opt.value}
                            type="button"
                            role="radio"
                            aria-checked={getVitalsForm(patient.id).acvpu === opt.value}
                            onClick={() => setPatientVitalsForm(patient.id, (v) => ({
                              ...v,
                              acvpu: v.acvpu === opt.value ? '' : opt.value,
                            }))}
                            style={{
                              flex: '1 0 auto',
                              minHeight: 36,
                              padding: '0 var(--space-2)',
                              borderRadius: 'var(--radius-sm)',
                              border: `1px solid ${getVitalsForm(patient.id).acvpu === opt.value ? 'var(--color-brand)' : 'var(--color-border)'}`,
                              background: getVitalsForm(patient.id).acvpu === opt.value ? 'var(--color-brand-dim)' : 'transparent',
                              color: 'var(--color-text)',
                              fontFamily: 'var(--font-mono)',
                              fontSize: 'var(--text-xs)',
                              fontWeight: 700,
                              cursor: 'pointer',
                            }}
                          >
                            {opt.short}
                          </button>
                        ))}
                      </div>
                    </fieldset>

                    <button onClick={() => handleRecordVitals(patient)} className="touch-target" style={{
                      width: '100%', minHeight: 40, borderRadius: 'var(--radius-sm)',
                      border: 'none', background: 'var(--color-brand)', color: 'white',
                      fontSize: 'var(--text-sm)', fontWeight: 600, cursor: 'pointer',
                    }}>
                      Lagre vitale tegn
                    </button>
                  </div>
                )}

                {/* Patient history timeline */}
                {showHistoryFor.has(patient.id) && (() => {
                  const vitalsEntries = (patient.vitalsHistory ?? []).map((v: any) => ({
                    type: 'vitals' as const, time: v.timestamp, data: v,
                  }));
                  const noteEntries = (patient.notes ?? []).map((n: any) => ({
                    type: 'note' as const, time: n.createdAt, data: n,
                  }));
                  const medEntries = (medications[patient.id] ?? []).map((m: any) => ({
                    type: 'medication' as const, time: m.givenAt, data: m,
                  }));
                  const timeline = [...vitalsEntries, ...noteEntries, ...medEntries]
                    .sort((a, b) => new Date(b.time).getTime() - new Date(a.time).getTime());
                  return (
                    <div style={{
                      marginTop: 'var(--space-3)', padding: 'var(--space-3)',
                      background: 'var(--color-surface-sunken)', borderRadius: 'var(--radius-md)',
                    }}>
                      <h4 style={{ fontSize: 'var(--text-sm)', fontWeight: 600, marginBottom: 'var(--space-2)' }}>
                        Logg / Historikk
                      </h4>
                      {timeline.length === 0 ? (
                        <p style={{ fontSize: 'var(--text-xs)', color: 'var(--color-text-subtle)' }}>
                          Ingen historikk ennå.
                        </p>
                      ) : timeline.map((entry, i) => {
                        const timeStr = new Date(entry.time).toLocaleTimeString('nb-NO', { hour: '2-digit', minute: '2-digit' });
                        if (entry.type === 'vitals') {
                          const v = entry.data;
                          const n2 = calculateNEWS2(v);
                          const n2c = news2Colors[n2.alertLevel];
                          return (
                            <div key={i} style={{
                              display: 'flex', gap: 'var(--space-2)', alignItems: 'flex-start',
                              padding: 'var(--space-2) 0', borderBottom: '1px solid var(--color-border)',
                            }}>
                              <span style={{ fontFamily: 'var(--font-mono)', fontSize: 'var(--text-xs)', color: 'var(--color-text-subtle)', whiteSpace: 'nowrap', minWidth: 38 }}>{timeStr}</span>
                              <span style={{ fontFamily: 'var(--font-mono)', fontSize: 'var(--text-xs)', fontWeight: 700, padding: '1px 6px', borderRadius: 'var(--radius-full)', background: n2c.bg, color: n2c.color, whiteSpace: 'nowrap' }}>
                                NEWS2 {n2.total}
                              </span>
                              <span style={{ fontFamily: 'var(--font-mono)', fontSize: 'var(--text-xs)', color: 'var(--color-text-subtle)', flexWrap: 'wrap' }}>
                                {[
                                  v.pulse && `Puls ${v.pulse}`,
                                  v.spo2 && `SpO₂ ${v.spo2}%`,
                                  v.respiratoryRate && `RF ${v.respiratoryRate}`,
                                  v.systolicBP && `BT ${v.systolicBP}`,
                                  v.temperature && `Temp ${v.temperature}°C`,
                                  v.acvpu && `ACVPU ${v.acvpu}`,
                                  v.painScore != null && `Smerte ${v.painScore}/10`,
                                ].filter(Boolean).join(' · ')}
                              </span>
                            </div>
                          );
                        }
                        if (entry.type === 'note') {
                          return (
                            <div key={i} style={{
                              display: 'flex', gap: 'var(--space-2)', alignItems: 'flex-start',
                              padding: 'var(--space-2) 0', borderBottom: '1px solid var(--color-border)',
                            }}>
                              <span style={{ fontFamily: 'var(--font-mono)', fontSize: 'var(--text-xs)', color: 'var(--color-text-subtle)', whiteSpace: 'nowrap', minWidth: 38 }}>{timeStr}</span>
                              <div style={{ flex: 1 }}>
                                {entry.data.author && (
                                  <span style={{ fontSize: 'var(--text-xs)', fontWeight: 600, color: 'var(--color-text-subtle)', marginBottom: 2, display: 'block' }}>
                                    {entry.data.author}
                                  </span>
                                )}
                                <span style={{ fontSize: 'var(--text-xs)', color: 'var(--color-text)', whiteSpace: 'pre-wrap' }}>
                                  {entry.data.text}
                                </span>
                              </div>
                            </div>
                          );
                        }
                        if (entry.type === 'medication') {
                          return (
                            <div key={i} style={{
                              display: 'flex', gap: 'var(--space-2)', alignItems: 'center',
                              padding: 'var(--space-2) 0', borderBottom: '1px solid var(--color-border)',
                            }}>
                              <span style={{ fontFamily: 'var(--font-mono)', fontSize: 'var(--text-xs)', color: 'var(--color-text-subtle)', whiteSpace: 'nowrap', minWidth: 38 }}>{timeStr}</span>
                              <span style={{ fontFamily: 'var(--font-mono)', fontSize: 'var(--text-xs)', fontWeight: 700, color: 'var(--color-status-warning)' }}>Rx</span>
                              <span style={{ fontFamily: 'var(--font-mono)', fontSize: 'var(--text-xs)', color: 'var(--color-text)' }}>
                                {entry.data.drug}{entry.data.dose && ` ${entry.data.dose}`}
                                {entry.data.route && ` (${routeLabels[entry.data.route] ?? entry.data.route})`}
                                {entry.data.givenBy && ` — ${entry.data.givenBy}`}
                              </span>
                            </div>
                          );
                        }
                        return null;
                      })}
                    </div>
                  );
                })()}
              </article>
            );
          })}
        </div>
      )}
    </div>
  );
}
