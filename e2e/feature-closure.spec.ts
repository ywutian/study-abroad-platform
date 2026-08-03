import { expect, test } from '@playwright/test';

import { installFullUiApiFixtures } from './full-ui-surface.fixtures';

const responseData = (data: unknown) => ({ success: true, data });

test.describe('Web feature closure', () => {
  test('restores school comparison from ids and keeps URL state after removal', async ({
    page,
  }) => {
    await installFullUiApiFixtures(page, 'guest');

    await page.goto('/en/schools/compare?ids=e2e-mit,e2e-stanford');

    await expect(page.getByRole('heading', { name: 'Compare Schools' })).toBeVisible();
    await expect(
      page.getByText('Massachusetts Institute of Technology', { exact: true }).first()
    ).toBeVisible();
    await expect(page.getByText('Stanford University', { exact: true }).first()).toBeVisible();
    await expect(page.getByText('Acceptance Rate', { exact: true })).toBeVisible();

    await page.getByRole('button', { name: 'Remove' }).first().click();

    await expect(page).toHaveURL(/\/en\/schools\/compare\?ids=e2e-stanford$/);
    await expect(page.getByText('Stanford University', { exact: true }).first()).toBeVisible();
    await expect(page.getByText('Add at least one more school to start comparing')).toBeVisible();
  });

  test('uploads outcome evidence and reads the updated state after reload', async ({ page }) => {
    await installFullUiApiFixtures(page, 'user');

    let evidenceUrl: string | null = null;
    const outcome = () => ({
      id: 'e2e-outcome',
      predictionResultId: 'e2e-prediction',
      result: 'ADMITTED',
      status: 'SELF_REPORTED',
      notes: 'Accepted through regular decision',
      evidenceUrl,
      round: 'RD',
      isFinal: true,
      createdAt: '2026-04-20T12:00:00.000Z',
      schoolName: 'Stanford University',
      predictionProbability: 0.42,
    });

    await page.route('**/api/**', async (route) => {
      const request = route.request();
      const path = new URL(request.url()).pathname.replace(/^\/api(?:\/v1)?(?=\/|$)/, '') || '/';
      if (path === '/predictions/outcomes/me') {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify(responseData([outcome()])),
        });
        return;
      }
      if (path === '/predictions/outcomes/me/stats') {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify(responseData({ totalReported: 1, selfReported: 1, verified: 0 })),
        });
        return;
      }
      if (path === '/predictions/outcomes/e2e-outcome/evidence' && request.method() === 'POST') {
        evidenceUrl = 'https://example.test/outcome-evidence/acceptance.pdf';
        await route.fulfill({
          status: 201,
          contentType: 'application/json',
          body: JSON.stringify(responseData(outcome())),
        });
        return;
      }
      await route.fallback();
    });

    await page.goto('/en/outcomes');
    await expect(page.getByRole('heading', { name: 'Admission Outcome Reports' })).toBeVisible();
    await expect(page.getByText('Stanford University', { exact: true })).toBeVisible();
    await expect(page.getByText('System predicted: 42%', { exact: true })).toBeVisible();

    await page.locator('input[type="file"]').setInputFiles({
      name: 'acceptance.pdf',
      mimeType: 'application/pdf',
      buffer: Buffer.from('%PDF-1.4 closure fixture'),
    });

    await expect(page.getByText('Uploaded', { exact: true })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Upload acceptance letter' })).toHaveCount(0);
  });
});
