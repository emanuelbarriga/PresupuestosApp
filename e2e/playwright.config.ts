import { defineConfig, devices } from '@playwright/test';
import path from 'path';

const EMULATOR_HOST = 'localhost';
const EMULATOR_PORTS = '8081,9099';

export default defineConfig({
  testDir: './specs',
  fullyParallel: false,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: 1,
  reporter: [
    ['html', { outputFolder: '../e2e-report' }],
    ['list'],
  ],
  timeout: 30000,
  use: {
    baseURL: 'http://localhost:3000',
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
  },
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
  ],
  // Global setup: ensures emulators are running and data is seeded
  globalSetup: path.resolve(__dirname, 'helpers', 'global-setup.ts'),
});
