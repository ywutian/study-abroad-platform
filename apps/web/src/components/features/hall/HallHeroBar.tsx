'use client';

/**
 * Hall refactor Stage 3 — Top task-flow hero bar.
 *
 * Single-row aggregate showing the user where they stand in the Hall economy:
 *   - 今日已得积分 + 累计积分
 *   - 滑动统计（连胜 + 徽章）
 *   - 评审者等级 chip + 信用分
 *   - 每日挑战进度
 *
 * Data comes from `GET /halls/me/overview` (one round trip, see use-hall-api.ts).
 * Skeleton-friendly: degrades gracefully while loading or when overview fails.
 */

import { useHallOverview } from '@/hooks/use-hall-api';
import { Flame, Trophy, Shield, Sparkles } from 'lucide-react';
import { cn } from '@/lib/utils';

export function HallHeroBar() {
  const { data: overview, isLoading } = useHallOverview();

  if (isLoading || !overview) {
    return (
      <div
        className={cn(
          'mb-4 grid grid-cols-2 gap-3 rounded-2xl border border-border bg-card p-4 sm:grid-cols-4 sm:gap-4 sm:p-6',
          'min-w-0', // PR #214-220 layout robustness: avoid pushing siblings off-screen
        )}
      >
        {[0, 1, 2, 3].map((i) => (
          <div key={i} className="h-16 min-w-0 animate-pulse rounded-lg bg-muted" />
        ))}
      </div>
    );
  }

  const dailyPct =
    overview.dailyChallenge.target > 0
      ? Math.min(
          100,
          Math.round(
            (overview.dailyChallenge.count / overview.dailyChallenge.target) *
              100,
          ),
        )
      : 0;

  return (
    <div
      className={cn(
        'mb-4 grid grid-cols-2 gap-3 rounded-2xl border border-border bg-card p-4 sm:grid-cols-4 sm:gap-4 sm:p-6',
        'min-w-0',
      )}
    >
      {/* 积分余额 + 今日 */}
      <div className="flex min-w-0 items-center gap-3">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-amber-100 text-amber-700 dark:bg-amber-950/50 dark:text-amber-300">
          <Sparkles className="h-5 w-5" />
        </div>
        <div className="min-w-0">
          <div className="text-xs text-muted-foreground">积分</div>
          <div className="truncate text-xl font-semibold tabular-nums">
            {overview.points.balance.toLocaleString()}
          </div>
          {overview.points.todayEarned > 0 && (
            <div className="truncate text-xs text-emerald-600 dark:text-emerald-400">
              今日 +{overview.points.todayEarned}
            </div>
          )}
        </div>
      </div>

      {/* 连胜 + 徽章 */}
      <div className="flex min-w-0 items-center gap-3">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-orange-100 text-orange-700 dark:bg-orange-950/50 dark:text-orange-300">
          <Flame className="h-5 w-5" />
        </div>
        <div className="min-w-0">
          <div className="text-xs text-muted-foreground">连胜</div>
          <div className="truncate text-xl font-semibold tabular-nums">
            {overview.swipe.currentStreak}
          </div>
          <div className="truncate text-xs text-muted-foreground">
            {badgeLabel(overview.swipe.badge)} · 最佳 {overview.swipe.bestStreak}
          </div>
        </div>
      </div>

      {/* 评审者等级 */}
      <div className="flex min-w-0 items-center gap-3">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-violet-100 text-violet-700 dark:bg-violet-950/50 dark:text-violet-300">
          <Shield className="h-5 w-5" />
        </div>
        <div className="min-w-0">
          <div className="text-xs text-muted-foreground">评审者</div>
          <div className="truncate text-xl font-semibold">
            {reviewerLabel(overview.reviewer.level)}
          </div>
          <div className="truncate text-xs text-muted-foreground">
            信用 {overview.reviewer.credit}
          </div>
        </div>
      </div>

      {/* 每日挑战 */}
      <div className="flex min-w-0 items-center gap-3">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-emerald-100 text-emerald-700 dark:bg-emerald-950/50 dark:text-emerald-300">
          <Trophy className="h-5 w-5" />
        </div>
        <div className="min-w-0 flex-1">
          <div className="text-xs text-muted-foreground">每日挑战</div>
          <div className="truncate text-xl font-semibold tabular-nums">
            {overview.dailyChallenge.count} / {overview.dailyChallenge.target}
          </div>
          <div className="mt-1 h-1.5 w-full overflow-hidden rounded-full bg-muted">
            <div
              className={cn(
                'h-full transition-all',
                overview.dailyChallenge.completed
                  ? 'bg-emerald-500'
                  : 'bg-emerald-400',
              )}
              style={{ width: `${dailyPct}%` }}
            />
          </div>
        </div>
      </div>
    </div>
  );
}

function badgeLabel(badge: string): string {
  const map: Record<string, string> = {
    bronze: '青铜',
    silver: '白银',
    gold: '黄金',
    platinum: '铂金',
    diamond: '钻石',
  };
  return map[badge] ?? badge;
}

function reviewerLabel(level: string): string {
  const map: Record<string, string> = {
    L1: '学习者',
    L2: '同侪',
    L3: '资深',
  };
  return map[level] ?? level;
}
