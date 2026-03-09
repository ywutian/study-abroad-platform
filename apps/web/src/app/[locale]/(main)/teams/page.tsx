import { Suspense } from 'react';
import { PageContainer } from '@/components/layout';
import { Skeleton } from '@/components/ui/skeleton';
import { TeamsPageClient } from './_components/TeamsPageClient';

function TeamsPageSkeleton() {
  return (
    <PageContainer maxWidth="7xl">
      <div className="space-y-6">
        <Skeleton className="h-12 w-64" />
        <Skeleton className="h-10 w-48" />
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {[1, 2, 3, 4, 5, 6].map((i) => (
            <Skeleton key={i} className="h-32 rounded-lg" />
          ))}
        </div>
      </div>
    </PageContainer>
  );
}

export default function TeamsPage() {
  return (
    <Suspense fallback={<TeamsPageSkeleton />}>
      <TeamsPageClient />
    </Suspense>
  );
}
