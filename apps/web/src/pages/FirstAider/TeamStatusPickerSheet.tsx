/**
 * TeamStatusPickerSheet
 *
 * Bottom-sheet modal for selecting a team's operational status.
 * "Trenger bistand" is the safety-critical option and is rendered as a
 * separate large red button above the four routine states so it cannot be
 * confused with them in the dark. Clicking the backdrop dismisses the sheet.
 */
import { TEAM_OPERATIONAL_STATUS_LABELS, TEAM_OPERATIONAL_STATUS_STYLE } from '../../lib/constants';
import type { TeamOperationalStatus } from '../../lib/types';

const ROUTINE_STATUSES: TeamOperationalStatus[] = ['available', 'en_route', 'on_scene', 'unavailable'];

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
  const pick = async (status: TeamOperationalStatus) => {
    await onSelect(status);
    onClose();
  };
  const critical = TEAM_OPERATIONAL_STATUS_STYLE.needs_assistance;
  const isNeedsAssistance = currentStatus === 'needs_assistance';

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Velg lagstatus"
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 'var(--z-modal)',
        background: 'rgba(0,0,0,0.55)',
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
          borderRadius: 'var(--radius-lg) var(--radius-lg) 0 0',
          padding: 'var(--space-4) var(--space-4) calc(var(--space-4) + env(safe-area-inset-bottom, 0px))',
          display: 'flex',
          flexDirection: 'column',
          gap: 'var(--space-2)',
        }}
      >
        <div style={{ fontWeight: 700, fontSize: 'var(--text-base)', marginBottom: 'var(--space-1)' }}>
          Lagstatus
        </div>

        <div
          role="radiogroup"
          aria-label="Lagstatus i felt"
          data-testid="firstaid-field-status-controls"
          style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-2)' }}
        >
          <button
            type="button"
            role="radio"
            aria-checked={isNeedsAssistance}
            data-testid="firstaid-field-status-needs_assistance"
            onClick={() => pick('needs_assistance')}
            style={{
              minHeight: 'var(--touch-comfortable)',
              padding: 'var(--space-3) var(--space-4)',
              borderRadius: 'var(--radius-md)',
              border: `2px solid ${critical.color}`,
              background: isNeedsAssistance ? critical.color : critical.bg,
              color: isNeedsAssistance ? 'white' : critical.color,
              fontSize: 'var(--text-lg)',
              fontWeight: 700,
              cursor: 'pointer',
              textAlign: 'left',
            }}
          >
            {isNeedsAssistance ? '✓ ' : '! '}{TEAM_OPERATIONAL_STATUS_LABELS.needs_assistance}
            <div style={{ fontSize: 'var(--text-sm)', fontWeight: 500, opacity: 0.85, marginTop: 2 }}>
              Varsler koordinator og sykestue umiddelbart
            </div>
          </button>

          {ROUTINE_STATUSES.map((status) => {
            const style = TEAM_OPERATIONAL_STATUS_STYLE[status];
            const selected = currentStatus === status;
            return (
              <button
                key={status}
                type="button"
                role="radio"
                aria-checked={selected}
                data-testid={`firstaid-field-status-${status}`}
                onClick={() => pick(status)}
                style={{
                  minHeight: 'var(--touch-min)',
                  padding: 'var(--space-3) var(--space-4)',
                  borderRadius: 'var(--radius-md)',
                  border: `2px solid ${selected ? style.color : 'var(--color-border)'}`,
                  background: selected ? style.bg : 'transparent',
                  color: 'var(--color-text)',
                  fontSize: 'var(--text-base)',
                  fontWeight: 700,
                  cursor: 'pointer',
                  textAlign: 'left',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 'var(--space-3)',
                }}
              >
                <span
                  aria-hidden="true"
                  style={{ width: 14, height: 14, borderRadius: '50%', background: style.color, flexShrink: 0 }}
                />
                {TEAM_OPERATIONAL_STATUS_LABELS[status]}
                {selected && <span style={{ marginLeft: 'auto', color: style.color }}>✓</span>}
              </button>
            );
          })}
        </div>

        <button
          type="button"
          onClick={onClose}
          style={{
            marginTop: 'var(--space-2)',
            minHeight: 'var(--touch-min)',
            padding: 'var(--space-3)',
            border: 'none',
            background: 'var(--color-surface-sunken)',
            borderRadius: 'var(--radius-md)',
            color: 'var(--color-text-muted)',
            fontSize: 'var(--text-base)',
            fontWeight: 600,
            cursor: 'pointer',
          }}
        >
          Avbryt
        </button>
      </div>
    </div>
  );
}
