import { PageContainer } from '@/components/layout';
import { Skeleton } from '@/components/ui/skeleton';

export default function TeamJoinLoading() {
  return (
    <PageContainer maxWidth="md">
      <div className="flex flex-col items-center justify-center py-12">
        <Skeleton className="h-12 w-12 rounded-full mb-4" />
        <Skeleton className="h-6 w-48" />
      </div>
    </PageContainer>
  );
}
