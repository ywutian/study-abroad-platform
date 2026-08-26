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
  timeout: 300000,
  outputDir: process.env.PLAYWRIGHT_OUTPUT_DIR ?? 'e2e-report',
  webServer: {
    command:
      'rm -rf apps/web/.next/dev apps/web/.next/server apps/web/.next/static apps/web/.next/types && pnpm --filter web dev',
    env: {
      ...process.env,
      ENABLE_E2E_FIXTURES: 'true',
      NODE_OPTIONS: [process.env.NODE_OPTIONS, '--max-old-space-size=8192']
        .filter(Boolean)
        .join(' '),
    },
    url: 'http://localhost:4100',
    reuseExistingServer: process.env.PLAYWRIGHT_REUSE_SERVER === 'true',
    timeout: 120000,
  },
});
