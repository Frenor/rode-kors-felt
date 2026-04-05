import autocannon from 'autocannon';
import { evaluateThresholds, type LoadMetrics, type LoadThresholds } from './thresholds.js';

function readNumberEnv(name: string, fallback: number): number {
  const value = process.env[name];
  if (!value) return fallback;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function readBooleanEnv(name: string, fallback: boolean): boolean {
  const value = process.env[name];
  if (!value) return fallback;
  return value === '1' || value.toLowerCase() === 'true';
}

type Scenario = {
  name: string;
  options: autocannon.Options;
};

function latencyP95(latency: autocannon.Histogram): number {
  const histogram = latency as unknown as Record<string, number | undefined>;
  return Number(histogram.p95 ?? histogram.p97_5 ?? 0);
}

async function runScenario(scenario: Scenario): Promise<{ scenario: string; metrics: LoadMetrics }> {
  const result = await autocannon(scenario.options);

  const metrics: LoadMetrics = {
    p95Ms: latencyP95(result.latency),
    requestsPerSecond: result.requests.average,
    errorRate: result.errors / Math.max(result.requests.total, 1),
  };

  return { scenario: scenario.name, metrics };
}

interface EventAuth {
  accessToken: string;
  eventId: string;
}

async function getEventAuth(baseUrl: string, code: string): Promise<EventAuth | null> {
  const response = await fetch(`${baseUrl}/api/auth/code`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ code }),
  });
  if (!response.ok) return null;
  const payload = await response.json() as { accessToken?: string; eventId?: string };
  if (!payload.accessToken || !payload.eventId) return null;
  return { accessToken: payload.accessToken, eventId: payload.eventId };
}

async function main() {
  const baseUrl = process.env.LOAD_TEST_BASE_URL ?? 'http://localhost:4000';
  const duration = readNumberEnv('LOAD_TEST_DURATION_SECONDS', 20);
  const connections = readNumberEnv('LOAD_TEST_CONNECTIONS', 25);
  const requireAuthScenarios = readBooleanEnv('LOAD_TEST_REQUIRE_AUTH_SCENARIOS', true);
  const thresholds: LoadThresholds = {
    p95Ms: readNumberEnv('LOAD_TEST_P95_MAX_MS', 350),
    minRequestsPerSecond: readNumberEnv('LOAD_TEST_RPS_MIN', 40),
    maxErrorRate: readNumberEnv('LOAD_TEST_ERROR_RATE_MAX', 0.01),
  };

  const scenarios: Scenario[] = [
    {
      name: 'health',
      options: {
        url: `${baseUrl}/health`,
        method: 'GET',
        connections,
        duration,
      },
    },
  ];

  const auth = await getEventAuth(baseUrl, process.env.LOAD_TEST_ACCESS_CODE ?? '123456');
  if (auth) {
    scenarios.push({
      name: 'events.list',
      options: {
        url: `${baseUrl}/api/events`,
        method: 'GET',
        headers: {
          authorization: `Bearer ${auth.accessToken}`,
        },
        connections,
        duration,
      },
    });
    scenarios.push({
      name: 'incidents.list',
      options: {
        url: `${baseUrl}/api/incidents?eventId=${encodeURIComponent(auth.eventId)}`,
        method: 'GET',
        headers: {
          authorization: `Bearer ${auth.accessToken}`,
        },
        connections,
        duration,
      },
    });
  } else {
    console.warn('[load-test] Hopper over event-scopede scenarier (kunne ikke hente event-token).');
    if (requireAuthScenarios) {
      console.error('[load-test] LOAD_TEST_REQUIRE_AUTH_SCENARIOS=true og autentisering feilet.');
      process.exitCode = 1;
      return;
    }
  }

  let hasFailure = false;
  for (const scenario of scenarios) {
    const { metrics, scenario: name } = await runScenario(scenario);
    const verdict = evaluateThresholds(metrics, thresholds);
    console.log(
      `[load-test] ${name} p95=${metrics.p95Ms.toFixed(1)}ms rps=${metrics.requestsPerSecond.toFixed(1)} errorRate=${(metrics.errorRate * 100).toFixed(2)}%`,
    );
    if (!verdict.pass) {
      hasFailure = true;
      for (const failure of verdict.failures) {
        console.error(`[load-test] ${name} FAIL: ${failure}`);
      }
    }
  }

  if (hasFailure) {
    process.exitCode = 1;
  }
}

void main();
