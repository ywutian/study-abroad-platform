'use client';

import type { SchoolFieldSource } from '@study-abroad/shared';
import { DATA_SOURCE_LABELS } from '@study-abroad/shared';
import { useLocale, useTranslations } from 'next-intl';
import { ExternalLink } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { cn } from '@/lib/utils';

const TIER_STYLES: Record<SchoolFieldSource['tier'], string> = {
  OFFICIAL: 'border-emerald-500/30 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300',
  PARTNER: 'border-sky-500/30 bg-sky-500/10 text-sky-700 dark:text-sky-300',
  SCRAPED: 'border-amber-500/30 bg-amber-500/10 text-amber-700 dark:text-amber-300',
  SEED: 'border-dashed border-muted-foreground/40 bg-muted/60 text-muted-foreground',
  COMMUNITY: 'border-pink-500/30 bg-pink-500/10 text-pink-700 dark:text-pink-300',
  INFERRED: 'border-fuchsia-500/30 bg-fuchsia-500/10 text-fuchsia-700 dark:text-fuchsia-300',
  UNAVAILABLE: 'border-dashed border-muted-foreground/40 bg-muted/60 text-muted-foreground',
};

interface TrustBadgeProps {
  source?: SchoolFieldSource | null;
  sourceUrl?: string | null;
  className?: string;
}

export function TrustBadge({ source, sourceUrl, className }: TrustBadgeProps) {
  const t = useTranslations();
  const locale = useLocale();

  if (!source) return null;

  const localeKey = locale === 'zh' ? 'zh' : 'en';
  const tierLabel = t(`school.trust.badges.${source.tier}`);
  const tierTitle = t(`school.trust.tiers.${source.tier}`);
  const sourceLabel = DATA_SOURCE_LABELS[source.source]?.[localeKey] ?? source.source;
  const stalenessLabel = t(`school.trust.staleness.${source.staleness}`);
  const predictionLabel = source.predictionEligible
    ? t('school.trust.predictionEligible')
    : t('school.trust.notUsedForPrediction');
  const updatedAt = new Date(source.fetchedAt).toLocaleDateString(locale, {
    month: 'short',
    year: 'numeric',
  });

  return (
    <TooltipProvider delayDuration={200}>
      <Tooltip>
        <TooltipTrigger asChild>
          <Badge
            variant="outline"
            className={cn('gap-1 text-2xs font-medium', TIER_STYLES[source.tier], className)}
          >
            {tierLabel}
          </Badge>
        </TooltipTrigger>
        <TooltipContent className="max-w-xs space-y-1 text-xs">
          <p className="font-medium">{tierTitle}</p>
          <p>{t('school.dataSource', { source: sourceLabel })}</p>
          <p>{t('school.updatedAt', { date: updatedAt })}</p>
          <p>{t('school.trust.stalenessLabel', { staleness: stalenessLabel })}</p>
          <p>{predictionLabel}</p>
          {source.verifiedBy ? (
            <p>{t('school.trust.verifiedBy', { reviewer: source.verifiedBy })}</p>
          ) : null}
          {sourceUrl ? (
            <a
              href={sourceUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1 text-primary hover:underline"
            >
              {t('school.viewSource')}
              <ExternalLink className="h-3 w-3" />
            </a>
          ) : null}
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}
