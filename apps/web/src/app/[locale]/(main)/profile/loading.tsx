import { Skeleton } from '@/components/ui/skeleton';
import { PageContainer } from '@/components/layout';

/**
 * Profile route skeleton — mirrors the actual layout (header + compact action bar + editor)
 * to avoid layout shift on hydration.
 */
export default function ProfileLoading() {
  return (
    <PageContainer maxWidth="5xl">
      {/* PageHeader: title + actions */}
      <div className="mb-6 flex items-center justify-between gap-4">
        <div className="space-y-2">
          <Skeleton className="h-8 w-40" />
          <Skeleton className="h-5 w-64" />
        </div>
        <div className="hidden gap-2 sm:flex">
          <Skeleton className="h-9 w-32 rounded-md" />
          <Skeleton className="h-9 w-32 rounded-md" />
        </div>
      </div>

      {/* Compact action bar */}
      <div className="mb-5 rounded-xl border bg-card p-4">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex items-center gap-3">
            <Skeleton className="h-10 w-10 rounded-xl" />
            <div className="min-w-0 flex-1 space-y-2">
              <div className="flex items-center gap-2">
                <Skeleton className="h-5 w-32 rounded-full" />
                <Skeleton className="h-6 w-12" />
              </div>
              <Skeleton className="h-4 w-64 max-w-full" />
              <Skeleton className="h-1.5 w-72 max-w-full rounded-full" />
            </div>
          </div>
          <div className="flex gap-2">
            <Skeleton className="h-9 w-28 rounded-md" />
            <Skeleton className="h-9 w-28 rounded-md" />
          </div>
        </div>
      </div>

      {/* 2-column body: tab nav + tab content */}
      <div className="flex flex-col gap-6 lg:flex-row">
        {/* Left: vertical tab nav (desktop) or select (mobile) */}
        <div className="lg:w-64 shrink-0">
          <div className="space-y-1">
            {Array.from({ length: 9 }).map((_, i) => (
              <Skeleton key={i} className="h-12 w-full rounded-xl" />
            ))}
          </div>
        </div>

        {/* Right: tab content card */}
        <div className="flex-1 min-w-0">
          <div className="rounded-xl border bg-card p-6 space-y-6">
            <div className="space-y-1.5">
              <Skeleton className="h-5 w-32" />
              <Skeleton className="h-4 w-56" />
            </div>
            <div className="grid gap-6 sm:grid-cols-2">
              {Array.from({ length: 4 }).map((_, i) => (
                <div key={i} className="space-y-2">
                  <Skeleton className="h-4 w-20" />
                  <Skeleton className="h-11 w-full rounded-md" />
                </div>
              ))}
            </div>
            <div className="space-y-2">
              <Skeleton className="h-4 w-24" />
              <Skeleton className="h-11 w-full rounded-md" />
            </div>
          </div>
        </div>
      </div>
    </PageContainer>
  );
}
