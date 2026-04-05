interface PatientActionButtonsProps {
  showVitals: boolean;
  showMeds: boolean;
  showNote: boolean;
  showHistory: boolean;
  onToggleVitals: () => void;
  onToggleMedication: () => void;
  onToggleNote: () => void;
  onToggleHistory: () => void;
  onOpenAmk: () => void;
}

export function PatientActionButtons({
  showVitals,
  showMeds,
  showNote,
  showHistory,
  onToggleVitals,
  onToggleMedication,
  onToggleNote,
  onToggleHistory,
  onOpenAmk,
}: PatientActionButtonsProps) {
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

    </div>
  );
}
