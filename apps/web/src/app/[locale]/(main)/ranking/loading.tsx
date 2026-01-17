import { Skeleton } from '@/components/ui/skeleton';

/**
 * Ranking 路由骨架屏
 * 模拟真实页面布局：权重配置区 + 排名表格
 */
export default function RankingLoading() {
  return (
    <div className="container mx-auto max-w-7xl px-4 animate-in fade-in duration-300">
      {/* 页面标题 */}
      <div className="mb-8 space-y-2">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-5 w-80" />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
        {/* 左侧权重配置 */}
        <div className="rounded-xl border bg-card p-6 space-y-5">
          <Skeleton className="h-5 w-24" />
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="space-y-2">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Skeleton className="h-8 w-8 rounded-lg" />
                  <Skeleton className="h-4 w-20" />
                </div>
                <Skeleton className="h-4 w-8" />
              </div>
              <Skeleton className="h-2 w-full rounded-full" />
            </div>
          ))}
          <Skeleton className="h-10 w-full rounded-md" />
        </div>

        {/* 右侧排名表格 */}
        <div className="lg:col-span-3 rounded-xl border bg-card">
          {/* 表头 */}
          <div className="border-b p-4">
            <div className="flex items-center gap-4">
              <Skeleton className="h-4 w-8" />
              <Skeleton className="h-4 w-40 flex-1" />
              <Skeleton className="h-4 w-16" />
              <Skeleton className="h-4 w-16" />
              <Skeleton className="h-4 w-16" />
              <Skeleton className="h-4 w-16" />
            </div>
          </div>
          {/* 表格行 */}
          {Array.from({ length: 10 }).map((_, i) => (
            <div key={i} className="border-b last:border-b-0 p-4">
              <div className="flex items-center gap-4">
                <Skeleton className="h-6 w-6 rounded-full" />
                <div className="flex-1 space-y-1">
                  <Skeleton className="h-4 w-48" />
                  <Skeleton className="h-3 w-32" />
                </div>
                <Skeleton className="h-4 w-12" />
                <Skeleton className="h-4 w-12" />
                <Skeleton className="h-4 w-12" />
                <Skeleton className="h-4 w-16" />
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
