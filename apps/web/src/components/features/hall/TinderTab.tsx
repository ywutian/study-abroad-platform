'use client';

/**
 * TinderTab — 案例判断学习闭环。
 *
 * 2026-05 Hall Plan C (C3): de-gamified. The casino layer (streaks, badges,
 * daily challenge, points toasts, leaderboard) was removed. What remains is
 * the genuine learning loop:
 *   - browse real admission cases (SwipeStack)
 *   - guess the outcome (swipe)
 *   - see whether you were right + the real result (SwipeResultOverlay)
 *   - a private cumulative accuracy stat, visible only to the user.
 */

import { useState, useCallback } from 'react';
import { useTranslations } from 'next-intl';
import { motion } from 'framer-motion';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { LoadingState } from '@/components/ui/loading-state';
import { Target } from 'lucide-react';
import { useSwipeCases, useSwipeStats, useSwipeMutation } from '@/hooks/use-hall-api';
import { SwipeStack } from './SwipeStack';
import { SwipeResultOverlay } from './SwipeResultOverlay';
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
  const { data: swipeStatsData } = useSwipeStats(true);

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
            setTimeout(() => setSwipeResult(null), 2000);
          },
        }
      );
    },
    [swipeMutation]
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
          <CardHeader>
            <div>
              <CardTitle>{t('hall.tinder.title')}</CardTitle>
              <CardDescription>{t('hall.tinder.description')}</CardDescription>
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

      {/* 侧边栏：私有判断校准准确率（仅自己可见，不上榜） */}
      <div className="space-y-4 sm:space-y-6 order-2">
        {swipeStatsData && swipeStatsData.totalSwipes > 0 ? (
          <Card>
            <CardHeader>
              <div className="flex items-center gap-2">
                <Target className="h-5 w-5 text-emerald-500" />
                <CardTitle className="text-base">{t('hall.calibration.title')}</CardTitle>
              </div>
              <CardDescription>{t('hall.calibration.description')}</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="flex items-baseline gap-2">
                <span className="text-3xl font-bold tabular-nums text-foreground">
                  {swipeStatsData.accuracy}%
                </span>
                <span className="text-sm text-muted-foreground">
                  {t('hall.calibration.accuracyLabel')}
                </span>
              </div>
              <p className="text-sm text-muted-foreground">
                {t('hall.calibration.correctOf', {
                  correct: swipeStatsData.correctCount,
                  total: swipeStatsData.totalSwipes,
                })}
              </p>
            </CardContent>
          </Card>
        ) : null}
      </div>
    </motion.div>
  );
}
