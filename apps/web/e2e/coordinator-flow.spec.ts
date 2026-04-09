import { test, expect } from '@playwright/test';
import { isProject, loginAsCoordinator, resetBrowserState } from './helpers';

test.beforeEach(async ({ page }, testInfo) => {
  test.skip(!isProject(testInfo, 'local-full'), 'local-full only');
  await resetBrowserState(page);
});

test('coordinator can log in and see dashboard', async ({ page }) => {
  await page.goto('/login');

  // Fill in email and password fields
  await page.getByLabel(/e-post/i).fill('admin@rkf.no');
  await page.getByLabel(/passord/i).fill('admin123');

  // Click "Logg inn"
  await page.getByRole('button', { name: /Logg inn/i }).click();

  // Wait for navigation to /coordinator
  await page.waitForURL('**/coordinator');

  // Verify "Koordinator" heading is visible
  await expect(page.getByRole('heading', { name: 'Koordinator' })).toBeVisible();

  // Verify core coordinator UI is visible (patient panel + map controls)
  await expect(page.getByRole('button', { name: /Leaflet/i })).toBeVisible();
  await expect(page.getByRole('button', { name: /MapLibre/i })).toBeVisible();
});

test('coordinator can see patient management panel and map', async ({ page }) => {
  await loginAsCoordinator(page);

  // Patient management panel heading should be visible
  await expect(page.getByRole('heading', { name: /Pasienter/i })).toBeVisible();

  // Map engine toggle buttons should be visible
  await expect(page.getByRole('button', { name: /Leaflet/i })).toBeVisible();
  await expect(page.getByRole('button', { name: /MapLibre/i })).toBeVisible();
});

test('unauthenticated user is redirected from /coordinator to /', async ({ page }) => {
  await resetBrowserState(page);

  // Navigate to /coordinator
  await page.goto('/coordinator');

  // Verify URL is / (redirected to CodeEntryPage)
  await expect(page).toHaveURL(/\/?$/);

  // Confirm we are on the CodeEntryPage
  await expect(page.getByRole('heading', { name: 'Rødt Kors Felt' })).toBeVisible();
});
