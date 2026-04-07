import { test, expect } from '@playwright/test';
import { isProject, loginAsCoordinator, loginAsFirstAider, resetBrowserState } from './helpers';

async function loginAsSickBay(page: import('@playwright/test').Page) {
  await page.goto('/');
  await page.evaluate(() => localStorage.clear());
  await page.evaluate(() => sessionStorage.clear());
  await page.context().clearCookies();
  await page.goto('/');
  for (const digit of ['6', '5', '4', '3', '2', '1']) {
    await page.getByRole('button', { name: digit }).click();
  }
  await page.getByRole('button', { name: /Koble til arrangement/i }).click();
  await page.waitForURL('**/sickbay');
}

async function selectTeamIfNeeded(page: import('@playwright/test').Page) {
  const chooseTeam = page.getByRole('heading', { name: /Velg patrulje/i });
  if (await chooseTeam.isVisible().catch(() => false)) {
    const teamButton = page.locator('button.touch-target').first();
    await expect(teamButton).toBeVisible();
    await teamButton.click();
  }
}

test.beforeEach(async ({ page }, testInfo) => {
  test.skip(!isProject(testInfo, 'local-full'), 'local-full only');
  await resetBrowserState(page);
});

test('covers the full incident to coordinator handoff path', async ({ page }) => {
  await loginAsFirstAider(page);
  await expect(page.getByRole('button', { name: /Meld( ny)? hendelse/i })).toBeVisible();
  await selectTeamIfNeeded(page);
  const workspace = page.getByTestId('firstaid-patient-workspace');
  await expect(workspace).toBeVisible();
  await expect(workspace.getByText('Egne pasienter', { exact: true })).toBeVisible();
  await expect(workspace.getByText('Utildelte pasienter', { exact: true })).toBeVisible();
  await workspace.getByTestId('firstaid-field-status-pill').click();
  await expect(workspace.getByTestId('firstaid-field-status-controls')).toBeVisible();
  await page.getByRole('button', { name: 'Avbryt' }).click();

  await page.getByRole('button', { name: /Meld( ny)? hendelse/i }).click();
  await page.waitForURL('**/firstaid/incident');

  await page.getByRole('button', { name: 'Medisinsk' }).click();

  let expectedMode: 'gps' | 'indoor_zone' = 'gps';
  const indoorRegion = page.getByRole('region', { name: /Innendørs lokasjon/i });
  if (await indoorRegion.isVisible().catch(() => false)) {
    expectedMode = 'indoor_zone';
    await expect(indoorRegion).toBeVisible();
    await page.getByRole('button', { name: /GPS-fallback/i }).click();
    await page.getByRole('button', { name: /Innendørs lokasjon/i }).click();
  }

  await page.getByRole('radio', { name: /Alert/i }).click();
  await page.getByRole('button', { name: /Neste: MIST/i }).click();
  await page.getByRole('radio', { name: 'Fall' }).click();
  await page.getByRole('button', { name: /Forhåndsvis/i }).click();

  const incidentRequestPromise = page.waitForRequest((request) => {
    return request.method() === 'POST' && request.url().includes('/incidents');
  });
  await page.getByRole('button', { name: /Send hendelse/i }).click();
  const incidentRequest = await incidentRequestPromise;
  const payload = incidentRequest.postDataJSON() as Record<string, unknown>;
  const location = payload.location as { lat?: number; lng?: number };
  const locationContext = payload.locationContext as { mode?: string } | undefined;
  expect(typeof location?.lat).toBe('number');
  expect(typeof location?.lng).toBe('number');
  if (expectedMode === 'indoor_zone') {
    expect(locationContext?.mode).toBe('indoor_zone');
  } else {
    expect(locationContext?.mode === undefined || locationContext.mode === 'gps').toBe(true);
  }
  await page.waitForURL('**/firstaid');

  await loginAsSickBay(page);
  await expect(page.getByRole('heading', { name: 'Sykestue' })).toBeVisible();

  await page.getByRole('button', { name: /\+ Ny pasient/i }).click();
  await page.getByLabel('Problemstilling').fill('Brystsmerter under aktivitet');
  await page.getByLabel('Behandler').fill('Testkliniker');
  await page.getByRole('button', { name: 'Registrer' }).click();

  await page.getByTestId('patient-ring-113').first().click();
  const amkDialog = await page.getByRole('dialog', { name: 'AMK-brief' });
  await expect(amkDialog).toBeVisible();
  await amkDialog.getByRole('button', { name: 'Generer AI-forslag' }).click();
  await expect(amkDialog.getByLabel('Foreslått tale')).toBeVisible();
  await amkDialog.getByRole('button', { name: 'Bekreft script' }).click();
  await amkDialog.getByLabel('Oppsummering gitt').fill('Pasient med brystsmerter');
  await amkDialog.getByLabel('AMK-veiledning').fill('Observasjon og transportvurdering');
  await amkDialog.getByLabel('Videre ansvar').fill('Lege');
  await amkDialog.getByRole('button', { name: 'Lagre AMK-logg' }).click();
  await expect(amkDialog.getByText(/AMK-samtale er logget/i)).toBeVisible();
  await expect(amkDialog.getByText(/Tidligere AMK-logger/i)).toBeVisible();
  await expect(amkDialog.getByText('Pasient med brystsmerter', { exact: true }).first()).toBeVisible();
  await amkDialog.getByRole('button', { name: 'Lukk' }).click();
  await expect(amkDialog).not.toBeVisible();
  // Open the patient status dropdown to verify status-change options are available
  await page.getByRole('button', { name: /Innkommende|I behandling|Observasjon/i }).first().click();
  await expect(page.getByTestId('status-btn-in_treatment').first()).toBeVisible();
  await expect(page.getByTestId('status-btn-observation').first()).toBeVisible();
  // Close the status dropdown by pressing Escape
  await page.keyboard.press('Escape');

  await loginAsCoordinator(page);
  await expect(page.getByRole('heading', { name: 'Koordinator' })).toBeVisible();
  await expect(page.getByRole('button', { name: /Leaflet/i })).toBeVisible();
  await expect(page.getByRole('button', { name: /MapLibre/i })).toBeVisible();
  await expect(page.getByRole('button', { name: /3D-presentasjon/i })).toBeVisible();
});
