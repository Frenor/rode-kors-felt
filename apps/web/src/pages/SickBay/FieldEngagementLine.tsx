import { TEAM_PATIENT_STATUS_STYLE } from '../../lib/constants';
import type { TeamPatientEngagement, TeamPatientStatus } from '../../lib/types';
import { Pill } from '../../components/ui';

/**
 * Which patrol is with an incoming patient and what it is doing ("Delta · På vei",
 * "Bravo · Transporterer"). The sick bay had no way to see who was bringing a
 * patient in until the patient was standing in the tent (review S9).
 */
export function FieldEngagementLine({ patientId, engagements }: { patientId: string; engagements: TeamPatientEngagement[] }) {
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
    </div>
  );
}
