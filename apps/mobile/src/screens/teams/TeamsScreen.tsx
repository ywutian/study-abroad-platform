import React from 'react';
import { View, StyleSheet } from 'react-native';
import { useTranslation } from 'react-i18next';
import { useQuery } from '@tanstack/react-query';
import { useColors, spacing } from '@/utils/theme';
import { EmptyState, Loading, Segment } from '@/components/ui';
import { PageContainer } from '@/components/layout/PageContainer';
import { PageHeader } from '@/components/layout/PageHeader';
import { apiClient } from '@/lib/api/client';

export default function TeamsScreen() {
  const { t } = useTranslation();
  const colors = useColors();

  const { data: teams, isLoading } = useQuery({
    queryKey: ['teams'],
    queryFn: () => apiClient.get('/teams'),
  });

  return (
    <PageContainer onRefresh={() => {}}>
      <PageHeader
        title={t('teams.title')}
        description={t('teams.description')}
        icon="people-outline"
        color="#3b82f6"
      />
      {isLoading ? (
        <Loading />
      ) : !teams || (Array.isArray(teams) && teams.length === 0) ? (
        <EmptyState
          icon="people-outline"
          title={t('teams.empty.title')}
          description={t('teams.empty.description')}
        />
      ) : (
        <View style={styles.list}>{/* Team list will be rendered here */}</View>
      )}
    </PageContainer>
  );
}

const styles = StyleSheet.create({
  list: {
    gap: spacing.md,
  },
});
