import { Suspense } from 'react';
import { PageContainer } from '@/components/layout';
import { Skeleton } from '@/components/ui/skeleton';
import { TeamJoinPageClient } from './_components/TeamJoinPageClient';

function TeamJoinPageSkeleton() {
  return (
    <PageContainer maxWidth="md">
      <div className="flex flex-col items-center justify-center py-12">
        <Skeleton className="h-12 w-12 rounded-full mb-4" />
        <Skeleton className="h-6 w-48" />
      </div>
    </PageContainer>
  );
}

export default function TeamJoinPage() {
  return (
    <Suspense fallback={<TeamJoinPageSkeleton />}>
      <TeamJoinPageClient />
    </Suspense>
  );
}
