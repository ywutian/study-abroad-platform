import { PageContainer } from '@/components/layout';
import { Skeleton } from '@/components/ui/skeleton';

/**
 * Hall route skeleton. Mirrors the current page shell: 4 tab pills + the
 * `verified` default content (a stats grid + a dashboard card grid). Kept
 * generic enough to also stand in for the C4 data-aware `path` fallback.
 * `PageContainer` variant matches `page.tsx` (`community`).
 */
export default function HallLoading() {
  return (
    <PageContainer variant="community">
      {/* Header */}
      <div className="mb-6 space-y-2">
        <Skeleton className="h-8 w-40" />
        <Skeleton className="h-5 w-64" />
      </div>

      {/* Tab navigation — 4 tabs */}
      <div className="flex gap-1.5 sm:gap-2 mb-4 sm:mb-8">
        {Array.from({ length: 4 }).map((_, i) => (
          <Skeleton key={i} className="h-12 w-28 rounded-xl" />
        ))}
      </div>

      {/* Stats grid */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 mb-6">
        {Array.from({ length: 4 }).map((_, i) => (
          <Skeleton key={i} className="h-24 rounded-xl" />
        ))}
      </div>

      {/* Dashboard card grid */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        {Array.from({ length: 4 }).map((_, i) => (
          <Skeleton key={i} className="h-56 rounded-xl" />
        ))}
      </div>
    </PageContainer>
  );
}
