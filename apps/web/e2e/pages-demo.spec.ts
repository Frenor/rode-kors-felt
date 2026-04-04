import { test, expect } from '@playwright/test';
import { isProject, resetBrowserState } from './helpers';

test.beforeEach(async ({ page }, testInfo) => {
  test.skip(!isProject(testInfo, 'pages-demo'), 'pages-demo only');
  await resetBrowserState(page);
});

test('supports the demo login and role navigation flow', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByRole('heading', { name: 'Rødt Kors Felt' })).toBeVisible();

  for (const digit of ['1', '2', '3', '4', '5', '6']) {
    await page.getByRole('button', { name: digit }).click();
  }
  await page.getByRole('button', { name: /Koble til arrangement/i }).click();
  await page.waitForURL('**/firstaid');
  await expect(page.getByRole('button', { name: /Meld( ny)? hendelse/i })).toBeVisible();

  await page.goto('/login');
  await page.getByLabel(/e-post/i).fill('admin@rkf.no');
  await page.getByLabel(/passord/i).fill('admin123');
  await page.getByRole('button', { name: /Logg inn/i }).click();
  await page.waitForURL('**/coordinator');
  await expect(page.getByRole('heading', { name: 'Koordinator' })).toBeVisible();
  await expect(page.getByRole('button', { name: /Leaflet/i })).toBeVisible();
});
