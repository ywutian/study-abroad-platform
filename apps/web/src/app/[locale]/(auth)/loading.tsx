import { Loader2 } from 'lucide-react';

/**
 * 认证页面路由切换加载状态
 */
export default function AuthLoading() {
  return (
    <div className="flex items-center justify-center py-20 animate-fade-in">
      <div className="relative flex h-10 w-10 items-center justify-center rounded-full bg-primary/8 border border-primary/20">
        <Loader2 className="h-5 w-5 animate-spin text-primary" />
      </div>
    </div>
  );
}
