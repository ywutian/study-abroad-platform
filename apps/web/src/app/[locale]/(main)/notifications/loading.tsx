import { PageContainer } from '@/components/layout';
import { Card, CardContent } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';

export default function NotificationsLoading() {
  return (
    <PageContainer>
      {/* Header */}
      <div className="mb-6 space-y-2">
        <Skeleton className="h-8 w-40" />
        <Skeleton className="h-5 w-64" />
      </div>

      {/* Tab buttons */}
      <div className="flex items-center gap-2 mb-6">
        <Skeleton className="h-9 w-16 rounded-md" />
        <Skeleton className="h-9 w-20 rounded-md" />
      </div>

      {/* Section label */}
      <Skeleton className="h-4 w-16 mb-3" />

      {/* Notification cards */}
      <div className="space-y-3">
        {Array.from({ length: 6 }).map((_, i) => (
          <Card key={i}>
            <CardContent className="flex items-start gap-4 p-4">
              <Skeleton className="h-10 w-10 rounded-full" />
              <div className="flex-1 space-y-2">
                <Skeleton className="h-4 w-32" />
                <Skeleton className="h-3 w-full" />
                <Skeleton className="h-3 w-20" />
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </PageContainer>
  );
}
