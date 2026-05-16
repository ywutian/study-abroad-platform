import { PageContainer } from '@/components/layout';
import { Card, CardContent } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';

/**
 * Dashboard loading skeleton — must match the real page layout to
 * minimize Cumulative Layout Shift (CLS).
 *
 * Real layout (current — post PRs #186-200):
 *   PageHeader
 *   → QuickAsk
 *   → CommandCenter (2-col xl: readiness left / priority queue right)
 *   → [DashboardEssayCoach]    (conditional, no skeleton — see note)
 *   → [DashboardDecisionPanel] (conditional, no skeleton — see note)
 *   → DashboardStats (Phase 2.5b — 9-tile snapshot)
 *   → WorkspaceHub (3-col Research / Community / Tools — Phase 2.5b)
 *   → DashboardActivity
 *
 * Conditional surfaces (EssayCoach, DecisionPanel) intentionally have
 * NO skeleton entry: they render null when the user has no data, so
 * reserving space for them would CAUSE the layout shift this file
 * exists to prevent.
 *
 * History:
 * - 2026-05 Phase 1.5 #16: rewritten from legacy "4 stat cards" stub
 * - 2026-05 Phase 1.5 #16 v2 (this update): synced with Phase 2.5a
 *   (readiness 2-col → 5-col), Phase 2.5b (Hub 4-col → 3-col + new
 *   Stats card insertion), to eliminate post-load reflow.
 */
export default function DashboardLoading() {
  return (
    <PageContainer variant="tool" maxWidth="fluid" className="max-w-[1500px]">
      {/* PageHeader skeleton (title + description + actions) */}
      <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="space-y-2">
          <Skeleton className="h-8 w-64" />
          <Skeleton className="h-5 w-80" />
        </div>
        <Skeleton className="h-9 w-32 shrink-0" />
      </div>

      <div className="space-y-6">
        {/* QuickAsk skeleton (input + suggestion chips strip) */}
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

        {/* CommandCenter skeleton (2-col on xl, single col below) */}
        <Card className="overflow-hidden rounded-[var(--theme-radius-card)]">
          <CardContent className="p-0">
            <div className="grid gap-0 xl:grid-cols-[minmax(0,1fr)_390px]">
              {/* Left column: hero + readiness items + pipeline */}
              <div className="min-w-0 border-b border-border p-4 sm:p-5 xl:border-b-0 xl:border-r">
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
                {/* 5 readiness items — Phase 2.5a 5-col equal-width grid */}
                <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-5">
                  {Array.from({ length: 5 }).map((_, i) => (
                    <Skeleton key={i} className="h-16 rounded-[var(--theme-radius-card)]" />
                  ))}
                </div>
              </div>
              {/* Right column: priority queue + deadline stream */}
              <div className="min-w-0 p-4 sm:p-5">
                <Skeleton className="mb-3 h-5 w-28" />
                <div className="space-y-2">
                  {Array.from({ length: 2 }).map((_, i) => (
                    <Skeleton key={i} className="h-24 rounded-[var(--theme-radius-card)]" />
                  ))}
                </div>
                <Skeleton className="mb-3 mt-5 h-5 w-28" />
                <Skeleton className="h-20 rounded-[var(--theme-radius-card)]" />
              </div>
            </div>
          </CardContent>
        </Card>

        {/*
          Stats snapshot — Phase 2.5b extracted this from the Hub. 9
          compact tiles in a 2/3/5-col responsive grid.
        */}
        <Card className="rounded-[var(--theme-radius-card)]">
          <CardContent className="p-4 sm:p-5">
            <div className="mb-3 space-y-1">
              <Skeleton className="h-5 w-24" />
              <Skeleton className="h-3 w-40" />
            </div>
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-5">
              {Array.from({ length: 9 }).map((_, i) => (
                <Skeleton key={i} className="h-14 rounded-[var(--theme-radius-control,0.5rem)]" />
              ))}
            </div>
          </CardContent>
        </Card>

        {/*
          WorkspaceHub — Phase 2.5b reduced this to 3 nav columns
          (Research / Community / Tools). Stats was extracted above.
        */}
        <Card className="rounded-[var(--theme-radius-card)]">
          <CardContent className="p-4 sm:p-5">
            <div className="mb-3 space-y-1">
              <Skeleton className="h-5 w-24" />
              <Skeleton className="h-3 w-40" />
            </div>
            <div className="grid gap-4 lg:grid-cols-3">
              {Array.from({ length: 3 }).map((_, col) => (
                <div key={col}>
                  <Skeleton className="mb-2 h-3 w-20" />
                  <div className="space-y-1.5">
                    {Array.from({ length: 4 }).map((_, row) => (
                      <Skeleton
                        key={row}
                        className="h-10 rounded-[var(--theme-radius-control,0.5rem)]"
                      />
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Activity stream skeleton */}
        <Card className="rounded-[var(--theme-radius-card)] py-0">
          <CardContent className="px-4 py-4">
            <Skeleton className="mb-3 h-5 w-32" />
            <div className="space-y-3">
              {Array.from({ length: 3 }).map((_, i) => (
                <div key={i} className="flex items-start gap-3 border-b py-2 last:border-0">
                  <Skeleton className="h-8 w-8 shrink-0 rounded-[var(--theme-radius-card)]" />
                  <div className="flex-1 space-y-1">
                    <Skeleton className="h-4 w-3/5" />
                    <Skeleton className="h-3 w-2/5" />
                  </div>
                  <Skeleton className="h-4 w-16 shrink-0" />
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>
    </PageContainer>
  );
}
