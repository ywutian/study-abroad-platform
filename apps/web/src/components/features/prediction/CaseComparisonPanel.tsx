'use client';

import { memo, useState } from 'react';
import { useTranslations } from 'next-intl';
import { useQuery } from '@tanstack/react-query';
import { Users, AlertCircle } from 'lucide-react';
import { apiClient } from '@/lib/api';
import { qk } from '@/lib/query';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

interface SimilarCase {
  id: string;
  school: string;
  year?: number;
  round?: string;
  result: 'ADMITTED' | 'REJECTED' | 'WAITLISTED' | 'DEFERRED';
  gpaRange?: string;
  satRange?: string;
  major?: string;
  tags: string[];
  demographicTags: string[];
  nationality?: string;
  activitySummary: string;
}

interface SimilarCasesResponse {
  status: 'OK' | 'INSUFFICIENT_DATA';
  count: number;
  minRequired: number;
  nationalityMatched: boolean;
  breakdown: { admitted: number; rejected: number; waitlisted: number };
  cases: SimilarCase[];
}

interface CaseComparisonPanelProps {
  schoolId: string;
}

const RESULT_STYLE: Record<string, { dot: string; badge: string }> = {
  ADMITTED: {
    dot: 'bg-emerald-500',
    badge:
      'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400 border-emerald-200',
  },
  REJECTED: {
    dot: 'bg-rose-500',
    badge: 'bg-rose-100 text-rose-700 dark:bg-rose-900/30 dark:text-rose-400 border-rose-200',
  },
  WAITLISTED: {
    dot: 'bg-amber-500',
    badge: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400 border-amber-200',
  },
  DEFERRED: {
    dot: 'bg-slate-400',
    badge: 'bg-muted text-muted-foreground border-border',
  },
};

/**
 * "Students with a profile like yours who applied here" — real admission
 * cases shown alongside a prediction. Honest by design: when fewer than the
 * server-side minimum match, it shows the count factually and renders NO
 * verdict — it never extrapolates from a tiny sample.
 */
export const CaseComparisonPanel = memo(function CaseComparisonPanel({
  schoolId,
}: CaseComparisonPanelProps) {
  const t = useTranslations('cases');
  const tResult = useTranslations('cases.result');
  const [showAll, setShowAll] = useState(false);

  const { data, isLoading, isError } = useQuery<SimilarCasesResponse>({
    queryKey: qk.cases.similar(schoolId),
    queryFn: () =>
      apiClient.get<SimilarCasesResponse>(
        `/cases/similar?schoolId=${encodeURIComponent(schoolId)}`
      ),
  });

  if (isLoading) {
    return (
      <div className="space-y-2">
        <Skeleton className="h-6 w-full" />
        <Skeleton className="h-12 w-full" />
        <Skeleton className="h-12 w-full" />
      </div>
    );
  }

  if (isError || !data) {
    return <p className="text-sm text-muted-foreground">{t('comparisonLoadError')}</p>;
  }

  // Honest empty / insufficient state — never render a verdict from a tiny
  // sample. Also covers a malformed/empty response (status not 'OK' or no
  // breakdown) so a bad payload degrades gracefully instead of crashing.
  if (data.status !== 'OK' || !data.breakdown) {
    return (
      <div className="flex items-start gap-2.5 rounded-lg border border-dashed bg-muted/30 p-3">
        <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" />
        <div className="min-w-0 space-y-0.5">
          <p className="text-sm font-medium text-foreground">{t('insufficientTitle')}</p>
          <p className="text-xs text-muted-foreground">
            {data.count > 0
              ? t('insufficientDescWithCount', { count: data.count })
              : t('insufficientDesc')}
          </p>
        </div>
      </div>
    );
  }

  const { breakdown, count } = data;
  const total = breakdown.admitted + breakdown.rejected + breakdown.waitlisted || 1;
  const allCases = data.cases ?? [];
  const visibleCases = showAll ? allCases : allCases.slice(0, 5);

  return (
    <div className="min-w-0 space-y-3">
      {/* Outcome summary */}
      <div className="space-y-1.5">
        <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
          <Users className="h-3.5 w-3.5 shrink-0" />
          {t('comparisonSummary', {
            admitted: breakdown.admitted,
            rejected: breakdown.rejected,
            waitlisted: breakdown.waitlisted,
          })}
        </p>
        <div className="flex h-2 w-full overflow-hidden rounded-full bg-muted">
          <div
            className="bg-emerald-500"
            style={{ width: `${(breakdown.admitted / total) * 100}%` }}
          />
          <div
            className="bg-amber-500"
            style={{ width: `${(breakdown.waitlisted / total) * 100}%` }}
          />
          <div
            className="bg-rose-500"
            style={{ width: `${(breakdown.rejected / total) * 100}%` }}
          />
        </div>
      </div>

      {!data.nationalityMatched && (
        <p className="text-xs text-muted-foreground">{t('crossNationalityNote')}</p>
      )}

      {/* Case rows */}
      <ul className="space-y-2">
        {visibleCases.map((c) => {
          const style = RESULT_STYLE[c.result] ?? RESULT_STYLE.DEFERRED;
          return (
            <li key={c.id} className="min-w-0 rounded-lg border bg-background p-2.5 text-sm">
              <div className="flex items-center justify-between gap-2">
                <div className="flex min-w-0 items-center gap-2">
                  <span className={cn('h-2 w-2 shrink-0 rounded-full', style.dot)} />
                  <span className="truncate text-xs text-muted-foreground">
                    {[c.gpaRange && `GPA ${c.gpaRange}`, c.satRange && `SAT ${c.satRange}`, c.major]
                      .filter(Boolean)
                      .join(' · ')}
                  </span>
                </div>
                <Badge variant="outline" className={cn('shrink-0 text-xs', style.badge)}>
                  {tResult(c.result.toLowerCase())}
                </Badge>
              </div>
              {(c.tags.length > 0 || c.demographicTags.length > 0) && (
                <div className="mt-1.5 flex min-w-0 flex-wrap gap-1">
                  {[...c.demographicTags, ...c.tags].slice(0, 5).map((tag) => (
                    <Badge key={tag} variant="secondary" className="text-2xs">
                      {tag}
                    </Badge>
                  ))}
                </div>
              )}
              {c.activitySummary && (
                <p className="mt-1 line-clamp-1 text-xs text-muted-foreground">
                  {c.activitySummary}
                </p>
              )}
            </li>
          );
        })}
      </ul>

      {count > 5 && (
        <Button
          variant="ghost"
          size="sm"
          onClick={() => setShowAll((v) => !v)}
          className="h-7 px-2 text-xs"
        >
          {showAll ? t('viewLess') : t('viewAll', { count })}
        </Button>
      )}
    </div>
  );
});
