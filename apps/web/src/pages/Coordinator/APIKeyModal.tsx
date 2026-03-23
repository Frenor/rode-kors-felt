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
      style={{
        position: 'fixed', inset: 0, zIndex: 'var(--z-modal)' as React.CSSProperties['zIndex'],
        background: 'rgba(0,0,0,0.5)', display: 'flex',
        alignItems: 'center', justifyContent: 'center', padding: 'var(--space-4)',
      }}
    >
      <FocusTrap onEscape={onClose}>
        <div style={{
          background: 'var(--color-surface)', borderRadius: 'var(--radius-lg)',
          padding: 'var(--space-6)', maxWidth: 440, width: '100%',
        }}>
          <h2 style={{ fontSize: 'var(--text-lg)', fontWeight: 700, marginBottom: 'var(--space-2)' }}>
            Anthropic API-nøkkel
          </h2>
          <p style={{ fontSize: 'var(--text-sm)', color: 'var(--color-text-muted)', marginBottom: 'var(--space-4)' }}>
            Nøkkelen lagres kun lokalt i nettleseren din og brukes til AI-triageanalyse.
          </p>
          <input
            type="password"
            value={draft}
            onChange={(e) => onChange(e.target.value)}
            placeholder="sk-ant-..."
            style={{
              width: '100%', padding: 'var(--space-2) var(--space-3)',
              borderRadius: 'var(--radius-md)', border: '1px solid var(--color-input-border)',
              background: 'var(--color-input-bg)', color: 'var(--color-text)',
              fontFamily: 'var(--font-mono)', fontSize: 'var(--text-sm)',
              marginBottom: 'var(--space-4)',
            }}
          />
          <div style={{ display: 'flex', gap: 'var(--space-2)' }}>
            <button
              onClick={onClose}
              style={{
                flex: 1, minHeight: 'var(--touch-min)', borderRadius: 'var(--radius-md)',
                border: '1px solid var(--color-border)', background: 'transparent', cursor: 'pointer',
              }}
            >
              Avbryt
            </button>
            <button
              onClick={onSave}
              style={{
                flex: 1, minHeight: 'var(--touch-min)', borderRadius: 'var(--radius-md)',
                border: 'none', background: 'var(--color-brand)', color: 'white',
                fontWeight: 700, cursor: 'pointer',
              }}
            >
              Lagre
            </button>
          </div>
        </div>
      </FocusTrap>
    </div>
  );
}
