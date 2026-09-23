/**
 * AssignmentBanner
 *
 * An assignment from the coordinator used to be silent on the patrol's phone
 * — the field list just re-rendered with a small "Oppdatert" flag (gap A4).
 * This is the persistent, un-missable version: it stays under the team
 * header (survives reload — see lib/pending-assignments.ts) until the
 * patrol answers "Vi drar" or "Kan ikke".
 */
import { patientNumber } from '../../lib/patient-number';
import { Button, Icon } from '../../components/ui';

export interface AssignmentBannerPatient {
  id: string;
  label: string;
  seq?: number | null;
}

export interface AssignmentBannerProps {
  patient: AssignmentBannerPatient;
  onAccept: (patientId: string) => void;
  onDecline: (patientId: string) => void;
}

export function AssignmentBanner({ patient, onAccept, onDecline }: AssignmentBannerProps) {
  const number = patientNumber(patient);
  return (
    <section
      role="alert"
      data-testid={`firstaid-assignment-banner-${patient.id}`}
      className="card"
      style={{
        padding: 'var(--space-3) var(--space-4)',
        borderColor: 'var(--color-brand)',
        background: 'var(--color-brand-dim)',
        display: 'flex',
        flexDirection: 'column',
        gap: 'var(--space-3)',
      }}
    >
      <div style={{ display: 'flex', gap: 'var(--space-2)', alignItems: 'flex-start' }}>
        <Icon name="alert" size="lg" style={{ color: 'var(--color-brand)', marginTop: 2, flexShrink: 0 }} />
        <span style={{ fontWeight: 700, fontSize: 'var(--text-base)', color: 'var(--color-brand)' }}>
          Koordinator har tildelt dere: {number ? `${number} ` : ''}
          {patient.label}
        </span>
      </div>
      <div style={{ display: 'flex', gap: 'var(--space-2)' }}>
        <Button variant="primary" size="lg" style={{ flex: 1 }} onClick={() => onAccept(patient.id)} data-testid={`firstaid-assignment-accept-${patient.id}`}>
          Vi drar
        </Button>
        <Button variant="secondary" size="lg" onClick={() => onDecline(patient.id)} data-testid={`firstaid-assignment-decline-${patient.id}`}>
          Kan ikke
        </Button>
      </div>
    </section>
  );
}
