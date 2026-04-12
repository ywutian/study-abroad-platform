---
description: "Frontend development rules for Next.js web app"
globs: ["apps/web/**"]
---

# Frontend Rules

## Auth Architecture

- Access token stored **in-memory only** (Zustand store — never localStorage)
- Refresh token in **httpOnly cookie** — inaccessible to JS
- Only `AuthInitializer` owns the refresh interval — not `setAuthFromLogin`
- `apiClient` unwraps `response.data` automatically — component code receives inner object

## API Proxy

All API calls go through Next.js rewrites: `/api/:path*` -> backend. Same-origin avoids CORS cookie issues.

## Provider Chain (`components/providers/index.tsx`)

```
ThemeProvider -> ErrorBoundary -> QueryProvider (staleTime: 5min, retry: 1)
  -> ProgressProvider -> TourProvider -> AuthInitializer
```
Also renders: `<Toaster>`, `<OfflineIndicator>`, `<FeedbackWidget>`.

## Route Protection (`proxy.ts`)

- Protected: `/profile`, `/dashboard`, `/essays`, `/assessment`, `/prediction`, `/chat`, `/settings`
- Admin: `/admin/*`
- Cookie-based check at Edge (no JWT verification — server-side only)

## i18n

`next-intl` with `{en, zh}`. Messages in `apps/web/src/messages/{en,zh}.json`. Use `Link`/`useRouter` from `@/lib/i18n/navigation`.

### i18n Check System (5 Layers)

| Layer | Script | Checks | Integration |
|-------|--------|--------|-------------|
| 1 | `check-i18n.ts` | Hardcoded Chinese in TSX | pre-commit + CI |
| 2 | `check-missing-keys.ts` | `t()` calls without matching key | pre-commit + CI |
| 3 | `check-translation-keys.ts` | en/zh key consistency | pre-commit + CI |
| 4 | `check-wrong-language.ts` | Wrong language in locale files | pre-commit + CI |
| 5 | `check-hardcoded-english.ts` | Hardcoded English (audit) | manual |

## CSS Design System (`globals.css`)

OKLCH color system with 50+ CSS custom properties per theme (light/dark).
Key utility classes: `zone-tinted`/`zone-dark`, `glass`/`glass-heavy`/`glass-premium`, `text-gradient-*`, `bg-gradient-*`, `text-display-hero`/`text-display-section`, `section-compact`/`normal`/`expansive`, 16 `animate-*` classes.

## Component Patterns

- **PageHeader + PageContainer**: ALL feature pages. Colors: `blue|violet|amber|emerald|rose|slate|indigo`.
- **Page split**: Pages >500 lines -> thin `page.tsx` orchestrator + `_components/` directory.
- **Motion**: `FadeInView`, `StaggerContainer`, `AnimatedNumber` from `@/components/ui/motion`.
- **PasswordStrength**: from `@/components/ui/password-strength`.

## UI Conventions (STRICT)

- **Prefer CSS vars**: `text-foreground`, `bg-background`, `bg-card`, `bg-muted`, `text-muted-foreground`, `border-border`
- **Hardcoded Tailwind colors** MUST add `dark:` variant (e.g., `bg-emerald-50 dark:bg-emerald-950/30`)
- **Never dynamically interpolate**: `` `bg-${color}-500` `` gets purged. Use static class maps.
- **Never** `bg-slate-800/900` or `text-white` for page backgrounds — use `bg-background`/`text-foreground`
- **Dark sections**: Use `.zone-dark` class instead of `bg-slate-900`
- **Auth pages**: Use `--auth-*` CSS vars — never hardcode colors
- **Typography**: Use `text-title`, `text-body-sm`, `text-caption` — not raw `text-xl`
- **Loading**: Use `Skeleton` in `loading.tsx`, matching page layout structure

## Overflow Prevention (3-layer defense)

- Layer 1 (global): `html`/`body` have `overflow-x: hidden` + `overflow-wrap: break-word`
- Layer 2 (layout): `PageContainer` and `Card` have `overflow-hidden` built-in
- Layer 3 (component): `flex` + `justify-between` MUST have `min-w-0` on variable-width child, `shrink-0` on fixed-width. Use `truncate` or `line-clamp-N`.

## Frontend AI Requests

```typescript
import { AI_TIMEOUTS } from '@/lib/constants';
const mutation = useMutation({
  mutationFn: (dto) => apiClient.post('/endpoint', dto, { timeout: AI_TIMEOUTS.AI_REQUEST }),
});
```
Error handling: global `MutationCache` in `query-provider.tsx`. Use `meta.skipGlobalErrorToast` to opt out.
AI Error Boundary: `<AIErrorBoundary feature="...">` wraps AI feature components.

## Admin Panel

- 20 pages under `apps/web/src/app/[locale]/(main)/admin/`
- recharts for AreaChart + health. Large pages split into `_components/` with own `useQuery`.
- `admin/ai-agent/_components/` and `admin/analytics/_components/` are **shared** — do NOT delete
- recharts theming: CSS vars `hsl(var(--primary))` for dark mode

## Code Review Checklist (Frontend)

1. [AUTO] Tailwind classes are static (no `${var}` interpolation)
2. [AUTO] Hardcoded colors have `dark:` variant
3. [AUTO] New page has sibling `loading.tsx`
4. [AUTO] No `console.log` in production code
5. [AUTO] `Tooltip` wrapped in `TooltipProvider`
6. [MANUAL] Icon buttons have `aria-label`
7. [MANUAL] Uses `PageHeader` + `PageContainer`
8. [MANUAL] No hardcoded user-facing strings (use i18n)

## Frontend Quality Checks (`check-code-quality.ts`)

| Rule | Severity | Catches |
|------|----------|---------|
| `no-dynamic-tailwind` | error | `` `bg-${color}-500` `` purged in prod |
| `no-hardcoded-dark-bg` | warning | `bg-slate-800` without `dark:` |
| `no-hardcoded-gray` | warning | `bg-gray-100` without `dark:` |
| `page-size-limit` | warning | `page.tsx` >500 lines |
| `no-console-in-prod` | warning | `console.log/error` |
| `no-missing-loading` | warning | `page.tsx` without `loading.tsx` |
| `no-missing-error-boundary` | warning | Route group without `error.tsx` |
| `no-tooltip-without-provider` | error | `Tooltip` without `TooltipProvider` |
