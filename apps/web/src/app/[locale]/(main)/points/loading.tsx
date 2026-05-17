import { PageContainer } from '@/components/layout';
import { Skeleton } from '@/components/ui/skeleton';
import { Card, CardContent } from '@/components/ui/card';

export default function PointsCenterLoading() {
  return (
    <PageContainer>
      <Skeleton className="mb-6 h-16 w-64" />
      <Skeleton className="mb-6 h-24 w-full rounded-xl" />
      <Skeleton className="mb-3 h-6 w-40" />
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {Array.from({ length: 6 }).map((_, i) => (
          <Card key={i}>
            <CardContent className="space-y-3 p-4">
              <Skeleton className="h-5 w-32" />
              <Skeleton className="h-10 w-full" />
              <Skeleton className="h-8 w-full" />
            </CardContent>
          </Card>
        ))}
      </div>
    </PageContainer>
  );
}
