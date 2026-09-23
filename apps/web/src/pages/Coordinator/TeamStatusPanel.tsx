/**
 * TeamStatusPanel — the coordinator's at-a-glance view of every patrol.
 *
 * "Trenger bistand" is the most safety-critical signal a patrol can send.
 * Until this panel existed it was only visible indirectly (as a reason in
 * the sick bay's critical-incoming list), so a coordinator could miss it
 * entirely. Teams needing assistance are pinned to the top in red.
 */

import { TEAM_OPERATIONAL_STATUS_LABELS } from '../../lib/constants';
import type { Team, TeamOperationalStatus } from '../../lib/types';

interface TeamStatusPanelProps {
  teams: Team[];
  /** Optional: how many devices are broadcasting per team (from live positions). */
  memberCounts?: Record<string, number>;
}

const STATUS_STYLE: Record<TeamOperationalStatus, { color: string; bg: string; border: string }> = {
  available:        { color: 'var(--color-status-ok)',       bg: 'var(--color-status-ok-bg)',       border: 'var(--color-status-ok-border)' },
  en_route:         { color: 'var(--color-status-info)',     bg: 'var(--color-status-info-bg)',     border: 'var(--color-status-info-border)' },
  on_scene:         { color: 'var(--color-status-warning)',  bg: 'var(--color-status-warning-bg)',  border: 'var(--color-status-warning-border)' },
  needs_assistance: { color: 'var(--color-status-critical)', bg: 'var(--color-status-critical-bg)', border: 'var(--color-status-critical-border)' },
  unavailable:      { color: 'var(--color-text-subtle)',     bg: 'var(--color-surface-sunken)',     border: 'var(--color-border)' },
};

const STATUS_PRIORITY: Record<TeamOperationalStatus, number> = {
  needs_assistance: 0,
  on_scene: 1,
  en_route: 2,
  available: 3,
  unavailable: 4,
};

const TRANSPORT_LABELS: Record<string, string> = {
  foot: 'Til fots',
  bike: 'Sykkel',
  vehicle: 'Kjøretøy',
  atv: 'ATV',
};

function formatClock(iso?: string | null): string | null {
  if (!iso) return null;
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return null;
  return d.toLocaleTimeString('nb-NO', { hour: '2-digit', minute: '2-digit' });
}

export function TeamStatusPanel({ teams, memberCounts = {} }: TeamStatusPanelProps) {
  const rows = [...teams].sort((a, b) => {
    const pa = STATUS_PRIORITY[(a.operationalStatus ?? 'available') as TeamOperationalStatus] ?? 9;
    const pb = STATUS_PRIORITY[(b.operationalStatus ?? 'available') as TeamOperationalStatus] ?? 9;
    if (pa !== pb) return pa - pb;
    return a.name.localeCompare(b.name, 'nb');
  });
  const needsAssistanceCount = teams.filter((t) => t.operationalStatus === 'needs_assistance').length;

  return (
    <section
      aria-labelledby="team-status-panel-title"
      data-testid="coordinator-team-status"
      style={{
        marginBottom: 'var(--space-4)',
        border: `1px solid ${needsAssistanceCount > 0 ? 'var(--color-status-critical)' : 'var(--color-border)'}`,
        borderRadius: 'var(--radius-md)',
        background: 'var(--color-surface)',
        overflow: 'hidden',
      }}
    >
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: 'var(--space-3) var(--space-4)', borderBottom: '1px solid var(--color-border)' }}>
        <h2
          id="team-status-panel-title"
          style={{ margin: 0, fontSize: 'var(--text-sm)', fontFamily: 'var(--font-mono)', letterSpacing: 'var(--tracking-mono)', textTransform: 'uppercase', color: 'var(--color-text-muted)' }}
        >
          Lag ({teams.length})
        </h2>
        {needsAssistanceCount > 0 && (
          <span
            role="status"
            aria-live="assertive"
            data-testid="team-status-needs-assistance-count"
            style={{
              fontFamily: 'var(--font-mono)', fontSize: 'var(--text-xs)', fontWeight: 700,
              padding: '2px 10px', borderRadius: 'var(--radius-full)',
              background: 'var(--color-status-critical)', color: 'white',
            }}
          >
            {needsAssistanceCount} trenger bistand
          </span>
        )}
      </div>

      {rows.length === 0 ? (
        <p style={{ margin: 0, padding: 'var(--space-4)', fontSize: 'var(--text-sm)', color: 'var(--color-text-subtle)', textAlign: 'center' }}>
          Ingen lag registrert
        </p>
      ) : (
        <ul style={{ listStyle: 'none', margin: 0, padding: 'var(--space-2)', display: 'flex', flexDirection: 'column', gap: 'var(--space-1)' }}>
          {rows.map((team) => {
            const status = (team.operationalStatus ?? 'available') as TeamOperationalStatus;
            const style = STATUS_STYLE[status] ?? STATUS_STYLE.available;
            const isCritical = status === 'needs_assistance';
            const updated = formatClock(team.statusUpdatedAt);
            const members = memberCounts[team.id];
            return (
              <li
                key={team.id}
                data-testid={`team-status-row-${team.id}`}
                data-status={status}
                style={{
                  display: 'flex', alignItems: 'center', gap: 'var(--space-3)', flexWrap: 'wrap',
                  padding: 'var(--space-2) var(--space-3)',
                  borderRadius: 'var(--radius-sm)',
                  border: `1px solid ${isCritical ? 'var(--color-status-critical)' : 'transparent'}`,
                  background: isCritical ? 'var(--color-status-critical-bg)' : 'transparent',
                }}
              >
                <span style={{ fontWeight: 700, fontSize: 'var(--text-sm)', minWidth: 96 }}>
                  {team.name}
                </span>
                <span
                  style={{
                    fontFamily: 'var(--font-mono)', fontSize: 'var(--text-xs)', fontWeight: 700,
                    padding: '2px 10px', borderRadius: 'var(--radius-full)',
                    background: style.bg, color: style.color, border: `1px solid ${style.border}`,
                  }}
                >
                  {TEAM_OPERATIONAL_STATUS_LABELS[status] ?? status}
                </span>
                {isCritical && team.statusNote && (
                  <span style={{ fontSize: 'var(--text-sm)', color: 'var(--color-status-critical)', fontWeight: 600 }}>
                    {team.statusNote}
                  </span>
                )}
                <span style={{ flex: 1 }} />
                <span style={{ fontFamily: 'var(--font-mono)', fontSize: 'var(--text-xs)', color: 'var(--color-text-subtle)', display: 'flex', gap: 'var(--space-2)' }}>
                  {team.transport && <span>{TRANSPORT_LABELS[team.transport] ?? team.transport}</span>}
                  {members ? <span>{members} enhet{members === 1 ? '' : 'er'}</span> : null}
                  {updated && <span>kl. {updated}</span>}
                </span>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
