/**
 * Test fixture: authenticated page with company selected.
 *
 * All tests that need to be inside the app should use this.
 * Handles login + company selection automatically.
 */
import { test as base, expect, Page } from '@playwright/test';

const TEST_EMAIL = 'test@ejemplo.com';
const TEST_PASSWORD = 'test123';

export async function loginAndSelectCompany(page: Page) {
  // Already logged in and on a company route?
  const url = page.url();
  if (url.includes('/dashboard') || url.includes('/datos') || url.includes('/estado-resultados')) {
    return; // Already authenticated and in a company
  }

  // Already on a company route?
  if (page.url().includes('/test-company-001/')) {
    return;
  }

  await page.goto('/login', { waitUntil: 'networkidle' });

  // Login
  const emailInput = page.getByPlaceholder('ejemplo@correo.com');
  const passwordInput = page.locator('input[type="password"]').first();
  
  await emailInput.waitFor({ state: 'visible', timeout: 10000 });
  await emailInput.fill(TEST_EMAIL);
  await passwordInput.fill(TEST_PASSWORD);

  const submitButton = page.getByRole('button', { name: /iniciar sesión/i });
  await Promise.all([
    // Wait for navigation to complete after clicking
    page.waitForURL(/select-company/, { timeout: 15000 }),
    submitButton.click(),
  ]);

  // Navigate directly to the test company dashboard
  // NOTE: waitUntil: 'domcontentloaded' (not 'networkidle') — Firebase onSnapshot keeps persistent connections
  await page.goto('/test-company-001/dashboard', { waitUntil: 'domcontentloaded', timeout: 20000 });
  // Wait for the dashboard to actually render (Firestore subscriptions need time)
  await page.waitForTimeout(4000);
}

export const test = base.extend({
  page: async ({ page }, use) => {
    await loginAndSelectCompany(page);
    await use(page);
  },
});

export { expect };
