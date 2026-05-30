import React from 'react';
import { View, StyleSheet } from 'react-native';
import { useTranslation } from 'react-i18next';
import { useQuery } from '@tanstack/react-query';
import { spacing } from '@/utils/theme';
import { EmptyState, Loading } from '@/components/ui';
import { PageContainer } from '@/components/layout/PageContainer';
import { PageHeader } from '@/components/layout/PageHeader';
import { API_ROUTES } from '@study-abroad/shared';
import { apiClient } from '@/lib/api/client';

export default function PeerReviewScreen() {
  const { t } = useTranslation();

  const { data: reviews, isLoading } = useQuery({
    queryKey: ['peer-review', 'available'],
    queryFn: () => apiClient.get(`${API_ROUTES.PEER_REVIEWS}/available`),
  });

  return (
    <PageContainer onRefresh={() => {}} variant="tool">
      <PageHeader
        title={t('peerReview.title')}
        description={t('peerReview.description')}
        icon="star-outline"
        variant="tool"
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
