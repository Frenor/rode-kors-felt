import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuthStore } from '../stores/auth';
import { api } from '../lib/api';

export function FirstAiderDashboard() {
  const { eventId, teams } = useAuthStore();
  const [selectedTeam, setSelectedTeam] = useState<string | null>(null);
  const [incidents, setIncidents] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();

  useEffect(() => {
    if (!eventId) return;
    api.getIncidents(eventId).then((res) => {
      setIncidents(res.incidents);
      setLoading(false);
    }).catch(() => setLoading(false));
  }, [eventId]);

  const statusLabels: Record<string, string> = {
    on_scene: 'På stedet',
    transporting: 'Under transport',
    at_sickbay: 'På sykestue',
    handed_over: 'Overlevert',
    resolved: 'Løst',
  };

  const typeLabels: Record<string, string> = {
    medical: 'Medisinsk',
    trauma: 'Traume',
    psychiatric: 'Psykiatrisk',
    other: 'Annet',
  };

  return (
    <div className="animate-fade-in">
      {/* Team selection (if not chosen yet) */}
      {!selectedTeam && teams.length > 0 && (
        <div style={{ marginBottom: 'var(--space-6)' }}>
          <h2 style={{ fontSize: 'var(--text-lg)', fontWeight: 600, marginBottom: 'var(--space-3)' }}>
            Velg patrulje
          </h2>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-2)' }}>
            {teams.map((team) => (
              <button
                key={team.id}
                onClick={() => setSelectedTeam(team.id)}
                className="touch-target"
                style={{
                  width: '100%',
                  minHeight: 'var(--touch-min)',
                  padding: 'var(--space-4)',
                  borderRadius: 'var(--radius-md)',
                  border: '1px solid var(--color-border)',
                  background: 'var(--color-surface)',
                  color: 'var(--color-text)',
                  fontSize: 'var(--text-base)',
                  fontWeight: 600,
                  textAlign: 'left',
                  cursor: 'pointer',
                }}
              >
                {team.name}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Main action — 1 tap from dashboard */}
      <button
        onClick={() => navigate('/firstaid/incident', {
          state: { teamId: selectedTeam, eventId },
        })}
        className="touch-target"
        aria-label="Meld ny hendelse"
        style={{
          width: '100%',
          minHeight: 80,
          padding: 'var(--space-5)',
          borderRadius: 'var(--radius-lg)',
          border: 'none',
          background: 'var(--color-brand)',
          color: 'white',
          fontSize: 'var(--text-xl)',
          fontWeight: 700,
          cursor: 'pointer',
          marginBottom: 'var(--space-6)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          gap: 'var(--space-3)',
        }}
      >
        <span style={{ fontSize: '1.5em' }} aria-hidden="true">+</span>
        Meld hendelse
      </button>

      {/* Recent incidents */}
      <section aria-labelledby="recent-heading">
        <h2
          id="recent-heading"
          style={{
            fontSize: 'var(--text-sm)',
            fontFamily: 'var(--font-mono)',
            color: 'var(--color-text-muted)',
            textTransform: 'uppercase',
            letterSpacing: 'var(--tracking-mono)',
            marginBottom: 'var(--space-3)',
          }}
        >
          Siste hendelser
        </h2>

        {loading ? (
          <p style={{ color: 'var(--color-text-subtle)', fontSize: 'var(--text-sm)' }}>
            Laster...
          </p>
        ) : incidents.length === 0 ? (
          <div style={{
            padding: 'var(--space-8)',
            textAlign: 'center',
            color: 'var(--color-text-subtle)',
            background: 'var(--color-surface)',
            borderRadius: 'var(--radius-md)',
            border: '1px solid var(--color-border)',
          }}>
            <p style={{ fontSize: 'var(--text-sm)' }}>Ingen hendelser ennå</p>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-2)' }}>
            {incidents.slice(0, 10).map((incident) => (
              <div
                key={incident.id}
                style={{
                  padding: 'var(--space-4)',
                  borderRadius: 'var(--radius-md)',
                  border: '1px solid var(--color-border)',
                  background: 'var(--color-surface)',
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 'var(--space-2)' }}>
                  <span style={{
                    fontWeight: 600,
                    fontSize: 'var(--text-sm)',
                  }}>
                    {typeLabels[incident.type] || incident.type}
                  </span>
                  <span style={{
                    fontFamily: 'var(--font-mono)',
                    fontSize: 'var(--text-xs)',
                    padding: '2px 8px',
                    borderRadius: 'var(--radius-full)',
                    background: incident.status === 'resolved' ? 'var(--color-status-ok-bg)' : 'var(--color-status-warning-bg)',
                    color: incident.status === 'resolved' ? 'var(--color-status-ok)' : 'var(--color-status-warning)',
                  }}>
                    {statusLabels[incident.status] || incident.status}
                  </span>
                </div>
                {incident.avpu && (
                  <span style={{
                    fontFamily: 'var(--font-mono)',
                    fontSize: 'var(--text-xs)',
                    color: 'var(--color-text-muted)',
                  }}>
                    AVPU: {incident.avpu.toUpperCase()}
                  </span>
                )}
                <div style={{
                  fontFamily: 'var(--font-mono)',
                  fontSize: 'var(--text-xs)',
                  color: 'var(--color-text-subtle)',
                  marginTop: 'var(--space-1)',
                }}>
                  {new Date(incident.createdAt).toLocaleTimeString('no-NO', { hour: '2-digit', minute: '2-digit' })}
                </div>
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
