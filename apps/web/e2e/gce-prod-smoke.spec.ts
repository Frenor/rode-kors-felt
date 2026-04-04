import { test, expect } from '@playwright/test';
import { installReadOnlyGuard, isProject, resetBrowserState, seedAuthState } from './helpers';

test.beforeEach(async ({ page }, testInfo) => {
  test.skip(!isProject(testInfo, 'gce-prod-smoke'), 'gce-prod-smoke only');
  await resetBrowserState(page);
  await installReadOnlyGuard(page);
});

test('loads the coordinator dashboard without issuing write requests', async ({ page }) => {
  expect(process.env.PLAYWRIGHT_GCE_BASE_URL, 'PLAYWRIGHT_GCE_BASE_URL must be provided for production smoke').toBeTruthy();
  const authStateJson = process.env.PLAYWRIGHT_GCE_AUTH_STATE;
  expect(authStateJson, 'PLAYWRIGHT_GCE_AUTH_STATE must be provided for production smoke').toBeTruthy();

  const authState = JSON.parse(authStateJson!);
  await seedAuthState(page, authState);

  await page.goto('/coordinator');
  await expect(page.getByRole('heading', { name: 'Koordinator' })).toBeVisible();
  await expect(page.getByRole('button', { name: /Leaflet/i })).toBeVisible();
  await expect(page.getByRole('button', { name: /MapLibre/i })).toBeVisible();
  await expect(page.getByRole('button', { name: /3D-presentasjon/i })).toBeVisible();
  await expect(page.getByText('Totalt')).toBeVisible();
});
