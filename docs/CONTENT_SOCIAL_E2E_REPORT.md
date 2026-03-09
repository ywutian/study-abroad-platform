# Content/Social Pages E2E Test Report

**Test Date:** 2025-03-05  
**Test Runner:** Playwright  
**Base URL:** http://localhost:4100/en

---

## Summary

| Status              | Count |
| ------------------- | ----- |
| OK                  | 8     |
| Redirect (expected) | 2     |
| Error               | 2     |

---

## Detailed Report

### 1. Cases Gallery — http://localhost:4100/en/cases

| Field             | Value                          |
| ----------------- | ------------------------------ |
| **Render Status** | OK                             |
| **HTTP**          | 200                            |
| **Final URL**     | http://localhost:4100/en/cases |

**Console Errors:**

- `Failed to load resource: the server responded with a status of 429 (Too Many Requests)` — API rate limiting during rapid test runs

**UI Issues:** None

**Screenshot:** `e2e-report/screenshots/content-social-cases.png`

---

### 2. Essays — http://localhost:4100/en/essays

| Field             | Value                                                     |
| ----------------- | --------------------------------------------------------- |
| **Render Status** | Redirect                                                  |
| **HTTP**          | 200 (after redirect)                                      |
| **Final URL**     | http://localhost:4100/en/login?callbackUrl=%2Fen%2Fessays |

**UI Issues:** Expected redirect to login (protected route)

**Notes:** Essays page correctly redirects unauthenticated users to login. Behavior is by design.

**Screenshot:** `e2e-report/screenshots/content-social-essays.png`

---

### 3. Essay Gallery — http://localhost:4100/en/essay-gallery

| Field             | Value                                  |
| ----------------- | -------------------------------------- |
| **Render Status** | OK                                     |
| **HTTP**          | 200                                    |
| **Final URL**     | http://localhost:4100/en/essay-gallery |

**Console Errors:**

- `Failed to load resource: the server responded with a status of 429 (Too Many Requests)` — API rate limiting

**UI Issues:** None

**Screenshot:** `e2e-report/screenshots/content-social-essay-gallery.png`

---

### 4. Forum — http://localhost:4100/en/forum

| Field             | Value                          |
| ----------------- | ------------------------------ |
| **Render Status** | OK (with runtime error)        |
| **HTTP**          | 200                            |
| **Final URL**     | http://localhost:4100/en/forum |

**Console Errors:**

- `Failed to load resource: the server responded with a status of 429 (Too Many Requests)`
- **`ReferenceError: Badge is not defined`** at ForumPage — **FIXED:** Missing `Badge` import in `forum/page.tsx`
- `Application error: ReferenceError: Badge is not defined` (error boundary)

**UI Issues:**

- Error boundary displayed due to `Badge is not defined` crash

**Fix Applied:** Added `import { Badge } from '@/components/ui/badge'` to `forum/page.tsx`

**Screenshot:** `e2e-report/screenshots/content-social-forum.png`

---

### 5. Hall of Fame — http://localhost:4100/en/hall

| Field             | Value                         |
| ----------------- | ----------------------------- |
| **Render Status** | OK                            |
| **HTTP**          | 200                           |
| **Final URL**     | http://localhost:4100/en/hall |

**Console Errors:**

- `Failed to load resource: the server responded with a status of 429 (Too Many Requests)` (multiple)
- `Failed to load resource: the server responded with a status of 401 (Unauthorized)` (multiple) — Expected when unauthenticated; API endpoints require auth

**UI Issues:** None

**Notes:** 401s are expected for unauthenticated users on protected API endpoints. Page still renders.

**Screenshot:** `e2e-report/screenshots/content-social-hall.png`

---

### 6. Swipe — http://localhost:4100/en/swipe

| Field             | Value                          |
| ----------------- | ------------------------------ |
| **Render Status** | OK                             |
| **HTTP**          | 200                            |
| **Final URL**     | http://localhost:4100/en/swipe |

**Console Errors:**

- `Failed to load resource: the server responded with a status of 429 (Too Many Requests)` (multiple)
- `Failed to load resource: the server responded with a status of 401 (Unauthorized)` (multiple) — Expected when unauthenticated

**UI Issues:** None

**Screenshot:** `e2e-report/screenshots/content-social-swipe.png`

---

### 7. Chat — http://localhost:4100/en/chat

| Field             | Value                                                   |
| ----------------- | ------------------------------------------------------- |
| **Render Status** | Redirect                                                |
| **HTTP**          | 200 (after redirect)                                    |
| **Final URL**     | http://localhost:4100/en/login?callbackUrl=%2Fen%2Fchat |

**Console Errors:**

- `Failed to load resource: the server responded with a status of 429 (Too Many Requests)`

**UI Issues:** Expected redirect to login (protected route)

**Notes:** Chat correctly redirects unauthenticated users to login.

**Screenshot:** `e2e-report/screenshots/content-social-chat.png`

---

### 8. Ranking — http://localhost:4100/en/ranking

| Field             | Value                            |
| ----------------- | -------------------------------- |
| **Render Status** | OK                               |
| **HTTP**          | 200                              |
| **Final URL**     | http://localhost:4100/en/ranking |

**Console Errors:**

- `Failed to load resource: the server responded with a status of 429 (Too Many Requests)`

**UI Issues:** None

**Screenshot:** `e2e-report/screenshots/content-social-ranking.png`

---

### 9. Verified Ranking — http://localhost:4100/en/verified-ranking

| Field             | Value                                     |
| ----------------- | ----------------------------------------- |
| **Render Status** | OK                                        |
| **HTTP**          | 200                                       |
| **Final URL**     | http://localhost:4100/en/verified-ranking |

**Console Errors:**

- `Failed to load resource: the server responded with a status of 429 (Too Many Requests)`

**UI Issues:** None

**Screenshot:** `e2e-report/screenshots/content-social-verified-ranking.png`

---

### 10. Help — http://localhost:4100/en/help

| Field             | Value                         |
| ----------------- | ----------------------------- |
| **Render Status** | **Error**                     |
| **HTTP**          | **500**                       |
| **Final URL**     | http://localhost:4100/en/help |

**Console Errors:**

- `Failed to load resource: the server responded with a status of 500 (Internal Server Error)`

**UI Issues:** HTTP 500 — Server error when loading the page

**Action Required:** Investigate server-side error (likely Next.js SSR or i18n during page render).

**Screenshot:** `e2e-report/screenshots/content-social-help.png`

---

### 11. Terms — http://localhost:4100/en/terms

| Field             | Value                          |
| ----------------- | ------------------------------ |
| **Render Status** | **Error**                      |
| **HTTP**          | **500**                        |
| **Final URL**     | http://localhost:4100/en/terms |

**Console Errors:**

- `Failed to load resource: the server responded with a status of 500 (Internal Server Error)`
- `Failed to load resource: the server responded with a status of 401 (Unauthorized)`

**UI Issues:** HTTP 500 — Server error when loading the page

**Action Required:** Investigate server-side error for Terms page.

**Screenshot:** `e2e-report/screenshots/content-social-terms.png`

---

### 12. Privacy — http://localhost:4100/en/privacy

| Field             | Value                            |
| ----------------- | -------------------------------- |
| **Render Status** | OK                               |
| **HTTP**          | 200                              |
| **Final URL**     | http://localhost:4100/en/privacy |

**Console Errors:**

- `Failed to load resource: the server responded with a status of 401 (Unauthorized)` — Likely an API call from the page

**UI Issues:** None

**Screenshot:** `e2e-report/screenshots/content-social-privacy.png`

---

## Issues to Resolve

### High Priority

1. **Forum — Badge not defined** — ✅ Fixed (missing import added)
2. **Help — HTTP 500** — Needs investigation (possible i18n or SSR issue)
3. **Terms — HTTP 500** — Needs investigation (possible i18n or SSR issue)

### Medium Priority

4. **429 Too Many Requests** — Rate limiting triggered during rapid E2E runs. Consider:
   - Increasing `THROTTLE_LIMIT` for test environment
   - Or adding delays between page navigations in tests

### Low Priority

5. **401 Unauthorized** — Expected for unauthenticated users on protected API calls. No action needed for public pages.

---

## How to Re-run Tests

```bash
# Ensure web app is running at http://localhost:4100
pnpm dev

# In another terminal:
pnpm exec playwright test e2e/content-social-pages.spec.ts
```

Screenshots: `e2e-report/screenshots/content-social-*.png`  
JSON report: `e2e-report/content-social-report.json`
