'use client';

import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import { AlertTriangle, BarChart3, Clock3, ShieldCheck, Target } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { useMemo } from 'react';
import { useTranslations } from 'next-intl';

type SnapshotPrediction = {
  probability: number | null;
  tier?: string;
  confidence?: string;
  updatedAt?: string | Date;
};

const STALE_AFTER_MS = 1000 * 60 * 60 * 24 * 30;

export function PortfolioSnapshot({
  predictions,
  selectedCount,
}: {
  predictions: SnapshotPrediction[];
  selectedCount: number;
}) {
  const t = useTranslations('prediction.workbench');
  const summary = useMemo(() => {
    const counts = { reach: 0, match: 0, safety: 0, unavailable: 0 };
    let totalProbability = 0;
    let probabilityCount = 0;
    let staleCount = 0;

    for (const prediction of predictions) {
      const tier = prediction.tier ?? 'unavailable';
      if (tier in counts) counts[tier as keyof typeof counts] += 1;
      if (prediction.probability != null) {
        totalProbability += prediction.probability;
        probabilityCount += 1;
      }
      if (prediction.updatedAt) {
        const updatedAt = new Date(prediction.updatedAt).getTime();
        if (Number.isFinite(updatedAt) && Date.now() - updatedAt > STALE_AFTER_MS) staleCount += 1;
      }
    }

    return {
      avgProbability:
        probabilityCount > 0 ? Math.round((totalProbability / probabilityCount) * 100) : null,
      counts,
      staleCount,
      predictedCount: probabilityCount,
      missingCount: Math.max(0, selectedCount - probabilityCount),
    };
  }, [predictions, selectedCount]);

  const balanceTone =
    summary.counts.safety > 0 && summary.counts.match > 0
      ? 'ready'
      : predictions.length > 0
        ? 'attention'
        : 'blocked';

  return (
    <section className="rounded-[var(--theme-radius-card)] border border-border bg-[color:var(--theme-card-bg)] p-4 shadow-[var(--theme-card-shadow)]">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-base font-semibold">{t('portfolioTitle')}</h2>
          <p className="text-sm text-muted-foreground">{t('portfolioSubtitle')}</p>
        </div>
        <Badge
          variant={
            balanceTone === 'ready'
              ? 'success'
              : balanceTone === 'attention'
                ? 'warning'
                : 'secondary'
          }
        >
          {balanceTone === 'ready'
            ? t('balanced')
            : balanceTone === 'attention'
              ? t('needsBalance')
              : t('notReady')}
        </Badge>
      </div>

      <div className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <SnapshotTile
          icon={Target}
          label={t('formalCoverage')}
          value={`${summary.predictedCount}/${Math.max(selectedCount, summary.predictedCount)}`}
          detail={t('formalCoverageDetail', {
            predicted: summary.predictedCount,
            missing: summary.missingCount,
          })}
        />
        <SnapshotTile
          icon={BarChart3}
          label={t('averageChance')}
          value={summary.avgProbability == null ? '--' : `${summary.avgProbability}%`}
          detail={t('averageChanceDetail')}
        />
        <SnapshotTile
          icon={ShieldCheck}
          label={t('portfolioMix')}
          value={`${summary.counts.reach}/${summary.counts.match}/${summary.counts.safety}`}
          detail={t('portfolioMixDetail')}
        />
        <SnapshotTile
          icon={summary.staleCount > 0 ? AlertTriangle : Clock3}
          label={t('stalePredictions')}
          value={String(summary.staleCount)}
          detail={
            summary.staleCount > 0
              ? t('stalePredictionsDetail', { count: summary.staleCount })
              : t('allFresh')
          }
          muted={summary.staleCount === 0}
        />
      </div>

      {predictions.length > 0 && (
        <div className="mt-4 flex h-2 overflow-hidden rounded-full bg-muted">
          {(['reach', 'match', 'safety'] as const).map((tier) => {
            const count = summary.counts[tier as keyof typeof summary.counts] ?? 0;
            if (count === 0) return null;
            return (
              <div
                key={tier}
                className={cn(
                  tier === 'reach' && 'bg-rose-500',
                  tier === 'match' && 'bg-amber-500',
                  tier === 'safety' && 'bg-emerald-500'
                )}
                style={{ width: `${(count / predictions.length) * 100}%` }}
              />
            );
          })}
        </div>
      )}
    </section>
  );
}

function SnapshotTile({
  icon: Icon,
  label,
  value,
  detail,
  muted,
}: {
  icon: LucideIcon;
  label: string;
  value: string;
  detail: string;
  muted?: boolean;
}) {
  return (
    <div className="rounded-[var(--theme-radius-button)] border bg-[color:var(--theme-control-bg)] p-3">
      <div className="flex items-center gap-2 text-xs text-muted-foreground">
        <Icon className={cn('h-4 w-4', muted ? 'text-muted-foreground' : 'text-primary')} />
        <span>{label}</span>
      </div>
      <p className="mt-1 text-2xl font-semibold text-metric">{value}</p>
      <p className="mt-1 text-xs leading-snug text-muted-foreground">{detail}</p>
    </div>
  );
}
