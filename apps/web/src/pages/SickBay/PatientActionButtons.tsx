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
  onOpenAmk: () => void;
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
  onOpenAmk,
  onStatusChange,
}: PatientActionButtonsProps) {
  const currentStatus = patient.status as keyof typeof STATUS_TRANSITIONS;
  const nextStatuses = STATUS_TRANSITIONS[currentStatus] ?? [];

  const quickActionStyle = (active = false) => ({
    minHeight: 36,
    padding: '0 var(--space-3)',
    borderRadius: 'var(--radius-full)',
    border: `1px solid ${active ? 'var(--color-brand)' : 'var(--color-border)'}`,
    background: active ? 'var(--color-brand-dim)' : 'transparent',
    fontSize: 'var(--text-xs)',
    fontFamily: 'var(--font-mono)',
    color: active ? 'var(--color-text)' : 'var(--color-text-muted)',
    cursor: 'pointer',
    whiteSpace: 'nowrap' as const,
  });

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-2)' }}>
      <div style={{ display: 'flex', gap: 'var(--space-2)', flexWrap: 'wrap' }}>
        <button
          onClick={onOpenAmk}
          data-testid="patient-ring-113"
          className="touch-target"
          style={{
            minHeight: 36,
            padding: '0 var(--space-3)',
            borderRadius: 'var(--radius-full)',
            border: '1px solid var(--color-status-critical)',
            background: 'var(--color-status-critical)',
            fontSize: 'var(--text-xs)',
            fontFamily: 'var(--font-mono)',
            color: 'white',
            cursor: 'pointer',
            whiteSpace: 'nowrap',
          }}
        >
          Ring 113
        </button>

        <button onClick={onToggleVitals} className="touch-target" style={quickActionStyle(showVitals)}>
          {showVitals ? 'Lukk vitale' : 'Vitale tegn'}
        </button>

        <button onClick={onToggleMedication} className="touch-target" style={quickActionStyle(showMeds)}>
          {showMeds ? 'Lukk medik.' : 'Medikament'}
        </button>

        <button onClick={onToggleNote} className="touch-target" style={quickActionStyle(showNote)}>
          {showNote ? 'Lukk notat' : 'Notat'}
        </button>

        <button onClick={onToggleHistory} className="touch-target" style={quickActionStyle(showHistory)}>
          Logg
        </button>
      </div>

      <section
        aria-label="Pasientstatus"
        data-testid={`patient-status-${patient.id}`}
        style={{
          display: 'flex',
          flexDirection: 'column',
          gap: 'var(--space-1)',
          padding: 'var(--space-2)',
          borderRadius: 'var(--radius-md)',
          background: 'var(--color-surface-sunken)',
          border: '1px solid var(--color-border)',
        }}
      >
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            gap: 'var(--space-2)',
            flexWrap: 'wrap',
          }}
        >
          <span
            id={`status-current-${patient.id}`}
            aria-live="polite"
            style={{ fontSize: 'var(--text-xs)', fontFamily: 'var(--font-mono)', color: 'var(--color-text-subtle)' }}
          >
            Statusløype
          </span>
          <span style={{ fontSize: 'var(--text-xs)', fontFamily: 'var(--font-mono)', color: 'var(--color-text-subtle)' }}>
            Aktiv: {statusLabels[patient.status] ?? patient.status}
          </span>
        </div>
        <div role="group" aria-label="Mulige statusendringer" style={{ display: 'flex', gap: 'var(--space-1)', flexWrap: 'wrap' }}>
          {Object.keys(statusLabels).map((statusKey) => {
            const status = statusKey as keyof typeof statusLabels;
            const sc = statusColors[status] ?? { color: 'var(--color-text-subtle)', bg: 'transparent' };
            const isCurrent = status === patient.status;
            const isAvailable = nextStatuses.includes(status);

            if (isCurrent) {
              return (
                <span
                  key={status}
                  aria-current="step"
                  style={{
                    minHeight: 30,
                    padding: '0 var(--space-2)',
                    borderRadius: 'var(--radius-full)',
                    display: 'inline-flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    background: sc.bg,
                    color: sc.color,
                    border: `1px solid ${sc.color}`,
                    fontSize: 'var(--text-xs)',
                    fontFamily: 'var(--font-mono)',
                    fontWeight: 700,
                    whiteSpace: 'nowrap',
                  }}
                >
                  {statusLabels[status]}
                </span>
              );
            }

            if (isAvailable) {
              const isTransfer = status === 'transferred';
              return (
                <button
                  key={status}
                  type="button"
                  data-testid={`status-btn-${status}`}
                  className="touch-target"
                  aria-label={`${statusLabels[status]}${isTransfer ? ' (krever SBAR)' : ''}`}
                  aria-describedby={`status-current-${patient.id}`}
                  onClick={() => onStatusChange(status)}
                  style={{
                    minHeight: 30,
                    padding: '0 var(--space-2)',
                    borderRadius: 'var(--radius-full)',
                    border: `1px ${isTransfer ? 'dashed' : 'solid'} ${sc.color}`,
                    background: 'transparent',
                    color: sc.color,
                    fontSize: 'var(--text-xs)',
                    fontFamily: 'var(--font-mono)',
                    cursor: 'pointer',
                    whiteSpace: 'nowrap',
                  }}
                >
                  {statusLabels[status]}
                </button>
              );
            }

            return (
              <span
                key={status}
                aria-hidden="true"
                style={{
                  minHeight: 30,
                  padding: '0 var(--space-2)',
                  borderRadius: 'var(--radius-full)',
                  display: 'inline-flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  border: '1px solid var(--color-border)',
                  color: 'var(--color-text-subtle)',
                  opacity: 0.55,
                  fontSize: 'var(--text-xs)',
                  fontFamily: 'var(--font-mono)',
                  whiteSpace: 'nowrap',
                }}
              >
                {statusLabels[status]}
              </span>
            );
          })}
        </div>
      </section>
    </div>
  );
}
