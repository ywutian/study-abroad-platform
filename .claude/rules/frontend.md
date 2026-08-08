---
description: 'Frontend development rules for Next.js web app'
globs: ['apps/web/**']
---

# Frontend Rules

## Auth Architecture

- Access token stored **in-memory only** (Zustand store — never localStorage)
- Refresh token in **httpOnly cookie** — inaccessible to JS
- Only `AuthInitializer` owns the refresh interval — not `setAuthFromLogin`
- `apiClient` unwraps `response.data` automatically — component code receives inner object
- **Authed queries MUST gate on auth-readiness** — a `useQuery` that fires before `AuthInitializer` restores the in-memory token 401-races (#145/#222). Use `useAuthGatedQuery` (`@/hooks/use-auth-gated-query`) or `enabled: useAuthReady() && …`; never a bare authed `useQuery`. `no-unguarded-auth-query` enforces this on protected routes.

## API Proxy

All API calls go through Next.js rewrites: `/api/:path*` -> backend. Same-origin avoids CORS cookie issues.

## Provider Chain (`components/providers/index.tsx`)

```
ThemeProvider -> ErrorBoundary -> QueryProvider (staleTime: 5min, retry: 1)
  -> ProgressProvider -> TourProvider -> AuthInitializer
```

Also renders: `<Toaster>`, `<OfflineIndicator>`, `<FeedbackWidget>`, `<OverflowDetector>` (dev-only).

## Route Protection (`proxy.ts`)

- Protected: `/profile`, `/dashboard`, `/essays`, `/assessment`, `/prediction`, `/chat`, `/settings`
- Admin: `/admin/*`
- Cookie-based check at Edge (no JWT verification — server-side only)

## i18n

`next-intl` with `{en, zh}`. Messages in `apps/web/src/messages/{en,zh}.json`. Use `Link`/`useRouter` from `@/lib/i18n/navigation`.

### i18n Check System (5 Layers)

| Layer | Script                       | Checks                           | Integration     |
| ----- | ---------------------------- | -------------------------------- | --------------- |
| 1     | `check-i18n.ts`              | Hardcoded Chinese in TSX         | pre-commit + CI |
| 2     | `check-missing-keys.ts`      | `t()` calls without matching key | pre-commit + CI |
| 3     | `check-translation-keys.ts`  | en/zh key consistency            | pre-commit + CI |
| 4     | `check-wrong-language.ts`    | Wrong language in locale files   | pre-commit + CI |
| 5     | `check-hardcoded-english.ts` | Hardcoded English (audit)        | manual          |

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

## Layout Robustness (4 ironclad rules)

Lessons from PR #214 / #215 / #217 (the /chat right-panel clipping incident — the right column was being clipped at the viewport edge despite two rounds of fixes):

1. **Every grid/flex child must be `min-w-0`** — including the outermost wrapper of a nested component. Inner `truncate` is not enough: if the outer flex/grid container has `min-width:auto` (the default), a long string still pushes the cell past its allotted width. The cascade then pushes siblings past viewport. Custom grid templates (`grid-cols-[…px…]` or `grid-cols-[minmax(…)…]`) **also need `min-w-0` on the grid container itself** — enforced by the `no-missing-min-w-in-grid-container` lint rule.
2. **`PageContainer.maxWidth` and className `max-w-*` are mutually exclusive** — use the `variant` system (now includes `workbench` for viewport-locked three-column tool surfaces). Never override max-width via className; it depends on tw-merge priority and is semantically backwards.
3. **`overflow-x-clip` is production-only** — `app/[locale]/(main)/layout.tsx` applies it only when `NODE_ENV === 'production'`. Dev mode lets `OverflowDetector` flag the real bug instead of silently masking it. If you need to add `overflow-x-*` elsewhere, condition it the same way.
4. **Page-fills-viewport height uses `--app-header-h` CSS var** — defined on the `(main)` layout root, default `6.5rem`. Do not encode `h-[calc(100dvh-6.5rem)]` magic numbers in leaf pages. The `workbench` PageContainer variant already does this for you.

## SSR Paint (what the server actually sends)

**A client hook cannot decide server-rendered output.** `useReducedMotion()`, `useMediaQuery()`,
`useTheme()` etc. all return their default during SSR, so a ternary on one of them only ever takes
the _client_ branch in the HTML. Real case (#519): `initial={prefersReducedMotion ? false : {opacity: 0}}`
meant every visitor — reduced-motion users included — got `style="opacity:0"` in the server HTML,
and the hero stayed invisible until ~570 KB of JS hydrated. The CSS-animation equivalent needs no
JS decision at all: `globals.css` already clamps animations under `prefers-reduced-motion: reduce`.

**Above-the-fold content must not be server-rendered invisible.** `motion.div` with
`initial={{opacity: 0}}` serialises to `style="opacity:0"` in the HTML — the content ships, then
waits for hydration to become visible. Below the fold this is correct (`whileInView` scroll-in);
above the fold it is a paint bug that no test catches, because the DOM is _there_.

```bash
# The whole page's invisible containers — expect these to be below-the-fold only
curl -s <url> | grep -c 'style="opacity:0'
# Is any ancestor of the <h1> one of them? (that is the bug)
```

Verified the same way as everything else in this file: **read the server HTML, not the browser DOM.**

### The other half: did React actually take over?

Server HTML is only one side. The other side — did the page hydrate — cannot be
read out of the HTML, and it cannot be trusted to an unreliable browser either:
in 2026-08 an in-app browser rendered `/zh/forum` as "0 个社区" plus a permanent
spinner while the API returned 20 rows, and that produced a written root cause
and a filed task for a bug that did not exist. The same symptom appeared on an
unrelated route, which is the tell: **a symptom that reproduces across unrelated
pages is about the instrument, not the page.**

`pnpm --filter web check:hydration` is the twin of `check:seo`. Its criterion is
not "is there content in the DOM" — the SSR shell always has content, and an
initial `loading=true` state renders exactly like a page that is still loading.
It is **what only a client effect can cause**: the page issuing its own data
request. Also asserts no `pageerror`, and that forum community rows render in
the route's locale (the slug→message map fails silently — English names just
come back). Network-dependent, so it stays out of `lint:all` / pre-push / CI;
run it after a deploy.

Positive and negative observations are not symmetric here. "The page rendered
20 localized rows" cannot be faked by a flaky browser. "The page rendered
nothing" can — on its own it settles nothing.

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

| Rule                                 | Severity | Catches                                                                                                                                                                                                                                            |
| ------------------------------------ | -------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `no-dynamic-tailwind`                | error    | `` `bg-${color}-500` `` purged in prod                                                                                                                                                                                                             |
| `no-hardcoded-dark-bg`               | warning  | `bg-slate-800` without `dark:`                                                                                                                                                                                                                     |
| `no-hardcoded-gray`                  | warning  | `bg-gray-100` without `dark:`                                                                                                                                                                                                                      |
| `page-size-limit`                    | warning  | `page.tsx` >500 lines                                                                                                                                                                                                                              |
| `no-console-in-prod`                 | warning  | `console.log/error`                                                                                                                                                                                                                                |
| `no-missing-loading`                 | warning  | `page.tsx` without `loading.tsx`                                                                                                                                                                                                                   |
| `no-missing-error-boundary`          | warning  | Route group without `error.tsx`                                                                                                                                                                                                                    |
| `no-tooltip-without-provider`        | error    | `Tooltip` without `TooltipProvider`                                                                                                                                                                                                                |
| `no-missing-min-w-in-grid-container` | error    | Custom `grid-cols-[…]` without `min-w-0` (overflow root cause PR #214/#215/#217). Worklist cleared to 0 + promoted to error in closure #3; `min-w-0` only allows shrinking so it's always safe. Suppress with `// @design-system-ignore-next-line` |
| `no-unguarded-auth-query`            | error    | Authed `useQuery` (apiClient) on a protected route with no `enabled` — 401 race (#145/#222). Use `useAuthGatedQuery` / `useAuthReady()`; public reads `// @public-query`                                                                           |
