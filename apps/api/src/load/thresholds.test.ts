import { describe, expect, it } from 'vitest';
import { evaluateThresholds } from './thresholds.js';

describe('load thresholds', () => {
  it('passes when metrics meet thresholds', () => {
    const verdict = evaluateThresholds(
      { p95Ms: 100, requestsPerSecond: 120, errorRate: 0.001 },
      { p95Ms: 250, minRequestsPerSecond: 80, maxErrorRate: 0.01 },
    );

    expect(verdict.pass).toBe(true);
    expect(verdict.failures).toHaveLength(0);
  });

  it('returns failure reasons when metrics violate thresholds', () => {
    const verdict = evaluateThresholds(
      { p95Ms: 500, requestsPerSecond: 20, errorRate: 0.1 },
      { p95Ms: 250, minRequestsPerSecond: 80, maxErrorRate: 0.01 },
    );

    expect(verdict.pass).toBe(false);
    expect(verdict.failures).toEqual([
      'p95 500.0ms > 250.0ms',
      'throughput 20.0 rps < 80.0 rps',
      'error-rate 10.00% > 1.00%',
    ]);
  });
});
