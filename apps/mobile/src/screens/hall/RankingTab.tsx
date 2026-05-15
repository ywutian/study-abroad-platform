import React, { useState, useCallback } from 'react';
import { RefreshControl } from 'react-native';
import { FlashList } from '@shopify/flash-list';
import { useTranslation } from 'react-i18next';
import { useQuery } from '@tanstack/react-query';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { EmptyState, Loading } from '@/components/ui';
import { useColors, spacing } from '@/utils/theme';
import { API_ROUTES } from '@study-abroad/shared';
import { apiClient } from '@/lib/api/client';
import type { RankingResult } from './types';
import { RankingItem } from './RankingItem';

export function RankingTab() {
  const { t } = useTranslation();
  const c = useColors();
  const insets = useSafeAreaInsets();
  const [refreshing, setRefreshing] = useState(false);

  const {
    data: rankingData,
    isLoading,
    refetch,
  } = useQuery<RankingResult[]>({
    queryKey: ['hall-target-ranking'],
    queryFn: () => apiClient.get<RankingResult[]>(`${API_ROUTES.HALLS}/target-ranking`),
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

  const renderRankingCard = useCallback(
    ({ item }: { item: RankingResult }) => <RankingItem item={item} colors={c} />,
    [c]
  );

  if (isLoading) return <Loading text={t('hallOfFame.loading')} />;

  const rankings = rankingData || [];

  if (rankings.length === 0) {
    return (
      <EmptyState
        icon="bar-chart-outline"
        title={t('hallOfFame.ranking.empty')}
        description={t('hallOfFame.ranking.emptyDesc')}
      />
    );
  }

  return (
    <FlashList
      data={rankings}
      renderItem={renderRankingCard}
      keyExtractor={(item) => item.schoolId}
      contentContainerStyle={{ paddingBottom: insets.bottom + spacing['3xl'] }}
      showsVerticalScrollIndicator={false}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
    />
  );
}
