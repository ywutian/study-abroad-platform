import { test } from '@playwright/test';
import * as fs from 'fs';
import * as path from 'path';

const BASE = 'http://localhost:4100/en';

const PAGES = [
  { url: '/admin', name: 'Admin Dashboard' },
  { url: '/admin/users', name: 'Admin Users' },
  { url: '/admin/schools', name: 'Admin Schools' },
  { url: '/admin/content', name: 'Admin Content' },
  { url: '/timeline', name: 'Timeline' },
  { url: '/vault', name: 'Vault' },
  { url: '/settings', name: 'Settings' },
  { url: '/teams', name: 'Teams' },
  { url: '/assessment', name: 'Assessment' },
  { url: '/uncommon-app', name: 'Uncommon App' },
  { url: '/referral', name: 'Referral' },
  { url: '/resume', name: 'Resume' },
  { url: '/followers', name: 'Followers' },
  { url: '/cases', name: 'Cases gallery' },
  { url: '/essays', name: 'Essays' },
  { url: '/essay-gallery', name: 'Essay Gallery' },
  { url: '/forum', name: 'Forum' },
  { url: '/hall', name: 'Hall of Fame' },
  { url: '/swipe', name: 'Swipe' },
  { url: '/chat', name: 'Chat' },
  { url: '/ranking', name: 'Ranking' },
  { url: '/verified-ranking', name: 'Verified Ranking' },
  { url: '/help', name: 'Help' },
  { url: '/terms', name: 'Terms' },
  { url: '/privacy', name: 'Privacy' },
];

interface ReportEntry {
  url: string;
  name: string;
  renderStatus: string;
  finalUrl: string;
  statusCode?: number;
  consoleErrors: string[];
  consoleWarnings: string[];
  uiIssues: string[];
}

test('admin and misc pages render test', async ({ page }) => {
  test.setTimeout(180000);
  const report: ReportEntry[] = [];
  const screenshotDir = path.join(process.cwd(), 'e2e-report', 'screenshots');
  fs.mkdirSync(screenshotDir, { recursive: true });

  for (const p of PAGES) {
    const fullUrl = BASE + p.url;
    const entry: ReportEntry = {
      url: fullUrl,
      name: p.name,
      renderStatus: 'Unknown',
      finalUrl: fullUrl,
      consoleErrors: [],
      consoleWarnings: [],
      uiIssues: [],
    };

    page.on('console', (msg) => {
      const text = msg.text();
      if (msg.type() === 'error') entry.consoleErrors.push(text);
      else if (msg.type() === 'warning') entry.consoleWarnings.push(text);
    });

    const response = await page
      .goto(fullUrl, { waitUntil: 'domcontentloaded', timeout: 10000 })
      .catch(() => null);
    if (response) entry.statusCode = response.status();

    const currentUrl = page.url();
    entry.finalUrl = currentUrl;

    if (currentUrl.includes('/login')) {
      entry.renderStatus = 'Redirect';
    } else if (response?.status() && response.status() >= 400) {
      entry.renderStatus = 'Error';
      entry.uiIssues.push('HTTP ' + response.status());
    } else {
      try {
        const bodyVisible = await page.locator('body').isVisible();
        entry.renderStatus = bodyVisible ? 'OK' : 'Error';
        if (!bodyVisible) entry.uiIssues.push('Empty or hidden body');
      } catch {
        entry.renderStatus = 'Error';
        entry.uiIssues.push('Page closed or unavailable');
      }
    }

    if (entry.renderStatus === 'OK') {
      try {
        const mainVisible = await page
          .locator('main, [role="main"], h1, h2')
          .first()
          .isVisible()
          .catch(() => false);
        if (!mainVisible) entry.uiIssues.push('No main content area detected');
      } catch {
        // ignore
      }
    }

    const slug = p.url.replace(/\//g, '-').replace(/^-/, '') || 'index';
    try {
      await page.screenshot({ path: path.join(screenshotDir, slug + '.png'), fullPage: false });
    } catch {
      // ignore screenshot errors
    }

    report.push(entry);
  }

  const reportPath = path.join(process.cwd(), 'e2e-report', 'admin-misc-report.json');
  fs.mkdirSync(path.dirname(reportPath), { recursive: true });
  fs.writeFileSync(reportPath, JSON.stringify(report, null, 2), 'utf-8');

  for (const r of report) {
    let s = '[' + r.renderStatus + '] ' + r.name + ' | ' + r.url;
    if (r.consoleErrors.length) s += ' | Errors: ' + r.consoleErrors.length;
    if (r.uiIssues.length) s += ' | UI: ' + r.uiIssues.join(', ');
    console.log(s);
  }
});
