import React, { useState, useCallback } from 'react';
import { View, StyleSheet, LayoutAnimation } from 'react-native';
import { useTranslation } from 'react-i18next';
import { useQuery } from '@tanstack/react-query';

import { EmptyState, Loading } from '@/components/ui';
import { recommendationRoutes } from '@study-abroad/shared';
import { apiClient } from '@/lib/api/client';
import { useColors, spacing } from '@/utils/theme';

import { HistoryItemCard } from './HistoryItemCard';
import { RecommendationResult, recommendationKeys } from './types';

interface HistoryTabProps {
  onViewResult: (item: RecommendationResult) => void;
  onSwitchToGenerate: () => void;
}

export function HistoryTab({ onViewResult, onSwitchToGenerate }: HistoryTabProps) {
  const { t } = useTranslation();
  const colors = useColors();

  const [expandedHistoryId, setExpandedHistoryId] = useState<string | null>(null);

  const { data: history, isLoading: historyLoading } = useQuery<RecommendationResult[]>({
    queryKey: recommendationKeys.history(),
    queryFn: () => apiClient.get(recommendationRoutes.history()),
    staleTime: 5 * 60_000,
  });

  const toggleHistoryExpand = useCallback((id: string) => {
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    setExpandedHistoryId((prev) => (prev === id ? null : id));
  }, []);

  if (historyLoading) {
    return <Loading text={t('recommendation.loadingHistory', 'Loading history...')} />;
  }

  if (!history || history.length === 0) {
    return (
      <EmptyState
        icon="time-outline"
        title={t('recommendation.noHistory', 'No recommendations yet')}
        description={t(
          'recommendation.noHistoryDesc',
          'Generate your first AI recommendation to get started.'
        )}
        action={{
          label: t('recommendation.goGenerate', 'Generate Now'),
          onPress: onSwitchToGenerate,
        }}
      />
    );
  }

  return (
    <View style={styles.container}>
      {history.map((item) => (
        <HistoryItemCard
          key={item.id}
          item={item}
          isExpanded={expandedHistoryId === item.id}
          onToggle={toggleHistoryExpand}
          onViewResult={onViewResult}
          colors={colors}
        />
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    gap: spacing.xs,
  },
});
