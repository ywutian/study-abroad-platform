'use client';

import { motion } from 'framer-motion';
import { useTranslations } from 'next-intl';
import { cn } from '@/lib/utils';
import { Card, CardContent } from '@/components/ui/card';
import { AnimatedCounter } from '@/components/ui/animated-counter';
import { Target, Flame, Trophy, BarChart3, TrendingUp } from 'lucide-react';
import { BadgeDisplay, BadgeProgress, SwipeBadge } from './BadgeDisplay';

interface SwipeStats {
  totalSwipes: number;
  correctCount: number;
  accuracy: number;
  currentStreak: number;
  bestStreak: number;
  badge: SwipeBadge;
  toNextBadge: number;
  dailyChallengeCount: number;
  dailyChallengeTarget: number;
}

interface StatCardProps {
  label: string;
  value: number;
  suffix?: string;
  icon: React.ComponentType<{ className?: string }>;
  color: string;
  delay?: number;
}

function StatCard({ label, value, suffix = '', icon: Icon, color, delay = 0 }: StatCardProps) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay, duration: 0.3 }}
      className="h-full"
    >
      <Card className="overflow-hidden h-full">
        <CardContent className="p-3 sm:p-4 text-center flex flex-col items-center justify-center h-full">
          <Icon className={cn('h-5 w-5 sm:h-6 sm:w-6 mb-1.5 sm:mb-2', color)} />
          <div className="text-xl sm:text-2xl font-bold tabular-nums whitespace-nowrap">
            <AnimatedCounter value={value} suffix={suffix} />
          </div>
          <p className="text-xs sm:text-sm text-muted-foreground mt-1 leading-tight">{label}</p>
        </CardContent>
      </Card>
    </motion.div>
  );
}

interface StatsPanelProps {
  stats: SwipeStats;
  showBadgeProgress?: boolean;
  compact?: boolean;
  className?: string;
}

export function StatsPanel({
  stats,
  showBadgeProgress = true,
  compact = false,
  className,
}: StatsPanelProps) {
  const t = useTranslations('hall.stats');

  if (compact) {
    return (
      <div className={cn('flex items-center justify-between gap-4', className)}>
        <div className="flex items-center gap-3">
          <BadgeDisplay badge={stats.badge} size="sm" animated={false} />
          <div>
            <p className="text-sm font-medium">{t('accuracyCompact', { value: stats.accuracy })}</p>
            <p className="text-xs text-muted-foreground">
              {t('correctOf', { correct: stats.correctCount, total: stats.totalSwipes })}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-4 text-sm">
          <div className="flex items-center gap-1">
            <motion.div
              animate={stats.currentStreak >= 3 ? { scale: [1, 1.2, 1] } : {}}
              transition={{ repeat: Infinity, duration: 1.5 }}
            >
              <Flame className="h-4 w-4 text-orange-500" />
            </motion.div>
            <span className="font-medium">{stats.currentStreak}</span>
          </div>
          <div className="flex items-center gap-1">
            <Trophy className="h-4 w-4 text-amber-500" />
            <span className="font-medium">{stats.bestStreak}</span>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className={cn('space-y-6', className)}>
      {/* Badge Display */}
      <Card className="overflow-hidden">
        <div className="h-1.5 bg-gradient-to-r from-primary via-purple-500 to-pink-500" />
        <CardContent className="p-6">
          <div className="flex flex-col items-center">
            <BadgeDisplay badge={stats.badge} size="lg" showLabel animated />
            {showBadgeProgress && (
              <div className="w-full mt-6">
                <BadgeProgress
                  currentBadge={stats.badge}
                  correctCount={stats.correctCount}
                  toNextBadge={stats.toNextBadge}
                />
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Stats Grid */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 items-stretch">
        <StatCard
          label={t('accuracy')}
          value={stats.accuracy}
          suffix="%"
          icon={Target}
          color="text-emerald-500"
          delay={0}
        />
        <StatCard
          label={t('currentStreak')}
          value={stats.currentStreak}
          icon={Flame}
          color="text-orange-500"
          delay={0.1}
        />
        <StatCard
          label={t('bestStreak')}
          value={stats.bestStreak}
          icon={Trophy}
          color="text-amber-500"
          delay={0.2}
        />
        <StatCard
          label={t('totalPredictions')}
          value={stats.totalSwipes}
          icon={BarChart3}
          color="text-blue-500"
          delay={0.3}
        />
      </div>

      {/* Additional Stats */}
      <Card>
        <CardContent className="p-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <TrendingUp className="h-5 w-5 text-primary" />
              <span className="font-medium">{t('correctPredictions')}</span>
            </div>
            <div className="text-right">
              <span className="text-2xl font-bold text-primary">{stats.correctCount}</span>
              <span className="text-muted-foreground"> / {stats.totalSwipes}</span>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
