import { ACVPU_OPTIONS } from '../../lib/constants';

export interface VitalsFormShape {
  pulse: string;
  spo2: string;
  rr: string;
  pain: string;
  bp: string;
  temp: string;
  acvpu: string;
}

interface VitalsEntryFormProps {
  patientId: string;
  form: VitalsFormShape;
  onChange: (updater: (prev: VitalsFormShape) => VitalsFormShape) => void;
  onSubmit: () => void;
}

export const EMPTY_VITALS_FORM: VitalsFormShape = { pulse: '', spo2: '', rr: '', pain: '', bp: '', temp: '', acvpu: '' };

const NUMERIC_FIELDS = [
  { key: 'pulse', label: 'Puls', placeholder: 'bpm', inputMode: 'numeric' as const },
  { key: 'spo2', label: 'SpO₂', placeholder: '%', inputMode: 'numeric' as const },
  { key: 'rr', label: 'RF', placeholder: '/min', inputMode: 'numeric' as const },
  { key: 'bp', label: 'Syst. BT', placeholder: 'mmHg', inputMode: 'numeric' as const },
  { key: 'temp', label: 'Temp', placeholder: '°C', inputMode: 'decimal' as const },
  { key: 'pain', label: 'Smerte', placeholder: '0-10', inputMode: 'numeric' as const },
] as const;

type NumericFieldKey = (typeof NUMERIC_FIELDS)[number]['key'];

export function VitalsEntryForm({ patientId, form, onChange, onSubmit }: VitalsEntryFormProps) {
  return (
    <div style={{
      marginTop: 'var(--space-3)', padding: 'var(--space-3)',
      background: 'var(--color-surface-sunken)', borderRadius: 'var(--radius-md)',
    }}>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 'var(--space-2)', marginBottom: 'var(--space-3)' }}>
        {NUMERIC_FIELDS.map((f) => (
          <div key={f.key}>
            <label htmlFor={`v-${patientId}-${f.key}`} style={{ fontSize: 'var(--text-xs)', fontFamily: 'var(--font-mono)', color: 'var(--color-text-subtle)' }}>
              {f.label}
            </label>
            <input
              id={`v-${patientId}-${f.key}`}
              type="number"
              inputMode={f.inputMode}
              value={form[f.key as NumericFieldKey]}
              onChange={(e) => onChange((v) => ({ ...v, [f.key]: e.target.value }))}
              placeholder={f.placeholder}
              style={{
                width: '100%', height: 44, textAlign: 'center',
                borderRadius: 'var(--radius-sm)', border: '1px solid var(--color-input-border)',
                background: 'var(--color-input-bg)', color: 'var(--color-text)',
                fontFamily: 'var(--font-mono)', fontSize: 'var(--text-base)', fontWeight: 600,
              }}
            />
          </div>
        ))}
      </div>

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
              aria-checked={form.acvpu === opt.value}
              onClick={() => onChange((v) => ({ ...v, acvpu: v.acvpu === opt.value ? '' : opt.value }))}
              style={{
                flex: '1 0 auto',
                minHeight: 36,
                padding: '0 var(--space-2)',
                borderRadius: 'var(--radius-sm)',
                border: `1px solid ${form.acvpu === opt.value ? 'var(--color-brand)' : 'var(--color-border)'}`,
                background: form.acvpu === opt.value ? 'var(--color-brand-dim)' : 'transparent',
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

      <button onClick={onSubmit} className="touch-target" style={{
        width: '100%', minHeight: 40, borderRadius: 'var(--radius-sm)',
        border: 'none', background: 'var(--color-brand)', color: 'white',
        fontSize: 'var(--text-sm)', fontWeight: 600, cursor: 'pointer',
      }}>
        Lagre vitale tegn
      </button>
    </div>
  );
}
