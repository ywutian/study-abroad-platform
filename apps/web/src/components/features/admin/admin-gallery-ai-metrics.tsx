'use client';

/**
 * Admin · Gallery AI metrics — closes the feedback/observability loop for the
 * 文书库 AI. Surfaces the previously write-only signals: NOT_HELPFUL `category`
 * breakdown, the free-text `notes`, and a per-essay failure drill-down.
 */
import { useCallback, useEffect, useState } from 'react';
import { useTranslations } from 'next-intl';
import { MessageSquareWarning, RefreshCw } from 'lucide-react';

import { apiClient } from '@/lib/api/client';
import { adminEssayGalleryAIRoutes } from '@study-abroad/shared';
import type { AdminEssayGalleryAIMetricsResponse } from '@study-abroad/shared';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { toast } from 'sonner';

function Stat({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="rounded-lg border border-border bg-card p-3">
      <div className="text-caption text-muted-foreground">{label}</div>
      <div className="mt-1 text-title font-semibold text-foreground">{value}</div>
    </div>
  );
}

export function AdminGalleryAiMetrics() {
  const t = useTranslations('essayAdmin');
  const [data, setData] = useState<AdminEssayGalleryAIMetricsResponse | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const res = await apiClient.get<AdminEssayGalleryAIMetricsResponse>(
        adminEssayGalleryAIRoutes.metrics()
      );
      setData(res);
    } catch {
      toast.error(t('galleryAi.loadFailed'));
    } finally {
      setLoading(false);
    }
  }, [t]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  if (loading && !data) {
    return (
      <div className="grid gap-3 sm:grid-cols-3">
        {Array.from({ length: 6 }).map((_, i) => (
          <Skeleton key={i} className="h-20" />
        ))}
      </div>
    );
  }

  if (!data) return null;

  const pct = (n: number) => `${Math.round(n * 100)}%`;

  return (
    <div className="space-y-6">
      <div className="flex justify-end">
        <Button variant="outline" size="sm" onClick={fetchData} disabled={loading}>
          <RefreshCw className={`mr-2 h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
          {t('galleryAi.refresh')}
        </Button>
      </div>

      <div className="grid gap-3 sm:grid-cols-3 lg:grid-cols-6">
        <Stat label={t('galleryAi.interactions')} value={data.totals.interactions} />
        <Stat label={t('galleryAi.questions')} value={data.totals.questions} />
        <Stat label={t('galleryAi.compares')} value={data.totals.compares} />
        <Stat label={t('galleryAi.helpfulRate')} value={pct(data.rates.helpfulRate)} />
        <Stat label={t('galleryAi.failureRate')} value={pct(data.rates.failureRate)} />
        <Stat label={t('galleryAi.avgTokens')} value={data.tokens.average} />
      </div>

      <div className="grid gap-3 sm:grid-cols-3">
        <Stat label={t('galleryAi.succeeded')} value={data.totals.succeeded} />
        <Stat label={t('galleryAi.failed')} value={data.totals.failed} />
        <Stat label={t('galleryAi.refunded')} value={data.totals.refunded} />
      </div>

      {/* NOT_HELPFUL category breakdown — gives `category` a reader */}
      <Card>
        <CardContent className="p-4">
          <h3 className="mb-3 text-body font-semibold text-foreground">
            {t('galleryAi.feedbackByCategory')}
          </h3>
          {data.feedbackByCategory.length === 0 ? (
            <p className="text-caption text-muted-foreground">{t('galleryAi.noNegative')}</p>
          ) : (
            <ul className="space-y-2">
              {data.feedbackByCategory.map((row) => (
                <li key={row.category} className="flex items-center justify-between">
                  <span className="text-body-sm text-foreground">
                    {t(`galleryAi.category.${row.category}`)}
                  </span>
                  <span className="rounded-full bg-rose-50 px-2 py-0.5 text-caption font-medium text-rose-700 dark:bg-rose-950/40 dark:text-rose-300">
                    {row.count}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>

      {/* Free-text notes on negative feedback — the qualitative triage signal */}
      <Card>
        <CardContent className="p-4">
          <h3 className="mb-3 flex items-center gap-2 text-body font-semibold text-foreground">
            <MessageSquareWarning className="h-4 w-4 text-amber-500" />
            {t('galleryAi.recentNotHelpful')}
          </h3>
          {data.recentNotHelpful.length === 0 ? (
            <p className="text-caption text-muted-foreground">{t('galleryAi.noNotes')}</p>
          ) : (
            <ul className="space-y-3">
              {data.recentNotHelpful.map((row) => (
                <li key={row.interactionId} className="rounded-lg border border-border p-3">
                  <div className="flex items-center gap-2 text-caption text-muted-foreground">
                    <span className="rounded bg-muted px-1.5 py-0.5 font-medium">
                      {t(`galleryAi.type.${row.type}`)}
                    </span>
                    {row.category && <span>{t(`galleryAi.category.${row.category}`)}</span>}
                    <span className="ml-auto">{new Date(row.createdAt).toLocaleDateString()}</span>
                  </div>
                  {row.notes ? (
                    <p className="mt-1.5 text-body-sm text-foreground">{row.notes}</p>
                  ) : (
                    <p className="mt-1.5 text-caption italic text-muted-foreground">
                      {t('galleryAi.noteEmpty')}
                    </p>
                  )}
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>

      {/* Per-essay failure drill-down — actionable */}
      <Card>
        <CardContent className="p-4">
          <h3 className="mb-3 text-body font-semibold text-foreground">
            {t('galleryAi.topFailingEssays')}
          </h3>
          {data.topFailingEssays.length === 0 ? (
            <p className="text-caption text-muted-foreground">{t('galleryAi.noFailures')}</p>
          ) : (
            <ul className="space-y-2">
              {data.topFailingEssays.map((row) => (
                <li
                  key={row.essayId}
                  className="flex items-center justify-between gap-2 text-body-sm"
                >
                  <span className="min-w-0 truncate font-mono text-caption text-muted-foreground">
                    {row.essayId}
                  </span>
                  <span className="shrink-0 text-foreground">
                    {t('galleryAi.failedOfTotal', { failed: row.failed, total: row.total })}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>

      <p className="text-caption text-muted-foreground">
        {t('galleryAi.missingCoverage', {
          missing: data.learningNotes.missingCount,
          total: data.learningNotes.publicEssayCount,
        })}
      </p>
    </div>
  );
}
