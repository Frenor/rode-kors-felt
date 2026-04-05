export interface LoadThresholds {
  p95Ms: number;
  minRequestsPerSecond: number;
  maxErrorRate: number;
}

export interface LoadMetrics {
  p95Ms: number;
  requestsPerSecond: number;
  errorRate: number;
}

export interface ThresholdEvaluation {
  pass: boolean;
  failures: string[];
}

export function evaluateThresholds(
  metrics: LoadMetrics,
  thresholds: LoadThresholds,
): ThresholdEvaluation {
  const failures: string[] = [];

  if (metrics.p95Ms > thresholds.p95Ms) {
    failures.push(`p95 ${metrics.p95Ms.toFixed(1)}ms > ${thresholds.p95Ms.toFixed(1)}ms`);
  }
  if (metrics.requestsPerSecond < thresholds.minRequestsPerSecond) {
    failures.push(
      `throughput ${metrics.requestsPerSecond.toFixed(1)} rps < ${thresholds.minRequestsPerSecond.toFixed(1)} rps`,
    );
  }
  if (metrics.errorRate > thresholds.maxErrorRate) {
    failures.push(
      `error-rate ${(metrics.errorRate * 100).toFixed(2)}% > ${(thresholds.maxErrorRate * 100).toFixed(2)}%`,
    );
  }

  return { pass: failures.length === 0, failures };
}
