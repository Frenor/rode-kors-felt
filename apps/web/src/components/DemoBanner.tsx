import { useState } from 'react';

interface DemoBannerProps {
  eventName: string;
}

export function DemoBanner({ eventName }: DemoBannerProps) {
  const [dismissed, setDismissed] = useState(
    () => sessionStorage.getItem('rkf-demo-banner-dismissed') === '1',
  );

  if (dismissed) return null;

  return (
    <div
      role="banner"
      aria-label="Demo-modus aktiv"
      style={{
        background: 'var(--color-status-warning-bg)',
        borderBottom: '2px solid var(--color-status-warning)',
        padding: 'var(--space-2) var(--space-4)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: 'var(--space-3)',
        fontFamily: 'var(--font-mono)',
        fontSize: 'var(--text-xs)',
        color: 'var(--color-status-warning)',
        fontWeight: 600,
        zIndex: 'var(--z-sticky)',
        flexShrink: 0,
      }}
    >
      <span>
        DEMO — {eventName} — Ingen ekte data lagres
      </span>
      <button
        onClick={() => {
          sessionStorage.setItem('rkf-demo-banner-dismissed', '1');
          setDismissed(true);
        }}
        aria-label="Lukk demo-banner"
        style={{
          background: 'transparent',
          border: 'none',
          color: 'var(--color-status-warning)',
          cursor: 'pointer',
          fontSize: 'var(--text-base)',
          lineHeight: 1,
          padding: 'var(--space-1)',
          flexShrink: 0,
        }}
      >
        ✕
      </button>
    </div>
  );
}
