'use client';

import { useSearchParams } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { GraduationCap, Sparkles } from 'lucide-react';
import { PageContainer, PageHeader } from '@/components/layout';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { BrowseTab } from './_components/BrowseTab';
import { RecommendTab } from './_components/RecommendTab';

export default function SchoolsPage() {
  const t = useTranslations('schools');
  const searchParams = useSearchParams();
  const defaultTab = searchParams.get('tab') === 'recommend' ? 'recommend' : 'browse';

  return (
    <PageContainer maxWidth="7xl">
      <PageHeader
        title={t('title')}
        description={t('description')}
        icon={GraduationCap}
        color="violet"
      />

      <Tabs defaultValue={defaultTab} className="space-y-6">
        <TabsList className="mb-4">
          <TabsTrigger value="browse" className="gap-2">
            <GraduationCap className="h-4 w-4" />
            {t('tabBrowse')}
          </TabsTrigger>
          <TabsTrigger value="recommend" className="gap-2">
            <Sparkles className="h-4 w-4" />
            {t('tabAiRecommend')}
          </TabsTrigger>
        </TabsList>

        <TabsContent value="browse" className="mt-0">
          <BrowseTab />
        </TabsContent>

        <TabsContent value="recommend" className="mt-0">
          <RecommendTab />
        </TabsContent>
      </Tabs>
    </PageContainer>
  );
}
