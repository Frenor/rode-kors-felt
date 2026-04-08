/**
 * IncidentFeed — the left-column incident list for the coordinator dashboard.
 */

import type { Incident, Team } from '../../lib/types';
import { IncidentCard } from './IncidentCard';

interface IncidentFeedProps {
  incidents: Incident[];
  teams: Team[];
  loading: boolean;
  flashIds: Set<string>;
  triageResults: Record<string, any>;
  triageLoading: Record<string, boolean>;
  triageErrors: Record<string, string>;
  activeFilter: string | null;
  onClearFilter: () => void;
  onEscalate: (id: string) => void;
  onResolveEscalation: (id: string) => void;
  onReopenEscalation: (id: string, escalationId?: string) => void;
  onStatusUpdate: (id: string, status: string) => void;
  onTriageAssess: (inc: Incident) => void;
  onNewOppdrag: () => void;
  calcEta: (team: any, incident: any) => string | null;
}

export function IncidentFeed({
  incidents,
  teams,
  loading,
  flashIds,
  triageResults,
  triageLoading,
  triageErrors,
  activeFilter,
  onClearFilter,
  onEscalate,
  onResolveEscalation,
  onReopenEscalation,
  onStatusUpdate,
  onTriageAssess,
  onNewOppdrag,
  calcEta,
}: IncidentFeedProps) {
  return (
    <div>
      <div className="flex-between mb-3">
        <div className="flex-align gap-2">
          <h2 className="section-label" style={{ margin: 0 }}>
            Hendelsesfeed
          </h2>
          {activeFilter && (
            <button
              onClick={onClearFilter}
              style={{
                fontSize: 'var(--text-xs)', padding: '2px 8px',
                borderRadius: 'var(--radius-sm)',
                border: '1px solid var(--color-border)',
                background: 'var(--color-surface-sunken)',
                color: 'var(--color-text-muted)', cursor: 'pointer',
              }}
            >
              Fjern filter ✕
            </button>
          )}
        </div>
        <button
          onClick={onNewOppdrag}
          style={{
            padding: 'var(--space-1) var(--space-3)',
            borderRadius: 'var(--radius-md)',
            border: '1px solid var(--color-brand)',
            background: 'transparent', color: 'var(--color-brand)',
            fontWeight: 600, fontSize: 'var(--text-sm)', cursor: 'pointer',
          }}
        >
          + Nytt oppdrag
        </button>
      </div>

      {loading ? (
        <p>Laster...</p>
      ) : incidents.length === 0 ? (
        <div className="card text-subtle" style={{ padding: 'var(--space-8)', textAlign: 'center' }}>
          <span aria-hidden="true" style={{ display: 'block', fontSize: 'var(--text-2xl)', marginBottom: 'var(--space-2)' }}>📋</span>
          Ingen aktive hendelser
        </div>
      ) : (
        <div role="feed" aria-label="Hendelser" className="flex-col gap-2">
          {incidents.map((inc) => (
            <IncidentCard
              key={inc.id}
              incident={inc}
              teams={teams}
              triageResult={triageResults[inc.id]}
              triageLoading={triageLoading[inc.id] ?? false}
              triageError={triageErrors[inc.id]}
              isNew={flashIds.has(inc.id)}
              onEscalate={onEscalate}
              onResolveEscalation={onResolveEscalation}
              onReopenEscalation={onReopenEscalation}
              onStatusUpdate={onStatusUpdate}
              onTriageAssess={onTriageAssess}
              calcEta={calcEta}
            />
          ))}
        </div>
      )}
    </div>
  );
}
