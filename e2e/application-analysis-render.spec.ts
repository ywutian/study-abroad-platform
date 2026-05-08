import { expect, test, type Page } from '@playwright/test';
import { getApplicationAnalysisRenderFixturesByTag } from '@study-abroad/shared';

const VIEWPORTS = [
  { name: 'desktop', width: 1440, height: 1100 },
  { name: 'narrow-web', width: 430, height: 1100 },
] as const;

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
  // Wait for late-rendering CardContent sections (e.g.
  // analysis-section-unknowns) to hydrate before the per-section
  // visibility loop runs. On slow CI machines, Next.js dev streaming
  // could flush the CardHeader before CardContent finished, which made
  // 007-unknown-policy-zh fail with "element(s) not found" against the
  // default 5s assertion timeout. Local headless Chrome was fast enough
  // to mask this; CI's runner consistently lost the race.
  await page.waitForLoadState('networkidle', { timeout: 60_000 }).catch(() => {
    /* best-effort — never block on a stuck network watcher */
  });
  await expect(page.getByTestId('analysis-section-actionPlan')).toBeVisible({
    timeout: 30_000,
  });
}

const renderFixtures = getApplicationAnalysisRenderFixturesByTag('render-smoke');

for (const viewport of VIEWPORTS) {
  test.describe(`application-analysis-render:${viewport.name}`, () => {
    test.use({ viewport: { width: viewport.width, height: viewport.height } });

    test.skip(
      process.env.ENABLE_E2E_FIXTURES !== 'true',
      'Render parity fixtures are only enabled in CI/dev governance runs.'
    );

    for (const fixture of renderFixtures) {
      test(`${fixture.caseId}`, async ({ page }) => {
        await openFixture(page, fixture.caseId, fixture.locale);

        await expect(page.getByTestId('analysis-overall-verdict')).toContainText(
          fixture.analysis.overallVerdict
        );
        await expect(page.getByTestId('analysis-state-badge')).toBeVisible();

        for (const section of fixture.expectedSections) {
          await expect(page.getByTestId(`analysis-section-${section}`)).toBeVisible();
        }

        const cards = page.getByTestId('analysis-school-card');
        await expect(cards).toHaveCount(fixture.expectedSchoolOrder.length);
        const actualSchoolOrder = await cards.evaluateAll((nodes) =>
          nodes.map((node) => node.getAttribute('data-school-name') ?? '')
        );
        expect(actualSchoolOrder).toEqual(fixture.expectedSchoolOrder);

        const actualPolicies = await page
          .getByTestId('analysis-testing-policy')
          .evaluateAll((nodes) => nodes.map((node) => node.getAttribute('data-policy') ?? ''));
        expect(actualPolicies).toEqual(
          fixture.analysis.schoolCards.map((school) => school.policyCard.testingPolicy)
        );

        const searchableBlocks = await Promise.all([
          page.getByTestId('analysis-next-actions').allInnerTexts(),
          page.getByTestId('analysis-school-card').allInnerTexts(),
        ]);
        const searchableText = searchableBlocks.flat().join('\n');
        for (const keyword of fixture.forbiddenKeywords) {
          expect(searchableText).not.toContain(keyword);
        }
      });
    }
  });
}
