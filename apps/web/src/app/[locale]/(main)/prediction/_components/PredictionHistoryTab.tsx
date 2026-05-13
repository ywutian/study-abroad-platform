'use client';

import { useMemo, useState } from 'react';
import type { ReactNode } from 'react';
import { useLocale, useTranslations } from 'next-intl';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { EmptyState } from '@/components/ui/empty-state';
import { Skeleton } from '@/components/ui/skeleton';
import { ResultFeedbackButtons } from '@/components/features/prediction';
import { usePredictionHistory, type PredictionHistoryItem } from '@/hooks/use-prediction';
import { cn, getSchoolName } from '@/lib/utils';
import {
  CalendarClock,
  ChevronLeft,
  ChevronRight,
  Clock3,
  Minus,
  RefreshCw,
  TrendingDown,
  TrendingUp,
} from 'lucide-react';

const TIER_STYLES = {
  reach: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300',
  match: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300',
  safety: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300',
} as const;

interface PredictionHistoryTabProps {
  onRefreshSchool?: (schoolId: string) => void;
  refreshingSchoolId?: string | null;
}

function formatProbability(value: number | null | undefined) {
  return value == null ? '--' : `${Math.round(value * 100)}%`;
}

function formatDelta(value: number | null | undefined, newLabel: string, pointsLabel: string) {
  if (value == null) return newLabel;
  const points = Math.round(value * 100);
  if (points === 0) return `0 ${pointsLabel}`;
  return `${points > 0 ? '+' : ''}${points} ${pointsLabel}`;
}

function humanizeCompactLabel(value?: string | null) {
  if (!value) return undefined;
  return value.replace(/[_-]+/g, ' ').trim();
}

function MiniTrend({ data }: { data: Array<{ probability: number | null; createdAt: string }> }) {
  const probabilities = data
    .slice()
    .reverse()
    .map((point) => point.probability)
    .filter((value): value is number => value != null);

  if (probabilities.length < 2) return <div className="h-9 rounded bg-muted/40" />;

  const width = 160;
  const height = 40;
  const min = Math.min(...probabilities) * 0.9;
  const max = Math.max(...probabilities) * 1.1 || 1;
  const range = max - min || 0.01;
  const points = probabilities.map((value, index) => {
    const x = (index / (probabilities.length - 1)) * width;
    const y = height - ((value - min) / range) * height;
    return `${x},${y}`;
  });
  const isUp = probabilities[probabilities.length - 1] >= probabilities[probabilities.length - 2];

  return (
    <svg viewBox={`0 0 ${width} ${height}`} className="h-9 w-full" role="img">
      <polyline
        points={points.join(' ')}
        fill="none"
        stroke={isUp ? 'rgb(16 185 129)' : 'rgb(244 63 94)'}
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth="3"
      />
    </svg>
  );
}

export function PredictionHistoryTab({
  onRefreshSchool,
  refreshingSchoolId,
}: PredictionHistoryTabProps) {
  const t = useTranslations('prediction');
  const locale = useLocale();
  const [page, setPage] = useState(1);
  const [selectedItem, setSelectedItem] = useState<PredictionHistoryItem | null>(null);
  const { data, isLoading } = usePredictionHistory(page, 20);

  const items = useMemo(() => data?.items ?? [], [data?.items]);
  const totalPages = data?.totalPages ?? 0;
  const stats = useMemo(() => {
    return {
      total: data?.total ?? 0,
      improved: items.filter((item) => item.trend === 'up').length,
      declined: items.filter((item) => item.trend === 'down').length,
      stale: items.filter((item) => item.stale).length,
      labeled: items.filter((item) => item.latestOutcomeLabel).length,
    };
  }, [data?.total, items]);

  if (isLoading) {
    return (
      <div className="space-y-3">
        {Array.from({ length: 5 }).map((_, i) => (
          <Skeleton key={i} className="h-24 w-full rounded-lg" />
        ))}
      </div>
    );
  }

  if (items.length === 0) {
    return (
      <EmptyState
        type="first-time"
        title={t('history.empty')}
        description={t('history.emptyDesc')}
      />
    );
  }

  return (
    <div className="space-y-4">
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
        <HistoryStat label={t('historyStats.formal')} value={stats.total} />
        <HistoryStat label={t('historyStats.improved')} value={stats.improved} tone="up" />
        <HistoryStat label={t('historyStats.declined')} value={stats.declined} tone="down" />
        <HistoryStat label={t('historyStats.stale')} value={stats.stale} tone="stale" />
        <HistoryStat label={t('historyStats.labeled')} value={stats.labeled} />
      </div>

      <Card className="py-0">
        <CardContent className="p-0">
          <div className="divide-y">
            {items.map((item) => {
              const schoolName = item.school ? getSchoolName(item.school, locale) : item.schoolId;
              const tier = item.tier as keyof typeof TIER_STYLES | undefined;
              const outcomeResult = item.latestOutcomeLabel?.result;
              const TrendIcon =
                item.trend === 'up' ? TrendingUp : item.trend === 'down' ? TrendingDown : Minus;

              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => setSelectedItem(item)}
                  className="grid w-full gap-3 p-4 text-left transition-colors hover:bg-muted/40 lg:grid-cols-[minmax(0,1.2fr)_130px_120px_160px_120px]"
                >
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="truncate font-medium">{schoolName}</span>
                      {tier && (
                        <Badge variant="secondary" className={cn('text-xs', TIER_STYLES[tier])}>
                          {t(`tier.${tier}`)}
                        </Badge>
                      )}
                      {item.stale && (
                        <Badge variant="warning" className="text-xs">
                          <Clock3 className="h-3 w-3" />
                          {t('historyStatus.stale')}
                        </Badge>
                      )}
                    </div>
                    <div className="mt-1 text-xs text-muted-foreground">
                      {new Date(item.updatedAt).toLocaleDateString(undefined, {
                        year: 'numeric',
                        month: 'short',
                        day: 'numeric',
                      })}
                      {item.roundContext && ` · ${humanizeCompactLabel(item.roundContext)}`}
                      {item.source && ` · ${item.source}`}
                    </div>
                  </div>

                  <HistoryCell
                    label={t('historyColumns.current')}
                    value={formatProbability(item.probability)}
                    strong
                  />
                  <HistoryCell
                    label={t('historyColumns.delta')}
                    value={formatDelta(
                      item.probabilityDelta,
                      t('historyStatus.new'),
                      t('historyStatus.points')
                    )}
                    tone={item.trend}
                    icon={<TrendIcon className="h-4 w-4" />}
                  />
                  <MiniTrend data={item.recentSnapshots} />
                  <div className="flex items-center gap-2 lg:justify-end">
                    {outcomeResult ? (
                      <Badge
                        variant={outcomeResult === 'ADMITTED' ? 'success' : 'outline'}
                        className="text-xs"
                      >
                        {t(`result.${outcomeResult.toLowerCase()}`)}
                      </Badge>
                    ) : (
                      <Badge variant="outline" className="text-xs">
                        {t('historyStatus.unlabeled')}
                      </Badge>
                    )}
                  </div>
                </button>
              );
            })}
          </div>
        </CardContent>
      </Card>

      {totalPages > 1 && (
        <div className="flex items-center justify-center gap-2">
          <Button
            variant="outline"
            size="sm"
            disabled={page <= 1}
            onClick={() => setPage((p) => Math.max(1, p - 1))}
          >
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <span className="text-sm text-muted-foreground">
            {page} / {totalPages}
          </span>
          <Button
            variant="outline"
            size="sm"
            disabled={page >= totalPages}
            onClick={() => setPage((p) => p + 1)}
          >
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
      )}

      <Dialog open={Boolean(selectedItem)} onOpenChange={(open) => !open && setSelectedItem(null)}>
        <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-2xl">
          {selectedItem && (
            <>
              <DialogHeader>
                <DialogTitle>
                  {selectedItem.school
                    ? getSchoolName(selectedItem.school, locale)
                    : selectedItem.schoolId}
                </DialogTitle>
                <DialogDescription>{t('historyDrawer.description')}</DialogDescription>
              </DialogHeader>

              <div className="space-y-4">
                <div className="grid gap-3 sm:grid-cols-3">
                  <HistoryStat
                    label={t('historyColumns.current')}
                    value={formatProbability(selectedItem.probability)}
                  />
                  <HistoryStat
                    label={t('historyColumns.previous')}
                    value={formatProbability(selectedItem.previousProbability)}
                  />
                  <HistoryStat
                    label={t('historyColumns.delta')}
                    value={formatDelta(
                      selectedItem.probabilityDelta,
                      t('historyStatus.new'),
                      t('historyStatus.points')
                    )}
                  />
                </div>

                <div className="rounded-[var(--theme-radius-button)] border bg-[color:var(--theme-control-bg)] p-3">
                  <div className="mb-2 flex items-center gap-2 text-sm font-medium">
                    <CalendarClock className="h-4 w-4 text-primary" />
                    {t('historyDrawer.timeline')}
                  </div>
                  <MiniTrend data={selectedItem.recentSnapshots} />
                  <div className="mt-3 space-y-2">
                    {selectedItem.recentSnapshots.map((snapshot) => (
                      <div key={snapshot.id} className="flex items-center justify-between text-sm">
                        <span className="text-muted-foreground">
                          {new Date(snapshot.createdAt).toLocaleDateString()}
                        </span>
                        <span className="font-medium">
                          {formatProbability(snapshot.probability)}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>

                {(selectedItem.confidenceReason || selectedItem.uncertaintyReasons?.length) && (
                  <div className="rounded-[var(--theme-radius-button)] border bg-[color:var(--theme-control-bg)] p-3 text-sm">
                    {selectedItem.confidenceReason && (
                      <p>
                        <span className="font-medium">{t('confidenceReasonLabel')}: </span>
                        {selectedItem.confidenceReason}
                      </p>
                    )}
                    {selectedItem.uncertaintyReasons?.length ? (
                      <ul className="mt-2 list-disc space-y-1 pl-5 text-muted-foreground">
                        {selectedItem.uncertaintyReasons.map((reason, index) => (
                          <li key={`${selectedItem.id}-uncertainty-${index}`}>{reason}</li>
                        ))}
                      </ul>
                    ) : null}
                  </div>
                )}

                <div className="flex flex-wrap gap-2">
                  {onRefreshSchool && (
                    <Button
                      variant="outline"
                      onClick={() => onRefreshSchool(selectedItem.schoolId)}
                      disabled={refreshingSchoolId === selectedItem.schoolId}
                      className="gap-2"
                    >
                      <RefreshCw
                        className={cn(
                          'h-4 w-4',
                          refreshingSchoolId === selectedItem.schoolId && 'animate-spin'
                        )}
                      />
                      {t('historyDrawer.refreshSchool')}
                    </Button>
                  )}
                </div>

                <ResultFeedbackButtons
                  schoolId={selectedItem.schoolId}
                  actualResult={selectedItem.latestOutcomeLabel?.result}
                />
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}

function HistoryStat({
  label,
  value,
  tone,
}: {
  label: string;
  value: number | string;
  tone?: 'up' | 'down' | 'stale';
}) {
  return (
    <div className="rounded-[var(--theme-radius-button)] border bg-[color:var(--theme-control-bg)] p-3">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p
        className={cn(
          'mt-1 text-2xl font-semibold text-metric',
          tone === 'up' && 'text-emerald-600',
          tone === 'down' && 'text-rose-600',
          tone === 'stale' && 'text-amber-600'
        )}
      >
        {value}
      </p>
    </div>
  );
}

function HistoryCell({
  label,
  value,
  strong,
  tone,
  icon,
}: {
  label: string;
  value: string;
  strong?: boolean;
  tone?: string;
  icon?: ReactNode;
}) {
  return (
    <div>
      <p className="text-xs text-muted-foreground">{label}</p>
      <p
        className={cn(
          'mt-1 flex items-center gap-1 text-sm',
          strong && 'text-lg font-semibold text-metric',
          tone === 'up' && 'text-emerald-600',
          tone === 'down' && 'text-rose-600'
        )}
      >
        {icon}
        {value}
      </p>
    </div>
  );
}
