'use client';

import { useState, type ReactNode } from 'react';
import { useTranslations } from 'next-intl';
import { ChevronDown } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import { TIER_CONFIG } from './constants';
import type { TierType } from './types';

interface PredictionResultTierGroupProps {
  tier: TierType;
  count: number;
  defaultOpen?: boolean;
  children: ReactNode;
}

/**
 * Collapsible Reach / Match / Safety section header. Grouping by tier makes the
 * portfolio shape ("5 reach · 18 match · 33 safety") legible at a glance —
 * matching the mental model applicants already use — without re-introducing the
 * banned nested-scroll or per-group virtualizer the old layout relied on.
 */
export function PredictionResultTierGroup({
  tier,
  count,
  defaultOpen = true,
  children,
}: PredictionResultTierGroupProps) {
  const t = useTranslations('prediction');
  const [open, setOpen] = useState(defaultOpen);
  const tierConfig = TIER_CONFIG[tier] ?? TIER_CONFIG.unavailable;
  const TierIcon = tierConfig.icon;

  return (
    <section className="space-y-2">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        className="flex w-full items-center gap-2 rounded-[var(--theme-radius-button)] px-1.5 py-1 text-left transition-colors hover:bg-muted/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/60"
      >
        <TierIcon className={cn('h-4 w-4 shrink-0', tierConfig.text)} aria-hidden />
        <span className="text-sm font-semibold text-foreground">{t(`tier.${tier}`)}</span>
        <Badge variant="secondary" className="h-5 px-1.5 text-2xs tabular-nums">
          {count}
        </Badge>
        <ChevronDown
          className={cn(
            'ml-auto h-4 w-4 shrink-0 text-muted-foreground transition-transform',
            !open && '-rotate-90'
          )}
          aria-hidden
        />
      </button>
      {open && <div className="space-y-2">{children}</div>}
    </section>
  );
}
