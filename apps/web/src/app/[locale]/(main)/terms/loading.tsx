import { Skeleton } from '@/components/ui/skeleton';

export default function TermsLoading() {
  return (
    <div className="container mx-auto max-w-4xl px-4 animate-in fade-in duration-300">
      {/* Header */}
      <div className="mb-8 space-y-3">
        <Skeleton className="h-9 w-40" />
        <Skeleton className="h-5 w-64" />
      </div>

      {/* Content sections */}
      <div className="space-y-6">
        {Array.from({ length: 5 }).map((_, i) => (
          <div key={i} className="rounded-xl border bg-card p-6 space-y-3">
            <Skeleton className="h-6 w-1/3" />
            <div className="space-y-1.5">
              <Skeleton className="h-3 w-full" />
              <Skeleton className="h-3 w-full" />
              <Skeleton className="h-3 w-full" />
              <Skeleton className="h-3 w-2/3" />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
