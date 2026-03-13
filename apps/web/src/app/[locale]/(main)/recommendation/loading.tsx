import { PageContainer } from '@/components/layout';
import { Skeleton } from '@/components/ui/skeleton';

export default function RecommendationLoading() {
  return (
    <PageContainer>
      {/* Redirecting placeholder - this page redirects to /schools?tab=recommend */}
      <div className="flex items-center justify-center py-20">
        <Skeleton className="h-5 w-48" />
      </div>
    </PageContainer>
  );
}
