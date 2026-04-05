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
  const actionCopy: Record<string, { label: string; icon: string }> = {
    'incoming:in_treatment': { label: 'Start behandling', icon: '▶' },
    'incoming:observation': { label: 'Legg til observasjon', icon: '⊕' },
    'in_treatment:observation': { label: 'Flytt til observasjon', icon: '→' },
    'observation:in_treatment': { label: 'Start behandling', icon: '▶' },
    'in_treatment:discharged': { label: 'Skriv ut', icon: '✓' },
    'observation:discharged': { label: 'Skriv ut', icon: '✓' },
    'in_treatment:transferred': { label: 'Overfør til AMK (SBAR)', icon: '⇢' },
    'observation:transferred': { label: 'Overfør til AMK (SBAR)', icon: '⇢' },
    'discharged:observation': { label: 'Flytt til observasjon', icon: '↺' },
    'transferred:observation': { label: 'Flytt til observasjon', icon: '↺' },
    'discharged:in_treatment': { label: 'Start behandling', icon: '↺' },
    'transferred:in_treatment': { label: 'Start behandling', icon: '↺' },
    'in_treatment:incoming': { label: 'Til innkommende', icon: '↩' },
    'observation:incoming': { label: 'Til innkommende', icon: '↩' },
  };

  return (
    <div style={{ display: 'flex', gap: 'var(--space-2)', flexWrap: 'wrap' }}>
      <button
        onClick={onOpenAmk}
        data-testid="patient-ring-113"
        className="touch-target"
        style={{
          minHeight: 40, padding: '0 var(--space-3)', borderRadius: 'var(--radius-sm)',
          border: '1px solid var(--color-status-critical)', background: 'var(--color-status-critical)',
          fontSize: 'var(--text-xs)', fontFamily: 'var(--font-mono)', color: 'white', cursor: 'pointer',
        }}
      >
        Ring 113
      </button>

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
            {`Status: ${statusLabels[patient.status] ?? patient.status}`}
          </span>
          <div role="group" aria-label="Mulige statusendringer" style={{ display: 'flex', gap: 'var(--space-2)', flexWrap: 'wrap' }}>
            {nextStatuses.map((nextStatus) => {
              const sc = statusColors[nextStatus] ?? { color: 'var(--color-text-subtle)', bg: 'transparent' };
              const isTransfer = nextStatus === 'transferred';
              const copy = actionCopy[`${currentStatus}:${nextStatus}`];
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
                  <span aria-hidden="true" style={{ marginRight: 6 }}>
                    {copy?.icon ?? '→'}
                  </span>
                  <span>{copy?.label ?? statusLabels[nextStatus]}</span>
                </button>
              );
            })}
          </div>
        </section>
      )}
    </div>
  );
}
