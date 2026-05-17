'use client';

/**
 * Hall refactor Stage 3 — 中国大陆录取数据中心
 *
 * Dashboard-form surface (vs the Cases page's instance-browser form):
 * per-school China-mainland admit trend cards, each carrying a
 * year-over-year difficulty signal and an A/B/C/D data-reliability rating.
 *
 * Numbers below the reliability threshold (D) are deliberately hidden —
 * the platform never renders a misleading "admit count" off 0 samples.
 */

import { useMemo } from 'react';
import { useTranslations, useLocale } from 'next-intl';
import { motion } from 'framer-motion';
import {
  Loader2,
  ShieldCheck,
  TrendingDown,
  TrendingUp,
  Minus,
  Info,
  Target,
  Sparkles,
} from 'lucide-react';
import type { DifficultySignal, DifficultySignalEntry } from '@study-abroad/shared';
import { AgentType } from '@study-abroad/shared';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { getLocalizedName } from '@/lib/i18n/locale-utils';
import { cn } from '@/lib/utils';
import { useRouter } from '@/lib/i18n/navigation';
import { openFloatingAgentChat } from '@/components/features/agent-chat/floating-chat-bridge';
import { useChinaAdmitTrend, useDifficultySignal } from '@/hooks/use-hall-api';

const RELIABILITY_STYLES: Record<string, string> = {
  A: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300',
  B: 'bg-blue-100 text-blue-700 dark:bg-blue-950/40 dark:text-blue-300',
  C: 'bg-amber-100 text-amber-700 dark:bg-amber-950/40 dark:text-amber-300',
  D: 'bg-muted text-muted-foreground',
};

const SIGNAL_STYLES: Record<
  DifficultySignal,
  { icon: typeof TrendingDown; dot: string; text: string }
> = {
  stable: {
    icon: Minus,
    dot: 'bg-emerald-500',
    text: 'text-emerald-600 dark:text-emerald-400',
  },
  declining: {
    icon: TrendingDown,
    dot: 'bg-amber-500',
    text: 'text-amber-600 dark:text-amber-400',
  },
  surging: {
    icon: TrendingUp,
    dot: 'bg-rose-500',
    text: 'text-rose-600 dark:text-rose-400',
  },
};

export function ChinaAdmitDashboard() {
  const t = useTranslations('verifiedRanking.dashboard');
  const tx = useTranslations('verifiedRanking.crossLink');
  const locale = useLocale();
  const router = useRouter();

  const { data: trend, isLoading } = useChinaAdmitTrend([], 4);
  const { data: signals } = useDifficultySignal([]);

  const signalMap = useMemo(() => {
    const m = new Map<string, DifficultySignalEntry>();
    (signals ?? []).forEach((s) => m.set(s.schoolId, s));
    return m;
  }, [signals]);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-40">
        <Loader2 className="h-7 w-7 animate-spin text-primary" />
      </div>
    );
  }

  const schools = trend?.schools ?? [];
  const lastUpdated = trend?.lastUpdated
    ? new Date(trend.lastUpdated).toLocaleDateString(locale)
    : '—';

  return (
    <div className="mb-8">
      {/* Data transparency banner — QW-1 */}
      <div className="mb-4 flex flex-wrap items-center gap-2 rounded-xl border border-indigo-200 bg-indigo-50 px-4 py-3 text-sm dark:border-indigo-900/50 dark:bg-indigo-950/30">
        <ShieldCheck className="h-4 w-4 shrink-0 text-indigo-600 dark:text-indigo-400" />
        <span className="min-w-0 text-indigo-900 dark:text-indigo-200">
          {t('banner', { count: schools.length, date: lastUpdated })}
        </span>
      </div>

      {schools.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12 text-center">
            <h3 className="font-semibold">{t('emptyTitle')}</h3>
            <p className="mt-1 text-sm text-muted-foreground">{t('emptyBody')}</p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {schools.map((s, i) => {
            const signal = signalMap.get(s.schoolId);
            const sig = SIGNAL_STYLES[signal?.signal ?? 'stable'];
            const SignalIcon = sig.icon;
            const maxAdmit = Math.max(1, ...s.yearly.map((y) => y.admitted));
            return (
              <motion.div
                key={s.schoolId}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: Math.min(i * 0.03, 0.3) }}
              >
                <Card className="h-full">
                  <CardContent className="flex h-full flex-col gap-3 p-4">
                    {/* Header: school name + difficulty dot */}
                    <div className="flex items-start gap-2">
                      <span
                        className={cn('mt-1.5 h-2 w-2 shrink-0 rounded-full', sig.dot)}
                        aria-hidden
                      />
                      <div className="min-w-0 flex-1">
                        <p className="truncate font-semibold">
                          {getLocalizedName(s.schoolNameZh, s.schoolName, locale)}
                        </p>
                        {s.schoolRank ? (
                          <p className="text-xs text-muted-foreground">
                            {t('rank', { rank: s.schoolRank })}
                          </p>
                        ) : null}
                      </div>
                      <span
                        className={cn(
                          'shrink-0 rounded-md px-1.5 py-0.5 text-xs font-bold',
                          RELIABILITY_STYLES[s.reliability],
                        )}
                        title={t(`reliability.${s.reliability}`)}
                      >
                        {s.reliability}
                      </span>
                    </div>

                    {/* 4-year mini bar chart */}
                    {s.reliability === 'D' ? (
                      <p className="text-xs text-muted-foreground">{t('noChinaData')}</p>
                    ) : (
                      <div className="flex items-end gap-1.5">
                        {s.yearly.map((y) => (
                          <div key={y.year} className="flex flex-1 flex-col items-center gap-1">
                            <span className="text-xs font-medium tabular-nums">
                              {y.admitted}
                            </span>
                            <div
                              className="w-full rounded-t bg-indigo-500/80 dark:bg-indigo-400/80"
                              style={{
                                height: `${Math.round((y.admitted / maxAdmit) * 40) + 4}px`,
                              }}
                            />
                            <span className="text-[10px] text-muted-foreground">
                              {String(y.year).slice(2)}
                            </span>
                          </div>
                        ))}
                      </div>
                    )}

                    {/* Difficulty signal label */}
                    <div className={cn('mt-auto flex items-center gap-1.5 text-xs', sig.text)}>
                      <SignalIcon className="h-3.5 w-3.5" />
                      <span>{t(`signal.${signal?.signal ?? 'stable'}`)}</span>
                      {signal && signal.changePct !== 0 ? (
                        <span className="text-muted-foreground">
                          ({signal.changePct > 0 ? '+' : ''}
                          {signal.changePct}%)
                        </span>
                      ) : null}
                    </div>
                  </CardContent>
                </Card>
              </motion.div>
            );
          })}
        </div>
      )}

      {/* Stage 7 B2/B7 — cross-links to prediction + agent chat */}
      <div className="mt-4 flex flex-col gap-3 rounded-xl border bg-card p-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="min-w-0">
          <p className="font-medium">{tx('predictTitle')}</p>
          <p className="text-sm text-muted-foreground">{tx('predictBody')}</p>
        </div>
        <div className="flex shrink-0 flex-wrap gap-2">
          <Button
            variant="outline"
            size="sm"
            className="gap-1.5"
            onClick={() =>
              openFloatingAgentChat({
                message: tx('askAi'),
                agentHint: AgentType.SCHOOL,
              })
            }
          >
            <Sparkles className="h-4 w-4" />
            {tx('askAi')}
          </Button>
          <Button
            size="sm"
            className="gap-1.5"
            onClick={() => router.push('/prediction')}
          >
            <Target className="h-4 w-4" />
            {tx('predictCta')}
          </Button>
        </div>
      </div>

      {/* Stage 6 — compliance disclaimer */}
      <p className="mt-3 flex items-start gap-1.5 text-xs text-muted-foreground">
        <Info className="mt-0.5 h-3.5 w-3.5 shrink-0" />
        <span className="min-w-0">{t('disclaimer')}</span>
      </p>
    </div>
  );
}
