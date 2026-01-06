'use client';

import { cn } from '@/lib/utils';
import { LucideIcon } from 'lucide-react';

interface StatCardProps {
  label: string;
  value: string | number;
  icon?: LucideIcon;
  trend?: {
    value: number;
    isPositive: boolean;
  };
  className?: string;
  index?: number; // for animation delay
}

export function StatCard({ label, value, icon: Icon, trend, className, index = 0 }: StatCardProps) {
  return (
    <div
      className={cn(
        'rounded-xl border bg-card p-4 sm:p-6',
        className
      )}
    >
      <div className="flex items-start justify-between">
        <div className="space-y-1">
          <p className="text-sm text-muted-foreground">{label}</p>
          <p className="text-2xl font-bold sm:text-3xl">{value}</p>
        </div>
        {Icon && (
          <div className="rounded-lg bg-primary/10 p-2 text-primary">
            <Icon className="h-5 w-5" />
          </div>
        )}
      </div>
      {trend && (
        <div className="mt-2 flex items-center gap-1">
          <span
            className={cn(
              'text-xs font-medium',
              trend.isPositive ? 'text-success' : 'text-destructive'
            )}
          >
            {trend.isPositive ? '+' : ''}{trend.value}%
          </span>
          <span className="text-xs text-muted-foreground">vs 上月</span>
        </div>
      )}
    </div>
  );
}





