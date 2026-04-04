import { defineConfig, devices } from '@playwright/test';

const isCI = Boolean(process.env.CI);
const localBaseURL = process.env.PLAYWRIGHT_LOCAL_BASE_URL ?? 'http://localhost:3000';
const demoBaseURL = process.env.PLAYWRIGHT_DEMO_BASE_URL ?? process.env.PLAYWRIGHT_BASE_URL ?? localBaseURL;
const gceBaseURL = process.env.PLAYWRIGHT_GCE_BASE_URL ?? process.env.PLAYWRIGHT_BASE_URL ?? localBaseURL;
const htmlOutputFolder = process.env.PLAYWRIGHT_HTML_OUTPUT_DIR ?? 'playwright-report';
const testResultsDir = process.env.PLAYWRIGHT_TEST_RESULTS_DIR ?? 'test-results';
const useExternalBaseURL = Boolean(
  process.env.PLAYWRIGHT_DEMO_BASE_URL ||
  process.env.PLAYWRIGHT_GCE_BASE_URL,
);

export default defineConfig({
  testDir: './e2e',
  fullyParallel: false,
  retries: isCI ? 1 : 0,
  outputDir: testResultsDir,
  reporter: isCI
    ? [['github'], ['html', { open: 'never', outputFolder: htmlOutputFolder }]]
    : [['list'], ['html', { open: 'never', outputFolder: htmlOutputFolder }]],
  use: {
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
  },
  projects: [
    {
      name: 'local-full',
      testMatch: ['**/{code-entry,coordinator-flow,incident-flow,local-full}.spec.ts'],
      use: {
        ...devices['Desktop Chrome'],
        baseURL: localBaseURL,
      },
    },
    {
      name: 'pages-demo',
      testMatch: '**/pages-demo.spec.ts',
      use: {
        ...devices['Desktop Chrome'],
        baseURL: demoBaseURL,
      },
    },
    {
      name: 'gce-prod-smoke',
      testMatch: '**/gce-prod-smoke.spec.ts',
      use: {
        ...devices['Desktop Chrome'],
        baseURL: gceBaseURL,
      },
    },
  ],
  ...(useExternalBaseURL
    ? {}
    : {
      webServer: {
        command: 'pnpm --filter @rkf/api dev & pnpm --filter @rkf/web dev',
        url: 'http://localhost:3000',
        reuseExistingServer: !isCI,
        timeout: 60_000,
      },
    }),
});
