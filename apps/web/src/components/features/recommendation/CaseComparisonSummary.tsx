'use client';

import { useState } from 'react';
import { useTranslations } from 'next-intl';
import { Badge } from '@/components/ui/badge';
import { ChevronDown, Users, TrendingUp, TrendingDown } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { CaseComparison, CohortStats } from '@study-abroad/shared';

interface CaseComparisonSummaryProps {
  comparison: CaseComparison;
}

export function CaseComparisonSummary({ comparison }: CaseComparisonSummaryProps) {
  const t = useTranslations('recommendation.caseComparison');
  const [expanded, setExpanded] = useState(false);

  const { admitted, rejected, nationalitySubset } = comparison;

  return (
    <div className="rounded-lg border border-border/60 bg-muted/30">
      <button
        type="button"
        onClick={() => setExpanded(!expanded)}
        className="flex w-full items-center justify-between px-3 py-2 text-left hover:bg-muted/50 transition-colors rounded-lg"
      >
        <div className="flex items-center gap-2">
          <Users className="h-3.5 w-3.5 text-muted-foreground" />
          <span className="text-xs font-medium">{t('title')}</span>
          <Badge variant="outline" className="text-2xs font-normal px-1.5 py-0">
            {comparison.totalCases} {t('cases')}
          </Badge>
        </div>
        <ChevronDown
          className={cn(
            'h-3.5 w-3.5 text-muted-foreground transition-transform',
            expanded && 'rotate-180'
          )}
        />
      </button>

      {expanded && (
        <div className="border-t border-border/60 px-3 py-2.5 space-y-2.5">
          {/* Admitted vs Rejected stats */}
          <div className="grid grid-cols-2 gap-2">
            <CohortCard label={t('admitted')} stats={admitted} variant="success" />
            <CohortCard label={t('rejected')} stats={rejected} variant="destructive" />
          </div>

          {/* GPA comparison bar */}
          {admitted.gpaMedian != null && rejected.gpaMedian != null && (
            <ComparisonRow
              label={t('gpaMedian')}
              admittedValue={admitted.gpaMedian}
              rejectedValue={rejected.gpaMedian}
              format={(v) => v.toFixed(2)}
            />
          )}

          {/* SAT comparison bar */}
          {admitted.satMedian != null && rejected.satMedian != null && (
            <ComparisonRow
              label={t('satMedian')}
              admittedValue={admitted.satMedian}
              rejectedValue={rejected.satMedian}
              format={(v) => v.toString()}
            />
          )}

          {/* Common traits */}
          {admitted.topTags && admitted.topTags.length > 0 && (
            <div className="space-y-1">
              <div className="flex items-center gap-1 text-2xs text-success font-medium">
                <TrendingUp className="h-3 w-3" />
                {t('admittedTraits')}
              </div>
              <div className="flex flex-wrap gap-1">
                {admitted.topTags.map((tag) => (
                  <Badge
                    key={tag}
                    variant="outline"
                    className="text-2xs px-1.5 py-0 bg-success/5 text-success border-success/20"
                  >
                    {tag}
                  </Badge>
                ))}
              </div>
            </div>
          )}

          {rejected.topTags && rejected.topTags.length > 0 && (
            <div className="space-y-1">
              <div className="flex items-center gap-1 text-2xs text-destructive font-medium">
                <TrendingDown className="h-3 w-3" />
                {t('rejectedTraits')}
              </div>
              <div className="flex flex-wrap gap-1">
                {rejected.topTags.map((tag) => (
                  <Badge
                    key={tag}
                    variant="outline"
                    className="text-2xs px-1.5 py-0 bg-destructive/5 text-destructive border-destructive/20"
                  >
                    {tag}
                  </Badge>
                ))}
              </div>
            </div>
          )}

          {/* Nationality subset */}
          {nationalitySubset && (
            <div className="border-t border-border/40 pt-2 space-y-1.5">
              <p className="text-2xs font-medium text-muted-foreground">
                {t('nationalityData', { nationality: nationalitySubset.nationality })}
              </p>
              <div className="grid grid-cols-2 gap-2">
                <CohortCard
                  label={t('admitted')}
                  stats={nationalitySubset.admitted}
                  variant="success"
                  compact
                />
                <CohortCard
                  label={t('rejected')}
                  stats={nationalitySubset.rejected}
                  variant="destructive"
                  compact
                />
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function CohortCard({
  label,
  stats,
  variant,
  compact,
}: {
  label: string;
  stats: CohortStats;
  variant: 'success' | 'destructive';
  compact?: boolean;
}) {
  const isSuccess = variant === 'success';

  return (
    <div
      className={cn(
        'rounded-md border px-2 py-1.5',
        isSuccess ? 'border-success/20 bg-success/5' : 'border-destructive/20 bg-destructive/5'
      )}
    >
      <div className="flex items-center justify-between">
        <span
          className={cn('text-2xs font-medium', isSuccess ? 'text-success' : 'text-destructive')}
        >
          {label}
        </span>
        <span className="text-2xs text-muted-foreground">n={stats.count}</span>
      </div>
      {!compact && (
        <div className="mt-1 space-y-0.5">
          {stats.gpaMedian != null && (
            <p className="text-2xs text-muted-foreground">
              GPA {stats.gpaMedian.toFixed(2)}
              {stats.gpaP25 != null && (
                <span className="opacity-70">
                  {' '}
                  ({stats.gpaP25.toFixed(2)}-{stats.gpaP75?.toFixed(2)})
                </span>
              )}
            </p>
          )}
          {stats.satMedian != null && (
            <p className="text-2xs text-muted-foreground">
              SAT {stats.satMedian}
              {stats.satP25 != null && (
                <span className="opacity-70">
                  {' '}
                  ({stats.satP25}-{stats.satP75})
                </span>
              )}
            </p>
          )}
        </div>
      )}
    </div>
  );
}

function ComparisonRow({
  label,
  admittedValue,
  rejectedValue,
  format,
}: {
  label: string;
  admittedValue: number;
  rejectedValue: number;
  format: (v: number) => string;
}) {
  const diff = admittedValue - rejectedValue;
  const diffSign = diff > 0 ? '+' : '';

  return (
    <div className="flex items-center justify-between text-2xs">
      <span className="text-muted-foreground">{label}</span>
      <div className="flex items-center gap-2">
        <span className="text-success font-medium">{format(admittedValue)}</span>
        <span className="text-muted-foreground">vs</span>
        <span className="text-destructive font-medium">{format(rejectedValue)}</span>
        {diff !== 0 && (
          <span className="text-muted-foreground/70">
            ({diffSign}
            {format(diff)})
          </span>
        )}
      </div>
    </div>
  );
}
