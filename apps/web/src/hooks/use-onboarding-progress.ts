'use client';

import { useQuery } from '@tanstack/react-query';
import { type DashboardData, userRoutes } from '@study-abroad/shared';

import { apiClient, STALE_TIME } from '@/lib/api';
import { useAuthStore } from '@/stores';

// 2026-05: Was redefining DashboardData locally as a narrow subset
// (only profile + pendingTasks). Now imports the canonical shape from
// @study-abroad/shared (PR #179) so this hook can never silently drift
// from the dashboard contract. Same query key as the page so the query
// cache is shared.

const COMPLETE_THRESHOLD = 80;

/**
 * Hook providing onboarding progress state for nav indicators.
 * Fetches dashboard data with 5-min stale time to avoid excessive requests.
 */
export function useOnboardingProgress() {
  const { isInitialized, accessToken } = useAuthStore();

  const { data } = useQuery({
    queryKey: ['dashboard'],
    queryFn: () => apiClient.get<DashboardData>(userRoutes.dashboard()),
    enabled: isInitialized && !!accessToken,
    staleTime: STALE_TIME.MODERATE,
  });

  const completeness = data?.profile?.completeness ?? 0;
  const profileGaps = data?.pendingTasks?.profileGaps ?? [];

  return {
    completeness,
    isComplete: completeness >= COMPLETE_THRESHOLD,
    profileGaps,
    gapCount: profileGaps.length,
    showIndicator: !!accessToken && completeness > 0 && completeness < COMPLETE_THRESHOLD,
  };
}
