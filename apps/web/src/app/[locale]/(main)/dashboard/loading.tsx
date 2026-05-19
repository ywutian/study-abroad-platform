import { PageContainer } from '@/components/layout';
import { Card, CardContent } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';

/**
 * Dashboard loading skeleton — must match the real page layout to
 * minimize Cumulative Layout Shift (CLS).
 *
 * Real layout (2026-05 redesign batch 2 — two-column workbench):
 *   PageHeader
 *   → QuickAsk                       (full-width, above the grid)
 *   → grid [ MAIN 1fr | SIDEBAR ~21rem ]
 *       MAIN:
 *         → CommandCenter            (single column — hero+readiness
 *                                     above the divider, priority queue
 *                                     + deadline stream below)
 *         → [PipelineStrip]          (conditional, no skeleton — see note)
 *         → [EssayCoach]             (conditional, no skeleton — see note)
 *         → [DecisionPanel]          (conditional, no skeleton — see note)
 *       SIDEBAR:
 *         → DashboardStats           (default-OPEN in the sidebar —
 *                                     header + 2-col tile grid skeleton)
 *         → DashboardWorkspaceHub    (collapsed — header-only skeleton)
 *
 * Conditional surfaces (PipelineStrip, EssayCoach, DecisionPanel)
 * intentionally have NO skeleton entry: they render null when the user
 * has no data, so reserving space for them would CAUSE the layout shift
 * this file exists to prevent.
 *
 * The grid template, `PageContainer variant`, and the readiness-grid
 * breakpoints below are kept byte-identical to page.tsx /
 * dashboard-command-center.tsx — any drift reintroduces CLS.
 *
 * History:
 * - 2026-05 Phase 1.5 #16: rewritten from legacy "4 stat cards" stub
 * - 2026-05 dashboard redesign batch 1: dropped the Activity skeleton,
 *   extracted PipelineStrip, reduced Stats/Hub to header-only skeletons
 * - 2026-05 dashboard redesign batch 2: two-column workbench layout;
 *   CommandCenter flattened to a single column; Stats skeleton shows
 *   the open tile grid (it is default-open in the sidebar)
 */
export default function DashboardLoading() {
  return (
    <PageContainer variant="admin">
      {/* PageHeader skeleton (title + description + actions) */}
      <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="space-y-2">
          <Skeleton className="h-8 w-64" />
          <Skeleton className="h-5 w-80" />
        </div>
        <Skeleton className="h-9 w-32 shrink-0" />
      </div>

      <div className="space-y-6">
        {/* QuickAsk skeleton (input + suggestion chips strip) — full-width */}
        <Card className="rounded-[var(--theme-radius-card)]">
          <CardContent className="p-3">
            <Skeleton className="h-9 w-full" />
            <div className="mt-2 flex flex-wrap gap-1.5">
              <Skeleton className="h-5 w-12" />
              <Skeleton className="h-5 w-44" />
              <Skeleton className="h-5 w-56" />
              <Skeleton className="h-5 w-48" />
            </div>
          </CardContent>
        </Card>

        {/* Two-column workbench grid — mirrors page.tsx exactly. */}
        <div className="grid min-w-0 grid-cols-1 gap-6 lg:grid-cols-[minmax(0,1fr)_clamp(19rem,22vw,21rem)]">
          {/* MAIN column */}
          <div className="min-w-0 space-y-6">
            {/* CommandCenter skeleton — single column (batch 2 flatten):
                hero + readiness above the divider, priority queue +
                deadline stream below. */}
            <Card className="overflow-hidden rounded-[var(--theme-radius-card)]">
              <CardContent className="p-0">
                {/* Hero + readiness section */}
                <div className="border-b border-border p-4 sm:p-5">
                  {/* Hero */}
                  <div className="mb-5 flex items-start gap-3">
                    <Skeleton className="h-11 w-11 shrink-0 rounded-[var(--theme-radius-card)]" />
                    <div className="flex-1 space-y-2">
                      <Skeleton className="h-7 w-72" />
                      <Skeleton className="h-4 w-full max-w-md" />
                    </div>
                    <Skeleton className="h-9 w-32 shrink-0" />
                  </div>
                  {/* Readiness header */}
                  <div className="mb-3 flex items-center justify-between gap-3">
                    <Skeleton className="h-5 w-24" />
                    <div className="flex items-center gap-2">
                      <Skeleton className="h-7 w-20" />
                      <Skeleton className="h-5 w-16" />
                      <Skeleton className="h-5 w-16" />
                    </div>
                  </div>
                  <Skeleton className="mb-3 h-1.5 w-full" />
                  {/* 5 readiness items — batch 2 breakpoint ladder
                      (must match dashboard-command-center.tsx). */}
                  <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-5">
                    {Array.from({ length: 5 }).map((_, i) => (
                      <Skeleton key={i} className="h-16 rounded-[var(--theme-radius-card)]" />
                    ))}
                  </div>
                </div>
                {/* Priority queue + deadline stream section */}
                <div className="p-4 sm:p-5">
                  <Skeleton className="mb-3 h-5 w-28" />
                  <div className="space-y-2">
                    {Array.from({ length: 2 }).map((_, i) => (
                      <Skeleton key={i} className="h-24 rounded-[var(--theme-radius-card)]" />
                    ))}
                  </div>
                  <Skeleton className="mb-3 mt-5 h-5 w-28" />
                  <Skeleton className="h-20 rounded-[var(--theme-radius-card)]" />
                </div>
              </CardContent>
            </Card>
            {/* PipelineStrip / EssayCoach / DecisionPanel — no skeleton
                (conditional null surfaces; see file header note). */}
          </div>

          {/* SIDEBAR column */}
          <aside className="min-w-0 space-y-4">
            {/* Stats snapshot — default-open in the sidebar: header +
                2-col grid of 9 counter tiles. */}
            <Card className="rounded-[var(--theme-radius-card)]">
              <CardContent className="p-4 sm:p-5">
                <div className="flex items-center justify-between gap-2">
                  <div className="space-y-1">
                    <Skeleton className="h-5 w-24" />
                    <Skeleton className="h-3 w-40" />
                  </div>
                  <Skeleton className="h-4 w-4 shrink-0" />
                </div>
                <div className="mt-3 grid grid-cols-2 gap-2">
                  {Array.from({ length: 9 }).map((_, i) => (
                    <Skeleton
                      key={i}
                      className="h-14 rounded-[var(--theme-radius-control,0.5rem)]"
                    />
                  ))}
                </div>
              </CardContent>
            </Card>

            {/* WorkspaceHub — collapsed by default; header-only skeleton. */}
            <Card className="rounded-[var(--theme-radius-card)]">
              <CardContent className="p-4 sm:p-5">
                <div className="flex items-center justify-between gap-2">
                  <div className="space-y-1">
                    <Skeleton className="h-5 w-24" />
                    <Skeleton className="h-3 w-40" />
                  </div>
                  <Skeleton className="h-4 w-4 shrink-0" />
                </div>
              </CardContent>
            </Card>
          </aside>
        </div>
      </div>
    </PageContainer>
  );
}
