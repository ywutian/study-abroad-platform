import { PageContainer } from '@/components/layout';
import { Skeleton } from '@/components/ui/skeleton';

export default function Loading() {
  return (
    <PageContainer>
      <div className="mb-6 space-y-3">
        <Skeleton className="h-8 w-64" />
        <Skeleton className="h-4 w-96" />
      </div>
      <div className="space-y-3">
        {[0, 1, 2].map((i) => (
          <Skeleton key={i} className="h-40 w-full" />
        ))}
      </div>
    </PageContainer>
  );
}
