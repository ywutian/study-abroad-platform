import { Skeleton } from '@/components/ui/skeleton';
import { PageContainer } from '@/components/layout/page-container';

export default function Loading() {
  return (
    <PageContainer>
      <div className="space-y-6">
        <Skeleton className="h-12 w-64" />
        <Skeleton className="h-4 w-96" />
        <div className="rounded-xl border border-border p-6 space-y-4">
          <Skeleton className="h-6 w-40" />
          <div className="grid grid-cols-2 gap-4">
            <Skeleton className="h-12 w-full" />
            <Skeleton className="h-12 w-full" />
            <Skeleton className="h-12 w-full" />
            <Skeleton className="h-12 w-full" />
          </div>
          <Skeleton className="h-20 w-full" />
          <div className="flex gap-2">
            <Skeleton className="h-10 w-32" />
            <Skeleton className="h-10 w-32" />
          </div>
        </div>
      </div>
    </PageContainer>
  );
}
