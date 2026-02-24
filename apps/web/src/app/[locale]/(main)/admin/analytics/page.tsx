'use client';

import { useTranslations } from 'next-intl';
import { PageHeader } from '@/components/layout';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { TrendingUp } from 'lucide-react';
import { TokenUsageTab } from './_components/token-usage-tab';
import { EngagementTab } from './_components/engagement-tab';
import { AgentPerformanceTab } from './_components/agent-performance-tab';

export default function AdminAnalyticsPage() {
  const t = useTranslations('admin.analytics');

  return (
    <>
      <PageHeader
        title={t('title')}
        description={t('description')}
        icon={TrendingUp}
        color="emerald"
      />
      <Tabs defaultValue="tokenUsage" className="mt-6">
        <TabsList>
          <TabsTrigger value="tokenUsage">{t('tabs.tokenUsage')}</TabsTrigger>
          <TabsTrigger value="engagement">{t('tabs.engagement')}</TabsTrigger>
          <TabsTrigger value="agentPerformance">{t('tabs.agentPerformance')}</TabsTrigger>
        </TabsList>
        <TabsContent value="tokenUsage" className="mt-4">
          <TokenUsageTab />
        </TabsContent>
        <TabsContent value="engagement" className="mt-4">
          <EngagementTab />
        </TabsContent>
        <TabsContent value="agentPerformance" className="mt-4">
          <AgentPerformanceTab />
        </TabsContent>
      </Tabs>
    </>
  );
}
