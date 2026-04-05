import { defineConfig, devices } from '@playwright/test';

const isCI = Boolean(process.env.CI);
const localWebPort = process.env.PLAYWRIGHT_LOCAL_WEB_PORT ?? (isCI ? '3000' : '3100');
const localApiPort = process.env.PLAYWRIGHT_LOCAL_API_PORT ?? (isCI ? '4000' : '4100');
const localBaseURL = process.env.PLAYWRIGHT_LOCAL_BASE_URL ?? `http://127.0.0.1:${localWebPort}`;
const localApiURL = process.env.PLAYWRIGHT_LOCAL_API_URL ?? `http://127.0.0.1:${localApiPort}`;
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
      webServer: [
        {
          command: [
            `PORT=${localApiPort}`,
            `CORS_ORIGIN=${localBaseURL}`,
            'pnpm --filter @rkf/api dev',
          ].join(' '),
          url: `${localApiURL}/health`,
          reuseExistingServer: !isCI,
          timeout: 60_000,
        },
        {
          command: [
            `VITE_API_URL=${localApiURL}`,
            'pnpm --filter @rkf/web dev --host 127.0.0.1 --port',
            localWebPort,
            '--strictPort',
          ].join(' '),
          url: localBaseURL,
          reuseExistingServer: !isCI,
          timeout: 60_000,
        },
      ],
    }),
});
