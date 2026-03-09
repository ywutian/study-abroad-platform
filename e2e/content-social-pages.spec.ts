/**
 * E2E browser tests for content/social pages.
 * Run: pnpm exec playwright test e2e/content-social-pages.spec.ts
 * Requires: web dev server at http://localhost:4100
 */
import { test } from '@playwright/test';
import * as fs from 'fs';
import * as path from 'path';

const BASE = 'http://localhost:4100/en';

const PAGES = [
  { url: '/cases', name: 'Cases gallery', protected: false },
  { url: '/essays', name: 'Essays', protected: true },
  { url: '/essay-gallery', name: 'Essay Gallery', protected: false },
  { url: '/forum', name: 'Forum', protected: false },
  { url: '/hall', name: 'Hall of Fame', protected: false },
  { url: '/swipe', name: 'Swipe', protected: false },
  { url: '/chat', name: 'Chat', protected: true },
  { url: '/ranking', name: 'Ranking', protected: false },
  { url: '/verified-ranking', name: 'Verified Ranking', protected: false },
  { url: '/help', name: 'Help', protected: false },
  { url: '/terms', name: 'Terms', protected: false },
  { url: '/privacy', name: 'Privacy', protected: false },
];

type ReportEntry = {
  page: string;
  url: string;
  renderStatus: 'OK' | 'Redirect' | 'Error';
  finalUrl: string;
  statusCode?: number;
  consoleErrors: string[];
  consoleWarnings: string[];
  uiIssues: string[];
  screenshot?: string;
};

const REPORT: ReportEntry[] = [];

test.describe('Content/Social pages E2E tests', () => {
  for (const { url, name, protected: isProtected } of PAGES) {
    test(name, async ({ page }) => {
      const entry: ReportEntry = {
        page: name,
        url: `${BASE}${url}`,
        renderStatus: 'OK',
        finalUrl: '',
        statusCode: undefined,
        consoleErrors: [],
        consoleWarnings: [],
        uiIssues: [],
      };

      page.on('console', (msg) => {
        const text = msg.text();
        const type = msg.type();
        if (type === 'error') entry.consoleErrors.push(text);
        else if (type === 'warning') entry.consoleWarnings.push(text);
      });

      try {
        const response = await page.goto(`${BASE}${url}`, {
          waitUntil: 'domcontentloaded',
          timeout: 20000,
        });
        entry.finalUrl = page.url();
        if (response) entry.statusCode = response.status();

        if (entry.finalUrl.includes('/login')) {
          entry.renderStatus = isProtected ? 'Redirect' : 'Error';
          if (isProtected) entry.uiIssues.push('Expected redirect to login (protected route)');
        } else if (response && response.status() >= 400) {
          entry.renderStatus = 'Error';
          entry.uiIssues.push(`HTTP ${response.status()}`);
        }

        if (entry.renderStatus === 'OK') {
          await page.waitForLoadState('networkidle', { timeout: 8000 }).catch(() => {});
          const body = await page.locator('body').textContent();
          if (!body || body.length < 100)
            entry.uiIssues.push('Page content seems empty or minimal');
          if (body?.includes('Something went wrong') || body?.includes('Error boundaries')) {
            entry.uiIssues.push('Error boundary or generic error displayed');
          }
          const mainVisible = await page
            .locator('main, [role="main"], h1, h2, .page-container')
            .first()
            .isVisible()
            .catch(() => false);
          if (!mainVisible) entry.uiIssues.push('No main content area or heading detected');
        }
      } catch (e) {
        entry.renderStatus = 'Error';
        entry.uiIssues.push(String(e).substring(0, 200));
      }

      const slug = url.replace(/\//g, '-').replace(/^-/, '') || 'index';
      const screenshotDir = path.join(process.cwd(), 'e2e-report', 'screenshots');
      fs.mkdirSync(screenshotDir, { recursive: true });
      const screenshotPath = path.join(screenshotDir, `content-social-${slug}.png`);
      try {
        await page.screenshot({ path: screenshotPath, fullPage: true });
        entry.screenshot = screenshotPath;
      } catch {
        try {
          await page.screenshot({ path: screenshotPath });
          entry.screenshot = screenshotPath;
        } catch {
          /* ignored */
        }
      }

      REPORT.push(entry);
    });
  }
});

test.afterAll(async () => {
  const reportPath = path.join(process.cwd(), 'e2e-report', 'content-social-report.json');
  fs.mkdirSync(path.dirname(reportPath), { recursive: true });
  fs.writeFileSync(reportPath, JSON.stringify(REPORT, null, 2), 'utf-8');

  console.log('\n\n========== CONTENT/SOCIAL PAGES E2E REPORT ==========\n');
  for (const r of REPORT) {
    console.log(`\n--- ${r.page} (${r.url}) ---`);
    console.log(`  Render status: ${r.renderStatus}`);
    console.log(`  Final URL: ${r.finalUrl}`);
    if (r.statusCode) console.log(`  HTTP: ${r.statusCode}`);
    if (r.consoleErrors.length) {
      console.log(`  Console errors (${r.consoleErrors.length}):`);
      r.consoleErrors.slice(0, 5).forEach((e) => console.log(`    - ${e.substring(0, 150)}`));
      if (r.consoleErrors.length > 5) console.log(`    ... and ${r.consoleErrors.length - 5} more`);
    }
    if (r.consoleWarnings.length) {
      console.log(`  Console warnings: ${r.consoleWarnings.length}`);
    }
    if (r.uiIssues.length) console.log(`  UI issues: ${r.uiIssues.join('; ')}`);
    if (r.screenshot) console.log(`  Screenshot: ${r.screenshot}`);
  }
  console.log('\n===================================================\n');
});
