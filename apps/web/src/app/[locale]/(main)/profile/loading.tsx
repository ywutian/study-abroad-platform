import { Skeleton } from '@/components/ui/skeleton';

/**
 * Profile 路由骨架屏
 * 模拟真实页面布局：进度条 + Tab 导航 + 表单区域
 */
export default function ProfileLoading() {
  return (
    <div className="container mx-auto max-w-5xl px-4 animate-in fade-in duration-300">
      {/* 页面标题 + 操作按钮 */}
      <div className="mb-6 flex items-center justify-between">
        <div className="space-y-2">
          <Skeleton className="h-8 w-40" />
          <Skeleton className="h-5 w-64" />
        </div>
        <div className="flex gap-2">
          <Skeleton className="h-9 w-24 rounded-md" />
          <Skeleton className="h-9 w-24 rounded-md" />
        </div>
      </div>

      {/* 进度条 */}
      <div className="mb-6 rounded-xl border bg-card p-4 space-y-2">
        <div className="flex items-center justify-between">
          <Skeleton className="h-4 w-28" />
          <Skeleton className="h-4 w-12" />
        </div>
        <Skeleton className="h-2 w-full rounded-full" />
      </div>

      {/* Tab 导航 */}
      <div className="mb-6 flex gap-1 overflow-x-auto pb-1">
        {Array.from({ length: 7 }).map((_, i) => (
          <Skeleton key={i} className="h-9 w-20 rounded-md shrink-0" />
        ))}
      </div>

      {/* 表单内容区域 */}
      <div className="rounded-xl border bg-card p-6 space-y-6">
        {/* 表单标题 */}
        <div className="space-y-1">
          <Skeleton className="h-5 w-32" />
          <Skeleton className="h-4 w-56" />
        </div>

        {/* 表单字段 */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="space-y-2">
              <Skeleton className="h-4 w-20" />
              <Skeleton className="h-10 w-full rounded-md" />
            </div>
          ))}
        </div>

        {/* 更多表单字段 */}
        <div className="space-y-2">
          <Skeleton className="h-4 w-24" />
          <Skeleton className="h-24 w-full rounded-md" />
        </div>

        {/* 保存按钮 */}
        <div className="flex justify-end">
          <Skeleton className="h-10 w-28 rounded-md" />
        </div>
      </div>
    </div>
  );
}
