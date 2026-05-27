---
name: create-feature-page
description: Scaffold a new Next.js feature page (apps/web) following project conventions — PageHeader + PageContainer with color variant, thin page.tsx + _components/ split if >500 lines, sibling loading.tsx + error.tsx, full i18n keys (en + zh), static Tailwind with dark: variants, min-w-0 on grid children (PR #214/215/217 overflow lesson), route protection if needed, AI_TIMEOUTS for AI requests.
---

# Create Feature Page

Scaffolds a complete Next.js feature page from scratch, locking in every convention the project's lint rules + design system enforce. Avoids the 8 most common rejections at code review.

## When to use

- New top-level route under `apps/web/src/app/[locale]/(main)/<feature>/`
- User asks "add a page for X"
- New tab inside an existing feature (e.g., new tab in `/cases`)

Do NOT use for: dialog/modal-only additions, single-component changes, admin pages (admin has its own conventions — see `apps/web/src/app/[locale]/(main)/admin/`).

## What gets scaffolded

```
apps/web/src/app/[locale]/(main)/<feature>/
├── page.tsx                # Thin orchestrator (≤200 lines, prefers ≤80)
├── loading.tsx             # Skeleton matching layout structure
├── error.tsx               # AIErrorBoundary or basic ErrorBoundary
└── _components/            # Only if page.tsx would exceed 500 lines
    ├── <feature>-header.tsx
    ├── <feature>-list.tsx
    └── ...
```

Plus updates to:
- `apps/web/src/messages/en.json` — new feature namespace
- `apps/web/src/messages/zh.json` — same keys, ZH translations
- `apps/web/src/middleware.ts` (or `proxy.ts`) — if route is protected

## Mandatory conventions (the 8 lint trips)

| # | Rule | What it catches |
|---|---|---|
| 1 | `PageHeader` + `PageContainer` wrap every page | Off-canon layout |
| 2 | Color variant from fixed set: `blue\|violet\|amber\|emerald\|rose\|slate\|indigo` | Custom colors |
| 3 | All hardcoded Tailwind colors have `dark:` variant | Missing dark mode |
| 4 | All Tailwind classes are STATIC strings, never `` `bg-${color}-500` `` | Purged in prod |
| 5 | `loading.tsx` sibling matches page skeleton structure | No loading state |
| 6 | Every grid/flex child of a viewport-wide container has `min-w-0` | PR #214/215/217 overflow bug |
| 7 | No hardcoded user-facing strings — every string is a `t('feature.key')` call | Hard-coded text |
| 8 | AI requests use `apiClient.post(url, dto, { timeout: AI_TIMEOUTS.AI_REQUEST })` | Default 30s too short for LLM |

## Standard imports

```typescript
// page.tsx
import { useTranslations } from 'next-intl';
import { PageHeader, PageContainer } from '@/components/layout';
// Or for tool surfaces:
//   <PageContainer variant="workbench"> for three-column viewport-locked
import { FadeInView, StaggerContainer } from '@/components/ui/motion';
import { useQuery } from '@tanstack/react-query';
import { apiClient } from '@/lib/api/client';
import { AI_TIMEOUTS } from '@/lib/constants';
```

## Page.tsx template

```typescript
'use client';
import { useTranslations } from 'next-intl';
import { PageHeader, PageContainer } from '@/components/layout';

export default function FeaturePage() {
  const t = useTranslations('feature');
  return (
    <>
      <PageHeader
        title={t('title')}
        subtitle={t('subtitle')}
        color="violet"
      />
      <PageContainer>
        {/* content */}
      </PageContainer>
    </>
  );
}
```

## loading.tsx template

```typescript
import { Skeleton } from '@/components/ui/skeleton';
import { PageHeader, PageContainer } from '@/components/layout';

export default function Loading() {
  return (
    <>
      <PageHeader title="" subtitle="" color="violet" />
      <PageContainer>
        <Skeleton className="h-12 w-full mb-4" />
        <Skeleton className="h-32 w-full" />
      </PageContainer>
    </>
  );
}
```

## i18n key checklist

For every new t('...') call:
- [ ] Added to `apps/web/src/messages/en.json`
- [ ] Added to `apps/web/src/messages/zh.json` with same key path
- [ ] `pnpm lint:i18n` passes (no missing, no wrong-language, no key drift)

## Route protection

If the page is auth-gated:
1. Add path to `apps/web/src/middleware.ts` (or `proxy.ts`) `PROTECTED_PATHS` array
2. If ADMIN-only, add to `ADMIN_PATHS`
3. Edge cookie check runs at middleware; component-level still verifies user from `useAuthStore`

## When to split

`page.tsx` should stay ≤ 500 lines (quality rule `page-size-limit`). If approaching:
1. Create `<feature>/_components/` directory
2. Move queries + handlers + JSX subtrees into co-located files
3. `page.tsx` becomes pure orchestrator: data wiring + composition only

## Mobile parity check

If the feature has user-facing data (profile, prediction, application analysis): the mobile app (`apps/mobile`) must surface it too. If shared contract changes:
1. `pnpm --filter @study-abroad/shared build`
2. Update corresponding mobile screen (`apps/mobile/src/screens/<feature>.tsx`)
3. Verify Metro picks up via `dist/` path

## Discipline rules

- **Never** `bg-slate-800` or `text-white` for page bg/text — use `bg-background` + `text-foreground`
- **Never** `text-xl font-bold` — use typography classes `text-title` / `text-body-sm` / `text-caption`
- **Never** dynamic Tailwind: `` `text-${color}-500` ``. Use a static map: `const colorMap = { blue: 'text-blue-500', ... }`
- **Tooltip** components MUST live inside a `TooltipProvider` (frontend-quality rule)
- **Icon buttons** need `aria-label` (manual review, not auto-caught)
- After scaffolding: run `pnpm --filter web lint` + manual visual check in dark mode

## Quick verify

```bash
cd apps/web && pnpm typecheck
pnpm --filter web lint
pnpm lint:i18n         # at repo root
pnpm dev               # ./dev.sh — visit the new page in both themes
```

## Anti-patterns

| Anti-pattern | Why bad | Fix |
|---|---|---|
| `bg-${dynamic}-500` | Tailwind purges unmapped classes | Static class map |
| `text-white` on page | Breaks dark mode | `text-foreground` |
| No `loading.tsx` | Layout shift on slow networks | Skeleton sibling |
| 800-line `page.tsx` | Untestable, slow refactor | Split to `_components/` |
| Hard-coded English | next-intl bypass, lint fails | `t('key')` everywhere |
| `max-w-[1200px]` className override | Conflicts with PageContainer `variant` | Use `variant="wide" \| "default" \| ...` |
| Grid child without `min-w-0` | Viewport-edge clipping (PR #214) | `min-w-0` on every grid/flex child |
