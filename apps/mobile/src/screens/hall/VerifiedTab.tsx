/**
 * VerifiedTab — 认证 tab (Hall refactor Stage 4 M5).
 *
 * Default tab of the Hall. Leads with the China Admit Dashboard (verified
 * mainland-China admit trend + difficulty signals — highest decision value)
 * then shows the verified-user ranking list below.
 */
import React, { useState, useCallback } from 'react';
import { View, Text, ScrollView, TouchableOpacity, RefreshControl, StyleSheet } from 'react-native';
import { useTranslation } from 'react-i18next';
import { useQuery } from '@tanstack/react-query';
import Animated, { FadeInDown } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { EmptyState, Loading } from '@/components/ui';
import { useColors, spacing, fontSize, fontWeight, borderRadius, fontFamily } from '@/utils/theme';
import { hallRoutes } from '@study-abroad/shared';
import { apiClient } from '@/lib/api/client';
import { qk } from '@/lib/query';
import type { VerifiedUserDto, VerifiedRankingResponse, RankingFilter } from './types';
import { RANKING_FILTERS } from './types';
import { VerifiedItem } from './VerifiedItem';
import { ChinaAdmitDashboard } from './ChinaAdmitDashboard';

export function VerifiedTab() {
  const { t } = useTranslation();
  const c = useColors();
  const insets = useSafeAreaInsets();

  const [verifiedFilter, setVerifiedFilter] = useState<RankingFilter>('all');
  const [refreshing, setRefreshing] = useState(false);

  const {
    data: verifiedData,
    isLoading,
    refetch,
  } = useQuery<VerifiedRankingResponse>({
    queryKey: qk.hall.verified(verifiedFilter),
    queryFn: () =>
      apiClient.get<VerifiedRankingResponse>(hallRoutes.verifiedRanking(), {
        params: { filter: verifiedFilter, limit: 50 },
      }),
    staleTime: 5 * 60_000,
  });

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    try {
      await refetch();
    } finally {
      setRefreshing(false);
    }
  }, [refetch]);

  const filterLabel = useCallback(
    (filter: RankingFilter): string => {
      const map: Record<RankingFilter, string> = {
        all: t('hall.verified.filters.all'),
        admitted: t('hall.verified.filters.admitted'),
        top20: t('hall.verified.filters.top20'),
        ivy: t('hall.verified.filters.ivy'),
      };
      return map[filter];
    },
    [t]
  );

  if (isLoading) return <Loading text={t('hall.loading')} />;

  const users = verifiedData?.items || [];
  const stats = verifiedData?.stats;

  return (
    <ScrollView
      showsVerticalScrollIndicator={false}
      contentContainerStyle={{ paddingBottom: insets.bottom + spacing['3xl'] }}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
    >
      {/* China Admit Dashboard — highest decision-value surface, shown first */}
      <Text style={[S.sectionTitle, { color: c.foreground }]}>
        {t('hall.verified.chinaAdmit.title')}
      </Text>
      <ChinaAdmitDashboard />

      {/* Verified-user ranking */}
      <Text style={[S.sectionTitle, { color: c.foreground, marginTop: spacing.xl }]}>
        {t('hall.verified.title')}
      </Text>

      {stats && (
        <Animated.View
          entering={FadeInDown.duration(400)}
          style={[S.verifiedStatsRow, { borderBottomColor: c.border }]}
        >
          <View style={S.vStatItem}>
            <Text style={[S.vStatValue, { color: c.primary }]}>{stats.totalVerified}</Text>
            <Text style={[S.vStatLabel, { color: c.foregroundMuted }]}>
              {t('hall.verified.stats.total')}
            </Text>
          </View>
          <View style={[S.vStatDivider, { backgroundColor: c.border }]} />
          <View style={S.vStatItem}>
            <Text style={[S.vStatValue, { color: c.success }]}>{stats.admittedCount}</Text>
            <Text style={[S.vStatLabel, { color: c.foregroundMuted }]}>
              {t('hall.verified.stats.admitted')}
            </Text>
          </View>
          <View style={[S.vStatDivider, { backgroundColor: c.border }]} />
          <View style={S.vStatItem}>
            <Text style={[S.vStatValue, { color: c.info }]}>
              {stats.avgGpa != null ? stats.avgGpa.toFixed(2) : '—'}
            </Text>
            <Text style={[S.vStatLabel, { color: c.foregroundMuted }]}>
              {t('hall.verified.stats.avgGpa')}
            </Text>
          </View>
        </Animated.View>
      )}

      {/* Filter chips */}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        style={S.filterScroll}
        contentContainerStyle={S.filterScrollContent}
      >
        {RANKING_FILTERS.map((filter) => {
          const active = verifiedFilter === filter;
          return (
            <TouchableOpacity
              key={filter}
              onPress={() => setVerifiedFilter(filter)}
              style={[S.filterChip, { backgroundColor: active ? c.primary : c.muted }]}
              accessibilityRole="button"
              accessibilityState={{ selected: active }}
              accessibilityLabel={filterLabel(filter)}
            >
              <Text
                style={[S.filterChipText, { color: active ? c.primaryForeground : c.foreground }]}
              >
                {filterLabel(filter)}
              </Text>
            </TouchableOpacity>
          );
        })}
      </ScrollView>

      {users.length === 0 ? (
        <EmptyState icon="shield-checkmark-outline" title={t('hall.verified.empty')} />
      ) : (
        users.map((item: VerifiedUserDto) => (
          <VerifiedItem key={item.caseId} item={item} colors={c} />
        ))
      )}
    </ScrollView>
  );
}

const S = StyleSheet.create({
  sectionTitle: {
    fontSize: fontSize.lg,
    fontWeight: fontWeight.semibold,
    marginBottom: spacing.md,
  },
  verifiedStatsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-around',
    paddingVertical: spacing.lg,
    borderBottomWidth: 1,
    marginBottom: spacing.md,
  },
  vStatItem: {
    alignItems: 'center',
    flex: 1,
  },
  vStatValue: {
    fontSize: fontSize['2xl'],
    fontWeight: fontWeight.bold,
    fontFamily: fontFamily.mono,
  },
  vStatLabel: {
    fontSize: fontSize.xs,
    marginTop: spacing.xs,
  },
  vStatDivider: {
    width: 1,
    height: 32,
  },
  filterScroll: {
    marginBottom: spacing.md,
  },
  filterScrollContent: {
    gap: spacing.sm,
    paddingRight: spacing.lg,
  },
  filterChip: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs + 2,
    borderRadius: borderRadius.full,
  },
  filterChipText: {
    fontSize: fontSize.xs,
    fontWeight: fontWeight.medium,
  },
});
