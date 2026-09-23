import { TEAM_PATIENT_STATUS_STYLE } from '../../lib/constants';
import type { Team, TeamPatientEngagement, TeamPatientStatus } from '../../lib/types';
import { Pill } from '../../components/ui';
import { distanceMeters, formatDistance } from '../../lib/geo';
import { TRANSPORT_LABELS } from '../FirstAider/TeamSettingsPanel';

/** Engagement statuses where the patrol is still closing the distance to the patient. */
const APPROACHING_STATUSES = new Set<TeamPatientStatus>(['en_route_to_patient', 'transporting']);

/**
 * "≈ 800 m unna · til fots" for the patrol currently approaching this patient
 * (gap A7/A9) — only when a team is en route/transporting and both the team's
 * and the patient's positions are known. Returns null otherwise (no invented
 * ETA, no distance for a team already standing over the patient).
 */
export function engagementDistanceLabel(
  engagements: TeamPatientEngagement[],
  teams: Team[],
  patient: { lat?: number | null; lon?: number | null },
): string | null {
  if (patient.lat == null || patient.lon == null) return null;
  const approaching = engagements.find((eng) => APPROACHING_STATUSES.has(eng.status));
  if (!approaching) return null;
  const team = teams.find((t) => t.id === approaching.teamId);
  if (!team?.currentPosition) return null;
  const distance = formatDistance(
    distanceMeters(team.currentPosition, { lat: patient.lat, lng: patient.lon }),
  );
  if (!distance) return null;
  const transportLabel = team.transport
    ? (TRANSPORT_LABELS[team.transport as keyof typeof TRANSPORT_LABELS] ?? team.transport)
    : null;
  return transportLabel ? `${distance} unna · ${transportLabel.toLowerCase()}` : `${distance} unna`;
}

/**
 * Which patrol is with an incoming patient and what it is doing ("Delta · På vei",
 * "Bravo · Transporterer"). The sick bay had no way to see who was bringing a
 * patient in until the patient was standing in the tent (review S9). When a
 * patrol is approaching and both positions are known, a measured distance
 * follows the pill (gap A7).
 */
export function FieldEngagementLine({
  patientId,
  engagements,
  distanceLabel = null,
}: {
  patientId: string;
  engagements: TeamPatientEngagement[];
  distanceLabel?: string | null;
}) {
  if (engagements.length === 0) return null;
  return (
    <div
      data-testid={`field-engagement-${patientId}`}
      style={{ display: 'flex', flexWrap: 'wrap', gap: 'var(--space-1)', alignItems: 'center' }}
    >
      {engagements.map((eng) => {
        const style = TEAM_PATIENT_STATUS_STYLE[eng.status as TeamPatientStatus];
        return (
          <Pill key={`${eng.teamId}-${eng.status}`} dot tone={style ? { color: style.color, bg: style.bg } : undefined}>
            {eng.teamName} · {style?.label ?? eng.status}
          </Pill>
        );
      })}
      {distanceLabel && (
        <span style={{ fontSize: 'var(--text-xs)', color: 'var(--color-text-muted)' }}>{distanceLabel}</span>
      )}
    </div>
  );
}
