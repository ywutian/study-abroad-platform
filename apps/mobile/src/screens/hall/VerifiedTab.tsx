import React, { useState, useCallback } from 'react';
import { View, Text, ScrollView, TouchableOpacity, RefreshControl, StyleSheet } from 'react-native';
import { FlashList } from '@shopify/flash-list';
import { useTranslation } from 'react-i18next';
import { useQuery } from '@tanstack/react-query';
import Animated, { FadeInDown } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { EmptyState, Loading } from '@/components/ui';
import { useColors, spacing, fontSize, fontWeight, borderRadius } from '@/utils/theme';
import { hallRoutes } from '@study-abroad/shared';
import { apiClient } from '@/lib/api/client';
import type { VerifiedUserDto, VerifiedRankingResponse, RankingFilter } from './types';
import { RANKING_FILTERS } from './types';
import { VerifiedItem } from './VerifiedItem';

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
    queryKey: ['hall-verified', verifiedFilter],
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
        all: t('hallOfFame.verified.filters.all', 'All'),
        admitted: t('hallOfFame.verified.filters.admitted', 'Admitted'),
        top20: t('hallOfFame.verified.filters.top20', 'Top 20'),
        ivy: t('hallOfFame.verified.filters.ivy', 'Ivy'),
      };
      return map[filter];
    },
    [t]
  );

  const renderVerifiedUserCard = useCallback(
    ({ item }: { item: VerifiedUserDto }) => <VerifiedItem item={item} colors={c} />,
    [c]
  );

  if (isLoading) return <Loading text={t('hallOfFame.loading', 'Loading...')} />;

  const users = verifiedData?.items || [];
  const stats = verifiedData?.stats;

  return (
    <View style={{ flex: 1 }}>
      {/* Stats summary */}
      {stats && (
        <Animated.View
          entering={FadeInDown.duration(400)}
          style={[S.verifiedStatsRow, { borderBottomColor: c.border }]}
        >
          <View style={S.vStatItem}>
            <Text style={[S.vStatValue, { color: c.primary }]}>{stats.totalVerified}</Text>
            <Text style={[S.vStatLabel, { color: c.foregroundMuted }]}>
              {t('hallOfFame.verified.stats.total', 'Verified')}
            </Text>
          </View>
          <View style={[S.vStatDivider, { backgroundColor: c.border }]} />
          <View style={S.vStatItem}>
            <Text style={[S.vStatValue, { color: c.success }]}>{stats.admittedCount}</Text>
            <Text style={[S.vStatLabel, { color: c.foregroundMuted }]}>
              {t('hallOfFame.verified.stats.admitted', 'Admitted')}
            </Text>
          </View>
          <View style={[S.vStatDivider, { backgroundColor: c.border }]} />
          <View style={S.vStatItem}>
            <Text style={[S.vStatValue, { color: c.info }]}>{stats.avgGpa.toFixed(2)}</Text>
            <Text style={[S.vStatLabel, { color: c.foregroundMuted }]}>
              {t('hallOfFame.verified.stats.avgGpa', 'Avg GPA')}
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
        <EmptyState
          icon="shield-checkmark-outline"
          title={t('hallOfFame.verified.empty', 'No verified users')}
        />
      ) : (
        <FlashList
          data={users}
          renderItem={renderVerifiedUserCard}
          keyExtractor={(item) => item.userId}
          contentContainerStyle={{ paddingBottom: insets.bottom + spacing['3xl'] }}
          showsVerticalScrollIndicator={false}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
        />
      )}
    </View>
  );
}

const S = StyleSheet.create({
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
