/**
 * NEWS2 — National Early Warning Score 2
 *
 * Pure, dependency-free implementation of the NEWS2 scoring algorithm.
 * Used by the Royal College of Physicians (UK) and adopted by
 * Norwegian Red Cross event medical operations.
 *
 * Reference: https://www.rcplondon.ac.uk/projects/outputs/national-early-warning-score-news-2
 *
 * Scoring parameters:
 *   - Respiratory rate
 *   - SpO₂ (Scale 1 — standard; Scale 2 for hypercapnic respiratory failure, not yet implemented)
 *   - Systolic blood pressure
 *   - Pulse
 *   - Consciousness (ACVPU — any non-Alert level scores 3)
 *   - Temperature
 *
 * Total score determines monitoring frequency and escalation path.
 */

import type { AcvpuLevel } from './index.js';

// ─── Input ──────────────────────────────────────────────────────

export interface News2Input {
  respiratoryRate?: number;
  spo2?: number;
  onSupplementalOxygen?: boolean;
  systolicBP?: number;
  pulse?: number;
  acvpu?: AcvpuLevel;
  temperature?: number;
}

// ─── Result ─────────────────────────────────────────────────────

export interface News2ParameterScores {
  respiratoryRate: number | null;
  spo2: number | null;
  systolicBP: number | null;
  pulse: number | null;
  consciousness: number | null;
  temperature: number | null;
}

export interface News2Result {
  /** Sum of all scored parameters */
  total: number;
  /** Individual parameter scores — null if parameter was not provided */
  scores: News2ParameterScores;
  /** True if any single parameter scored 3 (triggers 1h monitoring even if total < 5) */
  hasParameterScore3: boolean;
  /** Clinical alert level */
  alertLevel: 'routine' | 'low' | 'medium' | 'high';
  /** Reassessment interval in minutes. 0 = continuous monitoring. */
  monitoringMinutes: number;
}

// ─── Individual parameter scorers ───────────────────────────────

function scoreRespiratoryRate(rr: number): number {
  if (rr <= 8) return 3;
  if (rr <= 11) return 1;
  if (rr <= 20) return 0;
  if (rr <= 24) return 2;
  return 3; // ≥ 25
}

function scoreSpO2(spo2: number): number {
  // Scale 1 (standard — no hypercapnic respiratory failure)
  if (spo2 <= 91) return 3;
  if (spo2 <= 93) return 2;
  if (spo2 <= 95) return 1;
  return 0; // ≥ 96
}

function scoreSystolicBP(sbp: number): number {
  if (sbp <= 90) return 3;
  if (sbp <= 100) return 2;
  if (sbp <= 110) return 1;
  if (sbp <= 219) return 0;
  return 3; // ≥ 220
}

function scorePulse(pulse: number): number {
  if (pulse <= 40) return 3;
  if (pulse <= 50) return 1;
  if (pulse <= 90) return 0;
  if (pulse <= 110) return 1;
  if (pulse <= 130) return 2;
  return 3; // ≥ 131
}

function scoreConsciousness(acvpu: AcvpuLevel): number {
  // Any non-Alert state (C, V, P, U) scores 3
  return acvpu === 'alert' ? 0 : 3;
}

function scoreTemperature(temp: number): number {
  if (temp <= 35.0) return 3;
  if (temp <= 36.0) return 1;
  if (temp <= 38.0) return 0;
  if (temp <= 39.0) return 1;
  return 2; // ≥ 39.1
}

// ─── Main scoring function ───────────────────────────────────────

export function calculateNEWS2(input: News2Input): News2Result {
  const scores: News2ParameterScores = {
    respiratoryRate: input.respiratoryRate != null ? scoreRespiratoryRate(input.respiratoryRate) : null,
    spo2: input.spo2 != null ? scoreSpO2(input.spo2) : null,
    systolicBP: input.systolicBP != null ? scoreSystolicBP(input.systolicBP) : null,
    pulse: input.pulse != null ? scorePulse(input.pulse) : null,
    consciousness: input.acvpu != null ? scoreConsciousness(input.acvpu) : null,
    temperature: input.temperature != null ? scoreTemperature(input.temperature) : null,
  };

  const scoredValues = Object.values(scores).filter((s): s is number => s !== null);
  const total = scoredValues.reduce((sum, s) => sum + s, 0);
  const hasParameterScore3 = scoredValues.some((s) => s === 3);

  const alertLevel = deriveAlertLevel(total, hasParameterScore3);
  const monitoringMinutes = deriveMonitoringMinutes(total, hasParameterScore3);

  return { total, scores, hasParameterScore3, alertLevel, monitoringMinutes };
}

// ─── Alert level ─────────────────────────────────────────────────

function deriveAlertLevel(
  total: number,
  hasParameterScore3: boolean,
): News2Result['alertLevel'] {
  if (total >= 7) return 'high';
  if (total >= 5 || hasParameterScore3) return 'medium';
  if (total >= 1) return 'low';
  return 'routine';
}

// ─── Monitoring interval ─────────────────────────────────────────

function deriveMonitoringMinutes(total: number, hasParameterScore3: boolean): number {
  if (total >= 7) return 0;          // Continuous
  if (total >= 5 || hasParameterScore3) return 60;  // 1 hour
  if (total >= 1) return 360;        // 6 hours
  return 720;                         // 12 hours
}

// ─── Trend detection ─────────────────────────────────────────────

export interface News2Trend {
  /** Direction of change between the two most recent readings */
  direction: 'rising' | 'stable' | 'falling';
  /** Raw difference in NEWS2 score (positive = worsening) */
  deltaScore: number;
  /** Estimated rate of change per hour (based on timestamp gap) */
  ratePerHour: number;
}

/**
 * Calculate NEWS2 score trend from a list of vital readings.
 *
 * @param readings — ordered newest-first (as returned by the API)
 * @returns Trend based on two most recent readings; 'stable' if only one reading.
 *
 * Clinical threshold: Δ ≥ 2 in any 60-minute window is clinically significant.
 * (Royal College of Physicians NEWS2 guidance, 2017)
 */
export function calculateNEWS2Trend(
  readings: Array<{
    respiratoryRate?: number | null;
    spo2?: number | null;
    systolicBP?: number | null;
    pulse?: number | null;
    acvpu?: string | null;
    temperature?: number | null;
    timestamp: string;
  }>,
): News2Trend {
  if (readings.length < 2) {
    return { direction: 'stable', deltaScore: 0, ratePerHour: 0 };
  }

  const [newest, previous] = [readings[0]!, readings[1]!];

  const newestScore = calculateNEWS2({
    respiratoryRate: newest.respiratoryRate ?? undefined,
    spo2: newest.spo2 ?? undefined,
    systolicBP: newest.systolicBP ?? undefined,
    pulse: newest.pulse ?? undefined,
    acvpu: (newest.acvpu ?? undefined) as News2Input['acvpu'],
    temperature: newest.temperature ?? undefined,
  }).total;

  const previousScore = calculateNEWS2({
    respiratoryRate: previous.respiratoryRate ?? undefined,
    spo2: previous.spo2 ?? undefined,
    systolicBP: previous.systolicBP ?? undefined,
    pulse: previous.pulse ?? undefined,
    acvpu: (previous.acvpu ?? undefined) as News2Input['acvpu'],
    temperature: previous.temperature ?? undefined,
  }).total;

  const deltaScore = newestScore - previousScore;

  const timeDiffMs =
    new Date(newest.timestamp).getTime() - new Date(previous.timestamp).getTime();
  const timeDiffHours = timeDiffMs > 0 ? timeDiffMs / 3_600_000 : 1;
  const ratePerHour = deltaScore / timeDiffHours;

  const direction = deltaScore >= 2 ? 'rising' : deltaScore <= -2 ? 'falling' : 'stable';

  return { direction, deltaScore, ratePerHour };
}

// ─── Display helpers (Norwegian) ─────────────────────────────────

/** Norwegian label for monitoring interval */
export function news2MonitoringLabel(result: News2Result): string {
  if (result.monitoringMinutes === 0) return 'Kontinuerlig overvåkning';
  if (result.monitoringMinutes === 60) return 'Ny vurdering om 1 time';
  if (result.monitoringMinutes === 360) return 'Ny vurdering om 6 timer';
  return 'Ny vurdering om 12 timer';
}

/** Short label for NEWS2 badge */
export function news2BadgeLabel(result: News2Result): string {
  return `NEWS2 ${result.total}`;
}
