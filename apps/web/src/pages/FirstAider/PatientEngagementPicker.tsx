/**
 * PatientEngagementPicker
 *
 * Per-patient status picker shown first inside the own-patient accordion:
 * "På vei / Transporterer / Overvåker" is what the coordinator and the sick
 * bay are waiting to hear, so it gets three glove-sized chips rather than
 * small pills under three forms.
 */
import { TEAM_PATIENT_STATUS_STYLE } from '../../lib/constants';
import type { TeamPatientStatus } from '../../lib/types';
import { Button } from '../../components/ui';

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
      <div className="section-label" style={{ marginBottom: 'var(--space-2)' }}>
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
            <Button
              key={value}
              variant="tone"
              tone={{ color: style.color, bg: style.bg }}
              size="lg"
              role="radio"
              aria-checked={isActive}
              data-testid={`engagement-${value}`}
              icon={isActive ? 'check' : undefined}
              onClick={() => onSetStatus(patientId, isActive ? null : value)}
              style={{ padding: '0 var(--space-2)' }}
            >
              {style.label}
            </Button>
          );
        })}
      </div>
      {activeStatus != null && (
        <Button
          variant="ghost"
          size="sm"
          onClick={() => onSetStatus(patientId, null)}
          style={{ marginTop: 'var(--space-2)' }}
        >
          Fjern status (ikke lenger på denne pasienten)
        </Button>
      )}
    </div>
  );
}
