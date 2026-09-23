import { test, expect } from '@playwright/test';
import { isProject, resetBrowserState } from './helpers';

test.beforeEach(async ({ page }, testInfo) => {
  test.skip(!isProject(testInfo, 'pages-demo'), 'pages-demo only');
  await resetBrowserState(page);
});

async function selectTeamIfNeeded(page: import('@playwright/test').Page) {
  const chooseTeam = page.getByRole('heading', { name: /Velg patrulje/i });
  const workspaceReady = page.getByRole('button', { name: /Meld pasient/i });
  // Wait until the dashboard has actually rendered one of its two initial
  // states — a single isVisible() probe raced the first paint on cold starts
  // and skipped team selection, which then failed every later assertion.
  await expect(chooseTeam.or(workspaceReady).first()).toBeVisible({ timeout: 20_000 });
  if (await chooseTeam.isVisible()) {
    const teamButton = page.getByRole('button', { name: /^Alpha/ });
    await expect(teamButton).toBeVisible();
    await teamButton.click();
    await expect(workspaceReady).toBeVisible({ timeout: 20_000 });
  }
}

test('supports the demo login and role navigation flow', async ({ page }) => {
  expect(process.env.PLAYWRIGHT_DEMO_BASE_URL, 'PLAYWRIGHT_DEMO_BASE_URL must be provided for Pages demo checks').toBeTruthy();

  await page.goto('./');
  await expect(page.getByRole('button', { name: '1' })).toBeVisible({ timeout: 15_000 });

  // First aider flow: verify patient workspace UI is visible in demo preview.
  for (const digit of ['1', '2', '3', '4', '5', '6']) {
    await page.getByRole('button', { name: digit }).click();
  }
  await page.getByRole('button', { name: /Koble til arrangement/i }).click();
  await page.waitForURL('**/firstaid');
  await selectTeamIfNeeded(page);
  const workspace = page.getByTestId('firstaid-patient-workspace');
  await expect(workspace).toBeVisible({ timeout: 20_000 });
  await expect(
    workspace.getByRole('button', { name: /Meld pasient/i })
  ).toBeVisible({ timeout: 20_000 });
  await expect(workspace.getByText(/^Egne pasienter/)).toBeVisible();
  await expect(workspace.getByText(/^Utildelte pasienter/)).toBeVisible();
  await workspace.getByTestId('firstaid-field-status-pill').click();
  await expect(workspace.getByTestId('firstaid-field-status-controls')).toBeVisible();
  await page.getByRole('button', { name: 'Avbryt' }).click();

  // Report a patient from the field: the form must accept a free-text
  // location and the new patient must show up under "Egne pasienter".
  await workspace.getByRole('button', { name: /Meld pasient/i }).click();
  await workspace.getByRole('button', { name: 'Gul', exact: true }).click();
  await workspace.getByRole('button', { name: 'Brudd / skade', exact: true }).click();
  await workspace.getByLabel('Hvor er pasienten?').fill('Ved drikkestasjon 3 (demo)');
  await expect(workspace.getByTestId('report-gps-status')).toBeVisible();
  await workspace.getByRole('button', { name: 'Registrer pasient' }).click();
  await expect(workspace.getByRole('button', { name: /Meld pasient/i })).toBeVisible({ timeout: 10_000 });
  await expect(workspace.getByText('Brudd / skade').first()).toBeVisible();

  // Open the new patient: the engagement buttons come first, and closing the
  // patient offers reason chips instead of demanding free text.
  await workspace.getByText('Brudd / skade').first().click();
  await expect(workspace.getByTestId('engagement-en_route_to_patient').first()).toBeVisible();
  await workspace.getByRole('button', { name: 'Avslutt pasient' }).first().click();
  const closeForm = workspace.getByTestId(/^firstaid-close-form-/).first();
  await expect(closeForm.getByRole('radio', { name: 'Falsk alarm' })).toBeVisible();
  await closeForm.getByRole('button', { name: 'Avbryt' }).click();

  // Dark mode is a one-tap, remembered choice for patrols working at night.
  const themeToggle = page.getByTestId('theme-toggle');
  await expect(themeToggle).toHaveText('Auto');
  await themeToggle.click();
  await expect(themeToggle).toHaveText('Mørk');
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');
  expect(await page.evaluate(() => localStorage.getItem('rkf-theme'))).toBe('dark');
  await themeToggle.click(); // → Lys
  await themeToggle.click(); // → Auto

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

  await page.getByRole('button', { name: /^Ny pasient/i }).click();
  await page.getByRole('textbox', { name: 'Problemstilling', exact: true }).fill('Brystsmerter demo');
  await page.getByRole('textbox', { name: 'Behandler', exact: true }).fill('Demo-kliniker');
  await page.getByRole('button', { name: 'Registrer' }).click();

  // A freshly registered patient is incoming: "Start behandling" is a real
  // button on the card, not a dropdown entry.
  await expect(page.getByTestId(/^primary-action-/).first()).toHaveText(/Start behandling/);

  // A patrol on its way is visible on the incoming card (Alpha → Sofia in the demo seed),
  // and the three secondary editors sit behind one "Rediger detaljer" row.
  await expect(page.getByTestId('field-engagement-demo-pat-4')).toContainText('Alpha · På vei');
  await expect(page.getByTestId('edit-details-toggle-demo-pat-4')).toBeVisible();
  await expect(page.getByTestId('demographics-editor-toggle-demo-pat-4')).toBeHidden();

  // Typing vitals shows a live NEWS2 preview before anything is saved.
  await page.getByRole('button', { name: 'Vitale', exact: true }).first().click();
  await page.getByLabel('Puls').first().fill('115'); // pulse 111–130 scores 2
  await expect(page.getByTestId(/^news2-preview-/).first()).toContainText('NEWS2 foreløpig: 2 · lav');
  await page.getByRole('button', { name: 'Lukk vitale', exact: true }).first().click();

  await page.getByTestId('patient-ring-113').first().click();
  const amkDialog = page.getByRole('dialog', { name: 'AMK-brief' });
  await expect(amkDialog).toBeVisible();
  await expect(amkDialog.getByRole('button', { name: 'Generer AI-forslag' })).toBeVisible();
  await amkDialog.getByRole('button', { name: 'Lukk' }).click();
  await expect(amkDialog).not.toBeVisible();
  // Open the patient status dropdown to verify status-change options are available
  await page.getByRole('button', { name: /Innkommende|I behandling|Observasjon/i }).first().click();
  await expect(page.getByTestId('status-btn-in_treatment').first()).toBeVisible();
  await expect(page.getByTestId('status-btn-observation').first()).toBeVisible();

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
  // The attention queue is the first thing on the page; map engine settings
  // are demoted behind a disclosure.
  const attentionQueue = page.getByTestId('coordinator-attention-queue');
  await expect(attentionQueue).toBeVisible();
  await expect(page.getByTestId('attention-queue-count')).toBeVisible();
  // The shared patient number (gap A5) is on the queue row — demo-pat-5 is the
  // red, unassigned patient, so it lands in "Røde pasienter uten lag".
  await expect(attentionQueue.getByTestId('patient-number-demo-pat-5')).toBeVisible();
  await expect(page.getByRole('button', { name: /Leaflet/i })).toBeHidden();
  await page.getByTestId('map-settings-toggle').click();
  await expect(page.getByRole('button', { name: /Leaflet/i })).toBeVisible();
  // Team status overview must be present so "Trenger bistand" is visible to the coordinator.
  await expect(page.getByTestId('coordinator-team-status')).toBeVisible();
  await expect(page.getByTestId('team-status-row-team-alpha')).toBeVisible();
  // The coordinator can dispatch a team to a sector or place (gap B4).
  await expect(page.getByTestId('team-status-dispatch-team-alpha')).toBeVisible();
  // The coordinator can write to the patrols from the dashboard (demo: shown locally).
  await page.getByTestId('coordinator-message-text').fill('Samling ved mål kl. 14');
  await page.getByTestId('coordinator-message-send').click();
  await expect(page.getByText('Koordinator → Alle')).toBeVisible();
  await expect(page.getByText('Samling ved mål kl. 14')).toBeVisible();
});
