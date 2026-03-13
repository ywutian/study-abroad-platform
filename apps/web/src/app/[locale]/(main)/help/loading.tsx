import { Skeleton } from '@/components/ui/skeleton';

export default function Loading() {
  return (
    <div className="container mx-auto px-4 py-8 space-y-6">
      {/* Page header */}
      <Skeleton className="h-8 w-48" />
      <Skeleton className="h-4 w-64" />

      {/* Search card */}
      <Skeleton className="h-40 w-full rounded-xl" />

      {/* Resource cards */}
      <div className="grid gap-4 md:grid-cols-3">
        <Skeleton className="h-24 w-full rounded-xl" />
        <Skeleton className="h-24 w-full rounded-xl" />
        <Skeleton className="h-24 w-full rounded-xl" />
      </div>

      {/* FAQ section */}
      <Skeleton className="h-64 w-full rounded-xl" />
    </div>
  );
}
