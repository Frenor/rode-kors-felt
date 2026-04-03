import type { Incident, Team } from '../../lib/types';

interface TeamSectorAssignment {
  sector: string;
  assignedAt: string;
}

interface ResourceAllocationBoardProps {
  teams: Team[];
  incidents: Incident[];
  sectors: string[];
  assignments: Record<string, TeamSectorAssignment>;
  onAssignTeam: (teamId: string, sector: string | null) => void;
}

const TRANSPORT_ICON: Record<string, string> = {
  foot: '🚶',
  bike: '🚲',
  vehicle: '🚑',
  atv: '🛻',
};

const DEFAULT_CENTER = { lat: 59.9649, lng: 10.671 };

function haversineKm(a: { lat: number; lng: number }, b: { lat: number; lng: number }) {
  const toRad = (d: number) => (d * Math.PI) / 180;
  const R = 6371;
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const x = Math.sin(dLat / 2) ** 2
    + Math.cos(toRad(a.lat)) * Math.cos(toRad(b.lat)) * Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(x), Math.sqrt(1 - x));
}

function getSectorAnchors(sectors: string[], incidents: Incident[], teams: Team[]) {
  const points = [
    ...incidents.filter((inc) => inc.location).map((inc) => inc.location!),
    ...teams.filter((team) => team.currentPosition).map((team) => team.currentPosition!),
  ];

  const center = points.length === 0
    ? DEFAULT_CENTER
    : {
        lat: points.reduce((sum, p) => sum + p.lat, 0) / points.length,
        lng: points.reduce((sum, p) => sum + p.lng, 0) / points.length,
      };

  const unresolved = incidents.filter((inc) => inc.status !== 'resolved' && inc.location);
  const anchors = new Map<string, { lat: number; lng: number }>();

  sectors.forEach((sector, index) => {
    const incidentAnchor = unresolved[index]?.location;
    if (incidentAnchor) {
      anchors.set(sector, incidentAnchor);
      return;
    }

    const angle = (2 * Math.PI * index) / Math.max(1, sectors.length);
    const delta = 0.0035;
    anchors.set(sector, {
      lat: center.lat + Math.sin(angle) * delta,
      lng: center.lng + Math.cos(angle) * delta,
    });
  });

  return anchors;
}

export function ResourceAllocationBoard({
  teams,
  incidents,
  sectors,
  assignments,
  onAssignTeam,
}: ResourceAllocationBoardProps) {
  const sectorAnchors = getSectorAnchors(sectors, incidents, teams);

  const distanceLabel = (team: Team, sector: string) => {
    if (!team.currentPosition) return 'Ingen GPS';
    const anchor = sectorAnchors.get(sector);
    if (!anchor) return 'Ukjent';
    const km = haversineKm(team.currentPosition, anchor);
    return km < 1 ? `~${Math.round(km * 1000)} m` : `~${km.toFixed(1)} km`;
  };

  return (
    <section
      aria-labelledby="resource-board-title"
      style={{
        marginBottom: 'var(--space-4)',
        border: '1px solid var(--color-border)',
        borderRadius: 'var(--radius-md)',
        background: 'var(--color-surface)',
        overflow: 'hidden',
      }}
    >
      <div style={{ padding: 'var(--space-3) var(--space-4)', borderBottom: '1px solid var(--color-border)' }}>
        <h2
          id="resource-board-title"
          style={{
            margin: 0,
            fontSize: 'var(--text-sm)',
            fontFamily: 'var(--font-mono)',
            letterSpacing: 'var(--tracking-mono)',
            textTransform: 'uppercase',
            color: 'var(--color-text-muted)',
          }}
        >
          Ressursallokering (lag × sektorer)
        </h2>
      </div>

      <div style={{ overflowX: 'auto' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 760 }}>
          <thead>
            <tr>
              <th style={{ textAlign: 'left', padding: 'var(--space-3)', fontSize: 'var(--text-xs)', color: 'var(--color-text-subtle)' }}>
                Lag
              </th>
              {sectors.map((sector) => (
                <th key={sector} style={{ textAlign: 'center', padding: 'var(--space-3)', fontSize: 'var(--text-xs)', color: 'var(--color-text-subtle)' }}>
                  {sector}
                </th>
              ))}
              <th style={{ textAlign: 'center', padding: 'var(--space-3)', fontSize: 'var(--text-xs)', color: 'var(--color-text-subtle)' }}>
                Nullstill
              </th>
            </tr>
          </thead>
          <tbody>
            {teams.map((team) => {
              const assigned = assignments[team.id]?.sector ?? null;
              const avatarText = (team.name ?? '?').slice(0, 2).toUpperCase();
              return (
                <tr key={team.id} style={{ borderTop: '1px solid var(--color-border)' }}>
                  <td style={{ padding: 'var(--space-3)' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)' }}>
                      <div
                        aria-hidden="true"
                        style={{
                          width: 28,
                          height: 28,
                          borderRadius: '50%',
                          background: 'var(--color-brand-dim)',
                          color: 'var(--color-brand)',
                          display: 'grid',
                          placeItems: 'center',
                          fontSize: 'var(--text-xs)',
                          fontWeight: 700,
                        }}
                      >
                        {avatarText}
                      </div>
                      <div>
                        <div style={{ fontWeight: 600, fontSize: 'var(--text-sm)' }}>
                          {team.name}
                        </div>
                        <div style={{ fontSize: 'var(--text-xs)', color: 'var(--color-text-subtle)' }}>
                          {(TRANSPORT_ICON[team.transport ?? 'foot'] ?? '🚶')} {team.transport ?? 'foot'}
                        </div>
                      </div>
                    </div>
                  </td>
                  {sectors.map((sector) => {
                    const active = assigned === sector;
                    return (
                      <td key={sector} style={{ padding: 'var(--space-2)', textAlign: 'center' }}>
                        <button
                          onClick={() => onAssignTeam(team.id, active ? null : sector)}
                          style={{
                            width: '100%',
                            minHeight: 54,
                            borderRadius: 'var(--radius-sm)',
                            border: `1px solid ${active ? 'var(--color-brand)' : 'var(--color-border)'}`,
                            background: active ? 'var(--color-brand-dim)' : 'var(--color-surface)',
                            color: active ? 'var(--color-brand)' : 'var(--color-text)',
                            fontWeight: active ? 700 : 500,
                            cursor: 'pointer',
                            padding: 'var(--space-2)',
                          }}
                          title={`${team.name}: ${distanceLabel(team, sector)}`}
                        >
                          <div>{active ? 'Tildelt' : 'Tildel'}</div>
                          <div style={{ fontSize: 'var(--text-xs)', opacity: 0.8 }}>
                            {distanceLabel(team, sector)}
                          </div>
                        </button>
                      </td>
                    );
                  })}
                  <td style={{ padding: 'var(--space-2)', textAlign: 'center' }}>
                    <button
                      onClick={() => onAssignTeam(team.id, null)}
                      disabled={!assigned}
                      style={{
                        minHeight: 54,
                        padding: '0 var(--space-3)',
                        borderRadius: 'var(--radius-sm)',
                        border: '1px solid var(--color-border)',
                        background: 'transparent',
                        color: 'var(--color-text-subtle)',
                        cursor: assigned ? 'pointer' : 'not-allowed',
                        opacity: assigned ? 1 : 0.5,
                      }}
                    >
                      Fjern
                    </button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </section>
  );
}
