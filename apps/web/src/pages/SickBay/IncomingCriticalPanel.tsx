import type { SickbayIncomingItem } from '../../lib/types';

interface IncomingCriticalPanelProps {
  items: SickbayIncomingItem[];
  onStartTreatment: (patientId: string) => void;
}

const reasonLabels: Record<string, string> = {
  needs_assistance: 'Trenger bistand',
  open_escalation: 'Aktiv eskalering',
  triage_immediate: 'START umiddelbar',
  news2_high: 'NEWS2 høy',
};

const progressLabels: Record<string, string> = {
  dispatched: 'Utsendt',
  on_scene: 'På stedet',
  transporting: 'Under transport',
  at_sickbay: 'Ved sykestue',
};

const triageLabels: Record<string, string> = {
  immediate: 'Umiddelbar',
  delayed: 'Utsatt',
  minor: 'Mindre',
  expectant: 'Forventet',
};

export function IncomingCriticalPanel({ items, onStartTreatment }: IncomingCriticalPanelProps) {
  if (items.length === 0) return null;

  const sortedItems = [...items].sort((a, b) => {
    const aNews = a.news2?.alertLevel === 'high' ? 0 : a.news2?.alertLevel === 'medium' ? 1 : 2;
    const bNews = b.news2?.alertLevel === 'high' ? 0 : b.news2?.alertLevel === 'medium' ? 1 : 2;
    if (aNews !== bNews) return aNews - bNews;
    return new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime();
  });

  return (
    <section
      data-testid="sickbay-critical-banner"
      role="alert"
      aria-live="assertive"
      style={{
        marginBottom: 'var(--space-4)',
        padding: 'var(--space-3)',
        borderRadius: 'var(--radius-md)',
        border: '2px solid var(--color-status-critical-border)',
        background: 'var(--color-status-critical-bg)',
      }}
    >
      <header style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 'var(--space-2)' }}>
        <h2 style={{ margin: 0, fontSize: 'var(--text-base)', color: 'var(--color-status-critical)' }}>
          Kritisk innkommende nå
        </h2>
        <span
          data-testid="sickbay-critical-count"
          style={{ fontFamily: 'var(--font-mono)', fontSize: 'var(--text-xs)', color: 'var(--color-status-critical)' }}
        >
          {items.length} pasient{items.length === 1 ? '' : 'er'}
        </span>
      </header>

      <div style={{ marginTop: 'var(--space-2)', display: 'flex', flexDirection: 'column', gap: 'var(--space-2)' }}>
        {sortedItems.map((item) => (
          <article
            key={item.incidentId}
            data-testid={`sickbay-critical-patient-${item.incidentId}`}
            style={{
              padding: 'var(--space-2)',
              borderRadius: 'var(--radius-sm)',
              border: '1px solid var(--color-status-critical-border)',
              background: 'var(--color-surface)',
              display: 'flex',
              justifyContent: 'space-between',
              gap: 'var(--space-2)',
            }}
          >
            <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
              <div style={{ fontWeight: 700, fontSize: 'var(--text-sm)' }}>
                Hendelse {item.incidentId.slice(0, 8)}
              </div>
              <div
                aria-label="Progresjon i forløpet"
                style={{ fontSize: 'var(--text-xs)', fontFamily: 'var(--font-mono)', color: 'var(--color-text-subtle)' }}
              >
                Forløp: {progressLabels[item.progressStage] ?? item.progressStage}
                {item.triageTag ? ` · START ${triageLabels[item.triageTag] ?? item.triageTag}` : ''}
                {item.news2 ? ` · NEWS2 ${item.news2.total}` : ''}
              </div>
              <div style={{ fontSize: 'var(--text-xs)', color: 'var(--color-text-subtle)' }}>
                {item.criticalReasons.map((reason) => reasonLabels[reason] ?? reason).join(' · ')}
              </div>
              <div style={{ fontFamily: 'var(--font-mono)', fontSize: 'var(--text-xs)', color: 'var(--color-text-subtle)' }}>
                {item.latestVitals
                  ? [
                      item.latestVitals.pulse != null ? `Puls ${item.latestVitals.pulse}` : null,
                      item.latestVitals.spo2 != null ? `SpO₂ ${item.latestVitals.spo2}` : null,
                      item.latestVitals.respiratoryRate != null ? `RF ${item.latestVitals.respiratoryRate}` : null,
                    ].filter(Boolean).join(' · ')
                  : 'Vitalia ikke registrert ennå'}
              </div>
            </div>
            {item.patientId ? (
              <button
                onClick={() => onStartTreatment(item.patientId!)}
                className="touch-target"
                style={{
                  minHeight: 'var(--touch-min)',
                  padding: '0 var(--space-3)',
                  borderRadius: 'var(--radius-sm)',
                  border: '1px solid var(--color-status-critical)',
                  background: 'var(--color-status-critical)',
                  color: 'white',
                  fontSize: 'var(--text-xs)',
                  fontWeight: 700,
                  cursor: 'pointer',
                  whiteSpace: 'nowrap',
                }}
              >
                Start behandling
              </button>
            ) : null}
          </article>
        ))}
      </div>
    </section>
  );
}
