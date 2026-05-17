'use client';

import { useState } from 'react';
import { useTranslations } from 'next-intl';
import { useSearchParams } from 'next/navigation';
import { useRouter } from '@/lib/i18n/navigation';
import dynamic from 'next/dynamic';
import { BookOpen, FileText, BadgeCheck, ArrowRight } from 'lucide-react';

import { Link } from '@/lib/i18n/navigation';
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

      {/* Cross-link to the Verified China Admit Dashboard */}
      <Link
        href="/hall?tab=verified"
        className="mb-6 flex items-center gap-3 rounded-xl border border-indigo-200 bg-indigo-50 p-3 transition-colors hover:bg-indigo-100 dark:border-indigo-900 dark:bg-indigo-950/40 dark:hover:bg-indigo-950/70"
      >
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-indigo-500/15 text-indigo-600 dark:text-indigo-400">
          <BadgeCheck className="h-5 w-5" />
        </div>
        <div className="min-w-0 flex-1">
          <p className="font-semibold text-sm">{t('cases.verifiedBanner.title')}</p>
          <p className="text-xs text-muted-foreground">{t('cases.verifiedBanner.desc')}</p>
        </div>
        <span className="flex shrink-0 items-center gap-1 text-sm font-medium text-indigo-600 dark:text-indigo-400">
          {t('cases.verifiedBanner.action')}
          <ArrowRight className="h-4 w-4" />
        </span>
      </Link>

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
