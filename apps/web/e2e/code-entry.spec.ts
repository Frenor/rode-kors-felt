import { test, expect } from '@playwright/test';
import { isProject, resetBrowserState } from './helpers';

test.beforeEach(async ({ page }, testInfo) => {
  test.skip(!isProject(testInfo, 'local-full'), 'local-full only');
  await resetBrowserState(page);
});

test('renders numpad and accepts 6-digit code', async ({ page }) => {
  await page.goto('/');

  // Verify the heading is visible
  await expect(page.getByRole('heading', { name: 'Rødt Kors Felt' })).toBeVisible();

  // Verify all numpad digit buttons 0-9 are present
  for (const digit of ['0', '1', '2', '3', '4', '5', '6', '7', '8', '9']) {
    await expect(page.getByRole('button', { name: digit })).toBeVisible();
  }

  // Click digits 1-6
  for (const digit of ['1', '2', '3', '4', '5', '6']) {
    await page.getByRole('button', { name: digit }).click();
  }

  // Verify the code display shows 6 characters via aria-label
  const codeDisplay = page.getByRole('status');
  await expect(codeDisplay).toHaveAttribute('aria-label', 'Kode: 123456');

  // Click backspace (aria-label: "Slett siste siffer") and verify one digit is removed
  await page.getByRole('button', { name: 'Slett siste siffer' }).click();
  await expect(codeDisplay).toHaveAttribute('aria-label', 'Kode: 12345');
});

test('valid first aider code navigates to /firstaid', async ({ page }) => {
  await page.goto('/');

  // Enter code 1-2-3-4-5-6
  for (const digit of ['1', '2', '3', '4', '5', '6']) {
    await page.getByRole('button', { name: digit }).click();
  }

  // Click submit
  await page.getByRole('button', { name: /Koble til arrangement/i }).click();

  // Wait for navigation to /firstaid
  await page.waitForURL('**/firstaid');

  // Select a team — the "Meld hendelse" button is only shown once a team is active
  await page.getByRole('heading', { name: 'Velg patrulje' }).waitFor();
  await page.getByRole('button', { name: 'Alpha' }).click();

  // Verify "Meld hendelse" button is visible
  await expect(page.getByRole('button', { name: /Meld( ny)? hendelse/i })).toBeVisible();
});

test('valid sickbay code navigates to /sickbay', async ({ page }) => {
  await page.goto('/');

  // Enter code 6-5-4-3-2-1
  for (const digit of ['6', '5', '4', '3', '2', '1']) {
    await page.getByRole('button', { name: digit }).click();
  }

  // Click submit
  await page.getByRole('button', { name: /Koble til arrangement/i }).click();

  // Wait for navigation to /sickbay
  await page.waitForURL('**/sickbay');

  // Verify "Sykestue" heading is visible
  await expect(page.getByRole('heading', { name: 'Sykestue' })).toBeVisible();
});

test('invalid code shows error message', async ({ page }) => {
  await page.goto('/');

  // Enter code 0-0-0-0-0-0
  for (let i = 0; i < 6; i++) {
    await page.getByRole('button', { name: '0' }).click();
  }

  // Click submit
  await page.getByRole('button', { name: /Koble til arrangement/i }).click();

  // Verify an error message appears via the alert role
  const alert = page.getByRole('alert');
  await expect(alert).toBeVisible();
  await expect(alert).not.toBeEmpty();
});
