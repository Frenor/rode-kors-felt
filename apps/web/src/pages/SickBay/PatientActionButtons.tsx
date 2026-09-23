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
    minHeight: 44,
    padding: '0 var(--space-3)',
    borderRadius: 'var(--radius-full)',
    border: `1px solid ${active ? 'var(--color-brand)' : 'var(--color-border)'}`,
    background: active ? 'var(--color-brand-dim)' : 'transparent',
    fontSize: 'var(--text-sm)',
    fontWeight: 600,
    color: active ? 'var(--color-brand)' : 'var(--color-text)',
    cursor: 'pointer',
    whiteSpace: 'nowrap' as const,
  });
  return (
    <div className="patient-action-grid">
        <button
          type="button"
          onClick={onOpenAmk}
          data-testid="patient-ring-113"
          style={{
            minHeight: 44,
            padding: '0 var(--space-2)',
            borderRadius: 'var(--radius-full)',
            border: '1px solid var(--color-status-critical)',
            background: 'var(--color-status-critical)',
            fontSize: 'var(--text-sm)',
            fontWeight: 700,
            color: 'white',
            cursor: 'pointer',
            whiteSpace: 'nowrap',
          }}
        >
          Ring 113
        </button>

        <button type="button" onClick={onToggleVitals} aria-expanded={showVitals} style={quickActionStyle(showVitals)}>
          {showVitals ? 'Lukk vitale' : 'Vitale'}
        </button>

        <button type="button" onClick={onToggleMedication} aria-expanded={showMeds} style={quickActionStyle(showMeds)}>
          {showMeds ? 'Lukk medisin' : 'Medisin'}
        </button>

        <button type="button" onClick={onToggleNote} aria-expanded={showNote} style={quickActionStyle(showNote)}>
          {showNote ? 'Lukk notat' : 'Notat'}
        </button>

        <button type="button" onClick={onToggleHistory} aria-expanded={showHistory} style={quickActionStyle(showHistory)}>
          Logg
        </button>
    </div>
  );
}
