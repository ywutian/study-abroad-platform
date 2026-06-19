'use client';

/**
 * Golden-moment points loop (#4a): the instant a user's lifetime earned points
 * goes up, surface a toast with a one-click CTA to spend them on the essay AI.
 *
 * We watch `totalEarned` (monotonic — only rises on EARN) rather than
 * `currentPoints` (which also drops on spend), so spending never triggers a
 * false "you earned points" toast. The query shares the `['points-summary']`
 * key with PointsOverview, so there's no extra network cost; `staleTime: 0` +
 * focus refetch catches earns across navigation, and any earn site can fire the
 * `points:earned` window event for an immediate refetch.
 */

import { useEffect, useRef } from 'react';
import { useTranslations } from 'next-intl';
import { useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { apiClient } from '@/lib/api';
import { pointsRoutes } from '@study-abroad/shared';
import { useRouter } from '@/lib/i18n/navigation';
import { useAuthGatedQuery } from '@/hooks/use-auth-gated-query';

interface PointsSummary {
  currentPoints: number;
  totalEarned: number;
  totalSpent: number;
  transactionCount: number;
  actionStats: Record<string, number>;
}

/** Fire `window.dispatchEvent(new Event(POINTS_EARNED_EVENT))` after any
 *  points-earning action to nudge an immediate balance refetch. */
export const POINTS_EARNED_EVENT = 'points:earned';

export function PointsEarnWatcher() {
  const t = useTranslations('points');
  const router = useRouter();
  const queryClient = useQueryClient();
  const lastEarnedRef = useRef<number | null>(null);

  const { data } = useAuthGatedQuery({
    queryKey: ['points-summary'],
    queryFn: () => apiClient.get<PointsSummary>(pointsRoutes.summary()),
    staleTime: 0,
    refetchOnWindowFocus: true,
  });

  useEffect(() => {
    const onEarned = () => {
      void queryClient.invalidateQueries({ queryKey: ['points-summary'] });
    };
    window.addEventListener(POINTS_EARNED_EVENT, onEarned);
    return () => window.removeEventListener(POINTS_EARNED_EVENT, onEarned);
  }, [queryClient]);

  useEffect(() => {
    if (!data) return;
    const earned = data.totalEarned;
    // Seed the baseline on first observation — never toast on initial load.
    if (lastEarnedRef.current === null) {
      lastEarnedRef.current = earned;
      return;
    }
    const delta = earned - lastEarnedRef.current;
    lastEarnedRef.current = earned;
    if (delta > 0) {
      toast.success(t('earnToast.title', { points: delta }), {
        description: t('earnToast.description'),
        action: {
          label: t('earnToast.cta'),
          onClick: () => router.push('/cases'),
        },
      });
    }
  }, [data, router, t]);

  return null;
}
