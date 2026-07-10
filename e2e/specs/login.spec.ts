/**
 * E2E: Login flow
 *
 * Prerequisites: Auth emulator running with test@ejemplo.com / test123
 *
 * Covers:
 * - Login page renders
 * - Login with valid credentials redirects to dashboard
 */
import { test, expect } from '@playwright/test';

test.describe('Login', () => {
  test('login page renders and accepts credentials', async ({ page }) => {
    await page.goto('/login');

    // Should see login form
    const emailInput = page.getByPlaceholder('ejemplo@correo.com');
    await expect(emailInput).toBeVisible({ timeout: 5000 });

    // Fill and submit
    const passwordInput = page.locator('input[type="password"]');
    const submitButton = page.getByRole('button', { name: /iniciar sesión/i });

    await emailInput.fill('test@ejemplo.com');
    await passwordInput.fill('test123');
    await submitButton.click();

    // Should redirect away from /login (to /select-company or /onboarding)
    await page.waitForURL((url) => !url.pathname.includes('/login'), { timeout: 10000 });
    console.log('✅ Login successful, redirected to:', page.url());
  });
});
