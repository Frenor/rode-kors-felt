import { useLiveQuery } from 'dexie-react-hooks';
import { Button } from '../../components/ui';
import type { SickbayOccupancy } from '../../lib/constants';
import { offlineSickbayQueueDb } from '../../lib/offline-sickbay-queue';

interface SickBayHeaderProps {
  onNewPatient: () => void;
  /** Open patients whose re-assessment time has passed. */
  overdueCount?: number;
  /** Open patients on continuous monitoring (NEWS2 ≥ 7). */
  continuousCount?: number;
  /** Chair/bed occupancy (item 8.30) — `null` per type when capacity is not configured. */
  occupancy?: SickbayOccupancy;
}

export function SickBayHeader({ onNewPatient, overdueCount = 0, continuousCount = 0, occupancy }: SickBayHeaderProps) {
  const parts: string[] = [];
  if (overdueCount > 0) parts.push(`${overdueCount} forfalt vurdering`);
  if (continuousCount > 0) parts.push(`${continuousCount} kontinuerlig overvåkning`);

  // Live offline queue counts (item 8.27) — pending/syncing "venter på
  // sending", failed "ikke sendt". Nothing renders once the queue is empty,
  // matching the design system's "status strip only while degraded" rule.
  const queueItems = useLiveQuery(() => offlineSickbayQueueDb.queue.toArray(), [], []);
  const pendingQueueCount = (queueItems ?? []).filter((i) => i.status === 'pending' || i.status === 'syncing').length;
  const failedQueueCount = (queueItems ?? []).filter((i) => i.status === 'failed').length;

  const occupancyParts: string[] = [];
  if (occupancy?.chairs) occupancyParts.push(`Stoler ${occupancy.chairs.occupied}/${occupancy.chairs.total}`);
  if (occupancy?.beds) occupancyParts.push(`Senger ${occupancy.beds.occupied}/${occupancy.beds.total}`);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-2)', marginBottom: 'var(--space-4)' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 'var(--space-3)' }}>
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

      <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 'var(--space-3)' }}>
        {/* Occupancy strip (gap B6 / item 8.30) — never invents a denominator. */}
        {occupancyParts.length > 0 ? (
          <span data-testid="sickbay-occupancy" style={{ fontSize: 'var(--text-sm)', fontWeight: 600, color: 'var(--color-text-muted)' }}>
            <span className="data">{occupancyParts.join(' · ')}</span>
          </span>
        ) : (
          <span data-testid="sickbay-occupancy" style={{ fontSize: 'var(--text-sm)', color: 'var(--color-text-subtle)' }}>
            Kapasitet ikke satt
          </span>
        )}

        {(pendingQueueCount > 0 || failedQueueCount > 0) && (
          <span
            role="status"
            aria-live="polite"
            data-testid="sickbay-queue-status"
            style={{ fontSize: 'var(--text-sm)', fontWeight: 700 }}
          >
            {pendingQueueCount > 0 && (
              <span style={{ color: 'var(--color-status-warning)' }}>
                <span className="data">{pendingQueueCount}</span> venter på sending
              </span>
            )}
            {pendingQueueCount > 0 && failedQueueCount > 0 && <span style={{ color: 'var(--color-text-subtle)' }}> · </span>}
            {failedQueueCount > 0 && (
              <span style={{ color: 'var(--color-status-critical)' }}>
                <span className="data">{failedQueueCount}</span> ikke sendt
              </span>
            )}
          </span>
        )}
      </div>
    </div>
  );
}
