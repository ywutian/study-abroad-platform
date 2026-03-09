# Core Pages E2E Test Report

**Date:** March 5, 2025  
**Test run:** Playwright E2E (`pnpm test:e2e:web`)  
**Base URL:** http://localhost:4100  
**Environment:** Unauthenticated (no login cookie)

---

## Summary

| Page            | URL                  | Status       | Notes                                       |
| --------------- | -------------------- | ------------ | ------------------------------------------- |
| Dashboard       | `/en/dashboard`      | **Redirect** | Redirects to login (expected for protected) |
| Profile         | `/en/profile`        | **Redirect** | Redirects to login (expected for protected) |
| Schools listing | `/en/schools`        | **OK**       | Page renders; 1 console error (401)         |
| Find College    | `/en/find-college`   | **OK**       | Page renders cleanly                        |
| Prediction      | `/en/prediction`     | **Redirect** | Redirects to login (expected for protected) |
| Recommendation  | `/en/recommendation` | **OK**       | Page renders; 4 errors, 1 warning           |
| Landing/Home    | `/en`                | **OK**       | Page renders; 1 console error (429)         |
| About           | `/en/about`          | **OK**       | Page renders; 1 console error (429)         |

**All 8 tests passed** (43.3s total). Protected pages correctly redirect to login when unauthenticated.

---

## Detailed Per-Page Report

### 1. Dashboard

- **URL:** http://localhost:4100/en/dashboard
- **Render status:** Redirect
- **Final URL:** http://localhost:4100/en/login?callbackUrl=%2Fen%2Fdashboard
- **Console errors:** None
- **Screenshot:** e2e-report/screenshots/Dashboard.png
- **Notes:** Protected route; redirect to login is expected.

### 2. Profile

- **URL:** http://localhost:4100/en/profile
- **Render status:** Redirect
- **Final URL:** http://localhost:4100/en/login?callbackUrl=%2Fen%2Fprofile
- **Console errors:** None
- **Screenshot:** e2e-report/screenshots/Profile.png
- **Notes:** Protected route; redirect to login is expected.

### 3. Schools listing

- **URL:** http://localhost:4100/en/schools
- **Render status:** OK
- **Final URL:** http://localhost:4100/en/schools
- **Console errors:** 1 — Failed to load resource: 401 (Unauthorized)
- **Screenshot:** e2e-report/screenshots/Schools-listing.png
- **Notes:** Page renders; 401 likely from optional auth API calls.

### 4. Find College

- **URL:** http://localhost:4100/en/find-college
- **Render status:** OK
- **Final URL:** http://localhost:4100/en/find-college
- **Console errors:** None
- **Screenshot:** e2e-report/screenshots/Find-College.png
- **Notes:** Page renders without errors.

### 5. Prediction

- **URL:** http://localhost:4100/en/prediction
- **Render status:** Redirect
- **Final URL:** http://localhost:4100/en/login?callbackUrl=%2Fen%2Fprediction
- **Console errors:** None
- **Screenshot:** e2e-report/screenshots/Prediction.png
- **Notes:** Protected route; redirect to login is expected.

### 6. Recommendation

- **URL:** http://localhost:4100/en/recommendation
- **Render status:** OK
- **Final URL:** http://localhost:4100/en/recommendation
- **Console errors:** 4 (429 Too Many Requests x2, 401 Unauthorized x2)
- **Console warnings:** 1
- **Screenshot:** e2e-report/screenshots/Recommendation.png
- **Notes:** Page renders. 401 for auth-only endpoints; 429 suggests rate limiting.

### 7. Landing/Home

- **URL:** http://localhost:4100/en
- **Render status:** OK
- **Final URL:** http://localhost:4100/en
- **Console errors:** 1 — Failed to load resource: 429 (Too Many Requests)
- **Screenshot:** e2e-report/screenshots/Landing/Home.png
- **Notes:** Hero, features, CTA render. 429 likely from shared API during tests.

### 8. About

- **URL:** http://localhost:4100/en/about
- **Render status:** OK
- **Final URL:** http://localhost:4100/en/about
- **Console errors:** 1 — Failed to load resource: 429 (Too Many Requests)
- **Screenshot:** e2e-report/screenshots/About.png
- **Notes:** Page renders. 429 likely from rate limiting.

---

## Re-run Tests

pnpm test:e2e:web
pnpm exec playwright test e2e/core-pages.spec.ts --headed
