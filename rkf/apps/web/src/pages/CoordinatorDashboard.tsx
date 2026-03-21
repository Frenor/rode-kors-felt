import { useState, useEffect, useCallback } from 'react';
import { useAuthStore } from '../stores/auth';
import { useWsStore } from '../stores/ws';
import { api } from '../lib/api';
import { EventMap } from '../components/EventMap';

const typeLabels: Record<string, string> = {
  medical: 'Medisinsk', trauma: 'Traume',
  psychiatric: 'Psykiatrisk', other: 'Annet',
};

const PATH_LABELS: Record<string, string> = {
  path_a_rk_ambulance: 'Vei A — RK Ambulanse',
  path_b_113: 'Vei B — Ring 113',
};

export function CoordinatorDashboard() {
  const { eventId } = useAuthStore();
  const onMessage = useWsStore((s) => s.onMessage);
  const [incidents, setIncidents] = useState<any[]>([]);
  const [teams, setTeams] = useState<any[]>([]);
  const [stats, setStats] = useState<Record<string, number> | null>(null);
  const [loading, setLoading] = useState(true);
  const [escalateTarget, setEscalateTarget] = useState<string | null>(null);
  const [escalatePath, setEscalatePath] = useState<string>('path_a_rk_ambulance');
  const [escalateReason, setEscalateReason] = useState('');
  const [escalating, setEscalating] = useState(false);

  const fetchAll = useCallback(() => {
    if (!eventId) return;
    Promise.all([
      api.getIncidents(eventId),
      api.getEventStats(eventId),
      api.getEvent(eventId),
    ]).then(([incRes, statsRes, evtRes]) => {
      setIncidents(incRes.incidents);
      setStats(statsRes);
      setTeams(evtRes.teams ?? []);
      setLoading(false);
    }).catch(() => setLoading(false));
  }, [eventId]);

  useEffect(() => {
    fetchAll();
  }, [fetchAll]);

  // Live WS updates — merge into state instead of polling
  useEffect(() => {
    const off = onMessage((msg) => {
      if (msg.type === 'incident.created') {
        const inc = (msg.payload as any)?.incident;
        if (inc) setIncidents((prev) => [inc, ...prev.filter((i) => i.id !== inc.id)]);
      } else if (msg.type === 'incident.updated') {
        const inc = (msg.payload as any)?.incident;
        if (inc) setIncidents((prev) => prev.map((i) => (i.id === inc.id ? inc : i)));
      } else if (msg.type === 'escalation.raised') {
        const { incidentId, escalation } = (msg.payload as any) ?? {};
        if (incidentId) {
          setIncidents((prev) =>
            prev.map((i) => (i.id === incidentId ? { ...i, activeEscalation: escalation } : i)),
          );
        }
      } else if (msg.type === 'escalation.resolved') {
        const { incidentId } = (msg.payload as any) ?? {};
        if (incidentId) {
          setIncidents((prev) =>
            prev.map((i) => (i.id === incidentId ? { ...i, activeEscalation: null } : i)),
          );
        }
      } else if (msg.type === 'team.position') {
        const { teamId, position } = (msg.payload as any) ?? {};
        if (teamId && position) {
          setTeams((prev) =>
            prev.map((t) => (t.id === teamId ? { ...t, currentPosition: position } : t)),
          );
        }
      }
    });
    return off;
  }, [onMessage]);

  const handleStatusUpdate = async (id: string, status: string) => {
    await api.updateIncident(id, { status });
    setIncidents((prev) => prev.map((i) => (i.id === id ? { ...i, status } : i)));
  };

  const handleEscalate = async () => {
    if (!escalateTarget) return;
    setEscalating(true);
    try {
      await api.escalateIncident(escalateTarget, { path: escalatePath, reason: escalateReason || undefined });
    } finally {
      setEscalating(false);
      setEscalateTarget(null);
      setEscalateReason('');
    }
  };

  const handleScrollToIncident = (incidentId: string) => {
    document.getElementById(`inc-${incidentId}`)?.scrollIntoView({ behavior: 'smooth', block: 'center' });
  };

  return (
    <div>
      <h1 style={{ fontSize: 'var(--text-2xl)', fontWeight: 700, marginBottom: 'var(--space-6)' }}>
        Koordinator
      </h1>

      {/* Escalation modal */}
      {escalateTarget && (
        <div
          role="dialog"
          aria-label="Eskalér hendelse"
          aria-modal="true"
          style={{
            position: 'fixed', inset: 0, zIndex: 'var(--z-modal)',
            background: 'rgba(0,0,0,0.5)', display: 'flex',
            alignItems: 'center', justifyContent: 'center', padding: 'var(--space-4)',
          }}
        >
          <div style={{
            background: 'var(--color-surface)', borderRadius: 'var(--radius-lg)',
            padding: 'var(--space-6)', maxWidth: 440, width: '100%',
          }}>
            <h2 style={{ fontSize: 'var(--text-lg)', fontWeight: 700, marginBottom: 'var(--space-4)' }}>
              Eskalér hendelse
            </h2>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-3)', marginBottom: 'var(--space-4)' }}>
              {(['path_a_rk_ambulance', 'path_b_113'] as const).map((path) => (
                <button
                  key={path}
                  onClick={() => setEscalatePath(path)}
                  style={{
                    minHeight: 'var(--touch-min)',
                    padding: 'var(--space-3) var(--space-4)',
                    borderRadius: 'var(--radius-md)',
                    border: `2px solid ${escalatePath === path ? 'var(--color-status-critical)' : 'var(--color-border)'}`,
                    background: escalatePath === path ? 'var(--color-status-critical-bg)' : 'transparent',
                    color: 'var(--color-text)',
                    fontWeight: 600,
                    fontSize: 'var(--text-sm)',
                    cursor: 'pointer',
                    textAlign: 'left',
                  }}
                >
                  {PATH_LABELS[path]}
                </button>
              ))}
            </div>

            <div style={{ marginBottom: 'var(--space-4)' }}>
              <label htmlFor="escalate-reason" style={{ display: 'block', fontSize: 'var(--text-sm)', marginBottom: 'var(--space-1)' }}>
                Årsak (valgfritt)
              </label>
              <textarea
                id="escalate-reason"
                value={escalateReason}
                onChange={(e) => setEscalateReason(e.target.value)}
                rows={3}
                style={{
                  width: '100%', padding: 'var(--space-2)',
                  borderRadius: 'var(--radius-sm)', border: '1px solid var(--color-input-border)',
                  background: 'var(--color-input-bg)', color: 'var(--color-text)',
                  fontSize: 'var(--text-sm)', resize: 'vertical',
                }}
              />
            </div>

            <div style={{ display: 'flex', gap: 'var(--space-2)' }}>
              <button
                onClick={() => { setEscalateTarget(null); setEscalateReason(''); }}
                style={{
                  flex: 1, minHeight: 'var(--touch-min)', borderRadius: 'var(--radius-md)',
                  border: '1px solid var(--color-border)', background: 'transparent',
                  cursor: 'pointer',
                }}
              >
                Avbryt
              </button>
              <button
                onClick={handleEscalate}
                disabled={escalating}
                style={{
                  flex: 1, minHeight: 'var(--touch-min)', borderRadius: 'var(--radius-md)',
                  border: 'none', background: 'var(--color-status-critical)', color: 'white',
                  fontWeight: 700, cursor: 'pointer',
                }}
              >
                {escalating ? 'Sender...' : 'Bekreft eskalering'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Stats */}
      {stats && (
        <div style={{
          display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))',
          gap: 'var(--space-3)', marginBottom: 'var(--space-6)',
        }}>
          {[
            { l: 'Totalt', v: stats.totalIncidents },
            { l: 'Aktive', v: stats.activeIncidents },
            { l: 'Løste', v: stats.resolvedIncidents },
            { l: 'Pasienter', v: stats.totalPatients },
            { l: 'I behandling', v: stats.patientsInTreatment },
            { l: 'Utskrevet', v: stats.discharged },
          ].map(s => (
            <div key={s.l} style={{
              padding: 'var(--space-4)', borderRadius: 'var(--radius-md)',
              border: '1px solid var(--color-border)', background: 'var(--color-surface)',
            }}>
              <div style={{ fontFamily: 'var(--font-mono)', fontSize: 'var(--text-3xl)', fontWeight: 700 }}>
                {s.v ?? 0}
              </div>
              <div style={{
                fontFamily: 'var(--font-mono)', fontSize: 'var(--text-xs)',
                color: 'var(--color-text-subtle)', textTransform: 'uppercase',
              }}>
                {s.l}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Two-column layout: feed left, map right */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'minmax(320px, 1fr) 1fr',
        gap: 'var(--space-4)',
        alignItems: 'start',
      }}>
        {/* Left: incident feed */}
        <div>
          <h2 style={{
            fontFamily: 'var(--font-mono)', fontSize: 'var(--text-sm)',
            color: 'var(--color-text-muted)', textTransform: 'uppercase',
            marginBottom: 'var(--space-3)',
          }}>
            Hendelsesfeed
          </h2>

          {loading ? <p>Laster...</p> : incidents.length === 0 ? (
            <div style={{
              padding: 'var(--space-8)', textAlign: 'center',
              background: 'var(--color-surface)', borderRadius: 'var(--radius-md)',
              border: '1px solid var(--color-border)', color: 'var(--color-text-subtle)',
            }}>
              Ingen hendelser rapportert
            </div>
          ) : (
            <div role="feed" aria-label="Hendelser" style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-2)' }}>
              {incidents.map(inc => (
                <article id={`inc-${inc.id}`} key={inc.id} style={{
                  padding: 'var(--space-4)', borderRadius: 'var(--radius-md)',
                  border: inc.activeEscalation
                    ? '2px solid var(--color-status-critical)'
                    : '1px solid var(--color-border)',
                  background: 'var(--color-surface)',
                }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                    <div>
                      <strong>{typeLabels[inc.type] || inc.type}</strong>
                      {inc.acvpu && (
                        <span style={{ fontFamily: 'var(--font-mono)', fontSize: 'var(--text-xs)', marginLeft: 8 }}>
                          ACVPU: {inc.acvpu.toUpperCase()}
                        </span>
                      )}
                      {inc.activeEscalation && (
                        <span style={{
                          display: 'inline-block', marginLeft: 8,
                          fontFamily: 'var(--font-mono)', fontSize: 'var(--text-xs)',
                          fontWeight: 700, color: 'var(--color-status-critical)',
                        }}>
                          ⚠ ESKALERT: {PATH_LABELS[inc.activeEscalation.path] ?? inc.activeEscalation.path}
                        </span>
                      )}
                      <div style={{ fontFamily: 'var(--font-mono)', fontSize: 'var(--text-xs)', color: 'var(--color-text-subtle)', marginTop: 4 }}>
                        {new Date(inc.createdAt).toLocaleTimeString('nb-NO', { hour: '2-digit', minute: '2-digit' })}
                      </div>
                    </div>
                    {inc.status !== 'resolved' && (
                      <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap', justifyContent: 'flex-end' }}>
                        {!inc.activeEscalation && (
                          <button
                            onClick={() => setEscalateTarget(inc.id)}
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
                        {inc.status === 'on_scene' && (
                          <button onClick={() => handleStatusUpdate(inc.id, 'transporting')}
                            style={{ fontSize: 11, padding: '4px 8px', borderRadius: 4, border: '1px solid var(--color-border)', background: 'transparent', cursor: 'pointer' }}>
                            → Transport
                          </button>
                        )}
                        <button onClick={() => handleStatusUpdate(inc.id, 'resolved')}
                          style={{ fontSize: 11, padding: '4px 8px', borderRadius: 4, border: '1px solid var(--color-border)', background: 'transparent', cursor: 'pointer', color: 'var(--color-status-ok)' }}>
                          ✓ Løst
                        </button>
                      </div>
                    )}
                  </div>
                </article>
              ))}
            </div>
          )}
        </div>

        {/* Right: map */}
        <div style={{
          position: 'sticky',
          top: 72,
          height: 'calc(100dvh - 80px)',
          borderRadius: 'var(--radius-md)',
          overflow: 'hidden',
          border: '1px solid var(--color-border)',
        }}>
          <EventMap
            incidents={incidents}
            teams={teams}
            onIncidentClick={handleScrollToIncident}
          />
        </div>
      </div>
    </div>
  );
}
