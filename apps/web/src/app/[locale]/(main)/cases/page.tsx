'use client';

import { useState } from 'react';
import { useTranslations } from 'next-intl';
import { useSearchParams } from 'next/navigation';
import { useRouter } from '@/lib/i18n/navigation';
import dynamic from 'next/dynamic';
import { BookOpen, FileText } from 'lucide-react';

import { PageContainer, PageHeader } from '@/components/layout';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';

const CasesTab = dynamic(
  () => import('./_components/cases-tab').then((m) => ({ default: m.CasesTab })),
  { ssr: false }
);
const EssaysTab = dynamic(
  () => import('./_components/essays-tab').then((m) => ({ default: m.EssaysTab })),
  { ssr: false }
);

const VALID_TABS = ['cases', 'essays'] as const;
type CasesPageTab = (typeof VALID_TABS)[number];

const TAB_CONFIG = [
  { value: 'cases' as const, icon: BookOpen, labelKey: 'cases.tabs.cases' },
  { value: 'essays' as const, icon: FileText, labelKey: 'cases.tabs.essays' },
];

export default function CasesPage() {
  const t = useTranslations();
  const router = useRouter();
  const searchParams = useSearchParams();

  const initialTab = VALID_TABS.includes(searchParams.get('tab') as CasesPageTab)
    ? (searchParams.get('tab') as CasesPageTab)
    : 'cases';
  const [activeTab, setActiveTab] = useState<CasesPageTab>(initialTab);

  const handleTabChange = (tab: string) => {
    setActiveTab(tab as CasesPageTab);
    const params = new URLSearchParams(searchParams.toString());
    if (tab === 'cases') params.delete('tab');
    else params.set('tab', tab);
    const qs = params.toString();
    router.replace(`/cases${qs ? `?${qs}` : ''}`, { scroll: false });
  };

  return (
    <PageContainer maxWidth="7xl">
      <PageHeader
        title={t('cases.title')}
        description={t('cases.description')}
        icon={BookOpen}
        color="emerald"
      />

      <Tabs value={activeTab} onValueChange={handleTabChange}>
        <TabsList className="mb-6">
          {TAB_CONFIG.map(({ value, icon: Icon, labelKey }) => (
            <TabsTrigger key={value} value={value} className="gap-1.5">
              <Icon className="h-4 w-4" />
              {t(labelKey)}
            </TabsTrigger>
          ))}
        </TabsList>

        <TabsContent value="cases">
          <CasesTab />
        </TabsContent>
        <TabsContent value="essays">
          <EssaysTab />
        </TabsContent>
      </Tabs>
    </PageContainer>
  );
}
