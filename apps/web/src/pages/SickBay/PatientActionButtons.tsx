import { STATUS_TRANSITIONS, statusColors, statusLabels } from '../../lib/constants';
import type { SickBayPatient } from '../../lib/types';

interface PatientActionButtonsProps {
  patient: SickBayPatient;
  showVitals: boolean;
  showMeds: boolean;
  showNote: boolean;
  showHistory: boolean;
  onToggleVitals: () => void;
  onToggleMedication: () => void;
  onToggleNote: () => void;
  onToggleHistory: () => void;
  onStatusChange: (status: string) => void;
}

export function PatientActionButtons({
  patient,
  showVitals,
  showMeds,
  showNote,
  showHistory,
  onToggleVitals,
  onToggleMedication,
  onToggleNote,
  onToggleHistory,
  onStatusChange,
}: PatientActionButtonsProps) {
  const currentStatus = patient.status as keyof typeof STATUS_TRANSITIONS;
  const nextStatuses = STATUS_TRANSITIONS[currentStatus] ?? [];

  return (
    <div style={{ display: 'flex', gap: 'var(--space-2)', flexWrap: 'wrap' }}>
      <button
        onClick={onToggleVitals}
        className="touch-target"
        style={{
          minHeight: 40, padding: '0 var(--space-3)', borderRadius: 'var(--radius-sm)',
          border: '1px solid var(--color-border)', background: 'transparent',
          fontSize: 'var(--text-xs)', fontFamily: 'var(--font-mono)', color: 'var(--color-text-muted)', cursor: 'pointer',
        }}
      >
        {showVitals ? '✕ Lukk' : '+ Vitale tegn'}
      </button>

      <button
        onClick={onToggleMedication}
        className="touch-target"
        style={{
          minHeight: 40, padding: '0 var(--space-3)', borderRadius: 'var(--radius-sm)',
          border: '1px solid var(--color-border)', background: 'transparent',
          fontSize: 'var(--text-xs)', fontFamily: 'var(--font-mono)', color: 'var(--color-text-muted)', cursor: 'pointer',
        }}
      >
        {showMeds ? '✕ Lukk' : '+ Medikament'}
      </button>

      <button
        onClick={onToggleNote}
        className="touch-target"
        style={{
          minHeight: 40, padding: '0 var(--space-3)', borderRadius: 'var(--radius-sm)',
          border: '1px solid var(--color-border)', background: 'transparent',
          fontSize: 'var(--text-xs)', fontFamily: 'var(--font-mono)', color: 'var(--color-text-muted)', cursor: 'pointer',
        }}
      >
        {showNote ? '✕ Lukk' : '+ Notat'}
      </button>

      <button
        onClick={onToggleHistory}
        className="touch-target"
        style={{
          minHeight: 40, padding: '0 var(--space-3)', borderRadius: 'var(--radius-sm)',
          border: `1px solid ${showHistory ? 'var(--color-brand)' : 'var(--color-border)'}`,
          background: showHistory ? 'var(--color-brand-dim)' : 'transparent',
          fontSize: 'var(--text-xs)', fontFamily: 'var(--font-mono)', color: 'var(--color-text-muted)', cursor: 'pointer',
        }}
      >
        Logg
      </button>

      {nextStatuses.length > 0 && (
        <section
          aria-label="Endre pasientstatus"
          data-testid={`patient-status-${patient.id}`}
          style={{ display: 'flex', gap: 'var(--space-2)', flexWrap: 'wrap', alignItems: 'center' }}
        >
          <span
            id={`status-current-${patient.id}`}
            aria-live="polite"
            style={{ fontSize: 'var(--text-xs)', fontFamily: 'var(--font-mono)', color: 'var(--color-text-subtle)', whiteSpace: 'nowrap' }}
          >
            Status:
          </span>
          <div role="group" aria-label="Mulige statusendringer" style={{ display: 'flex', gap: 'var(--space-2)', flexWrap: 'wrap' }}>
            {nextStatuses.map((nextStatus) => {
              const sc = statusColors[nextStatus] ?? { color: 'var(--color-text-subtle)', bg: 'transparent' };
              const isTransfer = nextStatus === 'transferred';
              return (
                <button
                  key={nextStatus}
                  data-testid={`status-btn-${nextStatus}`}
                  className="touch-target"
                  aria-label={`${statusLabels[nextStatus]}${isTransfer ? ' (krever SBAR)' : ''}`}
                  aria-describedby={`status-current-${patient.id}`}
                  onClick={() => onStatusChange(nextStatus)}
                  style={{
                    minHeight: 'var(--touch-min)',
                    padding: '0 var(--space-3)',
                    borderRadius: 'var(--radius-sm)',
                    border: `1px ${isTransfer ? 'dashed' : 'solid'} ${sc.color}`,
                    background: 'transparent',
                    fontSize: 'var(--text-xs)',
                    fontFamily: 'var(--font-mono)',
                    color: sc.color,
                    cursor: 'pointer',
                    whiteSpace: 'nowrap',
                  }}
                >
                  → {statusLabels[nextStatus]}
                </button>
              );
            })}
          </div>
        </section>
      )}
    </div>
  );
}
