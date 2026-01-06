'use client';

import { cn } from '@/lib/utils';
import { Loader2 } from 'lucide-react';

interface LoadingStateProps {
  /** 加载状态 */
  loading?: boolean;
  /** 子内容 */
  children?: React.ReactNode;
  /** 自定义加载组件 */
  loader?: React.ReactNode;
  /** 尺寸 */
  size?: 'sm' | 'md' | 'lg';
  /** 是否全屏 */
  fullScreen?: boolean;
  /** 加载文案 */
  text?: string;
  /** 是否显示背景 */
  overlay?: boolean;
  /** 自定义类名 */
  className?: string;
  /** 骨架屏变体 */
  variant?: 'card' | 'list' | 'table' | 'profile';
  /** 骨架屏数量 */
  count?: number;
}

const sizeClasses = {
  sm: 'h-4 w-4',
  md: 'h-6 w-6',
  lg: 'h-10 w-10',
};

const textSizeClasses = {
  sm: 'text-xs',
  md: 'text-sm',
  lg: 'text-base',
};

export function LoadingState({
  loading = true,
  children,
  loader,
  size = 'md',
  fullScreen = false,
  text,
  overlay = false,
  className,
  variant,
  count = 3,
}: LoadingStateProps) {
  if (!loading) return <>{children}</>;

  // 如果指定了 variant，使用骨架屏
  if (variant) {
    switch (variant) {
      case 'card':
        return (
          <div className={cn('grid gap-4 sm:grid-cols-2', className)}>
            {Array.from({ length: count }).map((_, i) => (
              <CardSkeleton key={i} />
            ))}
          </div>
        );
      case 'list':
        return <ListSkeleton count={count} className={className} />;
      case 'table':
        return <TableSkeleton className={className} />;
      case 'profile':
        return <ProfileSkeleton className={className} />;
    }
  }

  const content = loader || (
    <div className="flex flex-col items-center justify-center gap-3">
      <Loader2 className={cn('animate-spin text-primary', sizeClasses[size])} />
      {text && (
        <p className={cn('text-muted-foreground', textSizeClasses[size])}>
          {text}
        </p>
      )}
    </div>
  );

  if (fullScreen) {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/80 backdrop-blur-sm">
        {content}
      </div>
    );
  }

  if (overlay) {
    return (
      <div className={cn('relative', className)}>
        {children}
        <div className="absolute inset-0 z-10 flex items-center justify-center bg-background/60 backdrop-blur-[2px]">
          {content}
        </div>
      </div>
    );
  }

  return (
    <div className={cn('flex items-center justify-center py-12', className)}>
      {content}
    </div>
  );
}

// 骨架屏组件
interface SkeletonProps {
  className?: string;
  variant?: 'text' | 'circular' | 'rectangular';
  width?: string | number;
  height?: string | number;
  animation?: 'pulse' | 'wave' | 'none';
}

export function Skeleton({
  className,
  variant = 'text',
  width,
  height,
  animation = 'pulse',
}: SkeletonProps) {
  const variantClasses = {
    text: 'rounded',
    circular: 'rounded-full',
    rectangular: 'rounded-lg',
  };

  const animationClasses = {
    pulse: 'animate-pulse',
    wave: 'skeleton',
    none: '',
  };

  return (
    <div
      className={cn(
        'bg-muted',
        variantClasses[variant],
        animationClasses[animation],
        className
      )}
      style={{
        width: typeof width === 'number' ? `${width}px` : width,
        height: typeof height === 'number' ? `${height}px` : height,
      }}
    />
  );
}

// 列表骨架屏
export function ListSkeleton({
  count = 3,
  className,
}: {
  count?: number;
  className?: string;
}) {
  return (
    <div className={cn('space-y-4', className)}>
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} className="flex items-center gap-4">
          <Skeleton variant="circular" width={40} height={40} />
          <div className="flex-1 space-y-2">
            <Skeleton width="60%" height={16} />
            <Skeleton width="40%" height={12} />
          </div>
        </div>
      ))}
    </div>
  );
}

// 卡片骨架屏
export function CardSkeleton({ className }: { className?: string }) {
  return (
    <div className={cn('rounded-xl border bg-card p-6 space-y-4', className)}>
      <div className="flex items-center gap-4">
        <Skeleton variant="circular" width={48} height={48} />
        <div className="flex-1 space-y-2">
          <Skeleton width="50%" height={20} />
          <Skeleton width="30%" height={14} />
        </div>
      </div>
      <div className="space-y-2">
        <Skeleton width="100%" height={14} />
        <Skeleton width="90%" height={14} />
        <Skeleton width="70%" height={14} />
      </div>
      <div className="flex gap-2">
        <Skeleton width={80} height={32} variant="rectangular" />
        <Skeleton width={80} height={32} variant="rectangular" />
      </div>
    </div>
  );
}

// 表格骨架屏
export function TableSkeleton({
  rows = 5,
  columns = 4,
  className,
}: {
  rows?: number;
  columns?: number;
  className?: string;
}) {
  return (
    <div className={cn('w-full', className)}>
      {/* Header */}
      <div className="flex gap-4 border-b pb-3 mb-3">
        {Array.from({ length: columns }).map((_, i) => (
          <Skeleton key={i} width={`${100 / columns}%`} height={16} />
        ))}
      </div>
      {/* Rows */}
      {Array.from({ length: rows }).map((_, rowIndex) => (
        <div key={rowIndex} className="flex gap-4 py-3 border-b border-muted">
          {Array.from({ length: columns }).map((_, colIndex) => (
            <Skeleton
              key={colIndex}
              width={`${100 / columns}%`}
              height={14}
            />
          ))}
        </div>
      ))}
    </div>
  );
}

// 个人资料骨架屏
export function ProfileSkeleton({ className }: { className?: string }) {
  return (
    <div className={cn('space-y-6', className)}>
      {/* Header */}
      <div className="flex items-center gap-4">
        <Skeleton variant="circular" width={80} height={80} />
        <div className="flex-1 space-y-2">
          <Skeleton width="40%" height={24} />
          <Skeleton width="60%" height={16} />
        </div>
      </div>
      {/* Stats */}
      <div className="grid grid-cols-3 gap-4">
        {[1, 2, 3].map((i) => (
          <div key={i} className="rounded-lg border p-4 space-y-2">
            <Skeleton width="30%" height={14} />
            <Skeleton width="50%" height={24} />
          </div>
        ))}
      </div>
      {/* Content */}
      <div className="space-y-4">
        <Skeleton width="100%" height={100} variant="rectangular" />
        <Skeleton width="100%" height={100} variant="rectangular" />
      </div>
    </div>
  );
}
