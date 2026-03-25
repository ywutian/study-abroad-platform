import React from 'react';
import { View, StyleSheet } from 'react-native';
import { useTranslation } from 'react-i18next';
import { useQuery } from '@tanstack/react-query';
import { useColors, spacing } from '@/utils/theme';
import { EmptyState, Loading } from '@/components/ui';
import { PageContainer } from '@/components/layout/PageContainer';
import { PageHeader } from '@/components/layout/PageHeader';
import { apiClient } from '@/lib/api/client';

export default function VerificationScreen() {
  const { t } = useTranslation();
  const colors = useColors();

  const { data: status, isLoading } = useQuery({
    queryKey: ['verification', 'status'],
    queryFn: () => apiClient.get('/verifications/status'),
  });

  return (
    <PageContainer onRefresh={() => {}}>
      <PageHeader
        title={t('verification.title')}
        description={t('verification.description')}
        icon="shield-checkmark-outline"
        color="#10b981"
      />
      {isLoading ? (
        <Loading />
      ) : (
        <View style={styles.content}>
          {/* Verification status and submission form will go here */}
          <EmptyState
            icon="shield-checkmark-outline"
            title={t('verification.empty.title')}
            description={t('verification.empty.description')}
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
