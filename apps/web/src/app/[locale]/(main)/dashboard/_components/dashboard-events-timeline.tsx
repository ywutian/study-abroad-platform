'use client';

import { useTranslations, useLocale } from 'next-intl';
import { CalendarClock, School } from 'lucide-react';
import { Link } from '@/lib/i18n/navigation';
import { cn } from '@/lib/utils';
import { toneFromSeverity, type DashboardDeadlineItem } from './dashboard-workbench-model';

// Local tone→class map (border accent / dot / text). Mirrors CommandCenter's
// `toneMeta` but kept local so this stays a standalone, prop-light component.
const toneClass: Record<string, { border: string; dot: string; text: string }> = {
  critical: {
    border: 'border-destructive/25 bg-destructive/5',
    dot: 'bg-destructive',
    text: 'text-destructive',
  },
  warning: {
    border: 'border-warning/25 bg-warning/5',
    dot: 'bg-warning',
    text: 'text-warning',
  },
  neutral: {
    border: 'border-border bg-[color:var(--theme-control-bg)]',
    dot: 'bg-muted-foreground',
    text: 'text-muted-foreground',
  },
  success: {
    border: 'border-success/25 bg-success/5',
    dot: 'bg-success',
    text: 'text-success',
  },
};

/**
 * 2026-07 dashboard batch-2 (feedback 5e): upcoming-events timeline overview.
 *
 * A calm, at-a-glance strip of the next milestones — school application
 * deadlines + competitions/exams (deadlineStream types 'school' | 'event').
 * Rendered ABOVE the command center so the user first sees "the few big
 * things coming up", THEN the granular to-do below. Granular tasks stay in
 * the To-do; synthetic 'prep' nudges belong to the detailed timeline page.
 *
 * Renders null when there are no dated milestones, so a new user never sees
 * an empty hole (same zero-suppression contract as the other surfaces).
 */
export function DashboardEventsTimeline({ items }: { items: DashboardDeadlineItem[] }) {
  const t = useTranslations('dashboard.workbench');
  const locale = useLocale();

  const milestones = items
    .filter((item) => item.type === 'school' || item.type === 'event')
    .slice(0, 6);

  if (milestones.length === 0) return null;

  const formatDays = (daysLeft: number) => {
    if (daysLeft < 0) return t('deadlineOverdue', { count: Math.abs(daysLeft) });
    if (daysLeft === 0) return t('deadlineToday');
    return t('deadlineDays', { count: daysLeft });
  };

  return (
    <section
      aria-label={t('upcomingEvents')}
      className="min-w-0 rounded-[var(--theme-radius-card)] border border-border bg-[color:var(--theme-card-bg)] p-4 shadow-[var(--theme-card-shadow)] sm:p-5"
    >
      <div className="mb-3 flex items-center justify-between gap-3">
        <div className="min-w-0">
          <h2 className="text-sm font-semibold">{t('upcomingEvents')}</h2>
          <p className="mt-0.5 line-clamp-1 text-xs text-muted-foreground">
            {t('upcomingEventsHint')}
          </p>
        </div>
        <Link href="/timeline" className="shrink-0 text-xs font-medium text-primary">
          {t('viewTimeline')}
        </Link>
      </div>

      {/* Horizontal milestone strip — scrolls inside its own container so the
          page body never scrolls sideways. `data-allow-overflow-x` opts this
          intentional scroller out of the dev OverflowDetector. */}
      <div
        data-allow-overflow-x
        className="-mx-1 flex gap-3 overflow-x-auto px-1 pb-1 [scrollbar-width:thin]"
      >
        {milestones.map((item) => {
          const tone = toneClass[toneFromSeverity(item.severity)] ?? toneClass.neutral;
          const due = new Date(item.dueAt);
          const dateLabel = Number.isNaN(due.getTime())
            ? ''
            : due.toLocaleDateString(locale, { month: 'short', day: 'numeric' });
          const Icon = item.type === 'school' ? School : CalendarClock;
          return (
            <Link
              key={`${item.type}-${item.id}`}
              href={item.href}
              className={cn(
                'flex w-40 shrink-0 flex-col gap-2 rounded-[var(--theme-radius-card)] border p-3 transition-colors hover:border-primary/35',
                tone.border
              )}
            >
              <div className="flex items-center justify-between gap-2">
                <span className="inline-flex min-w-0 items-center gap-1 text-2xs font-medium uppercase tracking-wide text-muted-foreground">
                  <Icon className="h-3 w-3 shrink-0" />
                  <span className="truncate">{dateLabel}</span>
                </span>
                <span className={cn('h-2 w-2 shrink-0 rounded-full', tone.dot)} />
              </div>
              <p className="line-clamp-2 text-sm font-medium leading-snug">{item.title}</p>
              <p className="truncate text-xs text-muted-foreground">{item.subtitle}</p>
              <p className={cn('mt-auto text-xs font-medium tabular-nums', tone.text)}>
                {formatDays(item.daysLeft)}
              </p>
            </Link>
          );
        })}
      </div>
    </section>
  );
}
