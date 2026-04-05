import { test, expect } from '@playwright/test';
import { isProject, resetBrowserState } from './helpers';

test.beforeEach(async ({ page }, testInfo) => {
  test.skip(!isProject(testInfo, 'pages-demo'), 'pages-demo only');
  await resetBrowserState(page);
});

async function selectTeamIfNeeded(page: import('@playwright/test').Page) {
  const chooseTeam = page.getByRole('heading', { name: /Velg patrulje/i });
  if (await chooseTeam.isVisible().catch(() => false)) {
    const teamButton = page.locator('button.touch-target').first();
    await expect(teamButton).toBeVisible();
    await teamButton.click();
  }
}

test('supports the demo login and role navigation flow', async ({ page }) => {
  expect(process.env.PLAYWRIGHT_DEMO_BASE_URL, 'PLAYWRIGHT_DEMO_BASE_URL must be provided for Pages demo checks').toBeTruthy();

  await page.goto('./');
  await expect(page.getByRole('button', { name: '1' })).toBeVisible({ timeout: 15_000 });

  // First aider flow: verify incident entry UI is visible in demo preview.
  for (const digit of ['1', '2', '3', '4', '5', '6']) {
    await page.getByRole('button', { name: digit }).click();
  }
  await page.getByRole('button', { name: /Koble til arrangement/i }).click();
  await page.waitForURL('**/firstaid');
  await expect(page.getByRole('button', { name: /Meld( ny)? hendelse/i })).toBeVisible();
  await selectTeamIfNeeded(page);
  await expect(page.getByTestId('firstaid-patient-workspace')).toBeVisible();
  await expect(page.getByText('Aktiv pasient')).toBeVisible();
  await expect(page.getByText('Overvåkede pasienter')).toBeVisible();
  await expect(page.getByText('Utildelte pasienter')).toBeVisible();
  await expect(page.getByTestId('firstaid-field-status-controls')).toBeVisible();
  await page.getByRole('button', { name: /Meld( ny)? hendelse/i }).click();
  await page.waitForURL('**/firstaid/incident');
  await page.getByRole('button', { name: 'Medisinsk' }).click();
  await expect(page.getByText(/D — Bevissthet \(ACVPU\)/i)).toBeVisible();

  // Sick Bay flow: verify Ring 113 and AMK brief are visible.
  const logoutBtn = page.getByRole('button', { name: /Logg ut/i });
  if (await logoutBtn.isVisible().catch(() => false)) {
    await logoutBtn.click();
  }
  await resetBrowserState(page);
  for (const digit of ['6', '5', '4', '3', '2', '1']) {
    await page.getByRole('button', { name: digit }).click();
  }
  await page.getByRole('button', { name: /Koble til arrangement/i }).click();
  await page.waitForURL('**/sickbay');
  await expect(page.getByRole('heading', { name: 'Sykestue' })).toBeVisible();

  const ring113Button = page.getByTestId('patient-ring-113').first();
  const hasPatient = await ring113Button.isVisible({ timeout: 1500 }).catch(() => false);
  if (!hasPatient) {
    await page.getByRole('button', { name: /\+ Ny pasient/i }).click();
    await page.getByLabel('Problemstilling').fill('Brystsmerter demo');
    await page.getByLabel('Behandler').fill('Demo-kliniker');
    await page.getByRole('button', { name: 'Registrer' }).click();
  }

  await page.getByTestId('patient-ring-113').first().click();
  const amkDialog = page.getByRole('dialog', { name: 'AMK-brief' });
  await expect(amkDialog).toBeVisible();
  await expect(amkDialog.getByRole('button', { name: 'Generer AI-forslag' })).toBeVisible();
  await amkDialog.getByRole('button', { name: 'Lukk' }).click();
  await expect(amkDialog).not.toBeVisible();
  await expect(page.getByRole('button', { name: 'Start behandling' }).first()).toBeVisible();
  await expect(page.getByRole('button', { name: 'Legg til observasjon' }).first()).toBeVisible();

  // Coordinator flow: verify map presentation controls in demo preview.
  if (await logoutBtn.isVisible().catch(() => false)) {
    await logoutBtn.click();
  }
  await resetBrowserState(page);
  await page.goto('./login');
  await page.getByLabel(/e-post/i).fill('admin@rkf.no');
  await page.getByLabel(/passord/i).fill('admin123');
  await page.getByRole('button', { name: /Logg inn/i }).click();
  await page.waitForURL('**/coordinator');
  await expect(page.getByRole('heading', { name: 'Koordinator' })).toBeVisible();
  await expect(page.getByRole('button', { name: /Leaflet/i })).toBeVisible();
});
