import { calculateNEWS2, news2MonitoringLabel, type News2Input } from '@rkf/shared-types';
import { ACVPU_OPTIONS, news2Colors } from '../../lib/constants';
import type { AcvpuLevel } from '../../lib/types';
import { Button } from '../../components/ui';

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

const NEWS2_LEVEL_LABELS = { routine: 'rutine', low: 'lav', medium: 'middels', high: 'høy' } as const;

const NEWS2_PARAM_LABELS: Array<[keyof ReturnType<typeof calculateNEWS2>['scores'], string]> = [
  ['respiratoryRate', 'RF'],
  ['spo2', 'SpO₂'],
  ['systolicBP', 'BT'],
  ['pulse', 'Puls'],
  ['consciousness', 'ACVPU'],
  ['temperature', 'Temp'],
];

const num = (v: string): number | undefined => {
  if (!v.trim()) return undefined;
  const n = Number.parseFloat(v.replace(',', '.'));
  return Number.isFinite(n) ? n : undefined;
};

/** Build the NEWS2 input from what has been typed so far. */
export function vitalsFormToNews2Input(form: VitalsFormShape): News2Input {
  return {
    pulse: num(form.pulse),
    spo2: num(form.spo2),
    respiratoryRate: num(form.rr),
    systolicBP: num(form.bp),
    temperature: num(form.temp),
    acvpu: (form.acvpu || undefined) as AcvpuLevel | undefined,
  };
}

export function VitalsEntryForm({ patientId, form, onChange, onSubmit }: VitalsEntryFormProps) {
  const input = vitalsFormToNews2Input(form);
  const hasAnyNews2Param = Object.values(input).some((v) => v !== undefined);
  const preview = hasAnyNews2Param ? calculateNEWS2(input) : null;
  const previewColors = preview ? news2Colors[preview.alertLevel] : null;
  const missing = preview
    ? NEWS2_PARAM_LABELS.filter(([key]) => preview.scores[key] === null).map(([, label]) => label)
    : [];

  return (
    <div style={{
      marginTop: 'var(--space-3)', padding: 'var(--space-3)',
      background: 'var(--color-surface-sunken)', borderRadius: 'var(--radius-md)',
    }}>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 'var(--space-2)', marginBottom: 'var(--space-3)' }}>
        {NUMERIC_FIELDS.map((f) => (
          <div key={f.key}>
            <label
              htmlFor={`v-${patientId}-${f.key}`}
              className="section-label"
              style={{ display: 'block', marginBottom: 4 }}
            >
              {f.label}
            </label>
            <input
              id={`v-${patientId}-${f.key}`}
              type="number"
              inputMode={f.inputMode}
              className="field field--data"
              value={form[f.key as NumericFieldKey]}
              onChange={(e) => onChange((v) => ({ ...v, [f.key]: e.target.value }))}
              placeholder={f.placeholder}
            />
          </div>
        ))}
      </div>

      <fieldset style={{ border: 'none', padding: 0, marginBottom: 'var(--space-3)' }}>
        <legend className="section-label" style={{ marginBottom: 'var(--space-2)' }}>
          Bevissthet (ACVPU)
        </legend>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: 'var(--space-1)' }}>
          {ACVPU_OPTIONS.map((opt) => (
            <Button
              key={opt.value}
              variant="secondary"
              size="sm"
              role="radio"
              aria-checked={form.acvpu === opt.value}
              aria-label={`${opt.short} — ${opt.label}`}
              onClick={() => onChange((v) => ({ ...v, acvpu: v.acvpu === opt.value ? '' : opt.value }))}
              className="data"
              style={{ padding: 0, fontSize: 'var(--text-base)' }}
            >
              {opt.short}
            </Button>
          ))}
        </div>
      </fieldset>

      {/* Live NEWS2 preview — tells the user what the set they are typing means
          before they save it, and which parameters are still missing. */}
      {preview && previewColors && (
        <div
          data-testid={`news2-preview-${patientId}`}
          role="status"
          aria-live="polite"
          style={{
            display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 'var(--space-2)',
            marginBottom: 'var(--space-3)', padding: 'var(--space-2) var(--space-3)',
            borderRadius: 'var(--radius-sm)', background: previewColors.bg, color: previewColors.color,
            fontSize: 'var(--text-sm)', fontWeight: 700,
          }}
        >
          <span>NEWS2 foreløpig: <span className="data">{preview.total}</span> · {NEWS2_LEVEL_LABELS[preview.alertLevel]}</span>
          <span style={{ fontWeight: 500 }}>· {news2MonitoringLabel(preview)}</span>
          {missing.length > 0 && (
            <span style={{ fontWeight: 500, opacity: 0.85 }}>· mangler {missing.join(', ')}</span>
          )}
        </div>
      )}

      <Button variant="ink" size="lg" block icon="activity" onClick={onSubmit}>
        Lagre vitale tegn
      </Button>
    </div>
  );
}
