'use client';

import { Link } from '@/lib/i18n/navigation';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import {
  BarChart3,
  Calculator,
  CheckCircle2,
  Clock3,
  ListChecks,
  Loader2,
  RefreshCw,
  UserRound,
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { useTranslations } from 'next-intl';

interface PredictionActionBarProps {
  completeness?: number;
  selectedCount: number;
  predictedCount: number;
  staleCount: number;
  hasProfileGaps: boolean;
  firstMissingLabel?: string;
  onRun: () => void;
  isRunning: boolean;
}

export function PredictionActionBar({
  completeness,
  selectedCount,
  predictedCount,
  staleCount,
  hasProfileGaps,
  firstMissingLabel,
  onRun,
  isRunning,
}: PredictionActionBarProps) {
  const t = useTranslations('prediction.workbench');
  const coverage =
    selectedCount > 0
      ? Math.round((Math.min(predictedCount, selectedCount) / selectedCount) * 100)
      : 0;
  const ctaLabel =
    predictedCount > 0 || staleCount > 0 ? t('refreshPredictions') : t('runPredictions');
  const CtaIcon = predictedCount > 0 || staleCount > 0 ? RefreshCw : Calculator;

  return (
    <section className="mb-4 rounded-[var(--theme-radius-card)] border border-primary/15 bg-[color:var(--theme-card-bg)] px-4 py-3 shadow-[var(--theme-card-shadow)]">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <div className="grid min-w-0 gap-2 sm:grid-cols-2 xl:grid-cols-4">
          <ActionMetric
            icon={UserRound}
            label={t('profile')}
            value={completeness != null ? `${completeness}%` : t('unknown')}
            tone={hasProfileGaps ? 'attention' : 'ready'}
            detail={
              hasProfileGaps && firstMissingLabel
                ? t('nextGap', { item: firstMissingLabel })
                : t('profileReady')
            }
          />
          <ActionMetric
            icon={ListChecks}
            label={t('selected')}
            value={String(selectedCount)}
            tone={selectedCount > 0 ? 'ready' : 'blocked'}
            detail={t('selectedDetail', { count: selectedCount })}
          />
          <ActionMetric
            icon={BarChart3}
            label={t('coverage')}
            value={`${coverage}%`}
            tone={coverage >= 80 ? 'ready' : selectedCount > 0 ? 'attention' : 'blocked'}
            detail={t('coverageDetail', { predicted: predictedCount, selected: selectedCount })}
          />
          <ActionMetric
            icon={Clock3}
            label={t('stale')}
            value={String(staleCount)}
            tone={staleCount > 0 ? 'attention' : 'ready'}
            detail={staleCount > 0 ? t('staleDetail', { count: staleCount }) : t('freshDetail')}
          />
        </div>

        <div className="flex shrink-0 flex-col gap-2 sm:flex-row lg:flex-col xl:flex-row">
          {hasProfileGaps && (
            <Button asChild variant="outline" className="gap-2">
              <Link href="/profile">
                <UserRound className="h-4 w-4" />
                {t('completeProfile')}
              </Link>
            </Button>
          )}
          <Button onClick={onRun} disabled={isRunning || selectedCount === 0} className="gap-2">
            {isRunning ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <CtaIcon className="h-4 w-4" />
            )}
            {isRunning ? t('running') : ctaLabel}
          </Button>
        </div>
      </div>
    </section>
  );
}

function ActionMetric({
  icon: Icon,
  label,
  value,
  detail,
  tone,
}: {
  icon: LucideIcon;
  label: string;
  value: string;
  detail: string;
  tone: 'ready' | 'attention' | 'blocked';
}) {
  return (
    <div className="flex min-w-0 items-center gap-3 rounded-[var(--theme-radius-button)] border bg-[color:var(--theme-control-bg)] px-3 py-2">
      <span
        className={cn(
          'flex h-9 w-9 shrink-0 items-center justify-center rounded-[var(--theme-radius-button)] border',
          tone === 'ready' && 'border-success/25 bg-success/10 text-success',
          tone === 'attention' && 'border-warning/25 bg-warning/10 text-warning',
          tone === 'blocked' && 'border-muted bg-muted text-muted-foreground'
        )}
      >
        {tone === 'ready' ? <CheckCircle2 className="h-4 w-4" /> : <Icon className="h-4 w-4" />}
      </span>
      <div className="min-w-0">
        <div className="flex items-center gap-2">
          <p className="truncate text-xs font-medium text-muted-foreground">{label}</p>
          <Badge
            variant={tone === 'ready' ? 'success' : tone === 'attention' ? 'warning' : 'secondary'}
          >
            {value}
          </Badge>
        </div>
        <p className="mt-0.5 text-xs leading-snug text-muted-foreground">{detail}</p>
      </div>
    </div>
  );
}
