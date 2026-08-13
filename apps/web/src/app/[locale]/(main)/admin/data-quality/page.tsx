'use client';

import { useTranslations } from 'next-intl';
import { useQuery } from '@tanstack/react-query';
import { BarChart3 } from 'lucide-react';
import { PageHeader } from '@/components/layout';
import { apiClient, STALE_TIME } from '@/lib/api';
import { adminRoutes } from '@study-abroad/shared';
import { DataQualityTab } from '../schools/_components/data-quality-tab';
import type { ComponentProps } from 'react';

export default function AdminDataQualityPage() {
  const t = useTranslations('admin');

  const {
    data: qualityData,
    isLoading,
    refetch,
  } = useQuery({
    queryKey: ['schoolDataQuality'],
    queryFn: () => apiClient.get(adminRoutes.schoolsDataQuality()),
    staleTime: STALE_TIME.STATIC,
  });

  return (
    <div className="space-y-6">
      <PageHeader
        title={t('dataQuality.title')}
        description={t('dataQuality.description')}
        icon={BarChart3}
        color="emerald"
      />
      <DataQualityTab
        qualityData={qualityData as ComponentProps<typeof DataQualityTab>['qualityData']}
        isLoading={isLoading}
        onRefresh={refetch}
      />
    </div>
  );
}
