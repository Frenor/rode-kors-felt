import { useState, useEffect } from 'react';
import { useAuthStore } from '../stores/auth';
import { api } from '../lib/api';

export function CoordinatorDashboard() {
  const { eventId } = useAuthStore();
  const [incidents, setIncidents] = useState<any[]>([]);
  const [stats, setStats] = useState<Record<string, number> | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchData = () => {
    if (!eventId) return;
    Promise.all([
      api.getIncidents(eventId),
      api.getEventStats(eventId),
    ]).then(([incRes, statsRes]) => {
      setIncidents(incRes.incidents);
      setStats(statsRes);
      setLoading(false);
    }).catch(() => setLoading(false));
  };

  useEffect(() => {
    fetchData();
    const iv = setInterval(fetchData, 10000);
    return () => clearInterval(iv);
  }, [eventId]);

  const typeLabels: Record<string, string> = {
    medical: 'Medisinsk', trauma: 'Traume',
    psychiatric: 'Psykiatrisk', other: 'Annet',
  };

  const handleStatusUpdate = async (id: string, status: string) => {
    await api.updateIncident(id, { status });
    fetchData();
  };

  return (
    <div>
      <h1 style={{ fontSize: 'var(--text-2xl)', fontWeight: 700, marginBottom: 'var(--space-6)' }}>
        Koordinator
      </h1>

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
                {s.v}
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
            <article key={inc.id} style={{
              padding: 'var(--space-4)', borderRadius: 'var(--radius-md)',
              border: '1px solid var(--color-border)', background: 'var(--color-surface)',
            }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                <div>
                  <strong>{typeLabels[inc.type] || inc.type}</strong>
                  {inc.avpu && <span style={{ fontFamily: 'var(--font-mono)', fontSize: 'var(--text-xs)', marginLeft: 8 }}>AVPU: {inc.avpu.toUpperCase()}</span>}
                  <div style={{ fontFamily: 'var(--font-mono)', fontSize: 'var(--text-xs)', color: 'var(--color-text-subtle)', marginTop: 4 }}>
                    {new Date(inc.createdAt).toLocaleTimeString('no-NO', { hour: '2-digit', minute: '2-digit' })}
                  </div>
                </div>
                {inc.status !== 'resolved' && (
                  <div style={{ display: 'flex', gap: 4 }}>
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
  );
}
