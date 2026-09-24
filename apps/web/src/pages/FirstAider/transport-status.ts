/**
 * Transport-request pill text (gap B3 / item 8.26).
 *
 * Pure so the two states — "requested, still unassigned" and "a team is on
 * its way" — and the vehicle-label lookup are covered by a unit test without
 * rendering the whole dashboard.
 */
import { TRANSPORT_LABELS } from './TeamSettingsPanel';
import { TRANSPORT_NEED_LABELS } from '../../lib/constants';
import type { TransportNeed } from '../../lib/types';
import type { TeamTransport } from '../../stores/auth';

export interface TransportStatusInput {
  transportNeed: TransportNeed | null;
  transportRequestedAt: string | null;
  transportTeamId: string | null;
  /** The assigned team, looked up by the caller from its own team list. */
  transportTeam: { name: string; transport?: TeamTransport } | null;
}

export interface TransportStatusResult {
  text: string;
  tone: 'warning' | 'info';
}

/** `null` when no transport has been requested — nothing to show. */
export function describeTransportStatus(input: TransportStatusInput): TransportStatusResult | null {
  const { transportNeed, transportRequestedAt, transportTeamId, transportTeam } = input;
  if (!transportNeed) return null;

  if (transportTeamId) {
    const vehicleLabel = transportTeam?.transport ? TRANSPORT_LABELS[transportTeam.transport] : null;
    const name = transportTeam?.name ?? 'Ukjent lag';
    return {
      text: `${name}${vehicleLabel ? ` (${vehicleLabel})` : ''} på vei`,
      tone: 'info',
    };
  }

  const time = transportRequestedAt
    ? ` · kl. ${new Date(transportRequestedAt).toLocaleTimeString('nb-NO', { hour: '2-digit', minute: '2-digit' })}`
    : '';
  return {
    text: `Transport bedt om: ${TRANSPORT_NEED_LABELS[transportNeed]}${time}`,
    tone: 'warning',
  };
}
