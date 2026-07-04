'use client';

import { useTranslations } from 'next-intl';
import { Link } from '@/lib/i18n/navigation';
import { cn } from '@/lib/utils';
import { Progress } from '@/components/ui/progress';
import { toneFromReadinessStatus, type DashboardWorkbench } from './dashboard-workbench-model';
import { DashboardQuickAddSchool } from './dashboard-quick-add-school';

// tone → status-dot colour. Kept local (4 entries) so this stays a small,
// self-contained sidebar component instead of importing CommandCenter's
// full `toneMeta` (which also carries border/badge/text variants).
const dotClass: Record<string, string> = {
  critical: 'bg-destructive',
  warning: 'bg-warning',
  neutral: 'bg-muted-foreground',
  success: 'bg-success',
};

/**
 * 2026-07 dashboard batch-2 (feedback 5c): compact setup-progress card.
 *
 * The old 5-card readiness grid lived in the CommandCenter hero and was
 * the user's least-useful surface ("进度条用处没有太大"). It moves here to
 * the sidebar as a small progress bar + one tight row per readiness item
 * (label + status word + tone dot), each still a one-click path into the
 * relevant page. Quick Add School stays inline. Renders null with no items.
 */
export function DashboardSetupProgress({ workbench }: { workbench: DashboardWorkbench }) {
  const t = useTranslations('dashboard.workbench');
  const items = workbench.readiness.items;
  const total = items.length;

  if (total === 0) return null;

  const readyCount = items.filter((item) => item.status === 'ready').length;
  const percent = Math.round((readyCount / total) * 100);

  return (
    <div className="rounded-[var(--theme-radius-card)] border border-border bg-[color:var(--theme-card-bg)] p-4 shadow-[var(--theme-card-shadow)]">
      <div className="mb-3 flex items-center justify-between gap-2">
        <h3 className="text-sm font-semibold">{t('setupChecklist')}</h3>
        <span className="shrink-0 text-xs font-medium tabular-nums text-muted-foreground">
          {t('setupProgress', { ready: readyCount, total })}
        </span>
      </div>

      <Progress value={percent} className="h-1.5" />

      <div className="mt-3 space-y-0.5">
        {items.map((item) => {
          // Prediction "attention" → deep-link straight into auto-run mode
          // (preserves the one-click run the old grid had).
          const href =
            item.key === 'prediction' && item.status === 'attention'
              ? `${item.href}?autorun=1`
              : item.href;
          return (
            <Link
              key={item.key}
              href={href}
              className="flex items-center gap-2 rounded-[var(--theme-radius-control,0.5rem)] px-2 py-1.5 transition-colors hover:bg-[color:var(--theme-control-hover-bg)]"
            >
              <span
                className={cn(
                  'h-2 w-2 shrink-0 rounded-full',
                  dotClass[toneFromReadinessStatus(item.status)]
                )}
              />
              <span className="min-w-0 flex-1 truncate text-sm">{item.label}</span>
              <span className="shrink-0 text-2xs font-medium text-muted-foreground">
                {t(`status.${item.status}`)}
              </span>
            </Link>
          );
        })}
      </div>

      <div className="mt-3">
        <DashboardQuickAddSchool />
      </div>
    </div>
  );
}
