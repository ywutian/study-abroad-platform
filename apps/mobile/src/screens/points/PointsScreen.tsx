import React from 'react';
import { View, StyleSheet } from 'react-native';
import { useTranslation } from 'react-i18next';
import { useQuery } from '@tanstack/react-query';
import { useColors, spacing } from '@/utils/theme';
import { EmptyState, Loading } from '@/components/ui';
import { StatsRow } from '@/components/ui/StatsRow';
import { PageContainer } from '@/components/layout/PageContainer';
import { PageHeader } from '@/components/layout/PageHeader';
import { apiClient } from '@/lib/api/client';

export default function PointsScreen() {
  const { t } = useTranslation();
  const colors = useColors();

  const { data: balance, isLoading } = useQuery({
    queryKey: ['points', 'balance'],
    queryFn: () => apiClient.get('/points/balance'),
  });

  return (
    <PageContainer onRefresh={() => {}}>
      <PageHeader
        title={t('points.title')}
        description={t('points.description')}
        icon="trophy-outline"
        color="#f59e0b"
      />
      {isLoading ? (
        <Loading />
      ) : (
        <View style={styles.content}>
          {/* Points balance, badges grid, and history will go here */}
          <EmptyState
            icon="trophy-outline"
            title={t('points.empty.title')}
            description={t('points.empty.description')}
          />
        </View>
      )}
    </PageContainer>
  );
}

const styles = StyleSheet.create({
  content: {
    gap: spacing.lg,
  },
});
