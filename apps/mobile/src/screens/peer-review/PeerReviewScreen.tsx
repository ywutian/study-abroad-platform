import React from 'react';
import { View, StyleSheet } from 'react-native';
import { useTranslation } from 'react-i18next';
import { useQuery } from '@tanstack/react-query';
import { useColors, spacing } from '@/utils/theme';
import { EmptyState, Loading } from '@/components/ui';
import { PageContainer } from '@/components/layout/PageContainer';
import { PageHeader } from '@/components/layout/PageHeader';
import { apiClient } from '@/lib/api/client';

export default function PeerReviewScreen() {
  const { t } = useTranslation();
  const colors = useColors();

  const { data: reviews, isLoading } = useQuery({
    queryKey: ['peer-review', 'available'],
    queryFn: () => apiClient.get('/peer-reviews/available'),
  });

  return (
    <PageContainer onRefresh={() => {}}>
      <PageHeader
        title={t('peerReview.title')}
        description={t('peerReview.description')}
        icon="star-outline"
        color="#8b5cf6"
      />
      {isLoading ? (
        <Loading />
      ) : !reviews || (Array.isArray(reviews) && reviews.length === 0) ? (
        <EmptyState
          icon="star-outline"
          title={t('peerReview.empty.title')}
          description={t('peerReview.empty.description')}
        />
      ) : (
        <View style={styles.list}>{/* Peer review list will be rendered here */}</View>
      )}
    </PageContainer>
  );
}

const styles = StyleSheet.create({
  list: {
    gap: spacing.md,
  },
});
