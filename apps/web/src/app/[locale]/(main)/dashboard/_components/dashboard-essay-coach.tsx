'use client';

import { useLocale, useTranslations } from 'next-intl';
import { ArrowRight, FileText, Sparkles, Wand2 } from 'lucide-react';

import { Card, CardContent } from '@/components/ui/card';
import { Link } from '@/lib/i18n/navigation';
import { DASHBOARD_EVENTS, trackEvent } from '@/lib/analytics';
import { cn } from '@/lib/utils';
import type { DashboardEssayCoach } from '@study-abroad/shared';

/**
 * DashboardEssayCoach — surfaces the user's latest AI essay feedback
 * inline on the dashboard, with a 1-click path back into the essay
 * workspace.
 *
 * 2026-05 Phase 2c: brings AI Layer 3 (essay feedback) to the dashboard,
 * matching Cialfo's best practice. Renders nothing when the user has
 * no AI runs yet (data === null) so the dashboard stays clean for
 * new users.
 *
 * Card layout:
 *   ┌─────────────────────────────────────────────────────────┐
 *   │ 🪄 Latest essay AI feedback                              │
 *   │   "Stanford Why Major" · review · 3 days ago             │
 *   │   "Strengthen the second paragraph with a concrete..."   │
 *   │                                            [继续打磨 →]   │
 *   └─────────────────────────────────────────────────────────┘
 */
export function DashboardEssayCoach({ data }: { data?: DashboardEssayCoach | null }) {
  const t = useTranslations('dashboard.essayCoach');
  const locale = useLocale();

  if (!data) return null;

  const dateLocale = locale === 'zh' ? 'zh-CN' : 'en-US';
  const dateLabel = new Date(data.createdAt).toLocaleDateString(dateLocale);
  const typeLabel =
    data.type === 'review' ? t('typeReview') : data.type === 'polish' ? t('typePolish') : data.type;
  const displaySuggestion = data.suggestion || t('fallbackSuggestion');

  return (
    <Card
      className={cn(
        'rounded-[var(--theme-radius-card)] border-border',
        'bg-[color:var(--theme-card-bg)] shadow-[var(--theme-card-shadow)]'
      )}
    >
      <CardContent className="p-4 sm:p-5">
        <div className="flex items-start gap-3">
          <span
            className={cn(
              'mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center',
              'rounded-[var(--theme-radius-card)] border border-primary/25 bg-primary/5'
            )}
            aria-hidden="true"
          >
            {data.type === 'polish' ? (
              <Wand2 className="h-4 w-4 text-primary" />
            ) : (
              <Sparkles className="h-4 w-4 text-primary" />
            )}
          </span>

          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-baseline gap-x-2 gap-y-1">
              <h3 className="text-sm font-semibold">{t('title')}</h3>
              <span className="text-xs text-muted-foreground">
                {t('subtitle', { type: typeLabel, date: dateLabel })}
              </span>
            </div>

            <div className="mt-1 flex items-center gap-2">
              <FileText className="h-3 w-3 shrink-0 text-muted-foreground" />
              <p className="truncate text-xs font-medium text-muted-foreground">
                {data.essayTitle}
              </p>
            </div>

            <p
              className={cn(
                'mt-2 text-sm leading-6 text-foreground/90',
                // 2 lines max — tooltip on hover via title attribute
                'line-clamp-2'
              )}
              title={displaySuggestion}
            >
              {displaySuggestion}
            </p>
          </div>

          <Link
            href={`/essays?id=${encodeURIComponent(data.essayId)}`}
            onClick={() =>
              // 2026-05 Phase 4: track dashboard → /essays funnel for
              // the Essay Coach card. essayId + type so we can measure
              // which AI result types drive click-through.
              trackEvent(DASHBOARD_EVENTS.essayCoachCtaClicked, {
                essayId: data.essayId,
                type: data.type,
              })
            }
            className={cn(
              'shrink-0 self-center rounded-[var(--theme-radius-control,0.5rem)]',
              'border border-border bg-[color:var(--theme-control-bg)] px-3 py-1.5',
              'text-xs font-medium transition-colors',
              'hover:border-primary/35 hover:bg-[color:var(--theme-control-hover-bg)]',
              'hover:text-primary'
            )}
            aria-label={t('ctaAriaLabel', { essayTitle: data.essayTitle })}
          >
            {t('cta')}
            <ArrowRight className="ml-1 inline h-3 w-3" />
          </Link>
        </div>
      </CardContent>
    </Card>
  );
}
