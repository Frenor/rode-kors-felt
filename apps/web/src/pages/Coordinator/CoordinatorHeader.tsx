/**
 * CoordinatorHeader — top bar with title, rapport and API-key button.
 */

interface CoordinatorHeaderProps {
  onDownloadReport: () => void;
  hasKey: boolean;
  isDemo: boolean;
  onOpenApiKey: () => void;
  connectedUsers?: number;
}

export function CoordinatorHeader({
  onDownloadReport,
  hasKey,
  isDemo,
  onOpenApiKey,
  connectedUsers,
}: CoordinatorHeaderProps) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 'var(--space-6)' }}>
      <h1 style={{ fontSize: 'var(--text-2xl)', fontWeight: 700 }}>Koordinator</h1>

      <div style={{ display: 'flex', gap: 'var(--space-2)', alignItems: 'center' }}>
        {connectedUsers !== undefined && (
          <span style={{
            fontFamily: 'var(--font-mono)',
            fontSize: 'var(--text-xs)',
            color: 'var(--color-text-subtle)',
          }}>
            {connectedUsers} tilkoblet
          </span>
        )}

        <button
          onClick={onDownloadReport}
          title="Last ned debrief-rapport som Markdown"
          style={{
            padding: 'var(--space-2) var(--space-3)', borderRadius: 'var(--radius-md)',
            border: '1px solid var(--color-border)', background: 'var(--color-surface)',
            color: 'var(--color-text-muted)', fontFamily: 'var(--font-mono)',
            fontSize: 'var(--text-xs)', cursor: 'pointer',
          }}
        >
          ⬇ Rapport
        </button>

        {!isDemo && (
          <button
            onClick={onOpenApiKey}
            title="Konfigurer Anthropic API-nøkkel for AI-triage"
            style={{
              padding: 'var(--space-2) var(--space-3)',
              borderRadius: 'var(--radius-md)',
              border: '1px solid var(--color-border)',
              background: hasKey ? 'var(--color-status-ok-bg)' : 'var(--color-surface)',
              color: hasKey ? 'var(--color-status-ok)' : 'var(--color-text-muted)',
              fontFamily: 'var(--font-mono)', fontSize: 'var(--text-xs)',
              cursor: 'pointer',
            }}
          >
            {hasKey ? '✓ AI aktiv' : '⚙ API-nøkkel'}
          </button>
        )}
      </div>
    </div>
  );
}
