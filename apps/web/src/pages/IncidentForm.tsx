import React, { useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useAuthStore } from '../stores/auth';
import { useGeolocation } from '../hooks/useGeolocation';
import { api } from '../lib/api';

type AcvpuLevel = 'alert' | 'confused' | 'voice' | 'pain' | 'unresponsive';
type IncidentType = 'medical' | 'trauma' | 'psychiatric' | 'other';
type TriageTag = 'immediate' | 'delayed' | 'minor' | 'expectant';

const TRIAGE_OPTIONS: { value: TriageTag; label: string; color: string; bg: string; border: string }[] = [
  { value: 'immediate', label: 'UMIDDELBAR', color: '#fff', bg: '#cc0000', border: '#aa0000' },
  { value: 'delayed',   label: 'UTSATT',     color: '#111', bg: '#f59e0b', border: '#b45309' },
  { value: 'minor',     label: 'MINDRE',     color: '#fff', bg: '#16a34a', border: '#15803d' },
  { value: 'expectant', label: 'FORVENTET',  color: '#fff', bg: '#374151', border: '#1f2937' },
];

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

// ─── MIST chip section component ────────────────────────────────────────────

interface MistChipSectionProps {
  label: string;
  chips: string[];
  selected: string[];
  onToggle: (value: string) => void;
  note: string;
  onNote: (value: string) => void;
  notePlaceholder: string;
  multiSelect?: boolean;
}

function MistChipSection({ label, chips, selected, onToggle, note, onNote, notePlaceholder, multiSelect }: MistChipSectionProps) {
  const chipStyle = (active: boolean): React.CSSProperties => ({
    minHeight: 44,
    padding: '0 var(--space-3)',
    borderRadius: 'var(--radius-sm)',
    border: `2px solid ${active ? 'var(--color-brand)' : 'var(--color-border)'}`,
    background: active ? 'var(--color-brand-dim)' : 'transparent',
    color: 'var(--color-text)',
    fontFamily: 'var(--font-mono)',
    fontSize: 'var(--text-sm)',
    fontWeight: active ? 700 : 400,
    cursor: 'pointer',
    whiteSpace: 'nowrap',
  });

  return (
    <div style={{ marginBottom: 'var(--space-4)' }}>
      <div style={{ fontSize: 'var(--text-sm)', fontWeight: 600, marginBottom: 'var(--space-2)' }}>
        {label}
      </div>
      <div role={multiSelect ? undefined : 'radiogroup'} style={{ display: 'flex', flexWrap: 'wrap', gap: 'var(--space-2)', marginBottom: 'var(--space-2)' }}>
        {chips.map((chip) => {
          const active = selected.includes(chip);
          return (
            <button
              key={chip}
              type="button"
              role={multiSelect ? undefined : 'radio'}
              aria-checked={multiSelect ? undefined : active}
              aria-pressed={multiSelect ? active : undefined}
              onClick={() => onToggle(chip)}
              style={chipStyle(active)}
            >
              {active ? '✓ ' : ''}{chip}
            </button>
          );
        })}
      </div>
      {(selected.includes('Annet') || note) && (
        <textarea
          value={note}
          onChange={(e) => onNote(e.target.value)}
          placeholder={notePlaceholder}
          rows={1}
          style={{
            width: '100%', padding: 'var(--space-2)',
            borderRadius: 'var(--radius-sm)', border: '1px solid var(--color-input-border)',
            background: 'var(--color-input-bg)', color: 'var(--color-text)',
            fontSize: 'var(--text-sm)', resize: 'none',
          }}
        />
      )}
    </div>
  );
}

const GPS_STATUS_LABELS: Record<string, string> = {
  idle: '⏳ Henter…',
  acquiring: '⏳ Henter…',
  ok: '📍 Lokasjon klar',
  denied: '⚠ Lokasjon utilgjengelig',
  unavailable: '⚠ Lokasjon utilgjengelig',
};

const GPS_STATUS_COLORS: Record<string, string> = {
  ok: 'var(--color-status-ok)',
  denied: 'var(--color-status-warning)',
  unavailable: 'var(--color-status-warning)',
  acquiring: 'var(--color-text-subtle)',
  idle: 'var(--color-text-subtle)',
};

export function IncidentForm() {
  const navigate = useNavigate();
  const location = useLocation();
  const { eventId } = useAuthStore();
  const { teamId } = (location.state as { teamId?: string }) || {};
  const { position: gpsPosition, status: gpsStatus } = useGeolocation();

  const [step, setStep] = useState(0); // 0=type, 1=AVPU+vitals, 2=MIST, 3=confirm
  const [type, setType] = useState<IncidentType | null>(null);
  const [triageTag, setTriageTag] = useState<TriageTag | null>(null);
  const [acvpu, setAcvpu] = useState<AcvpuLevel | null>(null);
  const [vitals, setVitals] = useState({ pulse: '', spo2: '', rr: '', pain: '' });

  // MIST — chip selections + optional free-text overrides
  const [mistMechanism, setMistMechanism] = useState<string[]>([]);
  const [mistMechanismNote, setMistMechanismNote] = useState('');
  const [mistInjury, setMistInjury] = useState<string[]>([]);
  const [mistInjuryNote, setMistInjuryNote] = useState('');
  const [mistSignsNote, setMistSignsNote] = useState('');
  const [mistTreatment, setMistTreatment] = useState<string[]>([]);
  const [mistTreatmentNote, setMistTreatmentNote] = useState('');

  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [isListening, setIsListening] = useState(false);
  const hasSpeechApi = typeof window !== 'undefined' && ('SpeechRecognition' in window || 'webkitSpeechRecognition' in window);

  const handleSubmit = async () => {
    if (!type || !eventId) return;
    setSubmitting(true);
    setError('');

    try {
      const payload: Record<string, unknown> = {
        eventId,
        teamId,
        type,
        location: gpsStatus === 'ok' && gpsPosition
        ? gpsPosition
        : { lat: 59.964, lng: 10.776 }, // fallback: Holmenkollen
        acvpu,
        triageTag: triageTag ?? undefined,
        clientId: crypto.randomUUID(),
      };

      if (vitals.pulse || vitals.spo2 || vitals.rr || vitals.pain) {
        payload.vitals = {
          pulse: vitals.pulse ? parseInt(vitals.pulse) : undefined,
          spo2: vitals.spo2 ? parseInt(vitals.spo2) : undefined,
          respiratoryRate: vitals.rr ? parseInt(vitals.rr) : undefined,
          painScore: vitals.pain ? parseInt(vitals.pain) : undefined,
        };
      }

      // Build MIST strings from chips + free-text
      const mechanism = [
        ...mistMechanism,
        ...(mistMechanismNote ? [mistMechanismNote] : []),
      ].join(', ');
      const injury = [
        ...mistInjury,
        ...(mistInjuryNote ? [mistInjuryNote] : []),
      ].join(', ');
      // Signs: auto-generate from vitals + ACVPU, append free-text
      const autoSigns = [
        acvpu ? `ACVPU: ${acvpu}` : '',
        vitals.pulse ? `Puls: ${vitals.pulse}` : '',
        vitals.spo2 ? `SpO₂: ${vitals.spo2}%` : '',
        vitals.rr ? `RF: ${vitals.rr}/min` : '',
        vitals.pain ? `Smerte: ${vitals.pain}/10` : '',
      ].filter(Boolean).join(', ');
      const signs = [autoSigns, mistSignsNote].filter(Boolean).join(' — ');
      const treatment = [
        ...mistTreatment,
        ...(mistTreatmentNote ? [mistTreatmentNote] : []),
      ].join(', ');

      if (mechanism || injury || signs || treatment) {
        payload.mist = { mechanism, injury, signs, treatment };
      }

      const result = await api.createIncident(payload);
      if ((result.incident as any)?._queued) {
        navigate('/firstaid', { state: { queued: true } });
      } else {
        navigate('/firstaid');
      }
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

      {/* Step 0: Incident Type + optional START triage tag */}
      {step === 0 && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-4)' }}>
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

          {/* START triage tag (MCI) — optional, visible in all conditions */}
          <fieldset style={{ border: 'none', padding: 0 }}>
            <legend style={{ fontSize: 'var(--text-sm)', fontWeight: 600, marginBottom: 'var(--space-2)', color: 'var(--color-text)' }}>
              START-triage (MCI) — valgfritt
            </legend>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 'var(--space-2)' }}>
              {TRIAGE_OPTIONS.map((opt) => (
                <button
                  key={opt.value}
                  type="button"
                  onClick={() => setTriageTag(triageTag === opt.value ? null : opt.value)}
                  role="radio"
                  aria-checked={triageTag === opt.value}
                  className="touch-target"
                  style={{
                    minHeight: 56,
                    borderRadius: 'var(--radius-md)',
                    border: `3px solid ${triageTag === opt.value ? opt.border : 'transparent'}`,
                    background: opt.bg,
                    color: opt.color,
                    fontWeight: 700,
                    fontSize: 'var(--text-sm)',
                    cursor: 'pointer',
                    opacity: triageTag !== null && triageTag !== opt.value ? 0.5 : 1,
                  }}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          </fieldset>
        </div>
      )}

      {/* Step 1: AVPU + Vitals (ABCDE assessment) */}
      {step === 1 && (
        <div>
          {/* GPS status pill */}
          <div style={{
            display: 'inline-flex', alignItems: 'center', gap: 4,
            fontFamily: 'var(--font-mono)', fontSize: 'var(--text-xs)',
            color: GPS_STATUS_COLORS[gpsStatus],
            marginBottom: 'var(--space-4)',
          }}>
            {GPS_STATUS_LABELS[gpsStatus]}
          </div>

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
            <div
              role="radiogroup"
              aria-label="Bevissthetsgrad — AVPU"
              style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 'var(--space-2)' }}
            >
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

      {/* Step 2: MIST — chip-based quick entry */}
      {step === 2 && (
        <div>
          <MistChipSection
            label="M — Skademekanisme"
            chips={['Fall', 'Kollisjon', 'Hjerterelatert', 'Termisk', 'Psykisk', 'Annet']}
            selected={mistMechanism}
            onToggle={(v) => setMistMechanism((s) => s.includes(v) ? s.filter((x) => x !== v) : [...s, v])}
            note={mistMechanismNote}
            onNote={setMistMechanismNote}
            notePlaceholder="Annen mekanisme..."
          />

          <MistChipSection
            label="I — Skade / kroppsdel"
            chips={['Hode', 'Nakke', 'Bryst', 'Mage', 'Arm', 'Ben', 'Rygg', 'Ingen synlig']}
            selected={mistInjury}
            onToggle={(v) => setMistInjury((s) => s.includes(v) ? s.filter((x) => x !== v) : [...s, v])}
            note={mistInjuryNote}
            onNote={setMistInjuryNote}
            notePlaceholder="Annen skade..."
            multiSelect
          />

          {/* S — Signs: auto-populated from steg 1, editable */}
          <div style={{ marginBottom: 'var(--space-4)' }}>
            <div style={{ fontSize: 'var(--text-sm)', fontWeight: 600, marginBottom: 'var(--space-2)' }}>
              S — Tegn / symptomer
            </div>
            <div style={{
              fontFamily: 'var(--font-mono)', fontSize: 'var(--text-xs)',
              color: 'var(--color-text-subtle)', marginBottom: 'var(--space-2)',
              padding: 'var(--space-2)', background: 'var(--color-surface-sunken)',
              borderRadius: 'var(--radius-sm)',
            }}>
              {[
                acvpu ? `ACVPU: ${acvpu}` : '',
                vitals.pulse ? `Puls: ${vitals.pulse}` : '',
                vitals.spo2 ? `SpO₂: ${vitals.spo2}%` : '',
                vitals.rr ? `RF: ${vitals.rr}/min` : '',
                vitals.pain ? `Smerte: ${vitals.pain}/10` : '',
              ].filter(Boolean).join(' · ') || 'Ingen vitale tegn registrert'}
            </div>
            <div style={{ position: 'relative' }}>
              <textarea
                value={mistSignsNote}
                onChange={(e) => setMistSignsNote(e.target.value)}
                placeholder="Tilleggssymptomer..."
                rows={2}
                style={{
                  width: '100%', padding: 'var(--space-2)',
                  paddingRight: hasSpeechApi ? 48 : 'var(--space-2)',
                  borderRadius: 'var(--radius-sm)', border: '1px solid var(--color-input-border)',
                  background: 'var(--color-input-bg)', color: 'var(--color-text)',
                  fontSize: 'var(--text-sm)', resize: 'none',
                }}
              />
              {hasSpeechApi && (
                <button
                  type="button"
                  aria-label={isListening ? 'Stopp taleopptak' : 'Start taleopptak'}
                  onClick={() => {
                    const SR = ((window as any).SpeechRecognition ?? (window as any).webkitSpeechRecognition) as any;
                    const recognition = new SR();
                    recognition.lang = 'nb-NO';
                    recognition.continuous = false;
                    recognition.interimResults = false;
                    recognition.onresult = (e: any) => {
                      const transcript = e.results[0][0].transcript as string;
                      setMistSignsNote((prev) => prev ? `${prev} ${transcript}` : transcript);
                      setIsListening(false);
                    };
                    recognition.onerror = () => setIsListening(false);
                    recognition.onend = () => setIsListening(false);
                    recognition.start();
                    setIsListening(true);
                  }}
                  style={{
                    position: 'absolute', top: 6, right: 6,
                    width: 36, height: 36, borderRadius: 'var(--radius-full)',
                    border: 'none',
                    background: isListening ? '#cc0000' : 'var(--color-brand)',
                    color: 'white', fontSize: 16, cursor: 'pointer',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    animation: isListening ? 'pulse 1s infinite' : 'none',
                  }}
                >
                  🎤
                </button>
              )}
            </div>
          </div>

          <MistChipSection
            label="T — Behandling gitt"
            chips={['Ro / støtte', 'Iskompresse', 'Bandasje', 'Oksygen', 'HLR', 'Stabilt sideleie', 'Intet']}
            selected={mistTreatment}
            onToggle={(v) => setMistTreatment((s) => s.includes(v) ? s.filter((x) => x !== v) : [...s, v])}
            note={mistTreatmentNote}
            onNote={setMistTreatmentNote}
            notePlaceholder="Annen behandling..."
            multiSelect
          />

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
              {/* MIST summary from chips */}
              {(mistMechanism.length > 0 || mistInjury.length > 0 || mistTreatment.length > 0) && (
                <div>
                  <span style={{ fontSize: 'var(--text-xs)', fontFamily: 'var(--font-mono)', color: 'var(--color-text-subtle)' }}>MIST</span>
                  <div style={{ fontFamily: 'var(--font-mono)', fontSize: 'var(--text-sm)', lineHeight: 'var(--leading-relaxed)' }}>
                    {mistMechanism.length > 0 && <div><strong>M:</strong> {[...mistMechanism, mistMechanismNote].filter(Boolean).join(', ')}</div>}
                    {mistInjury.length > 0 && <div><strong>I:</strong> {[...mistInjury, mistInjuryNote].filter(Boolean).join(', ')}</div>}
                    <div><strong>S:</strong> {[
                      acvpu ? `ACVPU: ${acvpu}` : '',
                      vitals.pulse ? `Puls: ${vitals.pulse}` : '',
                      vitals.spo2 ? `SpO₂: ${vitals.spo2}%` : '',
                      vitals.rr ? `RF: ${vitals.rr}/min` : '',
                      vitals.pain ? `Smerte: ${vitals.pain}/10` : '',
                      mistSignsNote,
                    ].filter(Boolean).join(' · ') || '—'}</div>
                    {mistTreatment.length > 0 && <div><strong>T:</strong> {[...mistTreatment, mistTreatmentNote].filter(Boolean).join(', ')}</div>}
                  </div>
                </div>
              )}
              {/* GPS status on confirm */}
              <div>
                <span style={{ fontSize: 'var(--text-xs)', fontFamily: 'var(--font-mono)', color: 'var(--color-text-subtle)' }}>POSISJON</span>
                <div style={{ fontFamily: 'var(--font-mono)', fontSize: 'var(--text-xs)', color: GPS_STATUS_COLORS[gpsStatus] }}>
                  {gpsStatus === 'ok' && gpsPosition
                    ? `📍 ${gpsPosition.lat.toFixed(4)}, ${gpsPosition.lng.toFixed(4)}`
                    : '⚠ Fallback-posisjon (arrangementet)'}
                </div>
              </div>
            </div>
          </div>

          <div
            id="incident-form-error"
            role="alert"
            aria-atomic="true"
            style={{
              color: 'var(--color-status-critical)', fontSize: 'var(--text-sm)',
              marginBottom: error ? 'var(--space-4)' : 0,
            }}
          >
            {error || ''}
          </div>

          <div style={{ display: 'flex', gap: 'var(--space-2)' }}>
            <button onClick={() => setStep(2)} className="touch-target" style={{
              flex: 1, minHeight: 'var(--touch-min)', borderRadius: 'var(--radius-md)',
              border: '1px solid var(--color-border)', background: 'var(--color-surface)',
              color: 'var(--color-text)', fontSize: 'var(--text-base)', cursor: 'pointer',
            }}>
              ← Rediger
            </button>
            <button onClick={handleSubmit} disabled={submitting} aria-describedby="incident-form-error" className="touch-target" style={{
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
