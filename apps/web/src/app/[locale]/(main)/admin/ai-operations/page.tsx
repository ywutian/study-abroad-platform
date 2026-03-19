'use client';

import { useState } from 'react';
import { useTranslations } from 'next-intl';
import { useSearchParams } from 'next/navigation';
import { useRouter } from '@/lib/i18n/navigation';
import dynamic from 'next/dynamic';
import { Bot, Activity, Settings, BarChart3, ShieldCheck, Users } from 'lucide-react';

import { PageHeader } from '@/components/layout';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';

const OverviewTab = dynamic(
  () => import('./_components/overview-tab').then((m) => ({ default: m.OverviewTab })),
  { ssr: false }
);
const ConfigurationTab = dynamic(
  () => import('./_components/configuration-tab').then((m) => ({ default: m.ConfigurationTab })),
  { ssr: false }
);
const PerformanceTab = dynamic(
  () => import('./_components/performance-tab').then((m) => ({ default: m.PerformanceTab })),
  { ssr: false }
);
const ReliabilityTab = dynamic(
  () => import('./_components/reliability-tab').then((m) => ({ default: m.ReliabilityTab })),
  { ssr: false }
);
const EngagementTab = dynamic(
  () => import('./_components/engagement-tab').then((m) => ({ default: m.EngagementTab })),
  { ssr: false }
);

const VALID_TABS = ['overview', 'config', 'performance', 'reliability', 'engagement'] as const;
type AiOpsTab = (typeof VALID_TABS)[number];

const TAB_CONFIG = [
  { value: 'overview' as const, icon: Activity, labelKey: 'admin.aiOps.tabs.overview' },
  { value: 'config' as const, icon: Settings, labelKey: 'admin.aiOps.tabs.config' },
  { value: 'performance' as const, icon: BarChart3, labelKey: 'admin.aiOps.tabs.performance' },
  { value: 'reliability' as const, icon: ShieldCheck, labelKey: 'admin.aiOps.tabs.reliability' },
  { value: 'engagement' as const, icon: Users, labelKey: 'admin.aiOps.tabs.engagement' },
];

export default function AdminAiOperationsPage() {
  const t = useTranslations();
  const router = useRouter();
  const searchParams = useSearchParams();

  const initialTab = VALID_TABS.includes(searchParams.get('tab') as AiOpsTab)
    ? (searchParams.get('tab') as AiOpsTab)
    : 'overview';
  const [activeTab, setActiveTab] = useState<AiOpsTab>(initialTab);

  const handleTabChange = (tab: string) => {
    setActiveTab(tab as AiOpsTab);
    const params = new URLSearchParams(searchParams.toString());
    if (tab === 'overview') params.delete('tab');
    else params.set('tab', tab);
    const qs = params.toString();
    router.replace(`/admin/ai-operations${qs ? `?${qs}` : ''}`, { scroll: false });
  };

  return (
    <>
      <PageHeader
        title={t('admin.aiOps.title')}
        description={t('admin.aiOps.description')}
        icon={Bot}
        color="blue"
      />

      <Tabs value={activeTab} onValueChange={handleTabChange} className="mt-6">
        <TabsList>
          {TAB_CONFIG.map(({ value, icon: Icon, labelKey }) => (
            <TabsTrigger key={value} value={value} className="gap-1.5">
              <Icon className="h-4 w-4" />
              {t(labelKey)}
            </TabsTrigger>
          ))}
        </TabsList>

        <TabsContent value="overview" className="mt-4">
          <OverviewTab />
        </TabsContent>
        <TabsContent value="config" className="mt-4">
          <ConfigurationTab />
        </TabsContent>
        <TabsContent value="performance" className="mt-4">
          <PerformanceTab />
        </TabsContent>
        <TabsContent value="reliability" className="mt-4">
          <ReliabilityTab />
        </TabsContent>
        <TabsContent value="engagement" className="mt-4">
          <EngagementTab />
        </TabsContent>
      </Tabs>
    </>
  );
}
