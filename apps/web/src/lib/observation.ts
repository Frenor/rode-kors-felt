/**
 * "When is this patient due for a new set of observations?"
 *
 * Derived purely from the latest vitals timestamp and the NEWS2 monitoring
 * interval, so it survives reloads and is visible on every card instead of
 * living in a setTimeout toast that fires once and is gone.
 */

import { calculateNEWS2 } from '@rkf/shared-types';
import type { VitalsReading } from './types';

export type ObservationDue =
  | { kind: 'none' }
  | { kind: 'continuous'; news2Total: number }
  | { kind: 'due'; dueAt: Date; minutesLeft: number; news2Total: number }
  | { kind: 'overdue'; dueAt: Date; minutesOverdue: number; news2Total: number };

export function nextObservationDue(
  latestVitals: VitalsReading | null | undefined,
  now: Date = new Date(),
): ObservationDue {
  if (!latestVitals?.timestamp) return { kind: 'none' };
  const recordedAt = new Date(latestVitals.timestamp).getTime();
  if (!Number.isFinite(recordedAt)) return { kind: 'none' };
  const news2 = calculateNEWS2(latestVitals);
  if (news2.monitoringMinutes === 0) return { kind: 'continuous', news2Total: news2.total };
  const dueAt = new Date(recordedAt + news2.monitoringMinutes * 60_000);
  const diffMinutes = Math.round((dueAt.getTime() - now.getTime()) / 60_000);
  if (diffMinutes < 0) {
    return { kind: 'overdue', dueAt, minutesOverdue: -diffMinutes, news2Total: news2.total };
  }
  return { kind: 'due', dueAt, minutesLeft: diffMinutes, news2Total: news2.total };
}

/** Sort key: overdue (most overdue first) → continuous → due soonest → no vitals. */
export function observationPriority(due: ObservationDue): number {
  switch (due.kind) {
    case 'overdue': return -1_000_000 - due.minutesOverdue;
    case 'continuous': return -500_000;
    case 'due': return due.minutesLeft;
    default: return 1_000_000;
  }
}

function clock(d: Date): string {
  return d.toLocaleTimeString('nb-NO', { hour: '2-digit', minute: '2-digit' });
}

export function formatMinutes(minutes: number): string {
  if (minutes < 60) return `${minutes} min`;
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return m === 0 ? `${h} t` : `${h} t ${m} min`;
}

/** Human text for the card. Returns '' when nothing is known. */
export function describeObservationDue(due: ObservationDue): string {
  switch (due.kind) {
    case 'continuous':
      return 'Kontinuerlig overvåkning';
    case 'overdue':
      return `Forfalt for ${formatMinutes(due.minutesOverdue)} (skulle vært kl. ${clock(due.dueAt)})`;
    case 'due':
      return due.minutesLeft === 0
        ? 'Neste vurdering nå'
        : `Neste vurdering kl. ${clock(due.dueAt)} (om ${formatMinutes(due.minutesLeft)})`;
    default:
      return '';
  }
}

/** "nå", "for 3 min siden", "for 1 t 5 min siden" */
export function formatRelativeAge(iso: string | null | undefined, now: Date = new Date()): string {
  if (!iso) return '';
  const then = new Date(iso).getTime();
  if (!Number.isFinite(then)) return '';
  const minutes = Math.max(0, Math.round((now.getTime() - then) / 60_000));
  if (minutes === 0) return 'nå';
  return `for ${formatMinutes(minutes)} siden`;
}
