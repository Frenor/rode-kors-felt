import { test, expect } from '@playwright/test';
import { loginAsFirstAider } from './helpers';

test.beforeEach(async ({ page }) => {
  await page.goto('/');
  await page.evaluate(() => localStorage.clear());
  await loginAsFirstAider(page);
});

test('completes 4-step incident form and returns to dashboard', async ({ page }) => {
  // Start from /firstaid (authenticated as first_aider)
  await expect(page).toHaveURL(/\/firstaid$/);

  // Click "Meld hendelse"
  await page.getByRole('button', { name: /Meld hendelse/i }).click();

  // Verify URL changes to /firstaid/incident
  await page.waitForURL('**/firstaid/incident');

  // Step 0: Click "Medisinsk"
  await page.getByRole('button', { name: 'Medisinsk' }).click();

  // Step 1: Verify AVPU section is visible
  await expect(page.getByText('D — Bevissthet (AVPU)')).toBeVisible();

  // Click the "A" button (Alert — Våken, short label "A")
  await page.getByRole('radio', { name: /Alert/i }).click();

  // Click "Neste: MIST →"
  await page.getByRole('button', { name: /Neste: MIST/i }).click();

  // Step 2: Fill in the Mechanism textarea
  await page.getByLabel(/M — Mechanism/i).fill('Test skademekanisme');

  // Click "Forhåndsvis →"
  await page.getByRole('button', { name: /Forhåndsvis/i }).click();

  // Step 3: Verify "MIST" section shows the entered mechanism text
  await expect(page.getByText('Test skademekanisme')).toBeVisible();

  // Verify "TYPE" shows "Medisinsk"
  await expect(page.getByText('TYPE')).toBeVisible();
  await expect(page.getByText('Medisinsk')).toBeVisible();

  // Click "Send hendelse"
  await page.getByRole('button', { name: /Send hendelse/i }).click();

  // Wait for navigation back to /firstaid
  await page.waitForURL('**/firstaid');

  // Verify "Meld hendelse" button is visible again
  await expect(page.getByRole('button', { name: /Meld hendelse/i })).toBeVisible();
});

test('back navigation works between steps', async ({ page }) => {
  // Navigate to /firstaid/incident (authenticated)
  await page.getByRole('button', { name: /Meld hendelse/i }).click();
  await page.waitForURL('**/firstaid/incident');

  // Click "Medisinsk" (step 0 → step 1)
  await page.getByRole('button', { name: 'Medisinsk' }).click();

  // Verify we are on step 1 (AVPU section visible)
  await expect(page.getByText('D — Bevissthet (AVPU)')).toBeVisible();

  // Click "← Tilbake" (step 1 → step 0)
  await page.getByRole('button', { name: /← Tilbake/i }).click();

  // Verify incident type buttons are visible again
  await expect(page.getByRole('button', { name: 'Medisinsk' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Traume' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Psykiatrisk' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Annet' })).toBeVisible();
});
