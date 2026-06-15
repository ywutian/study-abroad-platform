import { PageContainer } from '@/components/layout';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';

export default function UncommonAppLoading() {
  return (
    <PageContainer maxWidth="7xl">
      {/* Header */}
      <div className="mb-6 space-y-2">
        <Skeleton className="h-8 w-52" />
        <Skeleton className="h-5 w-72" />
      </div>

      <div className="space-y-5">
        {/* Next-action bar */}
        <Skeleton className="h-24 rounded-[var(--theme-radius-card)]" />

        {/* Readiness strip (4-up) */}
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {[0, 1, 2, 3].map((item) => (
            <Skeleton key={item} className="h-20 rounded-[var(--theme-radius-card)]" />
          ))}
        </div>

        {/* Two-column workbench: school board + advisor | health rail */}
        <div className="grid min-w-0 gap-6 xl:grid-cols-[minmax(0,1fr)_380px]">
          <div className="space-y-6">
            <Card>
              <CardHeader>
                <Skeleton className="h-6 w-40" />
                <Skeleton className="h-4 w-64" />
              </CardHeader>
              <CardContent className="space-y-3">
                {[0, 1, 2].map((item) => (
                  <Skeleton key={item} className="h-28 rounded-[var(--theme-radius-card)]" />
                ))}
              </CardContent>
            </Card>
            <Card>
              <CardHeader>
                <Skeleton className="h-6 w-40" />
                <Skeleton className="h-4 w-56" />
              </CardHeader>
              <CardContent>
                <Skeleton className="h-32 w-full rounded-[var(--theme-radius-card)]" />
              </CardContent>
            </Card>
          </div>

          <Card className="h-fit">
            <CardHeader>
              <Skeleton className="h-6 w-32" />
              <Skeleton className="h-4 w-48" />
            </CardHeader>
            <CardContent className="space-y-3">
              {[0, 1, 2, 3].map((item) => (
                <Skeleton key={item} className="h-24 rounded-[var(--theme-radius-card)]" />
              ))}
            </CardContent>
          </Card>
        </div>
      </div>
    </PageContainer>
  );
}
