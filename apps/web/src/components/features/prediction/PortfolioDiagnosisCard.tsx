'use client';

import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import { AlertTriangle, BarChart3, Info, ShieldCheck, type LucideIcon } from 'lucide-react';
import { useMemo } from 'react';
import { useTranslations } from 'next-intl';

type DiagnosisPrediction = {
  probability: number | null;
  tier?: string;
  updatedAt?: string | Date;
};

const STALE_AFTER_MS = 1000 * 60 * 60 * 24 * 30;

export function PortfolioDiagnosisCard({
  predictions,
  selectedCount,
}: {
  predictions: DiagnosisPrediction[];
  selectedCount: number;
}) {
  const t = useTranslations('prediction.diagnosis');
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

    const total = Math.max(probabilityCount, selectedCount, predictions.length);
    const reachRatio = total > 0 ? counts.reach / total : 0;
    const avgProbability =
      probabilityCount > 0 ? Math.round((totalProbability / probabilityCount) * 100) : null;

    let tone: 'ready' | 'attention' | 'blocked' = 'blocked';
    let recommendationKey = 'runFirst';
    let alertKey = 'selectMore';

    if (probabilityCount > 0) {
      if (counts.safety === 0) {
        tone = 'attention';
        recommendationKey = 'addSafety';
        alertKey = 'noSafety';
      } else if (reachRatio > 0.5) {
        tone = 'attention';
        recommendationKey = 'reachHeavy';
        alertKey = 'reachRisk';
      } else if (counts.match === 0) {
        tone = 'attention';
        recommendationKey = 'addMatch';
        alertKey = 'noMatch';
      } else {
        tone = 'ready';
        recommendationKey = 'balanced';
        alertKey = staleCount > 0 ? 'hasStale' : 'healthy';
      }
    }

    return {
      avgProbability,
      counts,
      probabilityCount,
      missingCount: Math.max(0, selectedCount - probabilityCount),
      staleCount,
      total,
      reachRatio: Math.round(reachRatio * 100),
      tone,
      recommendationKey,
      alertKey,
    };
  }, [predictions, selectedCount]);

  const totalForBar = Math.max(1, summary.probabilityCount || selectedCount || predictions.length);
  const healthLabel =
    summary.tone === 'ready'
      ? t('health.ready')
      : summary.tone === 'attention'
        ? t('health.attention')
        : t('health.blocked');

  return (
    <section className="rounded-[var(--theme-radius-card)] border border-border bg-[color:var(--theme-card-bg)] p-4 shadow-[var(--theme-card-shadow)]">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
        <div className="min-w-0">
          <h2 className="flex items-center gap-2 text-base font-semibold">
            <BarChart3 className="h-5 w-5 text-primary" />
            {t('title')}
          </h2>
          <p className="mt-1 text-sm text-muted-foreground">{t('subtitle')}</p>
        </div>
        <div className="grid min-w-[280px] gap-2 rounded-[var(--theme-radius-button)] border bg-[color:var(--theme-control-bg)] p-3 sm:grid-cols-3">
          <MiniStat
            label={t('mix')}
            value={`${summary.counts.reach}/${summary.counts.match}/${summary.counts.safety}`}
          />
          <MiniStat
            label={t('average')}
            value={summary.avgProbability == null ? '--' : `${summary.avgProbability}%`}
          />
          <MiniStat label={t('healthLabel')} value={healthLabel} tone={summary.tone} />
        </div>
      </div>

      {summary.probabilityCount > 0 && (
        <div className="mt-4">
          <div className="flex h-2 overflow-hidden rounded-full bg-muted">
            {(['reach', 'match', 'safety'] as const).map((tier) => {
              const count = summary.counts[tier];
              if (count === 0) return null;
              return (
                <div
                  key={tier}
                  className={cn(
                    tier === 'reach' && 'bg-rose-500',
                    tier === 'match' && 'bg-amber-500',
                    tier === 'safety' && 'bg-emerald-500'
                  )}
                  style={{ width: `${(count / totalForBar) * 100}%` }}
                />
              );
            })}
          </div>
          <div className="mt-2 flex flex-wrap gap-2 text-xs text-muted-foreground">
            <span>{t('reachCount', { count: summary.counts.reach })}</span>
            <span>{t('matchCount', { count: summary.counts.match })}</span>
            <span>{t('safetyCount', { count: summary.counts.safety })}</span>
            {summary.missingCount > 0 && (
              <span>{t('missingCount', { count: summary.missingCount })}</span>
            )}
          </div>
        </div>
      )}

      <div className="mt-4 grid gap-3">
        <DiagnosisLine
          icon={Info}
          tone="info"
          label={t('recommendation')}
          text={t(`recommendations.${summary.recommendationKey}`, {
            reach: summary.counts.reach,
            match: summary.counts.match,
            safety: summary.counts.safety,
            reachRatio: summary.reachRatio,
          })}
        />
        <DiagnosisLine
          icon={summary.tone === 'ready' ? ShieldCheck : AlertTriangle}
          tone={summary.tone === 'ready' ? 'ready' : 'attention'}
          label={t('watchout')}
          text={t(`alerts.${summary.alertKey}`, {
            stale: summary.staleCount,
            selected: selectedCount,
          })}
        />
      </div>
    </section>
  );
}

function MiniStat({
  label,
  value,
  tone,
}: {
  label: string;
  value: string;
  tone?: 'ready' | 'attention' | 'blocked';
}) {
  return (
    <div className="min-w-0">
      <p className="text-2xs uppercase tracking-wide text-muted-foreground">{label}</p>
      <p
        className={cn(
          'mt-1 text-lg font-semibold text-metric',
          tone === 'ready' && 'text-success',
          tone === 'attention' && 'text-warning',
          tone === 'blocked' && 'text-muted-foreground'
        )}
      >
        {value}
      </p>
    </div>
  );
}

function DiagnosisLine({
  icon: Icon,
  label,
  text,
  tone,
}: {
  icon: LucideIcon;
  label: string;
  text: string;
  tone: 'info' | 'ready' | 'attention';
}) {
  return (
    <div className="flex items-start gap-3 rounded-[var(--theme-radius-button)] border bg-[color:var(--theme-control-bg)] px-3 py-2.5">
      <span
        className={cn(
          'mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full border',
          tone === 'info' && 'border-primary/20 bg-primary/10 text-primary',
          tone === 'ready' && 'border-success/20 bg-success/10 text-success',
          tone === 'attention' && 'border-warning/25 bg-warning/10 text-warning'
        )}
      >
        <Icon className="h-4 w-4" />
      </span>
      <p className="text-sm leading-relaxed text-foreground">
        <span className="font-semibold">{label}</span>
        <span className="mx-1 text-muted-foreground">-</span>
        <span className="text-muted-foreground">{text}</span>
      </p>
    </div>
  );
}
