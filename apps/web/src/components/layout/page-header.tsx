'use client';

import { LucideIcon } from 'lucide-react';
import { cn } from '@/lib/utils';
import { ReactNode } from 'react';

export type PageHeaderColor = 
  | 'blue' 
  | 'violet' 
  | 'amber' 
  | 'emerald' 
  | 'rose' 
  | 'slate'
  | 'indigo';

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

const colorConfig: Record<PageHeaderColor, {
  gradient: string;
  iconGradient: string;
  shadow: string;
  glow1: string;
  glow2: string;
}> = {
  blue: {
    gradient: 'from-blue-500/10 via-background to-cyan-500/10',
    iconGradient: 'from-blue-500 to-cyan-500',
    shadow: 'shadow-blue-500/25',
    glow1: 'from-blue-500/20 to-cyan-500/20',
    glow2: 'from-sky-500/20 to-blue-500/20',
  },
  violet: {
    gradient: 'from-violet-500/10 via-background to-purple-500/10',
    iconGradient: 'from-violet-500 to-purple-500',
    shadow: 'shadow-violet-500/25',
    glow1: 'from-violet-500/20 to-purple-500/20',
    glow2: 'from-indigo-500/20 to-violet-500/20',
  },
  amber: {
    gradient: 'from-amber-500/10 via-background to-yellow-500/10',
    iconGradient: 'from-amber-500 to-yellow-500',
    shadow: 'shadow-amber-500/25',
    glow1: 'from-amber-500/20 to-yellow-500/20',
    glow2: 'from-orange-500/20 to-amber-500/20',
  },
  emerald: {
    gradient: 'from-emerald-500/10 via-background to-teal-500/10',
    iconGradient: 'from-emerald-500 to-teal-500',
    shadow: 'shadow-emerald-500/25',
    glow1: 'from-emerald-500/20 to-teal-500/20',
    glow2: 'from-green-500/20 to-emerald-500/20',
  },
  rose: {
    gradient: 'from-rose-500/10 via-background to-pink-500/10',
    iconGradient: 'from-rose-500 to-pink-500',
    shadow: 'shadow-rose-500/25',
    glow1: 'from-rose-500/20 to-pink-500/20',
    glow2: 'from-red-500/20 to-rose-500/20',
  },
  slate: {
    gradient: 'from-slate-500/10 via-background to-gray-500/10',
    iconGradient: 'from-slate-500 to-gray-500',
    shadow: 'shadow-slate-500/25',
    glow1: 'from-slate-500/20 to-gray-500/20',
    glow2: 'from-zinc-500/20 to-slate-500/20',
  },
  indigo: {
    gradient: 'from-indigo-500/10 via-background to-blue-500/10',
    iconGradient: 'from-indigo-500 to-blue-500',
    shadow: 'shadow-indigo-500/25',
    glow1: 'from-indigo-500/20 to-blue-500/20',
    glow2: 'from-violet-500/20 to-indigo-500/20',
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
        'relative mb-8 overflow-hidden rounded-2xl p-6 sm:p-8',
        `bg-gradient-to-br ${config.gradient}`,
        className
      )}
    >
      {/* 装饰光斑 */}
      <div
        className={cn(
          'absolute -right-20 -top-20 h-64 w-64 rounded-full blur-3xl',
          `bg-gradient-to-br ${config.glow1}`
        )}
      />
      <div
        className={cn(
          'absolute -bottom-20 -left-20 h-64 w-64 rounded-full blur-3xl',
          `bg-gradient-to-br ${config.glow2}`
        )}
      />

      <div className="relative z-10">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          {/* 标题区域 */}
          <div className="space-y-2">
            <div className="flex items-center gap-3">
              {Icon && (
                <div
                  className={cn(
                    'flex h-12 w-12 items-center justify-center rounded-xl shadow-lg',
                    `bg-gradient-to-br ${config.iconGradient} ${config.shadow}`
                  )}
                >
                  <Icon className="h-6 w-6 text-white" />
                </div>
              )}
              <div>
                <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">
                  {title}
                </h1>
                {description && (
                  <p className="text-muted-foreground">{description}</p>
                )}
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
              <div
                key={index}
                className="rounded-xl border bg-card/50 backdrop-blur-sm p-4"
              >
                <div className={cn(
                  'flex items-center gap-2 mb-1',
                  stat.color || 'text-muted-foreground'
                )}>
                  {stat.icon && <stat.icon className="h-4 w-4" />}
                  <span className="text-xs">{stat.label}</span>
                </div>
                <p className={cn(
                  'text-2xl font-bold',
                  stat.color || ''
                )}>{stat.value}</p>
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

export function SimplePageHeader({
  title,
  description,
  className,
}: SimplePageHeaderProps) {
  return (
    <div className={cn('mb-8', className)}>
      <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">{title}</h1>
      {description && (
        <p className="mt-2 text-muted-foreground">{description}</p>
      )}
    </div>
  );
}
