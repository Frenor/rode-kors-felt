/**
 * DeteriorationAlertsPanel — shows rapidly deteriorating patients (NEWS2 rising).
 */

import type { DeteriorationAlert } from '../../lib/types';

interface DeteriorationAlertsPanelProps {
  alerts: DeteriorationAlert[];
  onEscalate: (patientId: string) => void;
  onDismiss: (patientId: string) => void;
  onDismissAll: () => void;
}

export function DeteriorationAlertsPanel({
  alerts,
  onEscalate,
  onDismiss,
  onDismissAll,
}: DeteriorationAlertsPanelProps) {
  return (
    <div
      role="status"
      aria-live="polite"
      style={{
        marginBottom: 'var(--space-4)', padding: 'var(--space-4)',
        borderRadius: 'var(--radius-md)',
        border: '2px solid var(--color-status-critical)',
        background: 'var(--color-status-critical-bg)',
      }}
    >
      <div className="flex-between mb-2">
        <h3 className="text-sm fw-700 text-critical">
          Kritiske pasienter — NEWS2 stiger raskt
        </h3>
        <button
          onClick={onDismissAll}
          style={{ fontSize: 'var(--text-xs)', background: 'transparent', border: 'none', color: 'var(--color-text-subtle)', cursor: 'pointer' }}
        >
          Fjern alle
        </button>
      </div>

      <div className="flex-col gap-2">
        {[...alerts].sort((a, b) => b.ratePerHour - a.ratePerHour).map((alert) => (
          <div key={alert.patientId} style={{
            display: 'flex', justifyContent: 'space-between', alignItems: 'center',
            padding: 'var(--space-2) var(--space-3)',
            borderRadius: 'var(--radius-sm)', background: 'var(--color-surface)',
            border: '1px solid var(--color-status-critical)',
          }}>
            <div>
              <span
                className="mono-xs fw-700"
                aria-label={`NEWS2 stiger — score ${alert.news2Score}`}
              >
                <span aria-hidden="true">↑ </span>NEWS2 {alert.news2Score}
              </span>
              <span className="text-xs-subtle" style={{ marginLeft: 'var(--space-2)' }}>
                +{alert.ratePerHour.toFixed(1)} poeng/t
              </span>
            </div>
            <div className="flex-align gap-2">
              <button
                onClick={() => onEscalate(alert.patientId)}
                aria-label={`Eskalér pasient med NEWS2 ${alert.news2Score}`}
                className="btn-sm"
                style={{
                  border: '1px solid var(--color-status-critical)', background: 'transparent',
                  color: 'var(--color-status-critical)', fontWeight: 600,
                }}
              >
                Eskalér
              </button>
              <button
                onClick={() => onDismiss(alert.patientId)}
                aria-label={`Fjern varsel for pasient med NEWS2 ${alert.news2Score}`}
                style={{ fontSize: 'var(--text-xs)', background: 'transparent', border: 'none', color: 'var(--color-text-subtle)', cursor: 'pointer' }}
              >
                <span aria-hidden="true">✕</span>
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
