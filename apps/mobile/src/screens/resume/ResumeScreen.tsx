import React from 'react';
import { View, StyleSheet } from 'react-native';
import { useTranslation } from 'react-i18next';
import { useQuery } from '@tanstack/react-query';
import { useColors, spacing } from '@/utils/theme';
import { EmptyState, Loading } from '@/components/ui';
import { PageContainer } from '@/components/layout/PageContainer';
import { PageHeader } from '@/components/layout/PageHeader';
import { apiClient } from '@/lib/api/client';

export default function ResumeScreen() {
  const { t } = useTranslation();
  const colors = useColors();

  const { data: resumes, isLoading } = useQuery({
    queryKey: ['resumes'],
    queryFn: () => apiClient.get('/resumes'),
  });

  return (
    <PageContainer onRefresh={() => {}}>
      <PageHeader
        title={t('resume.title')}
        description={t('resume.description')}
        icon="document-text-outline"
        color="#6366f1"
      />
      {isLoading ? (
        <Loading />
      ) : !resumes || (Array.isArray(resumes) && resumes.length === 0) ? (
        <EmptyState
          icon="document-text-outline"
          title={t('resume.empty.title')}
          description={t('resume.empty.description')}
        />
      ) : (
        <View style={styles.list}>{/* Resume list will be rendered here */}</View>
      )}
    </PageContainer>
  );
}

const styles = StyleSheet.create({
  list: {
    gap: spacing.md,
  },
});
