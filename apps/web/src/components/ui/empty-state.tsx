'use client';

import { useTranslations } from 'next-intl';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { IconFrame, type IconTone } from '@/components/ui/icon-frame';
import {
  FileQuestion,
  Search,
  Inbox,
  FolderOpen,
  Wifi,
  AlertCircle,
  Plus,
  RefreshCw,
  Loader2,
  GraduationCap,
  BookOpen,
  Users,
  Compass,
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';

type EmptyStateType =
  | 'empty'
  | 'no-results'
  | 'no-data'
  | 'error'
  | 'offline'
  | 'first-time'
  | 'schools'
  | 'cases'
  | 'essays'
  | 'teams'
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
}

// 学术严肃风预设配置：简化配色，使用边框而非渐变
const presetConfig: Record<
  EmptyStateType,
  {
    icon: LucideIcon;
    tone: IconTone;
  }
> = {
  empty: {
    icon: Inbox,
    tone: 'neutral',
  },
  'no-results': {
    icon: Search,
    tone: 'default',
  },
  'no-data': {
    icon: FolderOpen,
    tone: 'neutral',
  },
  error: {
    icon: AlertCircle,
    tone: 'danger',
  },
  offline: {
    icon: Wifi,
    tone: 'warning',
  },
  'first-time': {
    icon: Compass,
    tone: 'default',
  },
  schools: {
    icon: GraduationCap,
    tone: 'default',
  },
  cases: {
    icon: BookOpen,
    tone: 'success',
  },
  essays: {
    icon: FileQuestion,
    tone: 'warning',
  },
  teams: {
    icon: Users,
    tone: 'default',
  },
  loading: {
    icon: Loader2,
    tone: 'default',
  },
  custom: {
    icon: FileQuestion,
    tone: 'neutral',
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
  essays: { title: 'noEssays', description: 'noEssaysDesc' },
  teams: { title: '', description: '' },
  loading: { title: 'loading', description: 'loadingDesc' },
  custom: { title: '', description: '' },
};

const sizeClasses = {
  sm: 'py-8',
  md: 'py-12',
  lg: 'py-20',
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
  const t = useTranslations('ui.empty');
  const config = presetConfig[type];
  const textKeys = presetTextKeys[type];
  const presetTitle = textKeys.title ? t(textKeys.title) : '';
  const presetDescription = textKeys.description ? t(textKeys.description) : '';

  return (
    <div
      className={cn(
        'relative flex flex-col items-center justify-center text-center',
        compact ? 'py-6' : sizeClasses[size],
        className
      )}
    >
      <div className="mb-4">
        {icon ? (
          <span className="inline-flex h-16 w-16 items-center justify-center rounded-xl border border-border bg-muted/50 text-muted-foreground shadow-[0_1px_2px_rgba(15,23,42,0.06)] [&>svg]:h-8 [&>svg]:w-8">
            {icon}
          </span>
        ) : (
          <IconFrame
            icon={config.icon}
            tone={config.tone}
            size={size === 'sm' ? 'lg' : 'xl'}
            iconClassName={type === 'loading' ? 'animate-spin' : undefined}
          />
        )}
      </div>

      {/* 标题 */}
      {(title || presetTitle) && (
        <h3
          className={cn(
            'font-semibold text-foreground',
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
            'mt-2 max-w-md text-muted-foreground leading-relaxed',
            size === 'sm' ? 'text-xs' : 'text-sm'
          )}
        >
          {description || presetDescription}
        </p>
      )}

      {/* 操作按钮 - 学术风：使用默认按钮样式 */}
      {(action || secondaryAction) && (
        <div className="mt-6 flex flex-col gap-3 sm:flex-row">
          {action && (
            <Button
              variant={action.variant || 'default'}
              onClick={action.onClick}
              size={size === 'sm' ? 'sm' : 'default'}
              className="gap-2"
            >
              {action.icon ? (
                action.icon
              ) : type === 'error' ? (
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
      action={
        onClear ? { label: t('clearFilter'), onClick: onClear, variant: 'outline' } : undefined
      }
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
