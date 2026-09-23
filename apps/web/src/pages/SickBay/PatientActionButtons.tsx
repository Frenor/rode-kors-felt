import { Button } from '../../components/ui';

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

/**
 * The five card actions. "Ring 113" is the only critical one: it gets a row of
 * its own above the four neutral openers (2 × 2), so nothing sits alone in a
 * half-empty row and the call button is never mistaken for a toggle.
 */
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
    <div className="patient-action-grid">
      <Button variant="danger-soft" size="sm" pill icon="phone" onClick={onOpenAmk} data-testid="patient-ring-113" className="patient-action-grid__call">
        Ring 113
      </Button>

      <Button variant="secondary" size="sm" pill selected={showVitals} aria-expanded={showVitals} onClick={onToggleVitals}>
        {showVitals ? 'Lukk vitale' : 'Vitale'}
      </Button>

      <Button variant="secondary" size="sm" pill selected={showMeds} aria-expanded={showMeds} onClick={onToggleMedication}>
        {showMeds ? 'Lukk medisin' : 'Medisin'}
      </Button>

      <Button variant="secondary" size="sm" pill selected={showNote} aria-expanded={showNote} onClick={onToggleNote}>
        {showNote ? 'Lukk notat' : 'Notat'}
      </Button>

      <Button variant="secondary" size="sm" pill selected={showHistory} aria-expanded={showHistory} onClick={onToggleHistory}>
        Logg
      </Button>
    </div>
  );
}
