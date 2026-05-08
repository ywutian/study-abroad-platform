import { expect, test, type Locator, type Page } from '@playwright/test';
import { getApplicationAnalysisRenderFixturesByTag } from '@study-abroad/shared';

const renderFixtures = getApplicationAnalysisRenderFixturesByTag('render-smoke');

async function openFixture(page: Page, caseId: string, locale: string) {
  await page.route('**/api/v1/auth/refresh', async (route) => {
    await route.fulfill({
      status: 401,
      contentType: 'application/json',
      body: JSON.stringify({ message: 'Unauthenticated' }),
    });
  });

  await page.goto(`/${locale}/qa/application-analysis/${caseId}`, {
    waitUntil: 'commit',
    timeout: 90_000,
  });
  await expect(page.getByTestId('analysis-root')).toBeVisible({
    timeout: 90_000,
  });
  await expect(page.getByTestId('analysis-state-badge')).toBeVisible({
    timeout: 90_000,
  });
}

async function buildMasks(page: Page, selectors: string[]) {
  const masks: Locator[] = [];
  for (const selector of selectors) {
    const locator = page.locator(selector);
    if ((await locator.count()) > 0) {
      masks.push(locator.first());
    }
  }
  return masks;
}

test.describe('application-analysis-visual', () => {
  test.use({ viewport: { width: 1440, height: 1100 } });

  test.skip(
    process.env.ENABLE_E2E_FIXTURES !== 'true',
    'Render parity fixtures are only enabled in CI/dev governance runs.'
  );

  for (const fixture of renderFixtures) {
    test(fixture.caseId, async ({ page }) => {
      await openFixture(page, fixture.caseId, fixture.locale);
      await page.addStyleTag({
        content: `
          *,
          *::before,
          *::after {
            animation: none !important;
            transition: none !important;
            caret-color: transparent !important;
          }
        `,
      });

      const root = page.getByTestId('analysis-root');
      const masks = await buildMasks(page, fixture.maskSelectors);

      await expect(root).toHaveScreenshot(`application-analysis-${fixture.caseId}.png`, {
        animations: 'disabled',
        mask: masks,
      });
    });
  }
});
