/**
 * TeamStatusPickerSheet
 *
 * Bottom-sheet modal for selecting a team's operational status.
 * Renders as a fixed overlay; clicking the backdrop dismisses it.
 */
import type { TeamOperationalStatus } from '../../lib/types';

const TEAM_STATUS_LABELS: Record<TeamOperationalStatus, string> = {
  available: 'Ledig',
  en_route: 'På vei',
  on_scene: 'Fremme på stedet',
  needs_assistance: 'Trenger bistand',
  unavailable: 'Utilgjengelig',
};

export interface TeamStatusPickerSheetProps {
  currentStatus: TeamOperationalStatus;
  onSelect: (status: TeamOperationalStatus) => Promise<void>;
  onClose: () => void;
}

export function TeamStatusPickerSheet({
  currentStatus,
  onSelect,
  onClose,
}: TeamStatusPickerSheetProps) {
  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Velg lagstatus"
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 50,
        background: 'rgba(0,0,0,0.4)',
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'flex-end',
      }}
      onClick={onClose}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          background: 'var(--color-surface)',
          borderRadius: 'var(--radius-md) var(--radius-md) 0 0',
          padding: 'var(--space-4)',
          display: 'flex',
          flexDirection: 'column',
          gap: 'var(--space-2)',
        }}
      >
        <div
          style={{
            fontWeight: 700,
            fontSize: 'var(--text-sm)',
            marginBottom: 'var(--space-1)',
          }}
        >
          Lagstatus
        </div>
        <div
          role="radiogroup"
          aria-label="Lagstatus i felt"
          data-testid="firstaid-field-status-controls"
          style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-2)' }}
        >
          {(Object.keys(TEAM_STATUS_LABELS) as TeamOperationalStatus[]).map((status) => (
            <button
              key={status}
              data-testid={`firstaid-field-status-${status}`}
              onClick={async () => {
                await onSelect(status);
                onClose();
              }}
              className="touch-target"
              style={{
                minHeight: 'var(--touch-min)',
                padding: 'var(--space-3)',
                borderRadius: 'var(--radius-sm)',
                border: `1px solid ${currentStatus === status ? 'var(--color-brand)' : 'var(--color-border)'}`,
                background: currentStatus === status ? 'var(--color-brand-dim)' : 'transparent',
                color: 'var(--color-text)',
                fontSize: 'var(--text-sm)',
                fontWeight: 600,
                cursor: 'pointer',
                textAlign: 'left',
              }}
            >
              {TEAM_STATUS_LABELS[status]}
            </button>
          ))}
        </div>
        <button
          onClick={onClose}
          style={{
            marginTop: 'var(--space-2)',
            padding: 'var(--space-3)',
            border: 'none',
            background: 'var(--color-surface-sunken)',
            borderRadius: 'var(--radius-sm)',
            color: 'var(--color-text-subtle)',
            fontSize: 'var(--text-sm)',
            cursor: 'pointer',
          }}
        >
          Avbryt
        </button>
      </div>
    </div>
  );
}
