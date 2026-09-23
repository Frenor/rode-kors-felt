import { patientNumber } from '../../lib/patient-number';
import { Pill } from './Pill';

/**
 * The patient's shared number ("#12"): the same on the radio, the phone, the
 * tablet and the map. Renders nothing while the number is unknown (a patient
 * created before the number existed, or not yet synced).
 */
export function PatientNumberPill({ seq, size = 'md', ...rest }: { seq?: number | null; size?: 'md' | 'lg' } & Omit<React.HTMLAttributes<HTMLSpanElement>, 'children'>) {
  const label = patientNumber({ seq });
  if (!label) return null;
  return (
    <Pill
      size={size}
      tone={{ color: 'var(--color-text)', bg: 'var(--color-surface-sunken)', border: 'var(--color-border)' }}
      aria-label={`Pasient ${label}`}
      {...rest}
    >
      <span className="data">{label}</span>
    </Pill>
  );
}
