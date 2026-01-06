'use client';

import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { 
  FileQuestion, 
  Search, 
  Inbox, 
  FolderOpen, 
  Wifi, 
  AlertCircle,
  Plus,
  RefreshCw,
} from 'lucide-react';

type EmptyStateType = 
  | 'empty' 
  | 'no-results' 
  | 'no-data' 
  | 'error' 
  | 'offline' 
  | 'custom';

interface EmptyStateProps {
  /** 空状态类型 */
  type?: EmptyStateType;
  /** 自定义图标 */
  icon?: React.ReactNode;
  /** 标题 */
  title?: string;
  /** 描述 */
  description?: string;
  /** 主操作 */
  action?: {
    label: string;
    onClick: () => void;
    variant?: 'default' | 'outline' | 'ghost';
  };
  /** 次操作 */
  secondaryAction?: {
    label: string;
    onClick: () => void;
  };
  /** 自定义类名 */
  className?: string;
  /** 尺寸 */
  size?: 'sm' | 'md' | 'lg';
  /** 是否紧凑 */
  compact?: boolean;
}

// 预设配置
const presets: Record<EmptyStateType, { icon: React.ReactNode; title: string; description: string }> = {
  empty: {
    icon: <Inbox className="h-12 w-12 text-muted-foreground/50" />,
    title: '暂无内容',
    description: '这里还没有任何内容',
  },
  'no-results': {
    icon: <Search className="h-12 w-12 text-muted-foreground/50" />,
    title: '未找到结果',
    description: '尝试使用不同的搜索条件',
  },
  'no-data': {
    icon: <FolderOpen className="h-12 w-12 text-muted-foreground/50" />,
    title: '暂无数据',
    description: '数据将在这里显示',
  },
  error: {
    icon: <AlertCircle className="h-12 w-12 text-destructive/50" />,
    title: '加载失败',
    description: '请稍后重试或刷新页面',
  },
  offline: {
    icon: <Wifi className="h-12 w-12 text-muted-foreground/50" />,
    title: '网络连接断开',
    description: '请检查您的网络连接',
  },
  custom: {
    icon: <FileQuestion className="h-12 w-12 text-muted-foreground/50" />,
    title: '',
    description: '',
  },
};

const sizeClasses = {
  sm: 'py-8',
  md: 'py-12',
  lg: 'py-20',
};

const iconSizeClasses = {
  sm: '[&>svg]:h-8 [&>svg]:w-8',
  md: '[&>svg]:h-12 [&>svg]:w-12',
  lg: '[&>svg]:h-16 [&>svg]:w-16',
};

export function EmptyState({
  type = 'empty',
  icon,
  title,
  description,
  action,
  secondaryAction,
  className,
  size = 'md',
  compact = false,
}: EmptyStateProps) {
  const preset = presets[type];

  return (
    <div
      className={cn(
        'flex flex-col items-center justify-center text-center',
        compact ? 'py-6' : sizeClasses[size],
        className
      )}
    >
      {/* 图标 */}
      <div className={cn('mb-4', iconSizeClasses[size])}>
        {icon || preset.icon}
      </div>

      {/* 标题 */}
      {(title || preset.title) && (
        <h3
          className={cn(
            'font-semibold text-foreground',
            size === 'sm' ? 'text-sm' : size === 'lg' ? 'text-xl' : 'text-base'
          )}
        >
          {title || preset.title}
        </h3>
      )}

      {/* 描述 */}
      {(description || preset.description) && (
        <p
          className={cn(
            'mt-1 max-w-md text-muted-foreground',
            size === 'sm' ? 'text-xs' : 'text-sm'
          )}
        >
          {description || preset.description}
        </p>
      )}

      {/* 操作按钮 */}
      {(action || secondaryAction) && (
        <div className="mt-6 flex flex-col gap-2 sm:flex-row">
          {action && (
            <Button
              variant={action.variant || 'default'}
              onClick={action.onClick}
              size={size === 'sm' ? 'sm' : 'default'}
            >
              {type === 'error' ? (
                <RefreshCw className="mr-2 h-4 w-4" />
              ) : (
                <Plus className="mr-2 h-4 w-4" />
              )}
              {action.label}
            </Button>
          )}
          {secondaryAction && (
            <Button
              variant="outline"
              onClick={secondaryAction.onClick}
              size={size === 'sm' ? 'sm' : 'default'}
            >
              {secondaryAction.label}
            </Button>
          )}
        </div>
      )}
    </div>
  );
}

// 便捷组件

export function NoResults({
  query,
  onClear,
  className,
}: {
  query?: string;
  onClear?: () => void;
  className?: string;
}) {
  return (
    <EmptyState
      type="no-results"
      title="未找到结果"
      description={query ? `未找到与 "${query}" 相关的结果` : '尝试使用不同的搜索条件'}
      action={onClear ? { label: '清除筛选', onClick: onClear, variant: 'outline' } : undefined}
      className={className}
    />
  );
}

export function LoadError({
  onRetry,
  error,
  className,
}: {
  onRetry?: () => void;
  error?: string;
  className?: string;
}) {
  return (
    <EmptyState
      type="error"
      title="加载失败"
      description={error || '请稍后重试或刷新页面'}
      action={onRetry ? { label: '重试', onClick: onRetry } : undefined}
      className={className}
    />
  );
}

export function NoData({
  title,
  description,
  action,
  className,
}: {
  title?: string;
  description?: string;
  action?: { label: string; onClick: () => void };
  className?: string;
}) {
  return (
    <EmptyState
      type="no-data"
      title={title}
      description={description}
      action={action}
      className={className}
    />
  );
}
