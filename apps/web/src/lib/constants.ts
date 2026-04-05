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

const AMK_CRITICALITY_NORMALIZATION: Record<string, 'low' | 'medium' | 'high' | 'critical'> = {
  low: 'low',
  lav: 'low',
  medium: 'medium',
  middels: 'medium',
  high: 'high',
  hoy: 'high',
  'høy': 'high',
  critical: 'critical',
  kritisk: 'critical',
};

export function normalizeAmkCriticality(value: string | null | undefined): 'low' | 'medium' | 'high' | 'critical' {
  if (!value) return 'low';
  return AMK_CRITICALITY_NORMALIZATION[value.trim().toLowerCase()] ?? 'low';
}

export function amkCriticalityLabel(value: string | null | undefined): string {
  return AMK_CRITICALITY_LABELS[normalizeAmkCriticality(value)];
}

const LLM_TRIAGE_LEVEL_NORMALIZATION: Record<string, 'low' | 'medium' | 'high' | 'critical'> = {
  ...AMK_CRITICALITY_NORMALIZATION,
};

export function normalizeLlmTriageLevel(value: string | null | undefined): 'low' | 'medium' | 'high' | 'critical' {
  if (!value) return 'medium';
  return LLM_TRIAGE_LEVEL_NORMALIZATION[value.trim().toLowerCase()] ?? 'medium';
}

export const TEAM_OPERATIONAL_STATUS_LABELS: Record<string, string> = {
  available: 'Ledig',
  en_route: 'På vei',
  on_scene: 'Fremme på stedet',
  needs_assistance: 'Trenger bistand',
  unavailable: 'Utilgjengelig',
};

export const PATH_LABELS: Record<string, string> = {
  path_a_rk_ambulance: 'Vei A — RK Ambulanse',
  path_b_113: 'Vei B — Ring 113',
};
