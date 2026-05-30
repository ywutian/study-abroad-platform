import React from 'react';
import { ScrollView, StyleSheet, RefreshControl } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useQuery } from '@tanstack/react-query';
import Animated, { SlideInUp } from 'react-native-reanimated';

import { apiClient } from '@/lib/api/client';
import { userRoutes, schoolRoutes, caseRoutes } from '@study-abroad/shared';
import type { DashboardSummary } from '@study-abroad/shared';
import { useAuthStore } from '@/stores';
import { useColors, spacing } from '@/utils/theme';
import type { School, Case, PaginatedResponse } from '@/types';
import {
  HomeHero,
  GuestHero,
  QuickActionsGrid,
  GradeRingCard,
  TierTiles,
  DeadlinesCard,
  TopSchoolsRail,
  RecentCasesList,
} from '@/components/features/home';

/**
 * Home — "Lumni Nocturne" redesign.
 *
 * Single source of truth = GET /users/me/dashboard (web-parity aggregation,
 * resilient per-section). Top-Schools (catalog) + Recent-Cases (detail) are the
 * only two extra reads the dashboard doesn't carry. No hardcoded/placeholder
 * numbers — every value below traces to a real dashboard field.
 */
export default function HomeScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { isAuthenticated } = useAuthStore();
  const [refreshing, setRefreshing] = React.useState(false);

  const { data: dashboard, refetch: refetchDashboard } = useQuery({
    queryKey: ['dashboard'],
    queryFn: () => apiClient.get<DashboardSummary>(userRoutes.dashboard()),
    enabled: isAuthenticated,
    refetchOnMount: 'always',
    refetchOnReconnect: 'always',
  });

  const {
    data: schoolsData,
    isLoading: schoolsLoading,
    refetch: refetchSchools,
  } = useQuery({
    queryKey: ['topSchools'],
    queryFn: () =>
      apiClient.get<PaginatedResponse<School>>(schoolRoutes.list(), {
        params: { page: 1, pageSize: 5 },
      }),
    refetchOnMount: 'always',
    refetchOnReconnect: 'always',
  });

  const {
    data: casesData,
    isLoading: casesLoading,
    refetch: refetchCases,
  } = useQuery({
    queryKey: ['recentCases'],
    queryFn: () =>
      apiClient.get<PaginatedResponse<Case>>(caseRoutes.list(), {
        params: { page: 1, pageSize: 5 },
      }),
    refetchOnMount: 'always',
    refetchOnReconnect: 'always',
  });

  const onRefresh = async () => {
    setRefreshing(true);
    await Promise.all([refetchDashboard(), refetchSchools(), refetchCases()]);
    setRefreshing(false);
  };

  const tiers = dashboard?.profile.schoolTiers;
  const showTiers = isAuthenticated && tiers && tiers.reach + tiers.target + tiers.safety > 0;
  const deadlines = dashboard?.upcomingDeadlines ?? [];

  return (
    <ScrollView
      style={[styles.container, { backgroundColor: colors.background }]}
      contentContainerStyle={{ paddingBottom: insets.bottom + spacing.xl }}
      refreshControl={
        <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary} />
      }
      showsVerticalScrollIndicator={false}
    >
      <Animated.View entering={SlideInUp.duration(500).springify()}>
        {isAuthenticated && dashboard ? (
          <HomeHero
            name={dashboard.user.nickname || dashboard.user.email.split('@')[0]}
            completeness={dashboard.profile.completeness}
            todayCount={dashboard.pendingTasks.todayCount ?? 0}
            submitted={dashboard.workbench?.pipeline?.submitted ?? 0}
            targetSchoolCount={dashboard.profile.targetSchoolCount}
            pendingTotal={dashboard.pendingTasks.total}
            nextDeadline={deadlines[0]}
          />
        ) : (
          <GuestHero />
        )}
      </Animated.View>

      <QuickActionsGrid pendingCount={dashboard?.pendingTasks.total ?? 0} />

      {isAuthenticated && dashboard ? (
        <GradeRingCard completeness={dashboard.profile.completeness} />
      ) : null}

      {showTiers && tiers ? <TierTiles tiers={tiers} /> : null}

      {isAuthenticated && deadlines.length > 0 ? (
        <DeadlinesCard deadlines={deadlines.slice(0, 5)} />
      ) : null}

      <TopSchoolsRail schools={schoolsData?.items ?? []} loading={schoolsLoading} />

      <RecentCasesList cases={casesData?.items ?? []} loading={casesLoading} />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
});
