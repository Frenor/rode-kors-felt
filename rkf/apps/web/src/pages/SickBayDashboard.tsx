import { useState, useEffect } from 'react';
import { useAuthStore } from '../stores/auth';
import { useNotificationStore } from '../stores/notifications';
import { useWsStore } from '../stores/ws';
import { api } from '../lib/api';
import {
  calculateNEWS2,
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

export function SickBayDashboard() {
  const { eventId } = useAuthStore();
  const addToast = useNotificationStore((s) => s.add);
  const onMessage = useWsStore((s) => s.onMessage);
  const [patients, setPatients] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [showIntake, setShowIntake] = useState(false);
  const [selectedPatient, setSelectedPatient] = useState<string | null>(null);
  const [vitalsForm, setVitalsForm] = useState({
    pulse: '', spo2: '', rr: '', pain: '', bp: '', temp: '', acvpu: '' as AcvpuLevel | '',
  });
  const [intakeForm, setIntakeForm] = useState({
    ageGroup: 'adult', presentingComplaint: '', assignedClinician: '',
  });

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

  const handleRecordVitals = async (patient: any) => {
    const vf = vitalsForm;
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

    // Calculate NEWS2 from the submitted values and schedule monitoring reminder
    const news2Result = calculateNEWS2({
      respiratoryRate: vf.rr ? parseInt(vf.rr) : undefined,
      spo2: vf.spo2 ? parseInt(vf.spo2) : undefined,
      systolicBP: vf.bp ? parseInt(vf.bp) : undefined,
      pulse: vf.pulse ? parseInt(vf.pulse) : undefined,
      acvpu: (vf.acvpu || undefined) as AcvpuLevel | undefined,
      temperature: vf.temp ? parseFloat(vf.temp) : undefined,
    });
    scheduleMonitoringReminder(patient, news2Result);

    setVitalsForm({ pulse: '', spo2: '', rr: '', pain: '', bp: '', temp: '', acvpu: '' });
    setSelectedPatient(null);
    fetchPatients();
  };

  const handleStatusChange = async (patientId: string, status: string) => {
    await api.updatePatient(patientId, { status });
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
          {patients.map((patient) => {
            const sc = statusColors[patient.status] || { color: 'var(--color-text-subtle)', bg: 'var(--color-surface-sunken)' };
            const news2 = patient.latestVitals ? calculateNEWS2(patient.latestVitals) : null;
            const n2colors = news2 ? news2Colors[news2.alertLevel] : null;

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
                    {/* NEWS2 badge */}
                    {news2 && n2colors && (
                      <span
                        aria-label={`${news2BadgeLabel(news2)}: ${news2MonitoringLabel(news2)}`}
                        title={news2MonitoringLabel(news2)}
                        style={{
                          fontFamily: 'var(--font-mono)', fontSize: 'var(--text-xs)', fontWeight: 700,
                          padding: '2px 8px', borderRadius: 'var(--radius-full)',
                          background: n2colors.bg, color: n2colors.color,
                        }}
                      >
                        {news2BadgeLabel(news2)}
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
                  {patient.status !== 'discharged' && (
                    <button onClick={() => handleStatusChange(patient.id, 'discharged')}
                      className="touch-target" style={{
                        minHeight: 40, padding: '0 var(--space-3)', borderRadius: 'var(--radius-sm)',
                        border: '1px solid var(--color-border)', background: 'transparent',
                        fontSize: 'var(--text-xs)', fontFamily: 'var(--font-mono)', color: 'var(--color-status-ok)', cursor: 'pointer',
                      }}>
                      Skriv ut
                    </button>
                  )}
                </div>

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
                            value={vitalsForm[f.key as keyof typeof vitalsForm]}
                            onChange={(e) => setVitalsForm(v => ({ ...v, [f.key]: e.target.value }))}
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
                            aria-checked={vitalsForm.acvpu === opt.value}
                            onClick={() => setVitalsForm(v => ({
                              ...v,
                              acvpu: v.acvpu === opt.value ? '' : opt.value,
                            }))}
                            style={{
                              flex: '1 0 auto',
                              minHeight: 36,
                              padding: '0 var(--space-2)',
                              borderRadius: 'var(--radius-sm)',
                              border: `1px solid ${vitalsForm.acvpu === opt.value ? 'var(--color-brand)' : 'var(--color-border)'}`,
                              background: vitalsForm.acvpu === opt.value ? 'var(--color-brand-dim)' : 'transparent',
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
              </article>
            );
          })}
        </div>
      )}
    </div>
  );
}
