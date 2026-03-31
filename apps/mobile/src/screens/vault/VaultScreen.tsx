import React from 'react';
import { View, StyleSheet } from 'react-native';
import { useTranslation } from 'react-i18next';
import { useQuery } from '@tanstack/react-query';
import { useColors, spacing } from '@/utils/theme';
import { EmptyState, Loading } from '@/components/ui';
import { PageContainer } from '@/components/layout/PageContainer';
import { PageHeader } from '@/components/layout/PageHeader';
import { API_ROUTES } from '@study-abroad/shared';
import { apiClient } from '@/lib/api/client';

export default function VaultScreen() {
  const { t } = useTranslation();
  const colors = useColors();

  const { data: items, isLoading } = useQuery({
    queryKey: ['vault'],
    queryFn: () => apiClient.get(API_ROUTES.VAULTS),
  });

  return (
    <PageContainer onRefresh={() => {}}>
      <PageHeader
        title={t('vault.title')}
        description={t('vault.description')}
        icon="lock-closed-outline"
        color="#10b981"
      />
      {isLoading ? (
        <Loading />
      ) : !items || (Array.isArray(items) && items.length === 0) ? (
        <EmptyState
          icon="lock-closed-outline"
          title={t('vault.empty.title')}
          description={t('vault.empty.description')}
        />
      ) : (
        <View style={styles.list}>{/* Vault items will be rendered here */}</View>
      )}
    </PageContainer>
  );
}

const styles = StyleSheet.create({
  list: {
    gap: spacing.md,
  },
});
