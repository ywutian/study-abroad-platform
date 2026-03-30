'use client';

import { useQuery } from '@tanstack/react-query';
import { apiClient, STALE_TIME } from '@/lib/api';
import { useAuthStore } from '@/stores';

interface DashboardProfile {
  completeness: number;
}

interface DashboardPendingTasks {
  total: number;
  profileGaps: string[];
}

interface DashboardData {
  profile: DashboardProfile;
  pendingTasks: DashboardPendingTasks;
}

const COMPLETE_THRESHOLD = 80;

/**
 * Hook providing onboarding progress state for nav indicators.
 * Fetches dashboard data with 5-min stale time to avoid excessive requests.
 */
export function useOnboardingProgress() {
  const { isInitialized, accessToken } = useAuthStore();

  const { data } = useQuery({
    queryKey: ['dashboard'],
    queryFn: () => apiClient.get<DashboardData>('/users/me/dashboard'),
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
