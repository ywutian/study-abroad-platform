'use client';

import { useTranslations } from 'next-intl';
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
  Sparkles,
  GraduationCap,
  BookOpen,
  Users,
  Target,
  Rocket,
} from 'lucide-react';

type EmptyStateType = 
  | 'empty' 
  | 'no-results' 
  | 'no-data' 
  | 'error' 
  | 'offline' 
  | 'first-time'
  | 'schools'
  | 'cases'
  | 'loading'
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
    icon?: React.ReactNode;
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
  /** 是否显示装饰 */
  showDecoration?: boolean;
}

// 预设配置
const presetConfig: Record<EmptyStateType, { 
  icon: React.ReactNode; 
  iconBg: string;
  iconColor: string;
  buttonGradient?: string;
  decorationColor?: string;
}> = {
  empty: { 
    icon: <Inbox className="h-8 w-8" />, 
    iconBg: 'bg-muted',
    iconColor: 'text-muted-foreground',
  },
  'no-results': { 
    icon: <Search className="h-8 w-8" />, 
    iconBg: 'bg-blue-500/10',
    iconColor: 'text-blue-500',
    buttonGradient: 'from-blue-500 to-cyan-500',
    decorationColor: 'from-blue-500/20 to-cyan-500/20',
  },
  'no-data': { 
    icon: <FolderOpen className="h-8 w-8" />, 
    iconBg: 'bg-violet-500/10',
    iconColor: 'text-violet-500',
    buttonGradient: 'from-violet-500 to-purple-500',
    decorationColor: 'from-violet-500/20 to-purple-500/20',
  },
  error: { 
    icon: <AlertCircle className="h-8 w-8" />, 
    iconBg: 'bg-destructive/10',
    iconColor: 'text-destructive',
    buttonGradient: 'from-destructive to-destructive/80',
  },
  offline: { 
    icon: <Wifi className="h-8 w-8" />, 
    iconBg: 'bg-amber-500/10',
    iconColor: 'text-amber-500',
    buttonGradient: 'from-amber-500 to-orange-500',
  },
  'first-time': {
    icon: <Rocket className="h-8 w-8" />,
    iconBg: 'bg-gradient-to-br from-blue-500/20 to-cyan-500/20',
    iconColor: 'text-blue-500',
    buttonGradient: 'from-blue-500 to-cyan-500',
    decorationColor: 'from-blue-500/10 to-cyan-500/10',
  },
  schools: {
    icon: <GraduationCap className="h-8 w-8" />,
    iconBg: 'bg-gradient-to-br from-violet-500/20 to-purple-500/20',
    iconColor: 'text-violet-500',
    buttonGradient: 'from-violet-500 to-purple-500',
    decorationColor: 'from-violet-500/10 to-purple-500/10',
  },
  cases: {
    icon: <BookOpen className="h-8 w-8" />,
    iconBg: 'bg-gradient-to-br from-emerald-500/20 to-teal-500/20',
    iconColor: 'text-emerald-500',
    buttonGradient: 'from-emerald-500 to-teal-500',
    decorationColor: 'from-emerald-500/10 to-teal-500/10',
  },
  loading: {
    icon: <Sparkles className="h-8 w-8 animate-pulse" />,
    iconBg: 'bg-primary/10',
    iconColor: 'text-primary',
  },
  custom: { 
    icon: <FileQuestion className="h-8 w-8" />, 
    iconBg: 'bg-muted',
    iconColor: 'text-muted-foreground',
  },
};

// Preset text keys mapping
const presetTextKeys: Record<EmptyStateType, { title: string; description: string }> = {
  empty: { title: 'noContent', description: 'noContentDesc' },
  'no-results': { title: 'noResults', description: 'noResultsDesc' },
  'no-data': { title: 'noData', description: 'noDataDesc' },
  error: { title: 'loadFailed', description: 'loadFailedDesc' },
  offline: { title: 'offline', description: 'offlineDesc' },
  'first-time': { title: 'firstTime', description: 'firstTimeDesc' },
  schools: { title: 'noSchools', description: 'noSchoolsDesc' },
  cases: { title: 'noCases', description: 'noCasesDesc' },
  loading: { title: 'loading', description: 'loadingDesc' },
  custom: { title: '', description: '' },
};

const sizeClasses = {
  sm: 'py-8',
  md: 'py-12',
  lg: 'py-20',
};

const iconContainerClasses = {
  sm: 'h-12 w-12 rounded-xl',
  md: 'h-16 w-16 rounded-2xl',
  lg: 'h-20 w-20 rounded-2xl',
};

const iconSizeClasses = {
  sm: '[&>svg]:h-6 [&>svg]:w-6',
  md: '[&>svg]:h-8 [&>svg]:w-8',
  lg: '[&>svg]:h-10 [&>svg]:w-10',
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
  showDecoration = true,
}: EmptyStateProps) {
  const t = useTranslations('ui.empty');
  const config = presetConfig[type];
  const textKeys = presetTextKeys[type];
  const presetTitle = textKeys.title ? t(textKeys.title) : '';
  const presetDescription = textKeys.description ? t(textKeys.description) : '';

  return (
    <div
      className={cn(
        'relative flex flex-col items-center justify-center text-center overflow-hidden',
        compact ? 'py-6' : sizeClasses[size],
        className
      )}
    >
      {/* 装饰背景 */}
      {showDecoration && config.decorationColor && (
        <>
          <div className={cn(
            'absolute -right-12 -top-12 h-32 w-32 rounded-full blur-3xl opacity-50',
            `bg-gradient-to-br ${config.decorationColor}`
          )} />
          <div className={cn(
            'absolute -left-12 -bottom-12 h-32 w-32 rounded-full blur-3xl opacity-50',
            `bg-gradient-to-br ${config.decorationColor}`
          )} />
        </>
      )}

      {/* 图标容器 */}
      <div 
        className={cn(
          'relative flex items-center justify-center mb-4 transition-transform hover:scale-105',
          iconContainerClasses[size],
          iconSizeClasses[size],
          config.iconBg,
          config.iconColor,
        )}
      >
        {icon || config.icon}
      </div>

      {/* 标题 */}
      {(title || presetTitle) && (
        <h3
          className={cn(
            'relative font-semibold text-foreground',
            size === 'sm' ? 'text-sm' : size === 'lg' ? 'text-xl' : 'text-base'
          )}
        >
          {title || presetTitle}
        </h3>
      )}

      {/* 描述 */}
      {(description || presetDescription) && (
        <p
          className={cn(
            'relative mt-2 max-w-md text-muted-foreground leading-relaxed',
            size === 'sm' ? 'text-xs' : 'text-sm'
          )}
        >
          {description || presetDescription}
        </p>
      )}

      {/* 操作按钮 */}
      {(action || secondaryAction) && (
        <div className="relative mt-6 flex flex-col gap-3 sm:flex-row">
          {action && (
            <Button
              variant={action.variant || 'default'}
              onClick={action.onClick}
              size={size === 'sm' ? 'sm' : 'default'}
              className={cn(
                'gap-2 shadow-lg',
                action.variant !== 'outline' && action.variant !== 'ghost' && config.buttonGradient && 
                `bg-gradient-to-r ${config.buttonGradient} hover:opacity-90 text-white shadow-${config.buttonGradient?.split(' ')[0]?.replace('from-', '')}/25`
              )}
            >
              {action.icon ? action.icon : type === 'error' ? (
                <RefreshCw className="h-4 w-4" />
              ) : (
                <Plus className="h-4 w-4" />
              )}
              {action.label}
            </Button>
          )}
          {secondaryAction && (
            <Button
              variant="outline"
              onClick={secondaryAction.onClick}
              size={size === 'sm' ? 'sm' : 'default'}
              className="gap-2"
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
  const t = useTranslations('ui.empty');
  return (
    <EmptyState
      type="no-results"
      title={t('noResults')}
      description={query ? t('noResultsQuery', { query }) : t('noResultsDesc')}
      action={onClear ? { label: t('clearFilter'), onClick: onClear, variant: 'outline' } : undefined}
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
  const t = useTranslations('ui.empty');
  const tCommon = useTranslations('common');
  return (
    <EmptyState
      type="error"
      title={t('loadFailed')}
      description={error || t('loadFailedDesc')}
      action={onRetry ? { label: tCommon('retry'), onClick: onRetry } : undefined}
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
