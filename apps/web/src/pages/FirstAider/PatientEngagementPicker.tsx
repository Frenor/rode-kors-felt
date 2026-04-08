/**
 * PatientEngagementPicker
 *
 * Per-patient status picker shown inside the own-patient accordion.
 * Allows a first-aider to record their engagement status (en route,
 * transporting, monitoring) and clear it. Shows checkmark on active option.
 */
import type { TeamPatientStatus } from '../../lib/types';

const STATUSES: Array<{
  value: TeamPatientStatus;
  label: string;
  activeBg: string;
  color: string;
}> = [
  { value: 'en_route_to_patient', label: 'På vei',       activeBg: '#fef3c7', color: '#92400e' },
  { value: 'transporting',        label: 'Transporterer', activeBg: '#dbeafe', color: '#1e40af' },
  { value: 'monitoring',          label: 'Overvåker',     activeBg: '#dcfce7', color: '#166534' },
];

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
    <div>
      <div
        style={{
          fontSize: 'var(--text-xs)',
          color: 'var(--color-text-subtle)',
          marginBottom: 'var(--space-1)',
          fontWeight: 600,
          textTransform: 'uppercase',
          letterSpacing: '0.05em',
        }}
      >
        Din status på denne pasienten
      </div>
      <div style={{ display: 'flex', gap: 'var(--space-2)', flexWrap: 'wrap' }}>
        {STATUSES.map(({ value, label, activeBg, color }) => {
          const isActive = activeStatus === value;
          return (
            <button
              key={value}
              onClick={() => onSetStatus(patientId, isActive ? null : value)}
              className="touch-target"
              style={{
                padding: '4px 12px',
                minHeight: 36,
                borderRadius: 'var(--radius-sm)',
                border: `1.5px solid ${color}`,
                background: isActive ? activeBg : 'transparent',
                color,
                fontSize: 'var(--text-xs)',
                fontWeight: 600,
                cursor: 'pointer',
                fontFamily: 'inherit',
              }}
            >
              {label}{isActive ? ' ✓' : ''}
            </button>
          );
        })}
        {activeStatus != null && (
          <button
            onClick={() => onSetStatus(patientId, null)}
            className="touch-target"
            style={{
              padding: '4px 12px',
              minHeight: 36,
              borderRadius: 'var(--radius-sm)',
              border: '1.5px solid var(--color-border)',
              background: 'transparent',
              color: 'var(--color-text-subtle)',
              fontSize: 'var(--text-xs)',
              fontWeight: 600,
              cursor: 'pointer',
              fontFamily: 'inherit',
            }}
          >
            Avslutt
          </button>
        )}
      </div>
    </div>
  );
}
