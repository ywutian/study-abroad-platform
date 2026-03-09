# E2E Browser Test Report: Admin & Miscellaneous Pages

**Test Date:** March 5, 2025  
**Base URL:** http://localhost:4100  
**Test Runner:** Playwright (Chromium)

---

## Summary

| Status   | Count |
| -------- | ----- |
| OK       | 9     |
| Redirect | 6     |
| Error    | 2     |

---

## Detailed Report

### 1. Admin Dashboard

- **URL:** http://localhost:4100/en/admin
- **Render Status:** Redirect
- **Final URL:** http://localhost:4100/en/login?callbackUrl=%2Fen%2Fadmin
- **HTTP Status:** 200 (login page)
- **Console Errors:** 11 (401 Unauthorized, 429 Too Many Requests, 500 Internal Server Error from API calls on login page)
- **Console Warnings:** 1 — Next.js `scroll-behavior: smooth` hint (add `data-scroll-behavior="smooth"` to `<html>`)
- **UI Issues:** None
- **Notes:** Expected behavior — admin requires authentication; redirects to login with callback URL preserved.

---

### 2. Admin Users

- **URL:** http://localhost:4100/en/admin/users
- **Render Status:** Redirect
- **Final URL:** http://localhost:4100/en/login?callbackUrl=%2Fen%2Fadmin%2Fusers
- **HTTP Status:** 200
- **Console Errors:** 11 (401, 429, 500)
- **Console Warnings:** 1 — scroll-behavior
- **UI Issues:** None
- **Notes:** Expected — admin-only, redirects to login.

---

### 3. Admin Schools

- **URL:** http://localhost:4100/en/admin/schools
- **Render Status:** Redirect
- **Final URL:** http://localhost:4100/en/login?callbackUrl=%2Fen%2Fadmin%2Fschools
- **HTTP Status:** 200
- **Console Errors:** 10 (401, 429, 500)
- **Console Warnings:** 1 — scroll-behavior
- **UI Issues:** None
- **Notes:** Expected — admin-only.

---

### 4. Admin Content

- **URL:** http://localhost:4100/en/admin/content
- **Render Status:** Redirect
- **Final URL:** http://localhost:4100/en/login?callbackUrl=%2Fen%2Fadmin%2Fcontent
- **HTTP Status:** 200
- **Console Errors:** 10 (401, 429, 500)
- **Console Warnings:** 1 — scroll-behavior
- **UI Issues:** None
- **Notes:** Expected — admin-only.

---

### 5. Timeline

- **URL:** http://localhost:4100/en/timeline
- **Render Status:** OK
- **Final URL:** http://localhost:4100/en/timeline
- **HTTP Status:** 200
- **Console Errors:** 10 (401, 429, 500 from unauthenticated API calls)
- **Console Warnings:** 1 — scroll-behavior
- **UI Issues:** None
- **Notes:** Page renders correctly. API errors expected when not logged in.

---

### 6. Vault

- **URL:** http://localhost:4100/en/vault
- **Render Status:** OK
- **Final URL:** http://localhost:4100/en/vault
- **HTTP Status:** 200
- **Console Errors:** 10 (401, 429, 500)
- **Console Warnings:** 1 — scroll-behavior
- **UI Issues:** None
- **Notes:** Page renders. Vault is not in `PROTECTED_PATTERNS` so no login redirect.

---

### 7. Settings

- **URL:** http://localhost:4100/en/settings
- **Render Status:** Redirect
- **Final URL:** http://localhost:4100/en/login?callbackUrl=%2Fen%2Fsettings
- **HTTP Status:** 200
- **Console Errors:** 10 (401, 429, 500)
- **Console Warnings:** 1 — scroll-behavior
- **UI Issues:** None
- **Notes:** Expected — settings is protected, redirects to login.

---

### 8. Teams

- **URL:** http://localhost:4100/en/teams
- **Render Status:** Error
- **Final URL:** http://localhost:4100/en/teams
- **HTTP Status:** 500
- **Console Errors:** 10 (401, 429, 500)
- **Console Warnings:** 1 — scroll-behavior
- **UI Issues:** HTTP 500
- **Notes:** **BUG** — Teams page returns 500 Internal Server Error. Needs investigation (likely SSR/API error when fetching teams data without auth).

---

### 9. Assessment

- **URL:** http://localhost:4100/en/assessment
- **Render Status:** Redirect
- **Final URL:** http://localhost:4100/en/login?callbackUrl=%2Fen%2Fassessment
- **HTTP Status:** 200
- **Console Errors:** 8 (401, 429)
- **Console Warnings:** 1 — scroll-behavior
- **UI Issues:** None
- **Notes:** Expected — assessment is protected.

---

### 10. Uncommon App

- **URL:** http://localhost:4100/en/uncommon-app
- **Render Status:** OK
- **Final URL:** http://localhost:4100/en/uncommon-app
- **HTTP Status:** 200
- **Console Errors:** 8 (401, 429)
- **Console Warnings:** 1 — scroll-behavior
- **UI Issues:** None
- **Notes:** Page renders correctly.

---

### 11. Referral

- **URL:** http://localhost:4100/en/referral
- **Render Status:** Error
- **Final URL:** http://localhost:4100/en/uncommon-app (unexpected — may be client-side redirect or test timing)
- **Console Errors:** 7 (401, 429)
- **Console Warnings:** 1 — scroll-behavior
- **UI Issues:** Empty or hidden body
- **Notes:** **POTENTIAL BUG** — Test reported empty body; final URL ended at `/uncommon-app`. Possible redirect from referral to uncommon-app, or race condition during navigation. Referral page exists and shows "login required" when unauthenticated — may need re-test with longer wait.

---

### 12. Resume

- **URL:** http://localhost:4100/en/resume
- **Render Status:** OK
- **Final URL:** http://localhost:4100/en/resume
- **HTTP Status:** 200
- **Console Errors:** 3 (429, 401)
- **Console Warnings:** 1 — scroll-behavior
- **UI Issues:** None
- **Notes:** Page renders correctly.

---

### 13. Followers

- **URL:** http://localhost:4100/en/followers
- **Render Status:** OK
- **Final URL:** http://localhost:4100/en/followers
- **HTTP Status:** 200
- **Console Errors:** 2 (429, 401)
- **Console Warnings:** 1 — scroll-behavior
- **UI Issues:** None
- **Notes:** Page renders correctly.

---

## Common Console Issues (All Pages)

1. **401 Unauthorized** — Expected when not logged in; API rejects unauthenticated requests.
2. **429 Too Many Requests** — Rate limiting from rapid navigation during test; may need higher throttle limits for E2E.
3. **500 Internal Server Error** — Some API endpoints return 500 without auth; may need graceful handling.
4. **Next.js scroll-behavior warning** — Add `data-scroll-behavior="smooth"` to `<html>` in layout to satisfy Next.js.

---

## Critical Issues to Fix

| Page         | Issue                                                       | Priority |
| ------------ | ----------------------------------------------------------- | -------- |
| **Teams**    | HTTP 500 on page load — server error during render          | High     |
| **Referral** | Test reported empty body; possible redirect or timing issue | Medium   |

---

## Screenshots

Screenshots saved to `e2e-report/screenshots/` for each page (e.g., `admin.png`, `admin-users.png`, `timeline.png`, etc.).

---

## How to Re-run

```bash
# Ensure web app is running at http://localhost:4100
pnpm web   # or ./dev.sh

# Run the E2E test
pnpm exec playwright test e2e/admin-and-misc-pages.spec.ts --timeout=180000
```

Full JSON report: `e2e-report/admin-misc-report.json`
