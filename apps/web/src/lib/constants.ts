/**
 * Shared UI constants — extracted from SickBayDashboard and CoordinatorDashboard
 * to avoid duplication across sub-components.
 */

import type { News2Result } from '@rkf/shared-types';

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
