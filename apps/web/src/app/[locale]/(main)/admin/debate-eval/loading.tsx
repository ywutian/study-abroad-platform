import { PageContainer } from '@/components/layout';
import { Card, CardContent } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';

export default function AdminDebateEvalLoading() {
  return (
    <PageContainer>
      <div className="mb-6 space-y-2">
        <Skeleton className="h-8 w-72" />
        <Skeleton className="h-5 w-96" />
      </div>
      <div className="grid grid-cols-12 gap-4 min-w-0">
        <Card className="col-span-12 lg:col-span-4">
          <CardContent className="space-y-3 p-4">
            <Skeleton className="h-6 w-24" />
            <Skeleton className="h-4 w-full" />
            <Skeleton className="h-4 w-full" />
            <Skeleton className="h-4 w-2/3" />
          </CardContent>
        </Card>
        <Card className="col-span-12 lg:col-span-5">
          <CardContent className="space-y-3 p-4">
            <Skeleton className="h-6 w-32" />
            <Skeleton className="h-32 w-full" />
            <Skeleton className="h-12 w-full" />
          </CardContent>
        </Card>
        <Card className="col-span-12 lg:col-span-3">
          <CardContent className="space-y-3 p-4">
            <Skeleton className="h-6 w-28" />
            <Skeleton className="h-9 w-full" />
            <Skeleton className="h-9 w-full" />
            <Skeleton className="h-9 w-full" />
            <Skeleton className="h-9 w-full" />
            <Skeleton className="h-24 w-full" />
            <Skeleton className="h-10 w-full" />
          </CardContent>
        </Card>
      </div>
    </PageContainer>
  );
}
