import { PageContainer } from '@/components/layout';
import { Card, CardContent } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';

export default function AdminFeatureFlagsLoading() {
  return (
    <PageContainer>
      <div className="mb-6 space-y-2">
        <Skeleton className="h-8 w-40" />
        <Skeleton className="h-5 w-72" />
      </div>

      <Card>
        <CardContent className="p-0">
          <div className="space-y-0">
            {/* Table header */}
            <div className="flex items-center gap-4 border-b px-4 py-3">
              <Skeleton className="h-4 w-24" />
              <Skeleton className="h-4 w-40" />
              <Skeleton className="h-4 w-16" />
              <Skeleton className="h-4 w-20" />
              <Skeleton className="ml-auto h-4 w-16" />
            </div>
            {/* Table rows */}
            {Array.from({ length: 5 }).map((_, i) => (
              <div key={i} className="flex items-center gap-4 border-b px-4 py-3 last:border-0">
                <Skeleton className="h-4 w-28" />
                <Skeleton className="h-4 w-36" />
                <Skeleton className="h-6 w-11 rounded-full" />
                <Skeleton className="h-5 w-24 rounded-full" />
                <div className="ml-auto flex gap-1">
                  <Skeleton className="h-8 w-8 rounded-md" />
                  <Skeleton className="h-8 w-8 rounded-md" />
                  <Skeleton className="h-8 w-8 rounded-md" />
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </PageContainer>
  );
}
