/**
 * Shared UI constants — extracted from SickBayDashboard and CoordinatorDashboard
 * to avoid duplication across sub-components.
 */

import type { News2Result } from '@rkf/shared-types';
import type { TeamOperationalStatus, TeamPatientStatus, TransportNeed } from './types';

export const ACVPU_OPTIONS: { value: string; label: string; short: string }[] = [
  { value: 'alert', label: 'Alert', short: 'A' },
  { value: 'confused', label: 'Forvirret', short: 'C' },
  { value: 'voice', label: 'Voice', short: 'V' },
  { value: 'pain', label: 'Pain', short: 'P' },
  { value: 'unresponsive', label: 'Ingen respons', short: 'U' },
];

export const news2Colors: Record<News2Result['alertLevel'], { color: string; bg: string }> = {
  routine: { color: 'var(--color-status-ok)', bg: 'var(--color-status-ok-bg)' },
  low: { color: 'var(--color-status-info)', bg: 'var(--color-status-info-bg)' },
  medium: { color: 'var(--color-status-warning)', bg: 'var(--color-status-warning-bg)' },
  high: { color: 'var(--color-status-critical)', bg: 'var(--color-status-critical-bg)' },
};

export const statusLabels: Record<string, string> = {
  incoming: 'Innkommende',
  in_treatment: 'Under behandling',
  observation: 'Observasjon',
  discharged: 'Utskrevet',
  transferred: 'Overført',
};

export const statusColors: Record<string, { color: string; bg: string }> = {
  incoming: { color: 'var(--color-status-warning)', bg: 'var(--color-status-warning-bg)' },
  in_treatment: { color: 'var(--color-status-info)', bg: 'var(--color-status-info-bg)' },
  observation: { color: 'var(--color-status-ok)', bg: 'var(--color-status-ok-bg)' },
  discharged: { color: 'var(--color-text-subtle)', bg: 'var(--color-surface-sunken)' },
  transferred: { color: 'var(--color-status-critical)', bg: 'var(--color-status-critical-bg)' },
};

export const ageLabels: Record<string, string> = {
  child: 'Barn',
  adolescent: 'Ungdom',
  adult: 'Voksen',
  elderly: 'Eldre',
};

export const GENDER_OPTIONS: Array<{ value: 'male' | 'female' | 'other'; label: string }> = [
  { value: 'male', label: 'Mann' },
  { value: 'female', label: 'Kvinne' },
  { value: 'other', label: 'Annet' },
];

export const GENDER_LABELS: Record<'male' | 'female' | 'other', string> = {
  male: 'Mann',
  female: 'Kvinne',
  other: 'Annet',
};

export const STATUS_TRANSITIONS: Record<string, string[]> = {
  incoming: ['in_treatment', 'observation'],
  in_treatment: ['incoming', 'observation', 'discharged', 'transferred'],
  observation: ['incoming', 'in_treatment', 'discharged', 'transferred'],
  discharged: ['observation', 'in_treatment'],
  transferred: ['observation', 'in_treatment'],
};

export const routeLabels: Record<string, string> = {
  inhaled: 'Inhalasjon',
  oral: 'Per os (svelget)',
  iv: 'Intravenøst (IV)',
  im: 'Intramuskulært (IM)',
  sublingual: 'Under tungen (SL)',
};

export const typeLabels: Record<string, string> = {
  medical: 'Medisinsk',
  trauma: 'Traume',
  psychiatric: 'Psykiatrisk',
  other: 'Annet',
};

type KnownCriticality = 'low' | 'medium' | 'high' | 'critical';
const CANONICAL_AMK_CRITICALITIES: KnownCriticality[] = ['low', 'medium', 'high', 'critical'];

export const TRIAGE_COLORS: Record<string, { color: string; bg: string; label: string }> = {
  low: { color: 'var(--color-status-ok)', bg: 'var(--color-status-ok-bg)', label: 'Lav' },
  medium: { color: 'var(--color-status-info)', bg: 'var(--color-status-info-bg)', label: 'Middels' },
  high: { color: 'var(--color-status-warning)', bg: 'var(--color-status-warning-bg)', label: 'Høy' },
  critical: { color: 'var(--color-status-critical)', bg: 'var(--color-status-critical-bg)', label: 'KRITISK' },
};

export const AMK_CRITICALITY_LABELS: Record<'low' | 'medium' | 'high' | 'critical', string> = {
  low: 'Lav',
  medium: 'Middels',
  high: 'Høy',
  critical: 'Kritisk',
};

export function normalizeAmkCriticality(value: string | null | undefined): KnownCriticality {
  if (!value) return 'low';
  const normalized = value.trim().toLowerCase();
  if (CANONICAL_AMK_CRITICALITIES.includes(normalized as KnownCriticality)) {
    return normalized as KnownCriticality;
  }
  throw new Error(`Unsupported AMK criticality '${value}'`);
}

export function amkCriticalityLabel(value: string | null | undefined): string {
  const canonical = normalizeAmkCriticality(value);
  return AMK_CRITICALITY_LABELS[canonical];
}

export function normalizeLlmTriageLevel(value: string | null | undefined): KnownCriticality {
  if (!value) return 'medium';
  const normalized = value.trim().toLowerCase();
  if (CANONICAL_AMK_CRITICALITIES.includes(normalized as KnownCriticality)) {
    return normalized as KnownCriticality;
  }
  return 'medium';
}

export const TEAM_OPERATIONAL_STATUS_LABELS: Record<string, string> = {
  available: 'Ledig',
  en_route: 'På vei',
  on_scene: 'Fremme på stedet',
  needs_assistance: 'Trenger bistand',
  unavailable: 'Utilgjengelig',
};

/**
 * Colour per team operational status. Shared by the coordinator's team panel
 * and the first aider's own status pill so both sides read the same colour.
 */
export const TEAM_OPERATIONAL_STATUS_STYLE: Record<
  TeamOperationalStatus,
  { color: string; bg: string; border: string }
> = {
  available:        { color: 'var(--color-status-ok)',       bg: 'var(--color-status-ok-bg)',       border: 'var(--color-status-ok-border)' },
  en_route:         { color: 'var(--color-status-info)',     bg: 'var(--color-status-info-bg)',     border: 'var(--color-status-info-border)' },
  on_scene:         { color: 'var(--color-status-warning)',  bg: 'var(--color-status-warning-bg)',  border: 'var(--color-status-warning-border)' },
  needs_assistance: { color: 'var(--color-status-critical)', bg: 'var(--color-status-critical-bg)', border: 'var(--color-status-critical-border)' },
  unavailable:      { color: 'var(--color-text-subtle)',     bg: 'var(--color-surface-sunken)',     border: 'var(--color-border)' },
};

export type FieldTriageStatus = 'red' | 'yellow' | 'green' | 'black';

export const FIELD_TRIAGE_ORDER: FieldTriageStatus[] = ['red', 'yellow', 'green', 'black'];

/** Field triage pill colours — theme-aware via tokens.css (light + dark). */
export const FIELD_TRIAGE_STYLE: Record<FieldTriageStatus, { bg: string; text: string; label: string }> = {
  red:    { bg: 'var(--color-triage-red-bg)',    text: 'var(--color-triage-red)',    label: 'Rød' },
  yellow: { bg: 'var(--color-triage-yellow-bg)', text: 'var(--color-triage-yellow)', label: 'Gul' },
  green:  { bg: 'var(--color-triage-green-bg)',  text: 'var(--color-triage-green)',  label: 'Grønn' },
  black:  { bg: 'var(--color-triage-black-bg)',  text: 'var(--color-triage-black)',  label: 'Svart' },
};

/** Team ↔ patient engagement pill colours (På vei / Transporterer / Overvåker). */
export const TEAM_PATIENT_STATUS_STYLE: Record<
  TeamPatientStatus,
  { label: string; bg: string; color: string }
> = {
  en_route_to_patient: { label: 'På vei',        bg: 'var(--color-engagement-en-route-bg)',     color: 'var(--color-engagement-en-route)' },
  transporting:        { label: 'Transporterer', bg: 'var(--color-engagement-transporting-bg)', color: 'var(--color-engagement-transporting)' },
  monitoring:          { label: 'Overvåker',     bg: 'var(--color-engagement-monitoring-bg)',   color: 'var(--color-engagement-monitoring)' },
};

/**
 * Why a patrol closes a patient. Chips instead of free text: typing a sentence
 * with gloves in the dark is the wrong trade-off, and the reason is almost
 * always one of these.
 */
export const PATIENT_CLOSE_REASONS: Array<{ id: string; label: string }> = [
  { id: 'handed_to_sickbay',   label: 'Overlevert sykestue' },
  { id: 'handed_to_ambulance', label: 'Overlevert ambulanse' },
  { id: 'treated_on_scene',    label: 'Ferdig behandlet på stedet' },
  { id: 'false_alarm',         label: 'Falsk alarm' },
  { id: 'disappeared',         label: 'Forsvunnet' },
];

export const SICKBAY_PLACEMENT_LABELS: Record<'chair' | 'bed', string> = {
  chair: 'Stol',
  bed: 'Seng',
};

export const PATH_LABELS: Record<string, string> = {
  path_a_rk_ambulance: 'Vei A — RK Ambulanse',
  path_b_113: 'Vei B — Ring 113',
};

export function calculateAgeYears(birthDate?: string | null): number | null {
  if (!birthDate) return null;
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(birthDate);
  if (!match) return null;
  const yearPart = Number(match[1] ?? '');
  const monthPart = Number(match[2] ?? '');
  const dayPart = Number(match[3] ?? '');
  if (!Number.isFinite(yearPart) || !Number.isFinite(monthPart) || !Number.isFinite(dayPart)) return null;
  const birth = new Date(Date.UTC(yearPart, monthPart - 1, dayPart));
  if (
    Number.isNaN(birth.getTime())
    || birth.getUTCFullYear() !== yearPart
    || birth.getUTCMonth() !== monthPart - 1
    || birth.getUTCDate() !== dayPart
  ) return null;
  const today = new Date();
  const todayYear = today.getFullYear();
  const todayMonth = today.getMonth() + 1;
  const todayDay = today.getDate();
  let age = todayYear - yearPart;
  const monthDiff = todayMonth - monthPart;
  const dayDiff = todayDay - dayPart;
  if (monthDiff < 0 || (monthDiff === 0 && dayDiff < 0)) {
    age -= 1;
  }
  return age >= 0 ? age : null;
}

export function formatPatientAge(options: { birthDate?: string | null; ageGroup?: string | null; ageYears?: number | null }): string {
  if (options.ageYears != null && Number.isFinite(options.ageYears) && options.ageYears >= 0) {
    return `${Math.floor(options.ageYears)} år`;
  }
  const age = calculateAgeYears(options.birthDate ?? null);
  if (age !== null) return `${age} år`;
  if (options.ageGroup) {
    const ageGroupLabel = ageLabels[options.ageGroup];
    if (ageGroupLabel) return ageGroupLabel;
  }
  return 'Alder ukjent';
}

export function formatSickbayPlacement(
  placementType?: 'chair' | 'bed' | null,
  placementNumber?: string | null,
): string | null {
  if (!placementType || !placementNumber) return null;
  const label = SICKBAY_PLACEMENT_LABELS[placementType];
  if (!label) return null;
  return `${label} ${placementNumber}`;
}

/**
 * Whole (fractional) minutes elapsed since an ISO timestamp, or `null` when
 * the timestamp is missing or invalid. Shared by the coordinator's wait-time
 * (gap A6), assignment-acknowledgement (gap A4) and message-receipt (gap B10)
 * thresholds below — one place to get the arithmetic right.
 */
export function minutesSince(iso: string | null | undefined, now: Date = new Date()): number | null {
  if (!iso) return null;
  const then = new Date(iso).getTime();
  if (!Number.isFinite(then)) return null;
  return (now.getTime() - then) / 60_000;
}

/**
 * How long a yellow/green patient can wait without a team before the
 * coordinator's "Krever handling" banner escalates it into "Venter for
 * lenge" (gap A6 / lane 8 item 8.20). Red patients are always in the banner
 * regardless of age — this only adds time as a second trigger for the rest.
 */
export const ATTENTION_WAIT_MINUTES: Record<'yellow' | 'green', number> = {
  yellow: 10,
  green: 30,
};

/**
 * Assignment-acknowledgement thresholds (gap A4 / item 8.21): a patrol
 * "acknowledges" an assignment by going en route or transporting for that
 * patient. Past `warn` minutes without that, the patient row shows "Ikke
 * bekreftet"; past `escalate` minutes it also enters the attention queue.
 */
export const ASSIGNMENT_ACK_MINUTES: Record<'warn' | 'escalate', number> = {
  warn: 2,
  escalate: 5,
};

/**
 * A directed coordinator message with no "Mottatt" receipt after this many
 * minutes shows "Ikke kvittert" in the message stream (gap B10 / item 8.24).
 */
export const MESSAGE_UNACKED_MINUTES = 3;

/**
 * Transport request chip / pill labels (gap B3 / item 8.26) — what a patrol
 * asks for when a patient cannot walk out under their own power.
 */
export const TRANSPORT_NEED_LABELS: Record<TransportNeed, string> = {
  stretcher: 'Båre',
  atv: 'ATV',
  ambulance: 'Ambulanse',
};

/**
 * Quick log complaint chips (gap A8 / item 8.28) — "Behandlet på stedet" is
 * almost always one of these; the chip's label becomes the patient label
 * unless "Annet" is picked, which requires its own free text instead.
 */
export const QUICK_LOG_COMPLAINTS: Array<{ id: string; label: string }> = [
  { id: 'blister', label: 'Gnagsår' },
  { id: 'cut', label: 'Kutt' },
  { id: 'sprain', label: 'Forstuing' },
  { id: 'headache', label: 'Hodepine' },
  { id: 'nausea', label: 'Kvalme' },
  { id: 'other', label: 'Annet' },
];
