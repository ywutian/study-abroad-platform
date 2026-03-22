'use client';

import { useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { useRouter } from '@/lib/i18n/navigation';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { PageHeader } from '@/components/layout';
import { GraduationCap, List, Lightbulb, AlertTriangle, Upload, Layers } from 'lucide-react';
import { SchoolListTab } from './_components/school-list-tab';
import { SuggestionsTab } from './_components/suggestions-tab';
import { ReviewTab } from './_components/review-tab';
import { BatchImportTab } from './_components/batch-import-tab';
import { TierOverviewTab } from './_components/tier-overview-tab';

const VALID_TABS = ['list', 'tiers', 'suggestions', 'review', 'import'] as const;
type HighSchoolTab = (typeof VALID_TABS)[number];

export default function AdminHighSchoolsPage() {
  const t = useTranslations('admin.highSchools');
  const router = useRouter();
  const searchParams = useSearchParams();

  const initialTab = VALID_TABS.includes(searchParams.get('tab') as HighSchoolTab)
    ? (searchParams.get('tab') as HighSchoolTab)
    : 'list';
  const [activeTab, setActiveTab] = useState<string>(initialTab);

  const handleTabChange = (tab: string) => {
    setActiveTab(tab);
    const params = new URLSearchParams(searchParams.toString());
    if (tab === 'list') params.delete('tab');
    else params.set('tab', tab);
    const qs = params.toString();
    router.replace(`/admin/high-schools${qs ? `?${qs}` : ''}`, { scroll: false });
  };

  return (
    <>
      <PageHeader
        title={t('title')}
        description={t('description')}
        icon={GraduationCap}
        color="violet"
      />

      <div className="mt-6">
        <Tabs value={activeTab} onValueChange={handleTabChange} className="space-y-6">
          <TabsList>
            <TabsTrigger value="list" className="flex items-center gap-2">
              <List className="h-4 w-4" />
              {t('tabs.list')}
            </TabsTrigger>
            <TabsTrigger value="tiers" className="flex items-center gap-2">
              <Layers className="h-4 w-4" />
              {t('tabs.tiers')}
            </TabsTrigger>
            <TabsTrigger value="suggestions" className="flex items-center gap-2">
              <Lightbulb className="h-4 w-4" />
              {t('tabs.suggestions')}
            </TabsTrigger>
            <TabsTrigger value="review" className="flex items-center gap-2">
              <AlertTriangle className="h-4 w-4" />
              {t('tabs.review')}
            </TabsTrigger>
            <TabsTrigger value="import" className="flex items-center gap-2">
              <Upload className="h-4 w-4" />
              {t('tabs.import')}
            </TabsTrigger>
          </TabsList>

          <TabsContent value="list">
            <SchoolListTab />
          </TabsContent>

          <TabsContent value="tiers">
            <TierOverviewTab />
          </TabsContent>

          <TabsContent value="suggestions">
            <SuggestionsTab />
          </TabsContent>

          <TabsContent value="review">
            <ReviewTab />
          </TabsContent>

          <TabsContent value="import">
            <BatchImportTab />
          </TabsContent>
        </Tabs>
      </div>
    </>
  );
}
