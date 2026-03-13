import { Skeleton } from '@/components/ui/skeleton';

export default function AdminCalibrationsLoading() {
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="space-y-2">
          <Skeleton className="h-8 w-40" />
        </div>
        <Skeleton className="h-10 w-36 rounded-md" />
      </div>

      <div className="rounded-lg border bg-card">
        <div className="border-b px-4 py-3 flex gap-4 bg-muted/50">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-4 flex-1" />
          ))}
        </div>
        {Array.from({ length: 5 }).map((_, i) => (
          <div key={i} className="border-b px-4 py-3 flex items-center gap-4">
            <Skeleton className="h-4 flex-1" />
            <Skeleton className="h-5 w-20 rounded-full" />
            <Skeleton className="h-4 w-48" />
            <Skeleton className="h-8 w-16 rounded-md" />
          </div>
        ))}
      </div>
    </div>
  );
}
