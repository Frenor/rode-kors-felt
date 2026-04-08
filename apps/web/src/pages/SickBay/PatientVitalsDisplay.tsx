import type { VitalsReading } from '../../lib/types';

interface PatientVitalsDisplayProps {
  vitals: VitalsReading;
}

const VITALS_FIELDS = [
  { label: 'Puls', key: 'pulse' as const, unit: 'bpm' },
  { label: 'SpO₂', key: 'spo2' as const, unit: '%' },
  { label: 'RF', key: 'respiratoryRate' as const, unit: '/min' },
  { label: 'BT', key: 'systolicBP' as const, unit: 'mmHg' },
  { label: 'Temp', key: 'temperature' as const, unit: '°C' },
  { label: 'Smerte', key: 'painScore' as const, unit: '/10' },
];

export function PatientVitalsDisplay({ vitals }: PatientVitalsDisplayProps) {
  return (
    <div
      aria-live="polite"
      aria-label="Siste vitale tegn for pasient"
      style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(60px, 1fr))',
        gap: 'var(--space-1)',
      }}
    >
      {VITALS_FIELDS.map((v) => {
        const value = vitals[v.key];
        if (value == null) return null;
        return (
          <div key={v.label} style={{
            textAlign: 'center', padding: '4px 6px',
            background: 'var(--color-surface-sunken)', borderRadius: 'var(--radius-sm)',
          }}>
            <div style={{ fontFamily: 'var(--font-mono)', fontSize: 'var(--text-xs)', color: 'var(--color-text-subtle)', lineHeight: 1.2 }}>
              {v.label}
            </div>
            <div style={{ fontFamily: 'var(--font-mono)', fontSize: 'var(--text-sm)', fontWeight: 700, lineHeight: 1.3 }}>
              {value}<span style={{ fontSize: '0.75em', color: 'var(--color-text-muted)' }}>{v.unit}</span>
            </div>
          </div>
        );
      })}
    </div>
  );
}
