import { defineConfig, devices } from '@playwright/test';

/**
 * Playwright e2e config. Boots the real dev server (`npm start` → ng serve on :5173) and runs the smoke
 * suite against it. The smoke is intentionally **backend-free**: it exercises bootstrap, routing, guards,
 * and client-side form validation — none of which need the API — so it runs anywhere without a backend.
 */
const PORT = 5173;
const baseURL = `http://localhost:${PORT}`;

export default defineConfig({
  testDir: './e2e',
  fullyParallel: true,
  forbidOnly: !!process.env['CI'],
  retries: process.env['CI'] ? 1 : 0,
  reporter: process.env['CI'] ? [['github'], ['html', { open: 'never' }]] : 'list',
  use: {
    baseURL,
    trace: 'on-first-retry',
  },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
  webServer: {
    command: 'npm start',
    url: baseURL,
    reuseExistingServer: !process.env['CI'],
    timeout: 120_000,
  },
});
