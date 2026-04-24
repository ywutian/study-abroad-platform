import { Skeleton } from '@/components/ui/skeleton';

export default function AdminPredictionHealthLoading() {
  return (
    <div className="space-y-6">
      {/* PageHeader */}
      <div className="space-y-2">
        <Skeleton className="h-8 w-56" />
        <Skeleton className="h-4 w-96" />
      </div>

      {/* Refresh bar */}
      <div className="flex justify-end">
        <Skeleton className="h-8 w-28" />
      </div>

      {/* Three card sections */}
      {Array.from({ length: 3 }).map((_, i) => (
        <Skeleton key={i} className="h-56 rounded-lg" />
      ))}
    </div>
  );
}
