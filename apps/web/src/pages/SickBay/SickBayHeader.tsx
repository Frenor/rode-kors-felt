import { Button } from '../../components/ui';

interface SickBayHeaderProps {
  onNewPatient: () => void;
  /** Open patients whose re-assessment time has passed. */
  overdueCount?: number;
  /** Open patients on continuous monitoring (NEWS2 ≥ 7). */
  continuousCount?: number;
}

export function SickBayHeader({ onNewPatient, overdueCount = 0, continuousCount = 0 }: SickBayHeaderProps) {
  const parts: string[] = [];
  if (overdueCount > 0) parts.push(`${overdueCount} forfalt vurdering`);
  if (continuousCount > 0) parts.push(`${continuousCount} kontinuerlig overvåkning`);
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 'var(--space-3)', marginBottom: 'var(--space-4)' }}>
      <div style={{ minWidth: 0 }}>
        <h1 style={{ fontSize: 'var(--text-xl)', fontWeight: 700, textWrap: 'balance' }}>Sykestue</h1>
        {parts.length > 0 ? (
          <p
            role="status"
            data-testid="sickbay-attention-summary"
            style={{ margin: 0, fontSize: 'var(--text-sm)', fontWeight: 700, color: 'var(--color-status-critical)' }}
          >
            {parts.join(' · ')}
          </p>
        ) : (
          <p style={{ margin: 0, fontSize: 'var(--text-sm)', color: 'var(--color-text-muted)' }}>
            Ingen forfalte vurderinger
          </p>
        )}
      </div>
      <Button variant="primary" size="lg" icon="plus" onClick={onNewPatient} style={{ flexShrink: 0 }}>
        Ny pasient
      </Button>
    </div>
  );
}
