import { type Page, type TestInfo } from '@playwright/test';

const MUTATING_METHODS = new Set(['POST', 'PATCH', 'PUT', 'DELETE']);

export function requireProject(testInfo: TestInfo, allowed: string | string[]) {
  const allowedProjects = Array.isArray(allowed) ? allowed : [allowed];
  if (!allowedProjects.includes(testInfo.project.name)) {
    throw new Error(`Unsupported Playwright project: ${testInfo.project.name}`);
  }
}

export function isProject(testInfo: TestInfo, allowed: string | string[]) {
  const allowedProjects = Array.isArray(allowed) ? allowed : [allowed];
  return allowedProjects.includes(testInfo.project.name);
}

export async function resetBrowserState(page: Page) {
  await page.goto('./');
  await page.evaluate(() => localStorage.clear());
  await page.evaluate(() => sessionStorage.clear());
  await page.context().clearCookies();
}

export async function loginAsFirstAider(page: Page) {
  await page.goto('./');
  for (const digit of ['1', '2', '3', '4', '5', '6']) {
    await page.getByRole('button', { name: digit }).click();
  }
  await page.getByRole('button', { name: /Koble til arrangement/i }).click();
  await page.waitForURL('**/firstaid');
  // Select the first available team so the full workspace UI is visible.
  await page.getByRole('heading', { name: 'Velg patrulje' }).waitFor();
  await page.getByRole('button', { name: 'Alpha' }).click();
}

export async function loginAsCoordinator(page: Page) {
  await page.goto('./login');
  await page.getByLabel(/e-post/i).fill('admin@rkf.no');
  await page.getByLabel(/passord/i).fill('admin123');
  await page.getByRole('button', { name: /Logg inn/i }).click();
  await page.waitForURL('**/coordinator');
}

export async function seedAuthState(page: Page, state: unknown) {
  await page.addInitScript((authState) => {
    sessionStorage.setItem('rkf-auth', JSON.stringify(authState));
  }, state);
}

export async function installReadOnlyGuard(page: Page) {
  await page.route('**/*', async (route) => {
    const method = route.request().method().toUpperCase();
    if (MUTATING_METHODS.has(method)) {
      await route.abort('blockedbyclient');
      throw new Error(`Read-only smoke guard blocked ${method} ${route.request().url()}`);
    }
    await route.continue();
  });
}
