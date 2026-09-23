/**
 * CoordinatorHeader — title, connected count, report download, AI key.
 * Both buttons are utilities, not actions of the event, so they stay neutral.
 */
import { Button } from '../../components/ui';

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
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 'var(--space-3)', flexWrap: 'wrap', marginBottom: 'var(--space-5)' }}>
      <h1 style={{ fontSize: 'var(--text-2xl)', fontWeight: 700, textWrap: 'balance' }}>Koordinator</h1>

      <div style={{ display: 'flex', gap: 'var(--space-2)', alignItems: 'center', flexWrap: 'wrap' }}>
        {connectedUsers !== undefined && (
          <span style={{ fontSize: 'var(--text-sm)', color: 'var(--color-text-muted)', fontWeight: 600 }}>
            <span className="data">{connectedUsers}</span> tilkoblet
          </span>
        )}

        <Button variant="secondary" size="sm" onClick={onDownloadReport} title="Last ned debrief-rapport som Markdown">
          Last ned rapport
        </Button>

        {!isDemo && (
          <Button
            variant={hasKey ? 'ghost' : 'secondary'}
            size="sm"
            icon={hasKey ? 'check' : 'sliders'}
            onClick={onOpenApiKey}
            title="Konfigurer Anthropic API-nøkkel for AI-triage"
            style={hasKey ? { color: 'var(--color-status-ok)' } : undefined}
          >
            {hasKey ? 'AI aktiv' : 'API-nøkkel'}
          </Button>
        )}
      </div>
    </div>
  );
}
