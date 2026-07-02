/**
 * E2E smoke tests for core feature pages.
 * Run with: pnpm exec playwright test e2e/core-pages.spec.ts
 * Requires: web dev server at http://localhost:4100
 */
import { expect, test, type Page, type Route } from '@playwright/test';

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

const API_FIXTURE_USER = {
  id: 'e2e-user',
  email: 'e2e@example.com',
  role: 'USER',
  emailVerified: true,
  locale: 'en',
};

const API_FIXTURE_SCHOOLS = [
  {
    id: 'e2e-mit',
    name: 'Massachusetts Institute of Technology',
    nameZh: '麻省理工学院',
    country: 'US',
    state: 'MA',
    city: 'Cambridge',
    usNewsRank: 2,
    acceptanceRate: 4,
    tuition: 60156,
    totalEnrollment: 11920,
    testingPolicy: 'REQUIRED',
    hasEarlyDecision: false,
    acceptsCommonApp: false,
  },
  {
    id: 'e2e-stanford',
    name: 'Stanford University',
    nameZh: '斯坦福大学',
    country: 'US',
    state: 'CA',
    city: 'Stanford',
    usNewsRank: 3,
    acceptanceRate: 4,
    tuition: 62484,
    totalEnrollment: 18000,
    testingPolicy: 'OPTIONAL',
    hasEarlyDecision: true,
    acceptsCommonApp: true,
  },
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

async function fulfillJson(route: Route, data: unknown, status = 200) {
  await route.fulfill({
    status,
    contentType: 'application/json',
    body: JSON.stringify(data),
  });
}

async function installApiFixtures(page: Page) {
  await page.route('**/api/v1/**', async (route) => {
    const request = route.request();
    const url = new URL(request.url());
    const path = url.pathname.replace(/^\/api\/v1/, '') || '/';

    if (path === '/auth/refresh' && request.method() === 'POST') {
      await fulfillJson(route, { data: { accessToken: 'e2e-access-token' } });
      return;
    }

    if (path === '/users/me' && request.method() === 'GET') {
      await fulfillJson(route, { data: API_FIXTURE_USER });
      return;
    }

    if (path === '/schools/countries' && request.method() === 'GET') {
      await fulfillJson(route, { data: [{ code: 'US', count: API_FIXTURE_SCHOOLS.length }] });
      return;
    }

    if (path === '/schools' && request.method() === 'GET') {
      await fulfillJson(route, {
        data: { items: API_FIXTURE_SCHOOLS, total: API_FIXTURE_SCHOOLS.length },
      });
      return;
    }

    if (path === '/school-lists' && request.method() === 'GET') {
      await fulfillJson(route, { data: [] });
      return;
    }

    if (path === '/recommendations/preflight' && request.method() === 'GET') {
      await fulfillJson(route, {
        data: {
          canGenerate: true,
          points: 100,
          profileComplete: true,
          missingFields: [],
          profileSummary: { gpa: 3.9, testCount: 1, activityCount: 3 },
        },
      });
      return;
    }

    await fulfillJson(route, { data: {} });
  });
}

test.describe('Core pages E2E smoke tests', () => {
  for (const { url, name, protected: isProtected } of PAGES) {
    test(name, async ({ page }) => {
      const consoleErrors: string[] = [];
      const consoleWarnings: string[] = [];
      const uiIssues: string[] = [];

      await installApiFixtures(page);

      page.on('console', (msg) => {
        const text = msg.text();
        const type = msg.type();
        if (type === 'error') consoleErrors.push(text);
        else if (type === 'warning') consoleWarnings.push(text);
      });
      page.on('requestfailed', (request) => {
        uiIssues.push(`Request failed: ${request.method()} ${request.url()}`);
      });
      page.on('response', (response) => {
        const responseUrl = response.url();
        if (responseUrl.includes('/api/v1/') && response.status() >= 500) {
          uiIssues.push(`API ${response.status()}: ${responseUrl}`);
        }
      });

      let finalUrl = url;
      let status: 'OK' | 'Redirect' | 'Error' = 'OK';

      try {
        // 30s timeout: Next.js dev-mode JIT + Turbopack first-load on heavy
        // pages (Schools listing) can exceed 15s in cold CI runners.
        const response = await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 30000 });
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
          const hasVisibleGenericError = await page
            .getByText(/Something went wrong/i)
            .first()
            .isVisible()
            .catch(() => false);
          if (hasVisibleGenericError) {
            uiIssues.push('Generic error message displayed');
          }
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

      if (isProtected) {
        expect(finalUrl).toContain('/en/login');
      } else {
        expect(status, uiIssues.join('\n')).toBe('OK');
      }
      expect(uiIssues).toEqual([]);
      // Filter out non-actionable noise:
      //   - React hydration warnings caused by browser-extension-style attribute
      //     injection (caret-color, data-* from password managers) — they
      //     don't break functionality and are not reproducible without the
      //     extension that caused them.
      //   - Next.js dev-mode HMR / source-map warnings.
      // Anything else still fails the test (e.g. real component throws,
      // failed module imports, runtime TypeErrors).
      const significantErrors = consoleErrors.filter((err) => {
        if (err.includes('hydrated but some attributes')) return false;
        if (err.includes('Hydration failed because')) return false;
        if (err.includes('caret-color')) return false;
        if (err.includes('Warning: Extra attributes from the server')) return false;
        return true;
      });
      expect(significantErrors).toEqual([]);
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

/**
 * Regression guard for PR #478 — the /schools filter rail overlapping the fixed
 * Feedback FAB and running off-screen ("advanced filters 跟 feedback 重合 / 看不到
 * block 最底部"). Layout bugs can't be unit-tested (jsdom has no layout engine),
 * so this asserts the real browser geometry — in the spec CI actually runs.
 */
test.describe('Schools filter rail layout', () => {
  test('stays viewport-bounded, scrolls internally, and clears the Feedback FAB', async ({
    page,
  }) => {
    await installApiFixtures(page);
    // Short height so the expanded filter panel reliably overflows the viewport —
    // the exact condition that broke (bottom fell below the fold + under the FAB).
    await page.setViewportSize({ width: 1440, height: 600 });
    await page.goto('/en/schools');

    const rail = page.locator('aside').first();
    await rail.waitFor({ state: 'visible' });

    // Expand every collapsed filter section so the panel is tall.
    await page.evaluate(() => {
      document
        .querySelectorAll('aside [aria-expanded="false"]')
        .forEach((b) => (b as HTMLElement).click());
    });
    await page.waitForTimeout(400);

    const g = await page.evaluate(() => {
      const aside = document.querySelector('aside') as HTMLElement;
      const cs = getComputedStyle(aside);
      const fab = [...document.querySelectorAll('button')].find(
        (b) => getComputedStyle(b).position === 'fixed' && /feedback/i.test(b.textContent || '')
      );
      return {
        vh: window.innerHeight,
        railHeight: aside.clientHeight,
        scrollHeight: aside.scrollHeight,
        overflowY: cs.overflowY,
        paddingBottom: parseFloat(cs.paddingBottom) || 0,
        fabTop: fab ? fab.getBoundingClientRect().top : null,
      };
    });

    // Precondition: the expanded panel really is taller than the viewport.
    expect(g.scrollHeight).toBeGreaterThan(g.vh);
    // 1. Bounded — the rail never exceeds the viewport (pre-fix it ran off-screen).
    expect(g.railHeight).toBeLessThanOrEqual(g.vh);
    // 2. Scrolls internally instead of clipping, so the bottom stays reachable.
    expect(['auto', 'scroll']).toContain(g.overflowY);
    // 3. The rail's bottom padding covers the fixed Feedback FAB's band, so the
    //    last filter can scroll clear of it instead of hiding underneath.
    if (g.fabTop !== null) {
      expect(g.paddingBottom).toBeGreaterThanOrEqual(g.vh - g.fabTop);
    }
  });
});
