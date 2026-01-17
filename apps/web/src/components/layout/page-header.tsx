'use client';

import { LucideIcon } from 'lucide-react';
import { cn } from '@/lib/utils';
import { ReactNode } from 'react';

export type PageHeaderColor = 'blue' | 'violet' | 'amber' | 'emerald' | 'rose' | 'slate' | 'indigo';

interface PageHeaderProps {
  title: string;
  description?: string;
  icon?: LucideIcon;
  color?: PageHeaderColor;
  children?: ReactNode;
  actions?: ReactNode;
  stats?: Array<{
    label: string;
    value: string | number;
    icon?: LucideIcon;
    color?: string;
  }>;
  className?: string;
}

// 学术严肃风：简化配色，使用单色 + 边框
const colorConfig: Record<
  PageHeaderColor,
  {
    bg: string;
    border: string;
    icon: string;
    iconBg: string;
  }
> = {
  blue: {
    bg: 'bg-primary/5',
    border: 'border-primary/20',
    icon: 'text-primary',
    iconBg: 'bg-primary/10 border-primary/20',
  },
  violet: {
    bg: 'bg-primary/5',
    border: 'border-violet-700/20',
    icon: 'text-violet-700 dark:text-violet-400',
    iconBg: 'bg-primary/10 border-violet-700/20',
  },
  amber: {
    bg: 'bg-warning/5',
    border: 'border-warning/20',
    icon: 'text-warning',
    iconBg: 'bg-warning/10 border-warning/20',
  },
  emerald: {
    bg: 'bg-success/5',
    border: 'border-success/20',
    icon: 'text-success',
    iconBg: 'bg-success/10 border-success/20',
  },
  rose: {
    bg: 'bg-destructive/5',
    border: 'border-destructive/20',
    icon: 'text-destructive',
    iconBg: 'bg-destructive/10 border-destructive/20',
  },
  slate: {
    bg: 'bg-muted/50',
    border: 'border-border',
    icon: 'text-muted-foreground',
    iconBg: 'bg-muted border-border',
  },
  indigo: {
    bg: 'bg-primary/5',
    border: 'border-primary/20',
    icon: 'text-primary',
    iconBg: 'bg-primary/10 border-primary/20',
  },
};

export function PageHeader({
  title,
  description,
  icon: Icon,
  color = 'blue',
  children,
  actions,
  stats,
  className,
}: PageHeaderProps) {
  const config = colorConfig[color];

  return (
    <div
      className={cn(
        // 学术风：去除圆角和光晕，使用简洁边框
        'relative mb-8 border-b-2 pb-6',
        config.border,
        className
      )}
    >
      <div className="relative z-10">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          {/* 标题区域 */}
          <div className="space-y-2">
            <div className="flex items-center gap-3">
              {Icon && (
                <div
                  className={cn(
                    // 学术风：方形图标容器 + 边框
                    'flex h-12 w-12 items-center justify-center rounded-lg border-2',
                    config.iconBg,
                    config.icon
                  )}
                >
                  <Icon className="h-6 w-6" />
                </div>
              )}
              <div>
                <h1 className="text-title">{title}</h1>
                {description && <p className="text-body-sm text-muted-foreground">{description}</p>}
              </div>
            </div>
          </div>

          {/* 操作按钮区域 */}
          {actions && <div className="flex items-center gap-3">{actions}</div>}
        </div>

        {/* 统计卡片 */}
        {stats && stats.length > 0 && (
          <div className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-4">
            {stats.map((stat, index) => (
              <div key={index} className="rounded-lg border-2 border-border bg-card p-4">
                <div
                  className={cn(
                    'flex items-center gap-2 mb-1',
                    stat.color || 'text-muted-foreground'
                  )}
                >
                  {stat.icon && <stat.icon className="h-4 w-4" />}
                  <span className="text-xs">{stat.label}</span>
                </div>
                <p className={cn('text-2xl font-bold', stat.color || '')}>{stat.value}</p>
              </div>
            ))}
          </div>
        )}

        {/* 自定义内容 */}
        {children}
      </div>
    </div>
  );
}

// 简化版页面头部（用于较简单的页面）
interface SimplePageHeaderProps {
  title: string;
  description?: string;
  className?: string;
}

export function SimplePageHeader({ title, description, className }: SimplePageHeaderProps) {
  return (
    <div className={cn('mb-8 border-b-2 border-border pb-6', className)}>
      <h1 className="text-title">{title}</h1>
      {description && <p className="mt-2 text-muted-foreground">{description}</p>}
    </div>
  );
}
