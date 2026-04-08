import { test, expect } from '@playwright/test';
import { isProject, loginAsFirstAider, resetBrowserState } from './helpers';

test.beforeEach(async ({ page }, testInfo) => {
  test.skip(!isProject(testInfo, 'local-full'), 'local-full only');
  await resetBrowserState(page);
  await loginAsFirstAider(page);
});

test('completes 4-step incident form and returns to dashboard', async ({ page }) => {
  // Start from /firstaid (authenticated as first_aider)
  await expect(page).toHaveURL(/\/firstaid$/);

  // Navigate to the Hendelser tab where "Meld hendelse" button lives
  await page.getByRole('button', { name: /^Hendelser/ }).click();

  // Click "Meld hendelse"
  await page.getByRole('button', { name: /Meld( ny)? hendelse/i }).click();

  // Verify URL changes to /firstaid/incident
  await page.waitForURL('**/firstaid/incident');

  // Step 0: Click "Medisinsk"
  await page.getByRole('button', { name: 'Medisinsk' }).click();

  // Step 1: Verify ACVPU section is visible
  await expect(page.getByText('D — Bevissthet (ACVPU)')).toBeVisible();

  // Click the "A" button (Alert — Våken, short label "A")
  await page.getByRole('radio', { name: /Alert/i }).click();

  // Click "Neste: MIST →"
  await page.getByRole('button', { name: /Neste: MIST/i }).click();

  // Step 2: Pick mechanism in MIST when available
  const fallMechanism = page.getByRole('radio', { name: 'Fall' });
  const canPickFall = await fallMechanism.isVisible().catch(() => false);
  if (canPickFall) {
    await fallMechanism.click();
  }

  // Click "Forhåndsvis →"
  await page.getByRole('button', { name: /Forhåndsvis/i }).click();

  // Step 3: Verify preview includes chosen mechanism if selected
  if (canPickFall) {
    await expect(page.getByText(/M:\s*Fall/i)).toBeVisible();
  }

  // Verify "TYPE" shows "Medisinsk"
  await expect(page.getByText('TYPE')).toBeVisible();
  await expect(page.getByText('Medisinsk')).toBeVisible();

  // Click "Send hendelse"
  await page.getByRole('button', { name: /Send hendelse/i }).click();

  // Wait for navigation back to /firstaid
  await page.waitForURL('**/firstaid');

  // Navigate to the Hendelser tab to verify "Meld hendelse" button is visible again
  await page.getByRole('button', { name: /^Hendelser/ }).click();

  // Verify "Meld hendelse" button is visible again
  await expect(page.getByRole('button', { name: /Meld( ny)? hendelse/i })).toBeVisible();
});

test('back navigation works between steps', async ({ page }) => {
  // Navigate to the Hendelser tab where "Meld hendelse" button lives
  await page.getByRole('button', { name: /^Hendelser/ }).click();

  // Navigate to /firstaid/incident (authenticated)
  await page.getByRole('button', { name: /Meld( ny)? hendelse/i }).click();
  await page.waitForURL('**/firstaid/incident');

  // Click "Medisinsk" (step 0 → step 1)
  await page.getByRole('button', { name: 'Medisinsk' }).click();

  // Verify we are on step 1 (ACVPU section visible)
  await expect(page.getByText('D — Bevissthet (ACVPU)')).toBeVisible();

  // Click "← Tilbake" (step 1 → step 0)
  await page.getByRole('button', { name: /← Tilbake/i }).click();

  // Verify incident type buttons are visible again
  await expect(page.getByRole('button', { name: 'Medisinsk' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Traume' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Psykiatrisk' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Annet' })).toBeVisible();
});
