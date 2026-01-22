'use client';

import { useTranslations } from 'next-intl';
import { motion } from 'framer-motion';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import { BadgeCheck, Shield, Clock, XCircle, GraduationCap } from 'lucide-react';

type VerificationStatus = 'VERIFIED' | 'PENDING' | 'REJECTED' | 'NONE';

interface VerificationBadgeProps {
  status: VerificationStatus;
  schoolName?: string;
  year?: number;
  size?: 'sm' | 'md' | 'lg';
  showLabel?: boolean;
  className?: string;
}

const statusStyles = {
  VERIFIED: {
    icon: BadgeCheck,
    color: 'text-blue-500',
    bgColor: 'bg-blue-500/10',
    borderColor: 'border-blue-500/20',
    gradient: 'bg-primary',
  },
  PENDING: {
    icon: Clock,
    color: 'text-amber-500',
    bgColor: 'bg-amber-500/10',
    borderColor: 'border-amber-500/20',
    gradient: 'bg-warning',
  },
  REJECTED: {
    icon: XCircle,
    color: 'text-red-500',
    bgColor: 'bg-red-500/10',
    borderColor: 'border-red-500/20',
    gradient: 'from-red-500 to-orange-500',
  },
  NONE: {
    icon: Shield,
    color: 'text-muted-foreground',
    bgColor: 'bg-muted',
    borderColor: 'border-muted',
    gradient: 'from-gray-400 to-gray-500',
  },
};

const sizeConfig = {
  sm: {
    icon: 'h-3 w-3',
    badge: 'text-xs px-1.5 py-0.5',
    text: 'text-xs',
  },
  md: {
    icon: 'h-4 w-4',
    badge: 'text-sm px-2 py-1',
    text: 'text-sm',
  },
  lg: {
    icon: 'h-5 w-5',
    badge: 'text-base px-3 py-1.5',
    text: 'text-base',
  },
};

export function VerificationBadge({
  status,
  schoolName,
  year,
  size = 'md',
  showLabel = true,
  className,
}: VerificationBadgeProps) {
  const t = useTranslations('verification');
  const styles = statusStyles[status];
  const sizeStyles = sizeConfig[size];
  const Icon = styles.icon;

  const getStatusLabel = (s: VerificationStatus) => {
    const labels: Record<VerificationStatus, string> = {
      VERIFIED: t('status.verified'),
      PENDING: t('status.pending'),
      REJECTED: t('status.rejected'),
      NONE: t('status.none'),
    };
    return labels[s];
  };

  const label = getStatusLabel(status);

  if (status === 'NONE' && !showLabel) {
    return null;
  }

  const badgeContent = (
    <motion.div
      initial={{ scale: 0.9, opacity: 0 }}
      animate={{ scale: 1, opacity: 1 }}
      className={cn('inline-flex items-center', className)}
    >
      <Badge
        variant="outline"
        className={cn(
          'gap-1 font-medium border',
          styles.bgColor,
          styles.borderColor,
          styles.color,
          sizeStyles.badge
        )}
      >
        <Icon className={sizeStyles.icon} />
        {showLabel && <span>{label}</span>}
      </Badge>
    </motion.div>
  );

  if (status === 'VERIFIED' && schoolName) {
    return (
      <TooltipProvider>
        <Tooltip>
          <TooltipTrigger asChild>{badgeContent}</TooltipTrigger>
          <TooltipContent className="p-3">
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <div
                  className={cn(
                    'flex h-8 w-8 items-center justify-center rounded-lg',
                    `bg-gradient-to-br ${styles.gradient} text-white`
                  )}
                >
                  <BadgeCheck className="h-4 w-4" />
                </div>
                <div>
                  <p className="font-semibold">{t('badge.verifiedUser')}</p>
                  <p className="text-xs text-muted-foreground">{t('badge.verifiedInfo')}</p>
                </div>
              </div>
              <div className="pt-2 border-t space-y-1">
                <div className="flex items-center gap-2 text-sm">
                  <GraduationCap className="h-3.5 w-3.5 text-muted-foreground" />
                  <span>{schoolName}</span>
                </div>
                {year && (
                  <p className="text-xs text-muted-foreground">
                    {t('badge.admittedYear', { year })}
                  </p>
                )}
              </div>
            </div>
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>
    );
  }

  if (status === 'PENDING') {
    return (
      <TooltipProvider>
        <Tooltip>
          <TooltipTrigger asChild>{badgeContent}</TooltipTrigger>
          <TooltipContent>
            <p>{t('badge.pendingReview')}</p>
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>
    );
  }

  return badgeContent;
}

/**
 * 简洁的认证图标（仅用于头像旁边等紧凑位置）
 */
export function VerificationIcon({
  verified,
  size = 'md',
  className,
}: {
  verified: boolean;
  size?: 'sm' | 'md' | 'lg';
  className?: string;
}) {
  const t = useTranslations('verification');
  if (!verified) return null;

  const sizeStyles = {
    sm: 'h-3 w-3',
    md: 'h-4 w-4',
    lg: 'h-5 w-5',
  };

  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <motion.span
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            className={cn('inline-flex text-blue-500', className)}
          >
            <BadgeCheck className={cn(sizeStyles[size], 'fill-current')} />
          </motion.span>
        </TooltipTrigger>
        <TooltipContent>
          <p>{t('badge.verifiedUserShort')}</p>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}
