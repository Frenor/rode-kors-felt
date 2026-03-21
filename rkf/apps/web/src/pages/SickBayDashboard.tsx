import { useState, useEffect } from 'react';
import { useAuthStore } from '../stores/auth';
import { api } from '../lib/api';

export function SickBayDashboard() {
  const { eventId } = useAuthStore();
  const [patients, setPatients] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [showIntake, setShowIntake] = useState(false);
  const [selectedPatient, setSelectedPatient] = useState<string | null>(null);
  const [vitalsForm, setVitalsForm] = useState({ pulse: '', spo2: '', rr: '', pain: '' });
  const [intakeForm, setIntakeForm] = useState({ ageGroup: 'adult', presentingComplaint: '', assignedClinician: '' });

  const fetchPatients = () => {
    if (!eventId) return;
    api.getPatients(eventId).then((res) => {
      setPatients(res.patients);
      setLoading(false);
    }).catch(() => setLoading(false));
  };

  useEffect(() => {
    fetchPatients();
    const iv = setInterval(fetchPatients, 15000);
    return () => clearInterval(iv);
  }, [eventId]);

  const handleIntake = async () => {
    if (!eventId) return;
    await api.createPatient({ eventId, ...intakeForm });
    setShowIntake(false);
    setIntakeForm({ ageGroup: 'adult', presentingComplaint: '', assignedClinician: '' });
    fetchPatients();
  };

  const handleRecordVitals = async (patientId: string) => {
    await api.recordVitals(patientId, {
      pulse: vitalsForm.pulse ? parseInt(vitalsForm.pulse) : undefined,
      spo2: vitalsForm.spo2 ? parseInt(vitalsForm.spo2) : undefined,
      respiratoryRate: vitalsForm.rr ? parseInt(vitalsForm.rr) : undefined,
      painScore: vitalsForm.pain ? parseInt(vitalsForm.pain) : undefined,
    });
    setVitalsForm({ pulse: '', spo2: '', rr: '', pain: '' });
    setSelectedPatient(null);
    fetchPatients();
  };

  const handleStatusChange = async (patientId: string, status: string) => {
    await api.updatePatient(patientId, { status });
    fetchPatients();
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

  const ageLabels: Record<string, string> = { child: 'Barn', adolescent: 'Ungdom', adult: 'Voksen', elderly: 'Eldre' };

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
            return (
              <article
                key={patient.id}
                aria-label={`Pasient ${patient.ageGroup ? ageLabels[patient.ageGroup] : ''}`}
                style={{
                  padding: 'var(--space-4)', borderRadius: 'var(--radius-md)',
                  border: '1px solid var(--color-border)', background: 'var(--color-surface)',
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 'var(--space-3)' }}>
                  <div>
                    <span style={{ fontWeight: 600 }}>{patient.presentingComplaint || 'Ukjent problemstilling'}</span>
                    <span style={{ fontFamily: 'var(--font-mono)', fontSize: 'var(--text-xs)', color: 'var(--color-text-subtle)', marginLeft: 'var(--space-2)' }}>
                      {ageLabels[patient.ageGroup] || ''}
                    </span>
                  </div>
                  <span style={{
                    fontFamily: 'var(--font-mono)', fontSize: 'var(--text-xs)',
                    padding: '2px 8px', borderRadius: 'var(--radius-full)',
                    background: sc.bg, color: sc.color,
                  }}>
                    {statusLabels[patient.status] || patient.status}
                  </span>
                </div>

                {/* Latest vitals */}
                {patient.latestVitals && (
                  <div style={{
                    display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 'var(--space-2)',
                    marginBottom: 'var(--space-3)',
                  }}>
                    {[
                      { label: 'Puls', value: patient.latestVitals.pulse, unit: 'bpm' },
                      { label: 'SpO₂', value: patient.latestVitals.spo2, unit: '%' },
                      { label: 'RF', value: patient.latestVitals.respiratoryRate, unit: '/min' },
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
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 'var(--space-2)', marginBottom: 'var(--space-3)' }}>
                      {[
                        { key: 'pulse', label: 'Puls', placeholder: 'bpm' },
                        { key: 'spo2', label: 'SpO₂', placeholder: '%' },
                        { key: 'rr', label: 'RF', placeholder: '/min' },
                        { key: 'pain', label: 'Smerte', placeholder: '0-10' },
                      ].map((f) => (
                        <div key={f.key}>
                          <label htmlFor={`v-${patient.id}-${f.key}`} style={{ fontSize: 'var(--text-xs)', fontFamily: 'var(--font-mono)', color: 'var(--color-text-subtle)' }}>
                            {f.label}
                          </label>
                          <input id={`v-${patient.id}-${f.key}`} type="number" inputMode="numeric"
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
                    <button onClick={() => handleRecordVitals(patient.id)} className="touch-target" style={{
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
