'use client';

import { useState } from 'react';
import { useTranslations } from 'next-intl';
import { CalendarClock, ChevronRight } from 'lucide-react';
import { outcomeRoutes } from '@study-abroad/shared';

import { Button } from '@/components/ui/button';
import { apiClient } from '@/lib/api';
import { useAuthGatedQuery } from '@/hooks/use-auth-gated-query';

import { ReportOutcomeModal } from './report-outcome-modal';

interface PendingDecision {
  predictionResultId: string;
  schoolId: string;
  schoolName: string;
  probability: number;
  tier: string | null;
  applicationRound: string | null;
  predictedAt: string;
}

/**
 * M6.3: Dashboard banner that surfaces predictions awaiting outcome reports.
 *
 * Displays on the dashboard above main content if user has at least one
 * prediction without a reported outcome. Each card triggers the report modal.
 */
export function OutcomePendingBanner() {
  const t = useTranslations('Outcome');
  const [selectedPrediction, setSelectedPrediction] = useState<PendingDecision | null>(null);

  // Auth-gated: don't fire before AuthInitializer restores the in-memory token,
  // otherwise this authed query 401-races on first paint (#145/#222 class).
  const { data: pending } = useAuthGatedQuery<PendingDecision[]>({
    queryKey: ['pending-decisions'],
    queryFn: () => apiClient.get<PendingDecision[]>(outcomeRoutes.pendingDecisions()),
    staleTime: 5 * 60 * 1000, // 5 min
  });

  if (!pending || pending.length === 0) return null;

  const showCount = Math.min(3, pending.length);
  const hasMore = pending.length > showCount;

  return (
    <>
      <div className="rounded-xl border bg-gradient-to-br from-amber-50 to-rose-50 dark:from-amber-950/30 dark:to-rose-950/30 p-5 shadow-sm">
        <div className="flex items-start gap-3">
          <div className="rounded-full bg-amber-100 dark:bg-amber-900/40 p-2">
            <CalendarClock className="h-5 w-5 text-amber-700 dark:text-amber-300" />
          </div>
          <div className="flex-1 min-w-0">
            <h3 className="font-semibold text-foreground">
              {t('bannerTitle', { count: pending.length })}
            </h3>
            <p className="text-sm text-muted-foreground mt-1">{t('bannerDescription')}</p>

            <div className="mt-3 grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
              {pending.slice(0, showCount).map((p) => (
                <button
                  key={p.predictionResultId}
                  type="button"
                  onClick={() => setSelectedPrediction(p)}
                  className="group flex items-center justify-between gap-2 rounded-lg border bg-card p-3 text-left transition-colors hover:bg-muted min-w-0"
                >
                  <div className="min-w-0 flex-1">
                    <p className="font-medium text-sm truncate">{p.schoolName}</p>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      {p.applicationRound ?? 'RD'} · {t('predicted')}{' '}
                      {(p.probability * 100).toFixed(0)}%
                    </p>
                  </div>
                  <ChevronRight className="h-4 w-4 text-muted-foreground shrink-0 group-hover:text-foreground" />
                </button>
              ))}
            </div>

            {hasMore && (
              <Button
                variant="link"
                size="sm"
                className="mt-2 px-0 h-auto"
                onClick={() => {
                  // For MVP: just show all pending in modal (extend later to a dedicated page)
                  setSelectedPrediction(pending[showCount]);
                }}
              >
                {t('seeMore', { count: pending.length - showCount })}
              </Button>
            )}
          </div>
        </div>
      </div>

      {selectedPrediction && (
        <ReportOutcomeModal
          open={selectedPrediction !== null}
          onOpenChange={(open) => !open && setSelectedPrediction(null)}
          predictionResultId={selectedPrediction.predictionResultId}
          schoolName={selectedPrediction.schoolName}
          probability={selectedPrediction.probability}
          round={selectedPrediction.applicationRound}
        />
      )}
    </>
  );
}
