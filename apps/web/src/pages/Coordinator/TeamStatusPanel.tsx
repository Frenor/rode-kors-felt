/**
 * TeamStatusPanel — the coordinator's at-a-glance view of every patrol.
 *
 * "Trenger bistand" is the most safety-critical signal a patrol can send.
 * Until this panel existed it was only visible indirectly (as a reason in
 * the sick bay's critical-incoming list), so a coordinator could miss it
 * entirely. Teams needing assistance are pinned to the top in red.
 */

import { useState, type FormEvent } from 'react';
import { TEAM_OPERATIONAL_STATUS_LABELS, TEAM_OPERATIONAL_STATUS_STYLE, TEAM_TRANSPORT_LABELS } from '../../lib/constants';
import type { Team, TeamOperationalStatus } from '../../lib/types';
import { Button, Pill } from '../../components/ui';
import { TeamAssistanceActions } from './TeamAssistanceActions';

interface TeamStatusPanelProps {
  teams: Team[];
  /** Optional: how many devices are broadcasting per team (from live positions). */
  memberCounts?: Record<string, number>;
  /** Stand a patrol down after its call for help is resolved (confirmed inline). */
  onClearAssistance?: (teamId: string) => Promise<void> | void;
  /** Open the message compose addressed to this patrol. */
  onMessageTeam?: (teamId: string) => void;
  /** Last sector/place dispatched to each team (gap B4 / item 8.23). */
  sectors?: Record<string, { sector: string; assignedAt: string }>;
  /** Dispatch a team to a sector or place — distinct from assigning a patient. */
  onDispatchTeam?: (teamId: string, sector: string) => Promise<void> | void;
}

const STATUS_STYLE = TEAM_OPERATIONAL_STATUS_STYLE;

const STATUS_PRIORITY: Record<TeamOperationalStatus, number> = {
  needs_assistance: 0,
  on_scene: 1,
  en_route: 2,
  available: 3,
  unavailable: 4,
};

function formatClock(iso?: string | null): string | null {
  if (!iso) return null;
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return null;
  return d.toLocaleTimeString('nb-NO', { hour: '2-digit', minute: '2-digit' });
}

/**
 * "Send til" (gap B4 / item 8.23) — a coordinator control for the sector-
 * assignment relay that already existed on the wire and in the field, but
 * had no sender. An inline text field beats a picker here: sectors are named
 * things ("Sektor B", "km 12"), not a fixed list.
 */
function TeamDispatchForm({
  team,
  sector,
  onDispatch,
}: {
  team: Team;
  sector?: { sector: string; assignedAt: string };
  onDispatch?: (teamId: string, sector: string) => Promise<void> | void;
}) {
  const [open, setOpen] = useState(false);
  const [value, setValue] = useState('');
  const [sending, setSending] = useState(false);

  if (!onDispatch) return null;

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    const trimmed = value.trim();
    if (!trimmed || sending) return;
    setSending(true);
    try {
      await onDispatch(team.id, trimmed);
      setValue('');
      setOpen(false);
    } finally {
      setSending(false);
    }
  };

  return (
    <span style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)', flexWrap: 'wrap' }}>
      {sector?.sector && (
        <span data-testid={`team-status-sector-${team.id}`} className="data" style={{ fontSize: 'var(--text-xs)', color: 'var(--color-text-muted)' }}>
          → {sector.sector}
        </span>
      )}
      {open ? (
        <form onSubmit={(e) => void submit(e)} style={{ display: 'flex', gap: 'var(--space-1)', alignItems: 'center' }}>
          <label className="sr-only" htmlFor={`team-status-dispatch-input-${team.id}`}>
            Sektor eller sted for {team.name}
          </label>
          <input
            id={`team-status-dispatch-input-${team.id}`}
            data-testid={`team-status-dispatch-input-${team.id}`}
            className="field"
            type="text"
            placeholder="Sektor eller sted"
            value={value}
            onChange={(e) => setValue(e.target.value)}
            autoFocus
            style={{ minHeight: 44, fontSize: 'var(--text-sm)', width: 150 }}
          />
          <Button type="submit" variant="secondary" size="sm" icon="send" disabled={!value.trim() || sending}>
            {sending ? 'Sender…' : 'Send'}
          </Button>
          <Button variant="ghost" size="sm" onClick={() => setOpen(false)}>
            Avbryt
          </Button>
        </form>
      ) : (
        <Button
          variant="secondary"
          size="sm"
          icon="navigate"
          data-testid={`team-status-dispatch-${team.id}`}
          onClick={() => setOpen(true)}
        >
          Send til
        </Button>
      )}
    </span>
  );
}

export function TeamStatusPanel({ teams, memberCounts = {}, onClearAssistance, onMessageTeam, sectors = {}, onDispatchTeam }: TeamStatusPanelProps) {
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
        <h2 id="team-status-panel-title" className="section-label" style={{ margin: 0 }}>
          Lag (<span className="data">{teams.length}</span>)
        </h2>
        {needsAssistanceCount > 0 && (
          <Pill
            role="status"
            aria-live="assertive"
            data-testid="team-status-needs-assistance-count"
            tone={{ color: 'white', bg: 'var(--color-status-critical)' }}
          >
            {needsAssistanceCount} trenger bistand
          </Pill>
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
                <Pill dot tone={{ color: style.color, bg: style.bg, border: style.border }}>
                  {TEAM_OPERATIONAL_STATUS_LABELS[status] ?? status}
                </Pill>
                {isCritical && team.statusNote && (
                  <span style={{ fontSize: 'var(--text-sm)', color: 'var(--color-status-critical)', fontWeight: 600 }}>
                    {team.statusNote}
                  </span>
                )}
                <span style={{ flex: 1 }} />
                <span style={{ fontSize: 'var(--text-xs)', color: 'var(--color-text-muted)', display: 'flex', gap: 'var(--space-2)' }}>
                  {team.transport && <span>{TEAM_TRANSPORT_LABELS[team.transport] ?? team.transport}</span>}
                  {members ? <span><span className="data">{members}</span> enhet{members === 1 ? '' : 'er'}</span> : null}
                  {updated && <span>kl. <span className="data">{updated}</span></span>}
                </span>
                <TeamDispatchForm team={team} sector={sectors[team.id]} onDispatch={onDispatchTeam} />
                {isCritical && (
                  <TeamAssistanceActions team={team} onClear={onClearAssistance} onMessage={onMessageTeam} testIdPrefix="team-status" />
                )}
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
