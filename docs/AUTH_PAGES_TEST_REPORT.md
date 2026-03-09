# Auth Pages End-to-End Testing Report

**Generated:** March 5, 2025  
**App URL:** http://localhost:4100  
**Note:** Browser MCP tools were unavailable during generation. This report is based on **code analysis** and an **executable Playwright test suite**. Run the tests with `pnpm exec playwright test e2e/auth.spec.ts` (ensure the web app is running).

---

## Executive Summary

| Page                 | Render Status | Console Issues     | UI Issues | Functional Issues |
| -------------------- | ------------- | ------------------ | --------- | ----------------- |
| Login (en)           | OK (expected) | None found in code | 1 minor   | None              |
| Register (en)        | OK (expected) | None found in code | 1 minor   | None              |
| Forgot Password (en) | OK (expected) | None found in code | None      | None              |
| Verify Email (en)    | OK (expected) | None found in code | None      | None              |
| Login (zh)           | OK (expected) | None found in code | None      | None              |

---

## 1. Login Page (`/en/login`)

### Page URL

- http://localhost:4100/en/login

### Render Status

**OK** — Page structure verified from source:

- Auth layout with left hero panel (lg+) and right form area
- Title: `auth.login.title`
- Subtitle: `auth.login.subtitle`
- Email and password fields with react-hook-form + zod validation
- Forgot password link, Register link, Login button

### Console Errors

None identified in code analysis. Form uses standard react-hook-form/zod; no obvious error paths that would log to console.

### UI Issues

1. **Placeholder hardcoded:** Email input uses `placeholder="you@example.com"` — consider translating via i18n for consistency (minor).

### Functional Issues

None. Validation schema:

- Email: `z.string().email()`
- Password: `z.string().min(8)`
- Links to `/forgot-password` and `/register` (locale-preserved)

### Screenshots

_Run Playwright with `-- headed` and add `await page.screenshot({ path: 'login.png' })` to capture._

---

## 2. Register Page (`/en/register`)

### Page URL

- http://localhost:4100/en/register

### Render Status

**OK** — Multi-step wizard (3 steps: Account → Profile → Scores):

- Step 0: email, password, confirmPassword, agreeTerms, referral code (collapsible)
- Step 1: realName, birthday, graduationDate
- Step 2: TOEFL, IELTS, SAT, ACT (optional)
- PasswordStrength component on password field

### Console Errors

None identified. Uses `useTranslations`, `react-hook-form`, `zod`, and standard components.

### UI Issues

1. **Referral collapsible label:** Uses `t('referral.yourCode', { defaultValue: 'Have a referral code?' })`. The key `referral.yourCode` maps to "Your Referral Code" (en) / "你的邀请码" (zh). For a collapsible trigger, "Have a referral code?" is more inviting. Consider adding `referral.haveCode` or similar.

### Functional Issues

None. Validation:

- Email: valid format
- Password: min 8 chars, regex for upper/lower/number/special
- confirmPassword match
- agreeTerms required
- realName required on step 1
- Step navigation via `handleNext` / `handlePrev`

### Screenshots

_Run Playwright tests to capture._

---

## 3. Forgot Password Page (`/en/forgot-password`)

### Page URL

- http://localhost:4100/en/forgot-password

### Render Status

**OK** — Single email form:

- Title, description, email input with Mail icon
- Send button, Back to login link
- Success state: CheckCircle icon, "Email Sent", resend button

### Console Errors

None identified. Uses `useMutation` from TanStack Query; errors handled by global MutationCache (toast).

### UI Issues

None. Uses auth layout and `--auth-*` CSS vars per guidelines.

### Functional Issues

None. Client-side validation: empty email → `toast.error(t('auth.forgotPassword.emailRequired'))`. No email format validation before submit — API will handle invalid emails.

### Screenshots

_Run Playwright tests to capture._

---

## 4. Verify Email Page (`/en/verify-email`)

### Page URL

- http://localhost:4100/en/verify-email?email=user@example.com

### Render Status

**OK** — Displays:

- Mail icon, title, subtitle
- Email from `?email=` query param
- Resend button (with 60s cooldown)
- Back to login link

### Console Errors

None identified.

### UI Issues

None. Empty `email` param shows empty string in UI — acceptable; page is typically reached after registration with email in URL.

### Functional Issues

None. Resend disabled when `!email || isResending || cooldown > 0`.

### Screenshots

_Run Playwright tests to capture._

---

## 5. Verify Email Callback (`/en/verify-email/callback`)

### Page URL

- http://localhost:4100/en/verify-email/callback?token=XXX

### Render Status

**OK** — Three states:

- **Loading:** Spinner, "Verifying email..."
- **Success:** CheckCircle, "Email Verified", link to `/login?verified=true`
- **Error:** AlertCircle, "Verification Failed", link to `/login`

### Console Errors

None identified.

### UI Issues

None.

### Functional Issues

None. Token from `?token=`; no token → error state with `t('invalidToken')`.

---

## 6. Chinese Locale (`/zh/login`, etc.)

### Page URL

- http://localhost:4100/zh/login

### Render Status

**OK** — All auth keys present in `zh.json`:

- `auth.login.*`, `auth.register.*`, `auth.forgotPassword.*`, `auth.verifyEmail.*`, `auth.layout.*`
- `validation.*`, `errors.*`, `referral.*`
- `ui.password.*` for PasswordStrength

### Console Errors

None identified.

### UI Issues

None. i18n keys aligned with en.json.

### Functional Issues

None.

---

## Playwright Test Suite

An executable test file is provided at:

```
e2e/auth.spec.ts
```

### Run Instructions

1. Start the web app:

   ```bash
   pnpm web
   # or: pnpm dev
   ```

2. Run auth tests:

   ```bash
   pnpm exec playwright test e2e/auth.spec.ts
   ```

3. Run with UI and screenshots:

   ```bash
   pnpm exec playwright test e2e/auth.spec.ts --headed
   ```

4. Run with trace (on first retry):
   ```bash
   pnpm exec playwright test e2e/auth.spec.ts --trace=on
   ```

---

## Recommendations

1. **Add `referral.haveCode`** — Use for the collapsible trigger on the register page instead of `referral.yourCode` for better UX.
2. **Translate placeholders** — Consider i18n for `you@example.com`, `your@email.com`, etc.
3. **Run E2E regularly** — Integrate `pnpm exec playwright test e2e/auth.spec.ts` into CI when web is available.
4. **Manual console check** — When browser MCP is available, run through each page and inspect DevTools Console for runtime errors/warnings.

---

## Translation Keys Reference

| Key                           | Purpose                                          |
| ----------------------------- | ------------------------------------------------ |
| `auth.login.title`            | Login page title                                 |
| `auth.login.subtitle`         | Login page subtitle                              |
| `auth.login.email`            | Email label                                      |
| `auth.login.password`         | Password label                                   |
| `auth.login.forgotPassword`   | Forgot password link                             |
| `auth.login.noAccount`        | "Don't have an account?"                         |
| `auth.login.signUp`           | Sign up link                                     |
| `validation.invalidEmail`     | Invalid email error                              |
| `validation.passwordMin`      | Password min length error                        |
| `validation.passwordStrength` | Password complexity error (register)             |
| `validation.passwordMismatch` | Passwords don't match                            |
| `validation.agreeRequired`    | Terms agreement required                         |
| `validation.required`         | Generic required field                           |
| `errors.networkError`         | Network error fallback                           |
| `ui.password.*`               | PasswordStrength labels (strength, length, etc.) |
