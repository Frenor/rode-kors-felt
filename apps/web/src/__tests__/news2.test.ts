import { describe, expect, it } from 'vitest';
import { calculateNEWS2 } from '@rkf/shared-types';

// ─── Respiratory Rate ─────────────────────────────────────────────

describe('NEWS2 — Respiratory Rate', () => {
  it('scores 3 for RR ≤ 8', () => {
    expect(calculateNEWS2({ respiratoryRate: 8 }).scores.respiratoryRate).toBe(3);
    expect(calculateNEWS2({ respiratoryRate: 4 }).scores.respiratoryRate).toBe(3);
  });
  it('scores 1 for RR 9–11', () => {
    expect(calculateNEWS2({ respiratoryRate: 9 }).scores.respiratoryRate).toBe(1);
    expect(calculateNEWS2({ respiratoryRate: 11 }).scores.respiratoryRate).toBe(1);
  });
  it('scores 0 for RR 12–20', () => {
    expect(calculateNEWS2({ respiratoryRate: 12 }).scores.respiratoryRate).toBe(0);
    expect(calculateNEWS2({ respiratoryRate: 20 }).scores.respiratoryRate).toBe(0);
  });
  it('scores 2 for RR 21–24', () => {
    expect(calculateNEWS2({ respiratoryRate: 21 }).scores.respiratoryRate).toBe(2);
    expect(calculateNEWS2({ respiratoryRate: 24 }).scores.respiratoryRate).toBe(2);
  });
  it('scores 3 for RR ≥ 25', () => {
    expect(calculateNEWS2({ respiratoryRate: 25 }).scores.respiratoryRate).toBe(3);
    expect(calculateNEWS2({ respiratoryRate: 40 }).scores.respiratoryRate).toBe(3);
  });
});

// ─── SpO₂ ─────────────────────────────────────────────────────────

describe('NEWS2 — SpO₂ (Scale 1)', () => {
  it('scores 3 for SpO₂ ≤ 91', () => {
    expect(calculateNEWS2({ spo2: 91 }).scores.spo2).toBe(3);
    expect(calculateNEWS2({ spo2: 85 }).scores.spo2).toBe(3);
  });
  it('scores 2 for SpO₂ 92–93', () => {
    expect(calculateNEWS2({ spo2: 92 }).scores.spo2).toBe(2);
    expect(calculateNEWS2({ spo2: 93 }).scores.spo2).toBe(2);
  });
  it('scores 1 for SpO₂ 94–95', () => {
    expect(calculateNEWS2({ spo2: 94 }).scores.spo2).toBe(1);
    expect(calculateNEWS2({ spo2: 95 }).scores.spo2).toBe(1);
  });
  it('scores 0 for SpO₂ ≥ 96', () => {
    expect(calculateNEWS2({ spo2: 96 }).scores.spo2).toBe(0);
    expect(calculateNEWS2({ spo2: 100 }).scores.spo2).toBe(0);
  });
});

// ─── Systolic BP ──────────────────────────────────────────────────

describe('NEWS2 — Systolic BP', () => {
  it('scores 3 for SBP ≤ 90', () => {
    expect(calculateNEWS2({ systolicBP: 90 }).scores.systolicBP).toBe(3);
    expect(calculateNEWS2({ systolicBP: 70 }).scores.systolicBP).toBe(3);
  });
  it('scores 2 for SBP 91–100', () => {
    expect(calculateNEWS2({ systolicBP: 91 }).scores.systolicBP).toBe(2);
    expect(calculateNEWS2({ systolicBP: 100 }).scores.systolicBP).toBe(2);
  });
  it('scores 1 for SBP 101–110', () => {
    expect(calculateNEWS2({ systolicBP: 101 }).scores.systolicBP).toBe(1);
    expect(calculateNEWS2({ systolicBP: 110 }).scores.systolicBP).toBe(1);
  });
  it('scores 0 for SBP 111–219', () => {
    expect(calculateNEWS2({ systolicBP: 111 }).scores.systolicBP).toBe(0);
    expect(calculateNEWS2({ systolicBP: 120 }).scores.systolicBP).toBe(0);
    expect(calculateNEWS2({ systolicBP: 219 }).scores.systolicBP).toBe(0);
  });
  it('scores 3 for SBP ≥ 220', () => {
    expect(calculateNEWS2({ systolicBP: 220 }).scores.systolicBP).toBe(3);
    expect(calculateNEWS2({ systolicBP: 250 }).scores.systolicBP).toBe(3);
  });
});

// ─── Pulse ────────────────────────────────────────────────────────

describe('NEWS2 — Pulse', () => {
  it('scores 3 for pulse ≤ 40', () => {
    expect(calculateNEWS2({ pulse: 40 }).scores.pulse).toBe(3);
    expect(calculateNEWS2({ pulse: 30 }).scores.pulse).toBe(3);
  });
  it('scores 1 for pulse 41–50', () => {
    expect(calculateNEWS2({ pulse: 41 }).scores.pulse).toBe(1);
    expect(calculateNEWS2({ pulse: 50 }).scores.pulse).toBe(1);
  });
  it('scores 0 for pulse 51–90', () => {
    expect(calculateNEWS2({ pulse: 51 }).scores.pulse).toBe(0);
    expect(calculateNEWS2({ pulse: 72 }).scores.pulse).toBe(0);
    expect(calculateNEWS2({ pulse: 90 }).scores.pulse).toBe(0);
  });
  it('scores 1 for pulse 91–110', () => {
    expect(calculateNEWS2({ pulse: 91 }).scores.pulse).toBe(1);
    expect(calculateNEWS2({ pulse: 110 }).scores.pulse).toBe(1);
  });
  it('scores 2 for pulse 111–130', () => {
    expect(calculateNEWS2({ pulse: 111 }).scores.pulse).toBe(2);
    expect(calculateNEWS2({ pulse: 130 }).scores.pulse).toBe(2);
  });
  it('scores 3 for pulse ≥ 131', () => {
    expect(calculateNEWS2({ pulse: 131 }).scores.pulse).toBe(3);
    expect(calculateNEWS2({ pulse: 160 }).scores.pulse).toBe(3);
  });
});

// ─── ACVPU Consciousness ─────────────────────────────────────────

describe('NEWS2 — Consciousness (ACVPU)', () => {
  it('scores 0 for alert', () => {
    expect(calculateNEWS2({ acvpu: 'alert' }).scores.consciousness).toBe(0);
  });
  it('scores 3 for confused', () => {
    expect(calculateNEWS2({ acvpu: 'confused' }).scores.consciousness).toBe(3);
  });
  it('scores 3 for voice', () => {
    expect(calculateNEWS2({ acvpu: 'voice' }).scores.consciousness).toBe(3);
  });
  it('scores 3 for pain', () => {
    expect(calculateNEWS2({ acvpu: 'pain' }).scores.consciousness).toBe(3);
  });
  it('scores 3 for unresponsive', () => {
    expect(calculateNEWS2({ acvpu: 'unresponsive' }).scores.consciousness).toBe(3);
  });
});

// ─── Temperature ─────────────────────────────────────────────────

describe('NEWS2 — Temperature', () => {
  it('scores 3 for temp ≤ 35.0', () => {
    expect(calculateNEWS2({ temperature: 35.0 }).scores.temperature).toBe(3);
    expect(calculateNEWS2({ temperature: 32 }).scores.temperature).toBe(3);
  });
  it('scores 1 for temp 35.1–36.0', () => {
    expect(calculateNEWS2({ temperature: 35.1 }).scores.temperature).toBe(1);
    expect(calculateNEWS2({ temperature: 36.0 }).scores.temperature).toBe(1);
  });
  it('scores 0 for temp 36.1–38.0', () => {
    expect(calculateNEWS2({ temperature: 36.5 }).scores.temperature).toBe(0);
    expect(calculateNEWS2({ temperature: 38.0 }).scores.temperature).toBe(0);
  });
  it('scores 1 for temp 38.1–39.0', () => {
    expect(calculateNEWS2({ temperature: 38.1 }).scores.temperature).toBe(1);
    expect(calculateNEWS2({ temperature: 39.0 }).scores.temperature).toBe(1);
  });
  it('scores 2 for temp ≥ 39.1', () => {
    expect(calculateNEWS2({ temperature: 39.1 }).scores.temperature).toBe(2);
    expect(calculateNEWS2({ temperature: 41 }).scores.temperature).toBe(2);
  });
});

// ─── Total score and alert levels ────────────────────────────────

describe('NEWS2 — Total and alert levels', () => {
  it('returns total 0 and routine for completely normal vitals', () => {
    const result = calculateNEWS2({
      respiratoryRate: 16,
      spo2: 98,
      systolicBP: 120,
      pulse: 70,
      acvpu: 'alert',
      temperature: 37.0,
    });
    expect(result.total).toBe(0);
    expect(result.alertLevel).toBe('routine');
    expect(result.monitoringMinutes).toBe(720);
    expect(result.hasParameterScore3).toBe(false);
  });

  it('returns "low" for total 1–4 with no single parameter at 3', () => {
    const result = calculateNEWS2({
      respiratoryRate: 22, // 2 pts
      spo2: 98,
      pulse: 70,
    });
    expect(result.total).toBe(2);
    expect(result.alertLevel).toBe('low');
    expect(result.monitoringMinutes).toBe(360);
  });

  it('returns "medium" when any single parameter scores 3 even if total < 5', () => {
    const result = calculateNEWS2({
      pulse: 40, // 3 pts — single param ≥ 3
      respiratoryRate: 16,
      spo2: 98,
    });
    expect(result.hasParameterScore3).toBe(true);
    expect(result.alertLevel).toBe('medium');
    expect(result.monitoringMinutes).toBe(60);
  });

  it('returns "medium" for total 5–6', () => {
    const result = calculateNEWS2({
      respiratoryRate: 22, // 2
      spo2: 94,            // 1
      systolicBP: 105,     // 1
      pulse: 100,          // 1
      temperature: 38.5,   // 1
    });
    expect(result.total).toBe(6);
    expect(result.alertLevel).toBe('medium');
    expect(result.monitoringMinutes).toBe(60);
  });

  it('returns "high" for total ≥ 7 and continuous monitoring', () => {
    const result = calculateNEWS2({
      respiratoryRate: 8,  // 3
      spo2: 91,            // 3
      systolicBP: 85,      // 3
    });
    expect(result.total).toBe(9);
    expect(result.alertLevel).toBe('high');
    expect(result.monitoringMinutes).toBe(0);
  });

  it('scores null for parameters not provided', () => {
    const result = calculateNEWS2({ pulse: 72 });
    expect(result.scores.respiratoryRate).toBeNull();
    expect(result.scores.spo2).toBeNull();
    expect(result.scores.pulse).toBe(0);
    expect(result.total).toBe(0);
  });

  it('only counts provided parameters in total', () => {
    // Single elevated RR = 3 pts
    const result = calculateNEWS2({ respiratoryRate: 26 });
    expect(result.total).toBe(3);
    expect(result.hasParameterScore3).toBe(true);
  });
});
