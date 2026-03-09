import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: './e2e',
  fullyParallel: false,
  retries: 0,
  workers: 1,
  use: {
    baseURL: 'http://localhost:4100',
    screenshot: 'only-on-failure',
  },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
  timeout: 180000,
  outputDir: 'e2e-report',
  webServer: {
    command: 'pnpm --filter web dev',
    url: 'http://localhost:4100',
    reuseExistingServer: true,
    timeout: 120000,
  },
});
