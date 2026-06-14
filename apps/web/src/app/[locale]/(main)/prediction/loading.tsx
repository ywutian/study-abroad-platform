import { PageContainer } from '@/components/layout';
import { Skeleton } from '@/components/ui/skeleton';

export default function PredictionLoading() {
  return (
    <PageContainer variant="workbench">
      {/* Header + snapshot + tabs */}
      <div className="shrink-0 space-y-3">
        <div className="space-y-2">
          <Skeleton className="h-8 w-48" />
          <Skeleton className="h-5 w-72" />
        </div>
        <Skeleton className="h-12 w-full rounded-[var(--theme-radius-card)]" />
        <Skeleton className="h-9 w-64 rounded-md" />
      </div>

      {/* Three-column workbench — mirrors the real layout so nothing reflows on resolve */}
      <div className="mt-4 grid min-w-0 gap-4 lg:min-h-0 lg:flex-1 lg:overflow-hidden lg:grid-cols-[minmax(280px,340px)_minmax(0,1fr)_minmax(360px,460px)]">
        {/* COL 1 — school selector */}
        <div className="min-w-0">
          <div className="space-y-4 rounded-[var(--theme-radius-card)] border bg-card p-4">
            <Skeleton className="h-5 w-32" />
            <Skeleton className="h-10 w-full rounded-md" />
            <div className="space-y-2">
              {Array.from({ length: 5 }).map((_, i) => (
                <Skeleton key={i} className="h-12 w-full rounded-[var(--theme-radius-button)]" />
              ))}
            </div>
            <Skeleton className="h-10 w-full rounded-md" />
          </div>
        </div>

        {/* COL 2 — scan list */}
        <div className="min-w-0 space-y-4">
          <div className="space-y-2 rounded-[var(--theme-radius-card)] border bg-card p-4">
            <Skeleton className="h-4 w-40" />
            <Skeleton className="h-16 w-full rounded-md" />
          </div>
          <div className="space-y-2">
            <Skeleton className="h-6 w-24" />
            {Array.from({ length: 6 }).map((_, i) => (
              <Skeleton key={i} className="h-[68px] w-full rounded-[var(--theme-radius-button)]" />
            ))}
          </div>
        </div>

        {/* COL 3 — detail pane (desktop only) */}
        <div className="hidden min-w-0 lg:block">
          <div className="space-y-4 rounded-[var(--theme-radius-card)] border bg-card p-4">
            <div className="flex items-center justify-between">
              <Skeleton className="h-6 w-40" />
              <Skeleton className="h-8 w-20" />
            </div>
            <Skeleton className="h-24 w-full rounded-md" />
            <Skeleton className="h-32 w-full rounded-md" />
            <Skeleton className="h-32 w-full rounded-md" />
          </div>
        </div>
      </div>
    </PageContainer>
  );
}
