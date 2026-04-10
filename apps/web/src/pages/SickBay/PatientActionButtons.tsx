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
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 'var(--space-2)' }}>
        <button
          onClick={onOpenAmk}
          data-testid="patient-ring-113"
          className="touch-target"
          style={{
            minHeight: 36,
            padding: '0 var(--space-2)',
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
          {showVitals ? 'Lukk vitale' : 'Vitale'}
        </button>

        <button onClick={onToggleMedication} className="touch-target" style={quickActionStyle(showMeds)}>
          {showMeds ? 'Lukk medik.' : 'Medik.'}
        </button>

        <button onClick={onToggleNote} className="touch-target" style={quickActionStyle(showNote)}>
          {showNote ? 'Lukk notat' : 'Notat'}
        </button>

        <button onClick={onToggleHistory} className="touch-target" style={quickActionStyle(showHistory)}>
          Logg
        </button>
    </div>
  );
}
