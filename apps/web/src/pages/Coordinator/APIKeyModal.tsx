/**
 * APIKeyModal — modal for configuring the Anthropic API key for AI triage.
 */

import { FocusTrap } from '../../components/FocusTrap';

interface APIKeyModalProps {
  draft: string;
  onChange: (v: string) => void;
  onSave: () => void;
  onClose: () => void;
}

export function APIKeyModal({ draft, onChange, onSave, onClose }: APIKeyModalProps) {
  return (
    <div
      role="dialog"
      aria-label="Anthropic API-nøkkel"
      aria-modal="true"
      className="modal-backdrop"
    >
      <FocusTrap onEscape={onClose}>
        <div style={{
          background: 'var(--color-surface)', borderRadius: 'var(--radius-lg)',
          padding: 'var(--space-6)', maxWidth: 440, width: '100%',
        }}>
          <h2 className="text-lg fw-700 mb-2">
            Anthropic API-nøkkel
          </h2>
          <p className="text-sm text-muted mb-4">
            Nøkkelen lagres kun lokalt i nettleseren din og brukes til AI-triageanalyse.
          </p>
          <input
            type="password"
            value={draft}
            onChange={(e) => onChange(e.target.value)}
            placeholder="sk-ant-..."
            className="form-input"
            style={{ fontFamily: 'var(--font-mono)', marginBottom: 'var(--space-4)' }}
          />
          <div className="flex gap-2">
            <button
              onClick={onClose}
              className="btn-ghost"
              style={{ flex: 1, minHeight: 'var(--touch-min)' }}
            >
              Avbryt
            </button>
            <button
              onClick={onSave}
              className="btn-brand"
              style={{ flex: 1, minHeight: 'var(--touch-min)' }}
            >
              Lagre
            </button>
          </div>
        </div>
      </FocusTrap>
    </div>
  );
}
