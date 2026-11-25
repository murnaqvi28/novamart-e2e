// @ts-check
require('dotenv').config();
const { defineConfig, devices } = require('@playwright/test');

const BASE_URL = (process.env.BASE_URL || 'https://novamart-ot9u.onrender.com').replace(/\/$/, '');

// Optional: point at a locally installed Chromium instead of the Playwright-managed one
const launchOptions = process.env.CHROMIUM_PATH ? { executablePath: process.env.CHROMIUM_PATH } : {};

module.exports = defineConfig({
  testDir: './tests',
  timeout: 60_000,
  expect: { timeout: 10_000 },
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  workers: process.env.CI ? 3 : undefined,
  reporter: [
    ['list'],
    ['html', { open: 'never' }],
    ...(process.env.CI ? [['github']] : []),
  ],
  globalSetup: require.resolve('./global-setup.js'),
  use: {
    baseURL: BASE_URL,
    testIdAttribute: 'data-testid',
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
    video: process.env.VIDEO || 'retain-on-failure',
    actionTimeout: 15_000,
    navigationTimeout: 30_000,
    launchOptions,
  },
  projects: [
    {
      name: 'api',
      testDir: './tests/api',
    },
    {
      name: 'chromium',
      testIgnore: '**/api/**',
      use: { ...devices['Desktop Chrome'], launchOptions },
    },
    {
      name: 'mobile',
      testIgnore: '**/api/**',
      grep: /@mobile/,
      use: { ...devices['Pixel 7'], launchOptions },
    },
  ],
});
