/**
 * IncidentCard — renders a single incident article in the coordinator feed.
 */

import type { Incident, Team } from '../../lib/types';
import { typeLabels, PATH_LABELS, TRIAGE_COLORS } from '../../lib/constants';

interface IncidentCardProps {
  incident: Incident;
  teams: Team[];
  triageResult: any;
  triageLoading: boolean;
  triageError: string | undefined;
  isNew: boolean;
  onEscalate: (id: string) => void;
  onStatusUpdate: (id: string, status: string) => void;
  onTriageAssess: (inc: Incident) => void;
  calcEta: (team: any, incident: any) => string | null;
}

export function IncidentCard({
  incident: inc,
  teams,
  triageResult,
  triageLoading,
  triageError,
  isNew,
  onEscalate,
  onStatusUpdate,
  onTriageAssess,
  calcEta,
}: IncidentCardProps) {
  const assignedTeam = teams.find((t) => t.id === inc.teamId);
  const eta = inc.status === 'dispatched' && assignedTeam ? calcEta(assignedTeam, inc) : null;

  return (
    <article
      id={`inc-${inc.id}`}
      className={isNew ? 'animate-flash animate-slide-in-top' : undefined}
      style={{
        padding: 'var(--space-4)', borderRadius: 'var(--radius-md)',
        border: inc.activeEscalation
          ? '2px solid var(--color-status-critical)'
          : inc.source === 'coordinator'
          ? '1px dashed var(--color-brand)'
          : '1px solid var(--color-border)',
        background: 'var(--color-surface)',
      }}
    >
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)', flexWrap: 'wrap' }}>
            <strong>{typeLabels[inc.type] || inc.type}</strong>
            {inc.source === 'coordinator' && (
              <span style={{
                fontFamily: 'var(--font-mono)', fontSize: 'var(--text-xs)',
                fontWeight: 700, color: 'var(--color-brand)',
                border: '1px solid var(--color-brand)',
                borderRadius: 'var(--radius-sm)', padding: '0 4px',
              }}>
                K
              </span>
            )}
            {inc.status === 'dispatched' && assignedTeam && (
              <span style={{ fontFamily: 'var(--font-mono)', fontSize: 'var(--text-xs)', color: 'var(--color-text-muted)' }}>
                Tildelt: {assignedTeam.name}{eta ? ` · ETA ${eta}` : ''}
              </span>
            )}
            {inc.status === 'dispatched' && !assignedTeam && (
              <span style={{ fontFamily: 'var(--font-mono)', fontSize: 'var(--text-xs)', color: 'var(--color-text-muted)' }}>
                Tildelt
              </span>
            )}
            {inc.acvpu && (
              <span style={{ fontFamily: 'var(--font-mono)', fontSize: 'var(--text-xs)' }}>
                ACVPU: {inc.acvpu.toUpperCase()}
              </span>
            )}
          </div>
          {inc.activeEscalation && (
            <span style={{
              display: 'inline-block', marginTop: 4,
              fontFamily: 'var(--font-mono)', fontSize: 'var(--text-xs)',
              fontWeight: 700, color: 'var(--color-status-critical)',
            }}>
              ⚠ ESKALERT: {PATH_LABELS[inc.activeEscalation.path] ?? inc.activeEscalation.path}
            </span>
          )}
          {inc.notes && inc.source === 'coordinator' && (
            <div style={{ fontSize: 'var(--text-xs)', color: 'var(--color-text-muted)', marginTop: 4, fontStyle: 'italic' }}>
              {inc.notes}
            </div>
          )}
          <div style={{ fontFamily: 'var(--font-mono)', fontSize: 'var(--text-xs)', color: 'var(--color-text-subtle)', marginTop: 4 }}>
            {new Date(inc.createdAt).toLocaleTimeString('nb-NO', { hour: '2-digit', minute: '2-digit' })}
          </div>
        </div>

        <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap', justifyContent: 'flex-end' }}>
          {/* AI triage button */}
          <button
            onClick={() => onTriageAssess(inc)}
            disabled={triageLoading}
            title="Be om AI-vurdering av kritikalitet"
            style={{
              fontSize: 11, padding: '4px 8px', borderRadius: 4,
              border: '1px solid var(--color-brand)',
              background: triageResult ? 'var(--color-brand)' : 'transparent',
              color: triageResult ? 'white' : 'var(--color-brand)',
              cursor: 'pointer', fontFamily: 'var(--font-mono)',
            }}
          >
            {triageLoading ? '⏳ AI...' : triageResult ? '✦ AI' : '✦ Vurder'}
          </button>

          {inc.status !== 'resolved' && (
            <>
              {!inc.activeEscalation && (
                <button
                  onClick={() => onEscalate(inc.id)}
                  style={{
                    fontSize: 11, padding: '4px 8px', borderRadius: 4,
                    border: '1px solid var(--color-status-critical)',
                    background: 'transparent',
                    color: 'var(--color-status-critical)',
                    cursor: 'pointer',
                  }}
                >
                  ⚠ Eskalér
                </button>
              )}
              {inc.status === 'dispatched' && (
                <button
                  onClick={() => onStatusUpdate(inc.id, 'on_scene')}
                  style={{ fontSize: 11, padding: '4px 8px', borderRadius: 4, border: '1px solid var(--color-brand)', background: 'transparent', cursor: 'pointer', color: 'var(--color-brand)' }}
                >
                  → Bekreftet på stedet
                </button>
              )}
              {inc.status === 'on_scene' && (
                <button
                  onClick={() => onStatusUpdate(inc.id, 'transporting')}
                  style={{ fontSize: 11, padding: '4px 8px', borderRadius: 4, border: '1px solid var(--color-border)', background: 'transparent', cursor: 'pointer' }}
                >
                  → Transport
                </button>
              )}
              <button
                onClick={() => onStatusUpdate(inc.id, 'resolved')}
                style={{ fontSize: 11, padding: '4px 8px', borderRadius: 4, border: '1px solid var(--color-border)', background: 'transparent', cursor: 'pointer', color: 'var(--color-status-ok)' }}
              >
                ✓ Løst
              </button>
            </>
          )}
        </div>
      </div>

      {/* AI triage result panel */}
      {triageError && (
        <div style={{
          marginTop: 'var(--space-3)',
          padding: 'var(--space-2) var(--space-3)',
          borderRadius: 'var(--radius-sm)',
          background: 'var(--color-status-critical-bg)',
          color: 'var(--color-status-critical)',
          fontFamily: 'var(--font-mono)', fontSize: 'var(--text-xs)',
        }}>
          {triageError}
        </div>
      )}

      {triageResult && (() => {
        const c = TRIAGE_COLORS[triageResult.level];
        if (!c) return null;
        return (
          <div style={{
            marginTop: 'var(--space-3)',
            padding: 'var(--space-3)',
            borderRadius: 'var(--radius-sm)',
            background: c.bg,
            border: `1px solid ${c.color}`,
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)', marginBottom: 'var(--space-1)' }}>
              <span style={{
                fontFamily: 'var(--font-mono)', fontSize: 'var(--text-xs)',
                fontWeight: 700, color: c.color, textTransform: 'uppercase',
              }}>
                ✦ AI — {c.label}
              </span>
            </div>
            <p style={{ fontSize: 'var(--text-xs)', margin: '0 0 var(--space-1)', color: 'var(--color-text)' }}>
              {triageResult.summary}
            </p>
            <p style={{ fontSize: 'var(--text-xs)', margin: 0, fontWeight: 600, color: c.color }}>
              → {triageResult.recommendation}
            </p>
          </div>
        );
      })()}
    </article>
  );
}
