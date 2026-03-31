import { PageContainer } from '@/components/layout';
import { Skeleton } from '@/components/ui/skeleton';

export default function SchoolCompareLoading() {
  return (
    <PageContainer maxWidth="default">
      {/* Back button skeleton */}
      <Skeleton className="h-8 w-16 mb-4" />

      {/* Page header skeleton */}
      <div className="mb-8 border-b-2 border-border pb-6">
        <div className="flex items-center gap-3">
          <Skeleton className="h-12 w-12 rounded-lg" />
          <div className="space-y-2">
            <Skeleton className="h-7 w-48" />
            <Skeleton className="h-4 w-64" />
          </div>
        </div>
      </div>

      {/* School selector bar skeleton */}
      <div className="mb-8 flex gap-3">
        <Skeleton className="h-10 w-40 rounded-lg" />
        <Skeleton className="h-10 w-40 rounded-lg" />
        <Skeleton className="h-10 w-32 rounded-lg" />
      </div>

      {/* Comparison table skeleton */}
      <div className="rounded-xl border bg-card overflow-hidden">
        {/* Header */}
        <div className="flex border-b border-border p-4 gap-4">
          <Skeleton className="h-5 w-[180px] shrink-0" />
          <Skeleton className="h-5 flex-1" />
          <Skeleton className="h-5 flex-1" />
          <Skeleton className="h-5 flex-1" />
        </div>
        {/* Rows */}
        {Array.from({ length: 12 }).map((_, i) => (
          <div key={i} className="flex border-b border-border p-4 gap-4">
            <Skeleton className="h-4 w-[180px] shrink-0" />
            <Skeleton className="h-4 flex-1" />
            <Skeleton className="h-4 flex-1" />
            <Skeleton className="h-4 flex-1" />
          </div>
        ))}
      </div>
    </PageContainer>
  );
}
