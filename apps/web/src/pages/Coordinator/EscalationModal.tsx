/**
 * EscalationModal — modal for escalating an incident to ambulance or 113.
 */

import { FocusTrap } from '../../components/FocusTrap';
import { PATH_LABELS } from '../../lib/constants';

interface EscalationModalProps {
  escalatePath: string;
  escalateReason: string;
  escalating: boolean;
  onPathChange: (p: string) => void;
  onReasonChange: (r: string) => void;
  onSubmit: () => void;
  onClose: () => void;
}

export function EscalationModal({
  escalatePath,
  escalateReason,
  escalating,
  onPathChange,
  onReasonChange,
  onSubmit,
  onClose,
}: EscalationModalProps) {
  return (
    <div
      role="dialog"
      aria-label="Eskalér hendelse"
      aria-modal="true"
      className="modal-backdrop"
    >
      <FocusTrap onEscape={onClose}>
        <div style={{
          background: 'var(--color-surface)', borderRadius: 'var(--radius-lg)',
          padding: 'var(--space-6)', maxWidth: 440, width: '100%',
        }}>
          <h2 className="text-lg fw-700 mb-4">
            Eskalér hendelse
          </h2>

          <div className="flex-col gap-3 mb-4">
            {(['path_a_rk_ambulance', 'path_b_113'] as const).map((path) => (
              <button
                key={path}
                onClick={() => onPathChange(path)}
                style={{
                  minHeight: 'var(--touch-min)',
                  padding: 'var(--space-3) var(--space-4)',
                  borderRadius: 'var(--radius-md)',
                  border: `2px solid ${escalatePath === path ? 'var(--color-status-critical)' : 'var(--color-border)'}`,
                  background: escalatePath === path ? 'var(--color-status-critical-bg)' : 'transparent',
                  color: 'var(--color-text)',
                  fontWeight: 600,
                  fontSize: 'var(--text-sm)',
                  cursor: 'pointer',
                  textAlign: 'left',
                }}
              >
                {PATH_LABELS[path]}
              </button>
            ))}
          </div>

          <div className="mb-4">
            <label htmlFor="escalate-reason" className="field-label">
              Årsak (valgfritt)
            </label>
            <textarea
              id="escalate-reason"
              value={escalateReason}
              onChange={(e) => onReasonChange(e.target.value)}
              rows={3}
              className="form-textarea"
            />
          </div>

          <div className="flex gap-2">
            <button
              onClick={onClose}
              className="btn-ghost"
              style={{ flex: 1, minHeight: 'var(--touch-min)' }}
            >
              Avbryt
            </button>
            <button
              onClick={onSubmit}
              disabled={escalating}
              style={{
                flex: 1, minHeight: 'var(--touch-min)', borderRadius: 'var(--radius-md)',
                border: 'none', background: 'var(--color-status-critical)', color: 'white',
                fontWeight: 700, cursor: 'pointer',
              }}
            >
              {escalating ? 'Sender...' : 'Bekreft eskalering'}
            </button>
          </div>
        </div>
      </FocusTrap>
    </div>
  );
}
