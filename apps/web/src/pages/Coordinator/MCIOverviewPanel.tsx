/**
 * MCIOverviewPanel — shows MCI status banner and START triage tag counts.
 */

import type { Incident } from '../../lib/types';

interface MCIOverviewPanelProps {
  mciActivatedBy: string | null;
  incidents: Incident[];
  togglingMci: boolean;
  downloadingSummary: boolean;
  onToggleMci: () => void;
  onDownloadSummary: () => void;
}

export function MCIOverviewPanel({
  mciActivatedBy,
  incidents,
  togglingMci,
  downloadingSummary,
  onToggleMci,
  onDownloadSummary,
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
      <div className="flex-between mb-3">
        <div>
          <span className="text-sm fw-700 text-critical">
            MASSEULYKKE — MCI-MODUS AKTIV
          </span>
          {mciActivatedBy && (
            <span className="text-xs-subtle" style={{ marginLeft: 'var(--space-2)' }}>
              (aktivert av {mciActivatedBy})
            </span>
          )}
        </div>
        <div className="flex gap-2">
          <button
            onClick={onDownloadSummary}
            disabled={downloadingSummary}
            className="btn-sm"
            style={{
              border: '1px solid var(--color-border)', background: 'var(--color-surface)',
              color: 'var(--color-text)', fontWeight: 600,
            }}
          >
            Last ned overlevering
          </button>
          <button
            onClick={onToggleMci}
            disabled={togglingMci}
            className="btn-sm"
            style={{
              border: '1px solid var(--color-status-critical)', background: 'transparent',
              color: 'var(--color-status-critical)', fontWeight: 600,
            }}
          >
            Deaktiver MCI
          </button>
        </div>
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
              <div className="fw-700 text-2xl" style={{ fontFamily: 'var(--font-mono)', color }}>
                {count}
              </div>
              <div className="text-xs fw-600" style={{ color }}>{label}</div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
