/**
 * E2E browser tests for auth pages.
 * Run: pnpm exec playwright test e2e/auth.spec.ts
 * Requires: Web app at http://localhost:4100
 */
import { test, expect } from '@playwright/test';

const BASE = 'http://localhost:4100';

test.describe('Auth - Login', () => {
  test('renders correctly', async ({ page }) => {
    await page.goto(`${BASE}/en/login`);
    await expect(page.getByLabel(/email/i)).toBeVisible();
    await expect(page.getByLabel(/password/i)).toBeVisible();
  });
  test('validates empty submit', async ({ page }) => {
    await page.goto(`${BASE}/en/login`);
    await page.getByRole('button', { name: /login/i }).click();
    await expect(page.getByText(/valid|required/i)).toBeVisible({ timeout: 5000 });
  });
  test('forgot password link works', async ({ page }) => {
    await page.goto(`${BASE}/en/login`);
    await page.getByRole('link', { name: /forgot/i }).click();
    await expect(page).toHaveURL(/forgot-password/);
  });
  test('register link works', async ({ page }) => {
    await page.goto(`${BASE}/en/login`);
    await page.getByRole('link', { name: /sign up/i }).click();
    await expect(page).toHaveURL(/register/);
  });
});

test.describe('Auth - Register', () => {
  test('renders step 0', async ({ page }) => {
    await page.goto(`${BASE}/en/register`);
    await expect(page.getByLabel(/email/i)).toBeVisible();
    await expect(page.getByLabel(/confirm password/i)).toBeVisible();
  });
  test('validates empty next', async ({ page }) => {
    await page.goto(`${BASE}/en/register`);
    await page.getByRole('button', { name: /next/i }).click();
    await expect(page.getByText(/valid|required/i)).toBeVisible({ timeout: 5000 });
  });
});

test.describe('Auth - Forgot Password', () => {
  test('renders and validates', async ({ page }) => {
    await page.goto(`${BASE}/en/forgot-password`);
    await page.getByRole('button', { name: /send|reset/i }).click();
    await expect(page.getByText(/email/i)).toBeVisible({ timeout: 5000 });
  });
});

test.describe('Auth - Verify Email', () => {
  test('renders with email param', async ({ page }) => {
    await page.goto(`${BASE}/en/verify-email?email=test%40example.com`);
    await expect(page.getByText(/test@example.com/)).toBeVisible();
  });
});

test.describe('Auth - Chinese i18n', () => {
  test('login in zh', async ({ page }) => {
    await page.goto(`${BASE}/zh/login`);
    await expect(page.getByRole('heading', { name: /登录/ })).toBeVisible();
  });
});
