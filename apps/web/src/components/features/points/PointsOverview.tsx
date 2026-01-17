'use client';

import { useTranslations, useFormatter } from 'next-intl';
import { useQuery } from '@tanstack/react-query';
import { motion } from 'framer-motion';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { apiClient } from '@/lib/api';
import { cn } from '@/lib/utils';
import {
  Coins,
  TrendingUp,
  TrendingDown,
  Activity,
  Sparkles,
  Gift,
  Crown,
  Star,
} from 'lucide-react';

interface PointsSummary {
  currentPoints: number;
  totalEarned: number;
  totalSpent: number;
  transactionCount: number;
  actionStats: Record<string, number>;
}

// 等级样式配置
const LEVEL_STYLES = [
  { key: 'novice', minPoints: 0, maxPoints: 99, icon: Star, color: 'text-gray-500' },
  { key: 'beginner', minPoints: 100, maxPoints: 299, icon: Star, color: 'text-blue-500' },
  { key: 'intermediate', minPoints: 300, maxPoints: 599, icon: Sparkles, color: 'text-primary' },
  { key: 'advanced', minPoints: 600, maxPoints: 999, icon: Gift, color: 'text-amber-500' },
  { key: 'expert', minPoints: 1000, maxPoints: 1999, icon: Crown, color: 'text-orange-500' },
  { key: 'master', minPoints: 2000, maxPoints: Infinity, icon: Crown, color: 'text-red-500' },
];

interface PointsOverviewProps {
  compact?: boolean;
  className?: string;
}

export function PointsOverview({ compact = false, className }: PointsOverviewProps) {
  const t = useTranslations('points');
  const format = useFormatter();

  const LEVELS = LEVEL_STYLES.map((level) => ({
    ...level,
    name: t(`levels.${level.key}`),
  }));

  function getLevel(points: number) {
    return LEVELS.find((l) => points >= l.minPoints && points <= l.maxPoints) || LEVELS[0];
  }

  function getLevelProgress(points: number) {
    const level = getLevel(points);
    if (level.maxPoints === Infinity) return 100;
    const range = level.maxPoints - level.minPoints;
    const progress = points - level.minPoints;
    return Math.min(100, (progress / range) * 100);
  }
  const { data: summary, isLoading } = useQuery({
    queryKey: ['points-summary'],
    queryFn: () => apiClient.get<PointsSummary>('/users/me/points/summary'),
  });

  if (isLoading) {
    return (
      <Card className={cn('animate-pulse', className)}>
        <CardContent className="p-6">
          <div className="h-32 bg-muted rounded" />
        </CardContent>
      </Card>
    );
  }

  const points = summary?.currentPoints || 0;
  const level = getLevel(points);
  const levelProgress = getLevelProgress(points);
  const nextLevel = LEVELS[LEVELS.indexOf(level) + 1];
  const LevelIcon = level.icon;

  if (compact) {
    return (
      <Card className={cn('overflow-hidden', className)}>
        <div className="h-1 bg-gradient-to-r bg-warning" />
        <CardContent className="p-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-warning/10">
                <Coins className="h-5 w-5 text-amber-500" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <span className="text-2xl font-bold">{format.number(points, 'standard')}</span>
                  <Badge variant="outline" className={cn('gap-1', level.color)}>
                    <LevelIcon className="h-3 w-3" />
                    {level.name}
                  </Badge>
                </div>
                <p className="text-xs text-muted-foreground">{t('overview.currentPoints')}</p>
              </div>
            </div>
            <div className="text-right text-sm">
              <div className="flex items-center gap-1 text-emerald-600">
                <TrendingUp className="h-3.5 w-3.5" />+{summary?.totalEarned || 0}
              </div>
              <div className="flex items-center gap-1 text-red-500">
                <TrendingDown className="h-3.5 w-3.5" />-{summary?.totalSpent || 0}
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className={cn('overflow-hidden', className)}>
      <div className="h-1.5 bg-warning" />
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2">
            <Coins className="h-5 w-5 text-amber-500" />
            {t('overview.title')}
          </CardTitle>
          <Badge variant="outline" className={cn('gap-1.5 px-3 py-1', level.color)}>
            <LevelIcon className="h-4 w-4" />
            {level.name}
          </Badge>
        </div>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* 积分展示 */}
        <div className="text-center py-4">
          <motion.div
            initial={{ scale: 0.5, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            className="relative inline-block"
          >
            <div className="absolute inset-0 bg-warning/20 blur-xl rounded-full" />
            <div className="relative">
              <span className="text-5xl font-bold bg-gradient-to-br bg-warning bg-clip-text text-transparent">
                {format.number(points, 'standard')}
              </span>
            </div>
          </motion.div>
          <p className="text-muted-foreground mt-2">{t('overview.availablePoints')}</p>
        </div>

        {/* 等级进度 */}
        {nextLevel && (
          <div className="space-y-2">
            <div className="flex items-center justify-between text-sm">
              <span className={level.color}>{level.name}</span>
              <span className="text-muted-foreground">
                {t('overview.upgradeHint', {
                  points: nextLevel.minPoints - points,
                  level: nextLevel.name,
                })}
              </span>
            </div>
            <Progress value={levelProgress} className="h-2" />
          </div>
        )}

        {/* 统计卡片 */}
        <div className="grid grid-cols-3 gap-3">
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
            className="rounded-xl bg-emerald-500/10 p-3 text-center"
          >
            <TrendingUp className="h-5 w-5 text-emerald-500 mx-auto mb-1" />
            <div className="text-lg font-bold text-emerald-600">+{summary?.totalEarned || 0}</div>
            <p className="text-xs text-muted-foreground">{t('overview.totalEarned')}</p>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
            className="rounded-xl bg-red-500/10 p-3 text-center"
          >
            <TrendingDown className="h-5 w-5 text-red-500 mx-auto mb-1" />
            <div className="text-lg font-bold text-red-500">-{summary?.totalSpent || 0}</div>
            <p className="text-xs text-muted-foreground">{t('overview.totalSpent')}</p>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3 }}
            className="rounded-xl bg-blue-500/10 p-3 text-center"
          >
            <Activity className="h-5 w-5 text-blue-500 mx-auto mb-1" />
            <div className="text-lg font-bold text-blue-500">{summary?.transactionCount || 0}</div>
            <p className="text-xs text-muted-foreground">{t('overview.transactions')}</p>
          </motion.div>
        </div>
      </CardContent>
    </Card>
  );
}
