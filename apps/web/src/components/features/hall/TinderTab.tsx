'use client';

/**
 * TinderTab — 预测游戏标签页
 *
 * 从 hall/page.tsx 拆分而来，负责：
 * - 滑动案例栈 (SwipeStack)
 * - 预测结果动画 (SwipeResultOverlay)
 * - 统计面板 (StatsPanel)
 * - 每日挑战 (DailyChallenge)
 * - 排行榜 (LeaderboardList)
 */

import { useState, useCallback } from 'react';
import { useTranslations } from 'next-intl';
import { motion } from 'framer-motion';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { LoadingState } from '@/components/ui/loading-state';
import { toast } from 'sonner';
import { Zap } from 'lucide-react';
import {
  useSwipeCases,
  useSwipeStats,
  useLeaderboard,
  useSwipeMutation,
} from '@/hooks/use-hall-api';
import { SwipeStack } from './SwipeStack';
import { SwipeResultOverlay } from './SwipeResultOverlay';
import { StatsPanel } from './StatsPanel';
import { DailyChallenge } from './DailyChallenge';
import { LeaderboardList } from './LeaderboardList';
import type { SwipeResult } from '@/types/hall';

export function TinderTab() {
  const t = useTranslations();

  // 本地 UI 状态
  const [swipeResult, setSwipeResult] = useState<SwipeResult | null>(null);

  // API hooks
  const {
    data: swipeBatchData,
    isLoading: casesLoading,
    refetch: refetchCases,
  } = useSwipeCases(true);
  const { data: swipeStatsData, isLoading: statsLoading } = useSwipeStats(true);
  const { data: leaderboardData, isLoading: leaderboardLoading } = useLeaderboard(true);

  const swipeMutation = useSwipeMutation();

  const swipeCases = swipeBatchData?.cases ?? [];
  const swipeMeta = swipeBatchData?.meta;

  // 处理滑动预测
  const handleSwipe = useCallback(
    (caseId: string, direction: 'left' | 'right' | 'up' | 'down') => {
      let prediction: 'admit' | 'reject' | 'waitlist';
      switch (direction) {
        case 'right':
          prediction = 'admit';
          break;
        case 'left':
          prediction = 'reject';
          break;
        default:
          prediction = 'waitlist';
      }

      swipeMutation.mutate(
        { caseId, prediction },
        {
          onSuccess: (response) => {
            setSwipeResult(response);
            if (response.isCorrect) {
              toast.success(t('hall.tinder.correctToast', { points: response.pointsEarned }));
            } else {
              toast.error(t('hall.tinder.incorrectToast', { result: response.actualResult }));
            }
            setTimeout(() => setSwipeResult(null), 2000);
          },
          onError: (error: Error) => {
            toast.error(error.message);
          },
        }
      );
    },
    [swipeMutation, t]
  );

  return (
    <motion.div
      key="tinder"
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -10 }}
      className="grid gap-4 sm:gap-6 lg:grid-cols-3"
    >
      {/* 滑动案例栈 */}
      <div className="lg:col-span-2 order-1">
        <Card className="overflow-hidden">
          <div className="h-1.5 bg-gradient-to-r from-pink-500 via-rose-500 to-red-500" />
          <CardHeader>
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-gradient-to-br from-pink-500 to-rose-500 text-white">
                <Zap className="h-5 w-5" />
              </div>
              <div>
                <CardTitle className="text-lg">{t('hall.tinder.title')}</CardTitle>
                <CardDescription>{t('hall.tinder.description')}</CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent className="relative">
            {casesLoading ? (
              <LoadingState variant="card" count={1} />
            ) : (
              <>
                <SwipeStack
                  cases={swipeCases}
                  onSwipe={handleSwipe}
                  onEmpty={() => refetchCases()}
                  isLoading={swipeMutation.isPending}
                  meta={swipeMeta}
                />
                <SwipeResultOverlay result={swipeResult} />
              </>
            )}
          </CardContent>
        </Card>
      </div>

      {/* 侧边栏：统计 + 排行榜 */}
      <div className="space-y-4 sm:space-y-6 order-2">
        {/* 每日挑战 */}
        {swipeStatsData && (
          <DailyChallenge
            currentCount={swipeStatsData.dailyChallengeCount}
            targetCount={swipeStatsData.dailyChallengeTarget}
          />
        )}

        {/* 统计面板 */}
        {statsLoading ? (
          <LoadingState variant="card" count={1} />
        ) : swipeStatsData ? (
          <StatsPanel stats={swipeStatsData} />
        ) : null}

        {/* 排行榜 */}
        {leaderboardLoading ? (
          <LoadingState variant="card" count={1} />
        ) : leaderboardData ? (
          <LeaderboardList
            entries={leaderboardData.entries}
            currentUserEntry={leaderboardData.currentUserEntry}
          />
        ) : null}
      </div>
    </motion.div>
  );
}
