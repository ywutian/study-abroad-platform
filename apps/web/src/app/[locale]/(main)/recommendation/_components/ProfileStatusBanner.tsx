'use client';

import { useTranslations } from 'next-intl';
import { Link } from '@/lib/i18n/navigation';
import { CheckCircle, AlertTriangle, Coins } from 'lucide-react';
import { Skeleton } from '@/components/ui/skeleton';
import { Button } from '@/components/ui/button';
import { FadeInView, AnimatedNumber } from '@/components/ui/motion';
import { cn } from '@/lib/utils';
import type { RecommendationPreflight } from '@study-abroad/shared';

interface ProfileStatusBannerProps {
  preflight?: RecommendationPreflight;
  isLoading: boolean;
}

export function ProfileStatusBanner({ preflight, isLoading }: ProfileStatusBannerProps) {
  const t = useTranslations('recommendation');

  if (isLoading) {
    return (
      <div className="mb-6 flex items-center gap-3 rounded-lg border p-4">
        <Skeleton className="h-5 w-5 rounded-full" />
        <Skeleton className="h-4 w-64" />
        <div className="ml-auto">
          <Skeleton className="h-4 w-24" />
        </div>
      </div>
    );
  }

  if (!preflight) return null;

  const missingFieldLabels = preflight.missingFields
    .map((f) => {
      const keyMap: Record<string, string> = {
        profile: t('missingProfile'),
        gpa: t('missingGpa'),
        testScores: t('missingTestScores'),
        activities: t('missingActivities'),
        targetMajor: t('missingTargetMajor'),
      };
      return keyMap[f] || f;
    })
    .join('、');

  const isReady = preflight.profileComplete;

  return (
    <FadeInView>
      <div
        className={cn(
          'mb-6 flex flex-col sm:flex-row sm:items-center gap-3 rounded-lg border p-4',
          isReady
            ? 'border-green-200 bg-green-50 dark:border-green-900 dark:bg-green-950'
            : 'border-yellow-200 bg-yellow-50 dark:border-yellow-900 dark:bg-yellow-950'
        )}
      >
        <div className="flex items-start sm:items-center gap-3 flex-1">
          {isReady ? (
            <CheckCircle className="h-5 w-5 shrink-0 text-green-600 mt-0.5 sm:mt-0" />
          ) : (
            <AlertTriangle className="h-5 w-5 shrink-0 text-yellow-600 mt-0.5 sm:mt-0" />
          )}

          <div className="flex-1 text-sm">
            {isReady ? (
              <span className="text-green-800 dark:text-green-200">
                <span className="font-medium">{t('profileReady')}</span>
                {preflight.profileSummary && (
                  <span className="ml-2 text-green-600 dark:text-green-400">
                    {t('profileReadySummary', {
                      gpa: preflight.profileSummary.gpa || '-',
                      testCount: preflight.profileSummary.testCount,
                      activityCount: preflight.profileSummary.activityCount,
                    })}
                  </span>
                )}
              </span>
            ) : (
              <span className="text-yellow-800 dark:text-yellow-200">
                <span className="font-medium">{t('profileIncomplete')}</span>
                <span className="ml-2 text-yellow-600 dark:text-yellow-400">
                  {t('profileIncompleteDesc', { fields: missingFieldLabels })}
                </span>
                <Link href="/profile">
                  <Button
                    variant="outline"
                    size="sm"
                    className="ml-2 h-auto py-0.5 px-2 text-yellow-700 dark:text-yellow-300"
                  >
                    {t('completeProfile')}
                  </Button>
                </Link>
              </span>
            )}
          </div>
        </div>

        {/* 积分显示 — 积分系统启用后恢复
        <div className="flex items-center gap-1.5 text-sm font-medium text-muted-foreground shrink-0 tabular-nums">
          <Coins className="h-4 w-4" />
          <AnimatedNumber value={preflight.points} />
          <span>{t('points')}</span>
        </div>
        */}
      </div>
    </FadeInView>
  );
}
