'use client';

import { useTranslations } from 'next-intl';
import { Card, CardContent } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import { User, GraduationCap, ListChecks, TrendingUp } from 'lucide-react';

interface DashboardStatsProps {
  completeness: number;
  schoolCount: number;
  schoolTiers: { reach: number; target: number; safety: number };
  effectivePending: number;
  grade: { grade: string; color: string; bgColor: string };
}

export function DashboardStats({
  completeness,
  schoolCount,
  schoolTiers,
  effectivePending,
  grade,
}: DashboardStatsProps) {
  const t = useTranslations();
  return (
    <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
      {/* Profile Completion */}
      <Card className="rounded-[var(--theme-radius-card)] py-0">
        <CardContent className="p-4">
          <div className="flex items-center gap-4">
            <div className="flex h-10 w-10 items-center justify-center rounded-[var(--theme-radius-card)] border bg-[color:var(--theme-control-bg)]">
              <User className="h-5 w-5 text-primary" />
            </div>
            <div className="flex-1">
              <p className="text-sm text-muted-foreground">
                {t('dashboard.stats.profileCompletion')}
              </p>
              <div className="flex items-center gap-2 mt-1">
                <Progress value={completeness} className="flex-1 h-2" />
                <span className="text-sm font-medium">{completeness}%</span>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* School List Count with Tier Breakdown */}
      <Card className="rounded-[var(--theme-radius-card)] py-0">
        <CardContent className="p-4">
          <div className="flex items-center gap-4">
            <div className="flex h-10 w-10 items-center justify-center rounded-[var(--theme-radius-card)] border bg-[color:var(--theme-control-bg)]">
              <GraduationCap className="h-5 w-5 text-primary" />
            </div>
            <div className="flex-1">
              <p className="text-sm text-muted-foreground">{t('dashboard.stats.schoolList')}</p>
              <p className="text-2xl font-semibold tabular-nums">{schoolCount}</p>
              {schoolCount > 0 && (
                <div className="flex gap-1.5 mt-1 flex-wrap">
                  {schoolTiers.reach > 0 && (
                    <Badge
                      variant="outline"
                      className="border-destructive/30 bg-destructive/10 px-1.5 py-0 text-2xs text-destructive"
                    >
                      {t('dashboard.stats.reach')} {schoolTiers.reach}
                    </Badge>
                  )}
                  {schoolTiers.target > 0 && (
                    <Badge
                      variant="outline"
                      className="border-primary/30 bg-primary/10 px-1.5 py-0 text-2xs text-primary"
                    >
                      {t('dashboard.stats.target')} {schoolTiers.target}
                    </Badge>
                  )}
                  {schoolTiers.safety > 0 && (
                    <Badge
                      variant="outline"
                      className="border-success/30 bg-success/10 px-1.5 py-0 text-2xs text-success"
                    >
                      {t('dashboard.stats.safety')} {schoolTiers.safety}
                    </Badge>
                  )}
                </div>
              )}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Pending Tasks */}
      <Card className="rounded-[var(--theme-radius-card)] py-0">
        <CardContent className="p-4">
          <div className="flex items-center gap-4">
            <div className="flex h-10 w-10 items-center justify-center rounded-[var(--theme-radius-card)] border border-warning/25 bg-warning/10">
              <ListChecks className="h-5 w-5 text-warning" />
            </div>
            <div>
              <p className="text-sm text-muted-foreground">{t('dashboard.stats.pendingTasks')}</p>
              <p className="text-2xl font-semibold tabular-nums">{effectivePending}</p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Profile Grade */}
      <Card className="rounded-[var(--theme-radius-card)] py-0">
        <CardContent className="p-4">
          <div className="flex items-center gap-4">
            <div
              className={cn(
                'flex h-10 w-10 items-center justify-center rounded-[var(--theme-radius-card)] border',
                grade.bgColor
              )}
            >
              <TrendingUp className={cn('h-5 w-5', grade.color)} />
            </div>
            <div>
              <p className="text-sm text-muted-foreground">{t('dashboard.stats.profileScore')}</p>
              <p className={cn('text-2xl font-semibold', grade.color)}>{grade.grade}</p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
