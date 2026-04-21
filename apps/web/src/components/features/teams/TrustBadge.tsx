'use client';

import { useTranslations } from 'next-intl';
import { BadgeCheck, Mail, ShieldCheck } from 'lucide-react';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { cn } from '@/lib/utils';

type VerificationLevel = 'admin' | 'verified' | 'email' | 'unverified';

interface TrustBadgeProps {
  level: VerificationLevel | undefined;
  size?: 'sm' | 'md';
  className?: string;
}

/**
 * Compact trust signal for recruitment cards.
 * Shows nothing for 'unverified' to avoid noise on the dominant cohort.
 */
export function TrustBadge({ level, size = 'sm', className }: TrustBadgeProps) {
  const t = useTranslations('teams.recruitment.trust');

  if (!level || level === 'unverified') return null;

  const iconSize = size === 'sm' ? 'h-3 w-3' : 'h-3.5 w-3.5';

  const config: Record<
    Exclude<VerificationLevel, 'unverified'>,
    { Icon: typeof ShieldCheck; color: string; tooltipKey: string; ariaKey: string }
  > = {
    admin: {
      Icon: ShieldCheck,
      color: 'text-amber-500 dark:text-amber-400',
      tooltipKey: 'adminTooltip',
      ariaKey: 'adminAria',
    },
    verified: {
      Icon: BadgeCheck,
      color: 'text-sky-500 dark:text-sky-400',
      tooltipKey: 'verifiedTooltip',
      ariaKey: 'verifiedAria',
    },
    email: {
      Icon: Mail,
      color: 'text-muted-foreground',
      tooltipKey: 'emailTooltip',
      ariaKey: 'emailAria',
    },
  };

  const { Icon, color, tooltipKey, ariaKey } = config[level];

  return (
    <TooltipProvider delayDuration={200}>
      <Tooltip>
        <TooltipTrigger asChild>
          <span className={cn('inline-flex items-center', className)}>
            <Icon className={cn(iconSize, color, 'shrink-0')} aria-label={t(ariaKey)} />
          </span>
        </TooltipTrigger>
        <TooltipContent side="top" className="text-xs">
          {t(tooltipKey)}
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}

interface QualityPillProps {
  signal: 'rich' | 'standard' | 'thin' | undefined;
  className?: string;
}

/**
 * Tiny quality signal pill. Only shows for 'thin' headlines to nudge the author.
 */
export function CardQualityPill({ signal, className }: QualityPillProps) {
  const t = useTranslations('teams.recruitment.trust');

  if (signal !== 'thin') return null;

  return (
    <span
      className={cn(
        'inline-flex items-center gap-1 rounded-full bg-muted px-2 py-0.5 text-2xs font-medium text-muted-foreground',
        className
      )}
      aria-label={t('thinAria')}
    >
      {t('thinLabel')}
    </span>
  );
}
