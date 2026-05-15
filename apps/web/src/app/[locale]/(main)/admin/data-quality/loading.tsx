import { Skeleton } from '@/components/ui/skeleton';

export default function AdminDataQualityLoading() {
  return (
    <div className="space-y-6">
      <div className="space-y-2">
        <Skeleton className="h-8 w-56" />
        <Skeleton className="h-4 w-80 max-w-full" />
      </div>
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {Array.from({ length: 4 }).map((_, index) => (
          <Skeleton key={index} className="h-28 rounded-[var(--theme-radius-card)]" />
        ))}
      </div>
      <Skeleton className="h-10 w-72 max-w-full" />
      <div className="space-y-2">
        {Array.from({ length: 6 }).map((_, index) => (
          <Skeleton key={index} className="h-12 rounded-[var(--theme-radius-card)]" />
        ))}
      </div>
    </div>
  );
}
