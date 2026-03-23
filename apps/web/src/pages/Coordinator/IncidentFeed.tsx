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
  onStatusUpdate,
  onTriageAssess,
  onNewOppdrag,
  calcEta,
}: IncidentFeedProps) {
  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 'var(--space-3)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)' }}>
          <h2 style={{
            fontFamily: 'var(--font-mono)', fontSize: 'var(--text-sm)',
            color: 'var(--color-text-muted)', textTransform: 'uppercase', margin: 0,
          }}>
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
        <div style={{
          padding: 'var(--space-8)', textAlign: 'center',
          background: 'var(--color-surface)', borderRadius: 'var(--radius-md)',
          border: '1px solid var(--color-border)', color: 'var(--color-text-subtle)',
        }}>
          <span aria-hidden="true" style={{ display: 'block', fontSize: 'var(--text-2xl)', marginBottom: 'var(--space-2)' }}>📋</span>
          Ingen aktive hendelser
        </div>
      ) : (
        <div role="feed" aria-label="Hendelser" style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-2)' }}>
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
