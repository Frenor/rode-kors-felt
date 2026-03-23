/**
 * MCIOverviewPanel — shows MCI status banner and START triage tag counts.
 */

import type { Incident } from '../../lib/types';

interface MCIOverviewPanelProps {
  mciActivatedBy: string | null;
  incidents: Incident[];
  togglingMci: boolean;
  onToggleMci: () => void;
}

export function MCIOverviewPanel({
  mciActivatedBy,
  incidents,
  togglingMci,
  onToggleMci,
}: MCIOverviewPanelProps) {
  const triageTags = [
    { tag: 'immediate', label: 'Umiddelbar', color: '#d00', bg: '#fee' },
    { tag: 'delayed', label: 'Utsatt', color: '#b60', bg: '#fef3c7' },
    { tag: 'minor', label: 'Mindre', color: 'var(--color-status-ok)', bg: 'var(--color-status-ok-bg)' },
    { tag: 'expectant', label: 'Forventet', color: 'var(--color-text-subtle)', bg: 'var(--color-surface-sunken)' },
  ];

  return (
    <div
      role="alert"
      aria-live="assertive"
      aria-atomic="true"
      style={{
        marginBottom: 'var(--space-4)', padding: 'var(--space-4)',
        borderRadius: 'var(--radius-md)',
        border: '2px solid var(--color-status-critical)',
        background: 'var(--color-status-critical-bg)',
      }}
    >
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 'var(--space-3)' }}>
        <div>
          <span style={{ fontWeight: 700, color: 'var(--color-status-critical)', fontSize: 'var(--text-sm)' }}>
            MASSEULYKKE — MCI-MODUS AKTIV
          </span>
          {mciActivatedBy && (
            <span style={{ fontSize: 'var(--text-xs)', color: 'var(--color-text-subtle)', marginLeft: 'var(--space-2)' }}>
              (aktivert av {mciActivatedBy})
            </span>
          )}
        </div>
        <button
          onClick={onToggleMci}
          disabled={togglingMci}
          style={{
            fontSize: 'var(--text-xs)', padding: '4px 10px', borderRadius: 'var(--radius-sm)',
            border: '1px solid var(--color-status-critical)', background: 'transparent',
            color: 'var(--color-status-critical)', cursor: 'pointer', fontWeight: 600,
          }}
        >
          Deaktiver MCI
        </button>
      </div>

      {/* START triage tag counts */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 'var(--space-2)' }}>
        {triageTags.map(({ tag, label, color, bg }) => {
          const count = incidents.filter((i) => i.triageTag === tag).length;
          return (
            <div key={tag} style={{
              textAlign: 'center', padding: 'var(--space-3)',
              borderRadius: 'var(--radius-md)', background: bg,
              border: `1px solid ${color}`,
            }}>
              <div style={{ fontFamily: 'var(--font-mono)', fontSize: 'var(--text-2xl)', fontWeight: 700, color }}>
                {count}
              </div>
              <div style={{ fontSize: 'var(--text-xs)', color, fontWeight: 600 }}>{label}</div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
