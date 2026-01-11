'use client';

import { useTranslations } from 'next-intl';
import { cn } from '@/lib/utils';
import { Badge } from '@/components/ui/badge';
import { 
  CheckCircle, 
  Clock, 
  XCircle, 
  AlertCircle, 
  Loader2,
  PauseCircle,
  PlayCircle,
  Star,
} from 'lucide-react';

// 状态类型
type StatusType = 
  | 'pending'
  | 'in_progress'
  | 'completed'
  | 'failed'
  | 'cancelled'
  | 'paused'
  | 'active'
  | 'inactive'
  | 'draft'
  | 'published'
  | 'archived'
  | 'featured';

interface StatusConfig {
  icon: React.ElementType;
  className: string;
  dotClassName: string;
  labelKey: string;
}

// 状态配置
const statusConfig: Record<StatusType, StatusConfig> = {
  pending: {
    labelKey: 'pending',
    icon: Clock,
    className: 'bg-yellow-500/10 text-yellow-600 dark:text-yellow-400 border-yellow-500/20',
    dotClassName: 'bg-yellow-500',
  },
  in_progress: {
    labelKey: 'inProgress',
    icon: Loader2,
    className: 'bg-blue-500/10 text-blue-600 dark:text-blue-400 border-blue-500/20',
    dotClassName: 'bg-blue-500',
  },
  completed: {
    labelKey: 'completed',
    icon: CheckCircle,
    className: 'bg-green-500/10 text-green-600 dark:text-green-400 border-green-500/20',
    dotClassName: 'bg-green-500',
  },
  failed: {
    labelKey: 'failed',
    icon: XCircle,
    className: 'bg-red-500/10 text-red-600 dark:text-red-400 border-red-500/20',
    dotClassName: 'bg-red-500',
  },
  cancelled: {
    labelKey: 'cancelled',
    icon: XCircle,
    className: 'bg-muted text-muted-foreground border-border',
    dotClassName: 'bg-muted-foreground',
  },
  paused: {
    labelKey: 'paused',
    icon: PauseCircle,
    className: 'bg-orange-500/10 text-orange-600 dark:text-orange-400 border-orange-500/20',
    dotClassName: 'bg-orange-500',
  },
  active: {
    labelKey: 'active',
    icon: PlayCircle,
    className: 'bg-green-500/10 text-green-600 dark:text-green-400 border-green-500/20',
    dotClassName: 'bg-green-500',
  },
  inactive: {
    labelKey: 'inactive',
    icon: PauseCircle,
    className: 'bg-muted text-muted-foreground border-border',
    dotClassName: 'bg-muted-foreground',
  },
  draft: {
    labelKey: 'draft',
    icon: Clock,
    className: 'bg-muted text-muted-foreground border-border',
    dotClassName: 'bg-muted-foreground',
  },
  published: {
    labelKey: 'published',
    icon: CheckCircle,
    className: 'bg-green-500/10 text-green-600 dark:text-green-400 border-green-500/20',
    dotClassName: 'bg-green-500',
  },
  archived: {
    labelKey: 'archived',
    icon: AlertCircle,
    className: 'bg-purple-500/10 text-purple-600 dark:text-purple-400 border-purple-500/20',
    dotClassName: 'bg-purple-500',
  },
  featured: {
    labelKey: 'featured',
    icon: Star,
    className: 'bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20',
    dotClassName: 'bg-amber-500',
  },
};

interface StatusBadgeProps {
  /** 状态 */
  status: StatusType;
  /** 自定义标签 */
  label?: string;
  /** 尺寸 */
  size?: 'sm' | 'default' | 'lg';
  /** 是否显示图标 */
  showIcon?: boolean;
  /** 是否显示圆点 */
  showDot?: boolean;
  /** 是否动画 (用于进行中状态) */
  animated?: boolean;
  /** 自定义类名 */
  className?: string;
}

const sizeClasses = {
  sm: 'text-xs px-1.5 py-0.5',
  default: 'text-xs px-2 py-1',
  lg: 'text-sm px-2.5 py-1',
};

const iconSizeClasses = {
  sm: 'h-3 w-3',
  default: 'h-3.5 w-3.5',
  lg: 'h-4 w-4',
};

export function StatusBadge({
  status,
  label,
  size = 'default',
  showIcon = false,
  showDot = true,
  animated = true,
  className,
}: StatusBadgeProps) {
  const t = useTranslations('ui.status');
  const config = statusConfig[status];
  const Icon = config.icon;
  const isAnimated = animated && status === 'in_progress';

  return (
    <Badge
      variant="outline"
      className={cn(
        'font-medium gap-1.5 border',
        sizeClasses[size],
        config.className,
        className
      )}
    >
      {showDot && !showIcon && (
        <span
          className={cn(
            'rounded-full',
            size === 'sm' ? 'h-1.5 w-1.5' : 'h-2 w-2',
            config.dotClassName,
            isAnimated && 'animate-pulse'
          )}
        />
      )}
      {showIcon && (
        <Icon
          className={cn(
            iconSizeClasses[size],
            isAnimated && 'animate-spin'
          )}
        />
      )}
      {label || t(config.labelKey)}
    </Badge>
  );
}

// 申请状态特化版本
type ApplicationStatus = 
  | 'preparing'
  | 'submitted'
  | 'interview'
  | 'admitted'
  | 'rejected'
  | 'waitlisted'
  | 'withdrawn';

const applicationStatusConfig: Record<ApplicationStatus, StatusConfig> = {
  preparing: {
    labelKey: 'preparing',
    icon: Clock,
    className: 'bg-muted text-muted-foreground border-border',
    dotClassName: 'bg-muted-foreground',
  },
  submitted: {
    labelKey: 'submitted',
    icon: CheckCircle,
    className: 'bg-blue-500/10 text-blue-600 dark:text-blue-400 border-blue-500/20',
    dotClassName: 'bg-blue-500',
  },
  interview: {
    labelKey: 'interview',
    icon: Loader2,
    className: 'bg-purple-500/10 text-purple-600 dark:text-purple-400 border-purple-500/20',
    dotClassName: 'bg-purple-500',
  },
  admitted: {
    labelKey: 'admitted',
    icon: CheckCircle,
    className: 'bg-green-500/10 text-green-600 dark:text-green-400 border-green-500/20',
    dotClassName: 'bg-green-500',
  },
  rejected: {
    labelKey: 'rejected',
    icon: XCircle,
    className: 'bg-red-500/10 text-red-600 dark:text-red-400 border-red-500/20',
    dotClassName: 'bg-red-500',
  },
  waitlisted: {
    labelKey: 'waitlisted',
    icon: Clock,
    className: 'bg-yellow-500/10 text-yellow-600 dark:text-yellow-400 border-yellow-500/20',
    dotClassName: 'bg-yellow-500',
  },
  withdrawn: {
    labelKey: 'withdrawn',
    icon: XCircle,
    className: 'bg-muted text-muted-foreground border-border',
    dotClassName: 'bg-muted-foreground',
  },
};

interface ApplicationStatusBadgeProps {
  status: ApplicationStatus;
  size?: 'sm' | 'default' | 'lg';
  showIcon?: boolean;
  className?: string;
}

export function ApplicationStatusBadge({
  status,
  size = 'default',
  showIcon = false,
  className,
}: ApplicationStatusBadgeProps) {
  const t = useTranslations('ui.status');
  const config = applicationStatusConfig[status];
  const Icon = config.icon;
  const isAnimated = status === 'interview';

  return (
    <Badge
      variant="outline"
      className={cn(
        'font-medium gap-1.5 border',
        sizeClasses[size],
        config.className,
        className
      )}
    >
      {!showIcon && (
        <span
          className={cn(
            'rounded-full',
            size === 'sm' ? 'h-1.5 w-1.5' : 'h-2 w-2',
            config.dotClassName,
            isAnimated && 'animate-pulse'
          )}
        />
      )}
      {showIcon && (
        <Icon
          className={cn(
            iconSizeClasses[size],
            isAnimated && 'animate-spin'
          )}
        />
      )}
      {t(config.labelKey)}
    </Badge>
  );
}



