import { expect, test } from '@playwright/test';

/**
 * Backend-free smoke: proves the app boots, the auth guard protects the app shell, the login form
 * renders, client-side validation fires, and routing between public auth pages works. None of these
 * touch the API, so the suite is deterministic without a running backend.
 */
test.describe('auth smoke', () => {
  test('redirects an unauthenticated visitor to the login page', async ({ page }) => {
    await page.goto('/');
    await expect(page).toHaveURL(/\/auth\/login/);
  });

  test('renders the login form', async ({ page }) => {
    await page.goto('/auth/login');
    await expect(page.locator('#email')).toBeVisible();
    await expect(page.locator('#password')).toBeVisible();
    await expect(page.locator('button[type="submit"]')).toBeVisible();
  });

  test('flags the required fields on an empty submit (no backend call)', async ({ page }) => {
    await page.goto('/auth/login');
    await page.locator('button[type="submit"]').click();
    // The form stays on the page and marks the empty controls invalid (ServerFormBase + Validators).
    await expect(page).toHaveURL(/\/auth\/login/);
    await expect(page.locator('#email')).toHaveClass(/form-input--error/);
    await expect(page.locator('#password')).toHaveClass(/form-input--error/);
  });

  test('navigates from login to forgot-password', async ({ page }) => {
    await page.goto('/auth/login');
    await page.locator('a[href="/auth/forgot-password"]').click();
    await expect(page).toHaveURL(/\/auth\/forgot-password/);
  });
});
