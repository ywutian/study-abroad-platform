'use client';

import { useTranslations } from 'next-intl';
import { cn } from '@/lib/utils';

type AdmissionTier = 'reach' | 'target' | 'safety' | 'likely';

type AdmissionTierBadgeProps = {
  tier: AdmissionTier;
  probability?: number;
  size?: 'sm' | 'md';
  showBand?: boolean;
  className?: string;
};

const bandOffset: Record<AdmissionTier, string> = {
  reach: 'left-[8%] w-[28%]',
  target: 'left-[34%] w-[32%]',
  safety: 'left-[68%] w-[24%]',
  likely: 'left-[54%] w-[26%]',
};

export function AdmissionTierBadge({
  tier,
  probability,
  size = 'sm',
  showBand = false,
  className,
}: AdmissionTierBadgeProps) {
  const t = useTranslations('ui.admissionTiers');

  return (
    <div className={cn('inline-flex flex-col gap-1.5', className)}>
      <span
        className={cn(
          'inline-flex w-fit items-center gap-2 rounded-md border px-2.5 py-1 font-medium',
          size === 'sm' ? 'text-2xs' : 'text-xs',
          tier === 'reach' &&
            'border-[color:var(--ds-status-reach)]/20 bg-[color:var(--ds-status-reach-bg)] text-[color:var(--ds-status-reach-fg)]',
          tier === 'target' &&
            'border-[color:var(--ds-status-target)]/20 bg-[color:var(--ds-status-target-bg)] text-[color:var(--ds-status-target-fg)]',
          tier === 'safety' &&
            'border-[color:var(--ds-status-safety)]/20 bg-[color:var(--ds-status-safety-bg)] text-[color:var(--ds-status-safety-fg)]',
          tier === 'likely' &&
            'border-[color:var(--ds-status-likely)]/20 bg-[color:var(--ds-status-likely-bg)] text-[color:var(--ds-status-likely-fg)]'
        )}
      >
        <span>{t(tier)}</span>
        {typeof probability === 'number' ? (
          <span className="font-mono text-2xs opacity-75">{probability}%</span>
        ) : null}
      </span>

      {showBand ? (
        <span className="relative block h-1.5 w-24 rounded-full bg-[color:var(--landing-border)]/75">
          <span
            className={cn(
              'absolute top-0 h-1.5 rounded-full',
              bandOffset[tier],
              tier === 'reach' && 'bg-[color:var(--ds-status-reach)]',
              tier === 'target' && 'bg-[color:var(--ds-status-target)]',
              tier === 'safety' && 'bg-[color:var(--ds-status-safety)]',
              tier === 'likely' && 'bg-[color:var(--ds-status-likely)]'
            )}
          />
        </span>
      ) : null}
    </div>
  );
}

export type { AdmissionTier, AdmissionTierBadgeProps };
