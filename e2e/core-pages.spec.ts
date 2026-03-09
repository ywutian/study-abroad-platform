/**
 * E2E smoke tests for core feature pages.
 * Run with: pnpm exec playwright test e2e/core-pages.spec.ts
 * Requires: web dev server at http://localhost:4100
 */
import { test, expect } from '@playwright/test';

const PAGES = [
  { url: '/en/dashboard', name: 'Dashboard', protected: true },
  { url: '/en/profile', name: 'Profile', protected: true },
  { url: '/en/schools', name: 'Schools listing', protected: false },
  { url: '/en/find-college', name: 'Find College', protected: false },
  { url: '/en/prediction', name: 'Prediction', protected: true },
  { url: '/en/recommendation', name: 'Recommendation', protected: false },
  { url: '/en', name: 'Landing/Home', protected: false },
  { url: '/en/about', name: 'About', protected: false },
];

const REPORT: Array<{
  page: string;
  url: string;
  status: 'OK' | 'Redirect' | 'Error';
  finalUrl: string;
  consoleErrors: string[];
  consoleWarnings: string[];
  uiIssues: string[];
  screenshot?: string;
}> = [];

test.describe('Core pages E2E smoke tests', () => {
  for (const { url, name, protected: isProtected } of PAGES) {
    test(name, async ({ page }) => {
      const consoleErrors: string[] = [];
      const consoleWarnings: string[] = [];
      const uiIssues: string[] = [];

      page.on('console', (msg) => {
        const text = msg.text();
        const type = msg.type();
        if (type === 'error') consoleErrors.push(text);
        else if (type === 'warning') consoleWarnings.push(text);
      });

      let finalUrl = url;
      let status: 'OK' | 'Redirect' | 'Error' = 'OK';

      try {
        const response = await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 15000 });
        finalUrl = page.url();

        if (
          isProtected &&
          !finalUrl.includes('dashboard') &&
          !finalUrl.includes('profile') &&
          !finalUrl.includes('prediction') &&
          !finalUrl.includes('schools') &&
          !finalUrl.includes('find-college') &&
          !finalUrl.includes('recommendation')
        ) {
          if (finalUrl.includes('login')) {
            status = 'Redirect';
          }
        } else if (response && response.status() >= 400) {
          status = 'Error';
          uiIssues.push(`HTTP ${response.status()}`);
        } else if (finalUrl.includes('login') && isProtected) {
          status = 'Redirect';
        }

        if (status === 'OK') {
          await page.waitForLoadState('networkidle', { timeout: 5000 }).catch(() => {});
          const body = await page.locator('body').textContent();
          if (!body || body.length < 100) uiIssues.push('Page content seems empty or minimal');
          if (body?.includes('Error') && body?.includes('Something went wrong'))
            uiIssues.push('Generic error message displayed');
        }
      } catch (e) {
        status = 'Error';
        uiIssues.push(String(e));
      }

      const screenshotPath = `e2e-report/screenshots/${name.replace(/\s+/g, '-')}.png`;
      try {
        await page.screenshot({ path: screenshotPath, fullPage: true });
      } catch {
        await page.screenshot({ path: screenshotPath });
      }

      REPORT.push({
        page: name,
        url,
        status,
        finalUrl,
        consoleErrors: [...consoleErrors],
        consoleWarnings: [...consoleWarnings],
        uiIssues,
        screenshot: screenshotPath,
      });
    });
  }
});

test.afterAll(async () => {
  console.log('\n\n========== E2E REPORT ==========\n');
  for (const r of REPORT) {
    console.log(`\n--- ${r.page} (${r.url}) ---`);
    console.log(`  Render status: ${r.status}`);
    console.log(`  Final URL: ${r.finalUrl}`);
    if (r.consoleErrors.length) console.log(`  Console errors: ${r.consoleErrors.length}`);
    r.consoleErrors.forEach((e) => console.log(`    - ${e.substring(0, 120)}`));
    if (r.consoleWarnings.length) console.log(`  Console warnings: ${r.consoleWarnings.length}`);
    if (r.uiIssues.length) console.log(`  UI issues: ${r.uiIssues.join('; ')}`);
    if (r.screenshot) console.log(`  Screenshot: ${r.screenshot}`);
  }
  console.log('\n================================\n');
});
