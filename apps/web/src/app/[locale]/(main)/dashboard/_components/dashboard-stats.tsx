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
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
      {/* Profile Completion */}
      <Card>
        <CardContent className="pt-6">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center">
              <User className="w-6 h-6 text-primary" />
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
      <Card>
        <CardContent className="pt-6">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-full bg-violet-500/10 flex items-center justify-center">
              <GraduationCap className="w-6 h-6 text-violet-500" />
            </div>
            <div className="flex-1">
              <p className="text-sm text-muted-foreground">{t('dashboard.stats.schoolList')}</p>
              <p className="text-2xl font-bold">{schoolCount}</p>
              {schoolCount > 0 && (
                <div className="flex gap-1.5 mt-1 flex-wrap">
                  {schoolTiers.reach > 0 && (
                    <Badge
                      variant="outline"
                      className="text-[10px] px-1.5 py-0 border-rose-300 text-rose-600 bg-rose-50 dark:border-rose-800 dark:text-rose-400 dark:bg-rose-950/30"
                    >
                      {t('dashboard.stats.reach')} {schoolTiers.reach}
                    </Badge>
                  )}
                  {schoolTiers.target > 0 && (
                    <Badge
                      variant="outline"
                      className="text-[10px] px-1.5 py-0 border-blue-300 text-blue-600 bg-blue-50 dark:border-blue-800 dark:text-blue-400 dark:bg-blue-950/30"
                    >
                      {t('dashboard.stats.target')} {schoolTiers.target}
                    </Badge>
                  )}
                  {schoolTiers.safety > 0 && (
                    <Badge
                      variant="outline"
                      className="text-[10px] px-1.5 py-0 border-emerald-300 text-emerald-600 bg-emerald-50 dark:border-emerald-800 dark:text-emerald-400 dark:bg-emerald-950/30"
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
      <Card>
        <CardContent className="pt-6">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-full bg-amber-500/10 flex items-center justify-center">
              <ListChecks className="w-6 h-6 text-amber-500" />
            </div>
            <div>
              <p className="text-sm text-muted-foreground">{t('dashboard.stats.pendingTasks')}</p>
              <p className="text-2xl font-bold">{effectivePending}</p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Profile Grade */}
      <Card>
        <CardContent className="pt-6">
          <div className="flex items-center gap-4">
            <div
              className={cn(
                'w-12 h-12 rounded-full flex items-center justify-center',
                grade.bgColor
              )}
            >
              <TrendingUp className={cn('w-6 h-6', grade.color)} />
            </div>
            <div>
              <p className="text-sm text-muted-foreground">{t('dashboard.stats.profileScore')}</p>
              <p className={cn('text-2xl font-bold', grade.color)}>{grade.grade}</p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
