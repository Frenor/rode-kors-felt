import { type Page } from '@playwright/test';

export async function loginAsFirstAider(page: Page) {
  await page.goto('/');
  for (const digit of ['1', '2', '3', '4', '5', '6']) {
    await page.getByRole('button', { name: digit }).click();
  }
  await page.getByRole('button', { name: /Koble til arrangement/i }).click();
  await page.waitForURL('**/firstaid');
}

export async function loginAsCoordinator(page: Page) {
  await page.goto('/login');
  await page.getByLabel(/e-post/i).fill('admin@rkf.no');
  await page.getByLabel(/passord/i).fill('admin123');
  await page.getByRole('button', { name: /Logg inn/i }).click();
  await page.waitForURL('**/coordinator');
}
