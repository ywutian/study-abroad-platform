'use client';

import { useState } from 'react';
import { useTranslations } from 'next-intl';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { EmptyState } from '@/components/ui/empty-state';
import { Skeleton } from '@/components/ui/skeleton';
import { usePredictionHistory } from '@/hooks/use-prediction';
import { History, ChevronLeft, ChevronRight, TrendingUp, TrendingDown, Minus } from 'lucide-react';
import { cn } from '@/lib/utils';

const TIER_STYLES = {
  reach: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300',
  match: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300',
  safety: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300',
} as const;

interface PredictionHistoryItem {
  id: string;
  schoolId: string;
  schoolName?: string;
  probability: number;
  tier?: string;
  confidence?: string;
  confidenceReason?: string;
  roundContext?: string;
  cohortKey?: string;
  source?: string;
  sourceSummary?: string | { primary?: string };
  uncertaintyReasons?: string[];
  modelVersion?: string;
  actualResult?: string;
  latestOutcomeLabel?: {
    result: string;
    status?: string;
  };
  createdAt: string;
  updatedAt: string;
}

function humanizeCompactLabel(value: string) {
  return value.replace(/[_-]+/g, ' ').trim();
}

export function PredictionHistoryTab() {
  const t = useTranslations('prediction');
  const [page, setPage] = useState(1);
  const { data, isLoading } = usePredictionHistory(page, 20) as {
    data?: { items: PredictionHistoryItem[]; totalPages: number };
    isLoading: boolean;
  };

  const items = data?.items ?? [];
  const totalPages = data?.totalPages ?? 0;

  if (isLoading) {
    return (
      <div className="space-y-3">
        {Array.from({ length: 5 }).map((_, i) => (
          <Skeleton key={i} className="h-20 w-full rounded-lg" />
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
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-base">
            <History className="h-4 w-4" />
            {t('history.title')}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          {items.map((item) => {
            const prob = Math.round(item.probability * 100);
            const tier = item.tier as keyof typeof TIER_STYLES | undefined;
            const tierStyle = tier ? TIER_STYLES[tier] : undefined;
            const outcomeResult = item.latestOutcomeLabel?.result ?? item.actualResult;

            return (
              <div
                key={item.id}
                className="flex items-center justify-between p-3 rounded-lg border bg-card hover:bg-muted/50 transition-colors"
              >
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="font-medium truncate">{item.schoolName || item.schoolId}</span>
                    {tierStyle && (
                      <Badge variant="secondary" className={cn('text-xs', tierStyle)}>
                        {t(`tier.${tier}`)}
                      </Badge>
                    )}
                    {outcomeResult && (
                      <Badge
                        variant={outcomeResult === 'ADMITTED' ? 'default' : 'outline'}
                        className="text-xs"
                      >
                        {t(`result.${outcomeResult.toLowerCase()}`)}
                      </Badge>
                    )}
                  </div>
                  <div className="text-xs text-muted-foreground mt-1">
                    {new Date(item.updatedAt).toLocaleDateString(undefined, {
                      year: 'numeric',
                      month: 'short',
                      day: 'numeric',
                    })}
                    {item.roundContext && ` · ${humanizeCompactLabel(item.roundContext)}`}
                    {item.source && ` · ${item.source}`}
                  </div>
                </div>
                <div className="flex items-center gap-2 shrink-0 ml-3">
                  <span
                    className={cn(
                      'text-lg font-bold tabular-nums',
                      prob >= 60
                        ? 'text-emerald-600 dark:text-emerald-400'
                        : prob >= 30
                          ? 'text-amber-600 dark:text-amber-400'
                          : 'text-red-600 dark:text-red-400'
                    )}
                  >
                    {prob}%
                  </span>
                  {prob >= 60 ? (
                    <TrendingUp className="h-4 w-4 text-emerald-500" />
                  ) : prob >= 30 ? (
                    <Minus className="h-4 w-4 text-amber-500" />
                  ) : (
                    <TrendingDown className="h-4 w-4 text-red-500" />
                  )}
                </div>
              </div>
            );
          })}
        </CardContent>
      </Card>

      {/* Pagination */}
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
    </div>
  );
}
