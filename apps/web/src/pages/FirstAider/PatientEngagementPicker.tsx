/**
 * PatientEngagementPicker
 *
 * Per-patient status picker shown first inside the own-patient accordion:
 * "På vei / Transporterer / Overvåker" is what the coordinator and the sick
 * bay are waiting to hear, so it gets three glove-sized buttons rather than
 * small chips under three forms.
 */
import { TEAM_PATIENT_STATUS_STYLE } from '../../lib/constants';
import type { TeamPatientStatus } from '../../lib/types';

const ORDER: TeamPatientStatus[] = ['en_route_to_patient', 'transporting', 'monitoring'];

export interface PatientEngagementPickerProps {
  patientId: string;
  /** Optimistic local status from the store */
  localStatus: TeamPatientStatus | null;
  /** Server-confirmed status from workspace response */
  serverStatus: TeamPatientStatus | null;
  onSetStatus: (patientId: string, status: TeamPatientStatus | null) => void;
}

export function PatientEngagementPicker({
  patientId,
  localStatus,
  serverStatus,
  onSetStatus,
}: PatientEngagementPickerProps) {
  const activeStatus = localStatus ?? serverStatus;

  return (
    <div data-testid={`engagement-picker-${patientId}`}>
      <div
        style={{
          fontSize: 'var(--text-xs)',
          color: 'var(--color-text-muted)',
          marginBottom: 'var(--space-2)',
          fontWeight: 700,
          textTransform: 'uppercase',
          letterSpacing: '0.05em',
        }}
      >
        Hva gjør dere nå?
      </div>
      <div
        role="radiogroup"
        aria-label="Din status på denne pasienten"
        style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 'var(--space-2)' }}
      >
        {ORDER.map((value) => {
          const style = TEAM_PATIENT_STATUS_STYLE[value];
          const isActive = activeStatus === value;
          return (
            <button
              key={value}
              type="button"
              role="radio"
              aria-checked={isActive}
              data-testid={`engagement-${value}`}
              onClick={() => onSetStatus(patientId, isActive ? null : value)}
              style={{
                minHeight: 'var(--touch-min)',
                padding: 'var(--space-2)',
                borderRadius: 'var(--radius-md)',
                border: `2px solid ${style.color}`,
                background: isActive ? style.bg : 'transparent',
                color: style.color,
                fontSize: 'var(--text-sm)',
                fontWeight: 700,
                cursor: 'pointer',
                fontFamily: 'inherit',
                lineHeight: 1.2,
              }}
            >
              {isActive ? '✓ ' : ''}{style.label}
            </button>
          );
        })}
      </div>
      {activeStatus != null && (
        <button
          type="button"
          onClick={() => onSetStatus(patientId, null)}
          style={{
            marginTop: 'var(--space-2)',
            minHeight: 44,
            padding: '0 var(--space-3)',
            borderRadius: 'var(--radius-sm)',
            border: '1px solid var(--color-border)',
            background: 'transparent',
            color: 'var(--color-text-muted)',
            fontSize: 'var(--text-sm)',
            fontWeight: 600,
            cursor: 'pointer',
            fontFamily: 'inherit',
          }}
        >
          Fjern status (ikke lenger på denne pasienten)
        </button>
      )}
    </div>
  );
}
