import { useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useAuthStore } from '../stores/auth';
import { api } from '../lib/api';

type AcvpuLevel = 'alert' | 'confused' | 'voice' | 'pain' | 'unresponsive';
type IncidentType = 'medical' | 'trauma' | 'psychiatric' | 'other';

const ACVPU_OPTIONS: { value: AcvpuLevel; label: string; short: string; color: string; bg: string }[] = [
  { value: 'alert', label: 'Alert — Våken', short: 'A', color: 'var(--color-avpu-alert)', bg: 'var(--color-avpu-alert-bg)' },
  { value: 'confused', label: 'Confused — Forvirret', short: 'C', color: 'var(--color-avpu-confused)', bg: 'var(--color-avpu-confused-bg)' },
  { value: 'voice', label: 'Voice — Reagerer på tiltale', short: 'V', color: 'var(--color-avpu-voice)', bg: 'var(--color-avpu-voice-bg)' },
  { value: 'pain', label: 'Pain — Reagerer på smerte', short: 'P', color: 'var(--color-avpu-pain)', bg: 'var(--color-avpu-pain-bg)' },
  { value: 'unresponsive', label: 'Unresponsive — Reagerer ikke', short: 'U', color: 'var(--color-avpu-unresponsive)', bg: 'var(--color-avpu-unresponsive-bg)' },
];

const INCIDENT_TYPES: { value: IncidentType; label: string }[] = [
  { value: 'medical', label: 'Medisinsk' },
  { value: 'trauma', label: 'Traume' },
  { value: 'psychiatric', label: 'Psykiatrisk' },
  { value: 'other', label: 'Annet' },
];

export function IncidentForm() {
  const navigate = useNavigate();
  const location = useLocation();
  const { eventId } = useAuthStore();
  const { teamId } = (location.state as { teamId?: string }) || {};

  const [step, setStep] = useState(0); // 0=type, 1=AVPU+vitals, 2=MIST, 3=confirm
  const [type, setType] = useState<IncidentType | null>(null);
  const [acvpu, setAcvpu] = useState<AcvpuLevel | null>(null);
  const [vitals, setVitals] = useState({ pulse: '', spo2: '', rr: '', pain: '' });
  const [mist, setMist] = useState({ mechanism: '', injury: '', signs: '', treatment: '' });
  const [notes, setNotes] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async () => {
    if (!type || !eventId) return;
    setSubmitting(true);
    setError('');

    try {
      const payload: Record<string, unknown> = {
        eventId,
        teamId,
        type,
        location: { lat: 59.964, lng: 10.776 }, // MVP: placeholder, replace with GPS
        acvpu,
        clientId: crypto.randomUUID(),
        notes,
      };

      if (vitals.pulse || vitals.spo2 || vitals.rr || vitals.pain) {
        payload.vitals = {
          pulse: vitals.pulse ? parseInt(vitals.pulse) : undefined,
          spo2: vitals.spo2 ? parseInt(vitals.spo2) : undefined,
          respiratoryRate: vitals.rr ? parseInt(vitals.rr) : undefined,
          painScore: vitals.pain ? parseInt(vitals.pain) : undefined,
        };
      }

      if (mist.mechanism || mist.injury || mist.signs || mist.treatment) {
        payload.mist = mist;
      }

      await api.createIncident(payload);
      navigate('/firstaid');
    } catch (err: any) {
      setError(err.message || 'Kunne ikke sende hendelse');
      setSubmitting(false);
    }
  };

  const stepTitles = ['Hendelsestype', 'ABCDE-vurdering', 'MIST-rapport', 'Bekreft og send'];

  return (
    <div className="animate-fade-in">
      {/* Progress */}
      <div style={{ marginBottom: 'var(--space-4)' }}>
        <div style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          marginBottom: 'var(--space-2)',
        }}>
          <h1 style={{ fontSize: 'var(--text-lg)', fontWeight: 700 }}>
            {stepTitles[step]}
          </h1>
          <span style={{
            fontFamily: 'var(--font-mono)',
            fontSize: 'var(--text-xs)',
            color: 'var(--color-text-subtle)',
          }}>
            {step + 1} / {stepTitles.length}
          </span>
        </div>
        <div style={{
          height: 4,
          background: 'var(--color-border)',
          borderRadius: 'var(--radius-full)',
          overflow: 'hidden',
        }}>
          <div style={{
            height: '100%',
            width: `${((step + 1) / stepTitles.length) * 100}%`,
            background: 'var(--color-brand)',
            borderRadius: 'var(--radius-full)',
            transition: 'width var(--duration-normal) var(--ease-default)',
          }} />
        </div>
      </div>

      {/* Step 0: Incident Type */}
      {step === 0 && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-2)' }}>
          {INCIDENT_TYPES.map((t) => (
            <button
              key={t.value}
              onClick={() => { setType(t.value); setStep(1); }}
              className="touch-target"
              style={{
                width: '100%',
                minHeight: 'var(--touch-comfortable)',
                padding: 'var(--space-4)',
                borderRadius: 'var(--radius-md)',
                border: `2px solid ${type === t.value ? 'var(--color-brand)' : 'var(--color-border)'}`,
                background: type === t.value ? 'var(--color-brand-dim)' : 'var(--color-surface)',
                color: 'var(--color-text)',
                fontSize: 'var(--text-base)',
                fontWeight: 600,
                textAlign: 'left',
                cursor: 'pointer',
              }}
            >
              {t.label}
            </button>
          ))}
        </div>
      )}

      {/* Step 1: AVPU + Vitals (ABCDE assessment) */}
      {step === 1 && (
        <div>
          {/* AVPU selector — glove-friendly 56px+ */}
          <fieldset style={{ border: 'none', marginBottom: 'var(--space-6)' }}>
            <legend style={{
              fontSize: 'var(--text-sm)',
              fontWeight: 600,
              marginBottom: 'var(--space-3)',
              color: 'var(--color-text)',
            }}>
              D — Bevissthet (ACVPU)
            </legend>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 'var(--space-2)' }}>
              {ACVPU_OPTIONS.map((opt) => (
                <button
                  key={opt.value}
                  type="button"
                  onClick={() => setAcvpu(opt.value)}
                  role="radio"
                  aria-checked={acvpu === opt.value}
                  className="touch-target"
                  style={{
                    minHeight: 'var(--touch-comfortable)',
                    padding: 'var(--space-3)',
                    borderRadius: 'var(--radius-md)',
                    border: `2px solid ${acvpu === opt.value ? opt.color : 'var(--color-border)'}`,
                    background: acvpu === opt.value ? opt.bg : 'var(--color-surface)',
                    cursor: 'pointer',
                    textAlign: 'center',
                  }}
                >
                  <div style={{
                    fontSize: 'var(--text-2xl)',
                    fontWeight: 700,
                    fontFamily: 'var(--font-mono)',
                    color: opt.color,
                  }}>
                    {opt.short}
                  </div>
                  <div style={{
                    fontSize: 'var(--text-xs)',
                    color: 'var(--color-text-muted)',
                    marginTop: 'var(--space-1)',
                  }}>
                    {opt.label}
                  </div>
                </button>
              ))}
            </div>
          </fieldset>

          {/* Vitals — B (respirasjon) + C (sirkulasjon) */}
          <fieldset style={{ border: 'none', marginBottom: 'var(--space-4)' }}>
            <legend style={{
              fontSize: 'var(--text-sm)',
              fontWeight: 600,
              marginBottom: 'var(--space-3)',
              color: 'var(--color-text)',
            }}>
              Vitale tegn
            </legend>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 'var(--space-3)' }}>
              {[
                { key: 'pulse', label: 'Puls (bpm)', placeholder: 'f.eks. 72', min: 0, max: 300 },
                { key: 'spo2', label: 'SpO₂ (%)', placeholder: 'f.eks. 98', min: 0, max: 100 },
                { key: 'rr', label: 'Pustefrekvens (/min)', placeholder: 'f.eks. 16', min: 0, max: 80 },
                { key: 'pain', label: 'Smerte (0–10)', placeholder: '0–10', min: 0, max: 10 },
              ].map((field) => (
                <div key={field.key}>
                  <label
                    htmlFor={`vital-${field.key}`}
                    style={{
                      display: 'block',
                      fontSize: 'var(--text-xs)',
                      fontFamily: 'var(--font-mono)',
                      color: 'var(--color-text-muted)',
                      marginBottom: 'var(--space-1)',
                    }}
                  >
                    {field.label}
                  </label>
                  <input
                    id={`vital-${field.key}`}
                    type="number"
                    inputMode="numeric"
                    min={field.min}
                    max={field.max}
                    placeholder={field.placeholder}
                    value={vitals[field.key as keyof typeof vitals]}
                    onChange={(e) => setVitals((v) => ({ ...v, [field.key]: e.target.value }))}
                    style={{
                      width: '100%',
                      height: 'var(--touch-min)',
                      padding: '0 var(--space-3)',
                      borderRadius: 'var(--radius-md)',
                      border: '1px solid var(--color-input-border)',
                      background: 'var(--color-input-bg)',
                      color: 'var(--color-text)',
                      fontFamily: 'var(--font-mono)',
                      fontSize: 'var(--text-lg)',
                      fontWeight: 600,
                      textAlign: 'center',
                    }}
                  />
                </div>
              ))}
            </div>
          </fieldset>

          <div style={{ display: 'flex', gap: 'var(--space-2)' }}>
            <button onClick={() => setStep(0)} className="touch-target" style={{
              flex: 1, minHeight: 'var(--touch-min)', borderRadius: 'var(--radius-md)',
              border: '1px solid var(--color-border)', background: 'var(--color-surface)',
              color: 'var(--color-text)', fontSize: 'var(--text-base)', cursor: 'pointer',
            }}>
              ← Tilbake
            </button>
            <button onClick={() => setStep(2)} className="touch-target" style={{
              flex: 2, minHeight: 'var(--touch-min)', borderRadius: 'var(--radius-md)',
              border: 'none', background: 'var(--color-brand)', color: 'white',
              fontSize: 'var(--text-base)', fontWeight: 600, cursor: 'pointer',
            }}>
              Neste: MIST →
            </button>
          </div>
        </div>
      )}

      {/* Step 2: MIST report */}
      {step === 2 && (
        <div>
          {[
            { key: 'mechanism', label: 'M — Mechanism (Skademekanisme)', placeholder: 'Hva skjedde?' },
            { key: 'injury', label: 'I — Injury (Skade)', placeholder: 'Hvilke skader observeres?' },
            { key: 'signs', label: 'S — Signs (Tegn/symptomer)', placeholder: 'Vitale tegn, symptomer...' },
            { key: 'treatment', label: 'T — Treatment (Behandling gitt)', placeholder: 'Hva er gjort?' },
          ].map((field) => (
            <div key={field.key} style={{ marginBottom: 'var(--space-4)' }}>
              <label
                htmlFor={`mist-${field.key}`}
                style={{
                  display: 'block',
                  fontSize: 'var(--text-sm)',
                  fontWeight: 600,
                  marginBottom: 'var(--space-1)',
                  color: 'var(--color-text)',
                }}
              >
                {field.label}
              </label>
              <textarea
                id={`mist-${field.key}`}
                value={mist[field.key as keyof typeof mist]}
                onChange={(e) => setMist((m) => ({ ...m, [field.key]: e.target.value }))}
                placeholder={field.placeholder}
                rows={2}
                style={{
                  width: '100%',
                  padding: 'var(--space-3)',
                  borderRadius: 'var(--radius-md)',
                  border: '1px solid var(--color-input-border)',
                  background: 'var(--color-input-bg)',
                  color: 'var(--color-text)',
                  fontFamily: 'var(--font-sans)',
                  fontSize: 'var(--text-base)',
                  resize: 'vertical',
                  minHeight: 'var(--touch-comfortable)',
                }}
              />
            </div>
          ))}

          {/* Free-text notes */}
          <div style={{ marginBottom: 'var(--space-4)' }}>
            <label htmlFor="notes" style={{
              display: 'block', fontSize: 'var(--text-sm)', fontWeight: 600,
              marginBottom: 'var(--space-1)', color: 'var(--color-text)',
            }}>
              Tilleggsnotater
            </label>
            <textarea
              id="notes"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Annen relevant informasjon..."
              rows={2}
              style={{
                width: '100%', padding: 'var(--space-3)', borderRadius: 'var(--radius-md)',
                border: '1px solid var(--color-input-border)', background: 'var(--color-input-bg)',
                color: 'var(--color-text)', fontFamily: 'var(--font-sans)',
                fontSize: 'var(--text-base)', resize: 'vertical',
              }}
            />
          </div>

          <div style={{ display: 'flex', gap: 'var(--space-2)' }}>
            <button onClick={() => setStep(1)} className="touch-target" style={{
              flex: 1, minHeight: 'var(--touch-min)', borderRadius: 'var(--radius-md)',
              border: '1px solid var(--color-border)', background: 'var(--color-surface)',
              color: 'var(--color-text)', fontSize: 'var(--text-base)', cursor: 'pointer',
            }}>
              ← Tilbake
            </button>
            <button onClick={() => setStep(3)} className="touch-target" style={{
              flex: 2, minHeight: 'var(--touch-min)', borderRadius: 'var(--radius-md)',
              border: 'none', background: 'var(--color-brand)', color: 'white',
              fontSize: 'var(--text-base)', fontWeight: 600, cursor: 'pointer',
            }}>
              Forhåndsvis →
            </button>
          </div>
        </div>
      )}

      {/* Step 3: Confirm and submit */}
      {step === 3 && (
        <div>
          <div style={{
            padding: 'var(--space-4)', borderRadius: 'var(--radius-md)',
            border: '1px solid var(--color-border)', background: 'var(--color-surface)',
            marginBottom: 'var(--space-4)',
          }}>
            <div style={{ display: 'grid', gap: 'var(--space-3)' }}>
              <div>
                <span style={{ fontSize: 'var(--text-xs)', fontFamily: 'var(--font-mono)', color: 'var(--color-text-subtle)' }}>TYPE</span>
                <div style={{ fontWeight: 600 }}>{INCIDENT_TYPES.find(t => t.value === type)?.label}</div>
              </div>
              {acvpu && (
                <div>
                  <span style={{ fontSize: 'var(--text-xs)', fontFamily: 'var(--font-mono)', color: 'var(--color-text-subtle)' }}>ACVPU</span>
                  <div style={{ fontWeight: 600, color: ACVPU_OPTIONS.find(a => a.value === acvpu)?.color }}>
                    {ACVPU_OPTIONS.find(a => a.value === acvpu)?.label}
                  </div>
                </div>
              )}
              {(vitals.pulse || vitals.spo2 || vitals.rr || vitals.pain) && (
                <div>
                  <span style={{ fontSize: 'var(--text-xs)', fontFamily: 'var(--font-mono)', color: 'var(--color-text-subtle)' }}>VITALE TEGN</span>
                  <div style={{ fontFamily: 'var(--font-mono)', fontSize: 'var(--text-sm)' }}>
                    {vitals.pulse && `Puls: ${vitals.pulse} `}
                    {vitals.spo2 && `SpO₂: ${vitals.spo2}% `}
                    {vitals.rr && `RF: ${vitals.rr}/min `}
                    {vitals.pain && `Smerte: ${vitals.pain}/10`}
                  </div>
                </div>
              )}
              {(mist.mechanism || mist.injury || mist.signs || mist.treatment) && (
                <div>
                  <span style={{ fontSize: 'var(--text-xs)', fontFamily: 'var(--font-mono)', color: 'var(--color-text-subtle)' }}>MIST</span>
                  <div style={{ fontSize: 'var(--text-sm)', lineHeight: 'var(--leading-relaxed)' }}>
                    {mist.mechanism && <div><strong>M:</strong> {mist.mechanism}</div>}
                    {mist.injury && <div><strong>I:</strong> {mist.injury}</div>}
                    {mist.signs && <div><strong>S:</strong> {mist.signs}</div>}
                    {mist.treatment && <div><strong>T:</strong> {mist.treatment}</div>}
                  </div>
                </div>
              )}
            </div>
          </div>

          {error && (
            <div role="alert" style={{
              color: 'var(--color-status-critical)', fontSize: 'var(--text-sm)',
              marginBottom: 'var(--space-4)',
            }}>
              {error}
            </div>
          )}

          <div style={{ display: 'flex', gap: 'var(--space-2)' }}>
            <button onClick={() => setStep(2)} className="touch-target" style={{
              flex: 1, minHeight: 'var(--touch-min)', borderRadius: 'var(--radius-md)',
              border: '1px solid var(--color-border)', background: 'var(--color-surface)',
              color: 'var(--color-text)', fontSize: 'var(--text-base)', cursor: 'pointer',
            }}>
              ← Rediger
            </button>
            <button onClick={handleSubmit} disabled={submitting} className="touch-target" style={{
              flex: 2, minHeight: 'var(--touch-min)', borderRadius: 'var(--radius-md)',
              border: 'none', background: 'var(--color-brand)', color: 'white',
              fontSize: 'var(--text-base)', fontWeight: 700, cursor: submitting ? 'not-allowed' : 'pointer',
            }}>
              {submitting ? 'Sender...' : '✓ Send hendelse'}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
