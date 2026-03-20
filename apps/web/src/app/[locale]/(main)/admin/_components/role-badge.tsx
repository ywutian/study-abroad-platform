'use client';

import { Crown, Shield, ShieldCheck, Wrench } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';

type RoleType = 'USER' | 'VERIFIED' | 'OPERATOR' | 'ADMIN' | 'SUPER_ADMIN';

const ROLE_CONFIG: Record<
  RoleType,
  {
    icon?: React.ElementType;
    className: string;
    label: string;
    labelZh: string;
  }
> = {
  USER: {
    className: 'bg-muted text-muted-foreground',
    label: 'User',
    labelZh: '用户',
  },
  VERIFIED: {
    icon: ShieldCheck,
    className:
      'bg-blue-500/10 text-blue-600 dark:text-blue-400 border-blue-200 dark:border-blue-800',
    label: 'Verified',
    labelZh: '已认证',
  },
  OPERATOR: {
    icon: Wrench,
    className:
      'bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-200 dark:border-amber-800',
    label: 'Operator',
    labelZh: '运营员',
  },
  ADMIN: {
    icon: Shield,
    className:
      'bg-violet-500/10 text-violet-600 dark:text-violet-400 border-violet-200 dark:border-violet-800',
    label: 'Admin',
    labelZh: '管理员',
  },
  SUPER_ADMIN: {
    icon: Crown,
    className:
      'bg-rose-500/10 text-rose-600 dark:text-rose-400 border-rose-200 dark:border-rose-800',
    label: 'Super Admin',
    labelZh: '超级管理员',
  },
};

interface RoleBadgeProps {
  role: string;
  locale?: string;
  size?: 'sm' | 'md';
  showIcon?: boolean;
  className?: string;
}

export function RoleBadge({
  role,
  locale,
  size = 'sm',
  showIcon = true,
  className,
}: RoleBadgeProps) {
  const config = ROLE_CONFIG[role as RoleType] || ROLE_CONFIG.USER;
  const Icon = config.icon;
  const label = locale === 'zh' ? config.labelZh : config.label;

  return (
    <Badge
      variant="outline"
      className={cn(
        'gap-1 font-medium',
        config.className,
        size === 'sm' && 'text-xs px-1.5 py-0',
        size === 'md' && 'text-sm px-2 py-0.5',
        className
      )}
    >
      {showIcon && Icon && <Icon className={cn(size === 'sm' ? 'h-3 w-3' : 'h-3.5 w-3.5')} />}
      {label}
    </Badge>
  );
}

export const ROLE_HIERARCHY: RoleType[] = ['USER', 'VERIFIED', 'OPERATOR', 'ADMIN', 'SUPER_ADMIN'];

export function getRoleLevel(role: string): number {
  return ROLE_HIERARCHY.indexOf(role as RoleType);
}

export function canAssignRole(currentRole: string, targetRole: string): boolean {
  return getRoleLevel(currentRole) > getRoleLevel(targetRole);
}
