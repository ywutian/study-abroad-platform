import { Loader2 } from 'lucide-react';

/**
 * 主区域路由切换加载状态
 * Next.js App Router 会在路由切换时自动显示此组件
 * 提供柔和的加载动画，避免页面空白闪烁
 */
export default function MainLoading() {
  return (
    <div className="flex items-center justify-center py-32 animate-fade-in">
      <div className="flex flex-col items-center gap-4">
        <div className="relative">
          {/* 外层光环动画 */}
          <div
            className="absolute inset-[-4px] rounded-full border-2 border-primary/15 animate-ping"
            style={{ animationDuration: '1.5s' }}
          />
          {/* 加载圈 */}
          <div className="relative flex h-11 w-11 items-center justify-center rounded-full bg-primary/8 border border-primary/20 backdrop-blur-sm">
            <Loader2 className="h-5 w-5 animate-spin text-primary" />
          </div>
        </div>
      </div>
    </div>
  );
}
