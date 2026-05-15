'use client';

import { useSearchParams } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { GraduationCap, Lightbulb, ListChecks, Search, ShieldCheck } from 'lucide-react';
import { EnterpriseStatusStrip, PageContainer, PageHeader } from '@/components/layout';
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from '@/components/ui/breadcrumb';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Link } from '@/lib/i18n/navigation';
import { BrowseTab } from './_components/BrowseTab';
import { RecommendTab } from './_components/RecommendTab';

export default function SchoolsPage() {
  const t = useTranslations('schools');
  const tc = useTranslations('common');
  const statusT = useTranslations('enterpriseStatus');
  const searchParams = useSearchParams();
  const defaultTab = searchParams.get('tab') === 'recommend' ? 'recommend' : 'browse';

  return (
    <PageContainer maxWidth="fluid">
      <Breadcrumb className="mb-2">
        <BreadcrumbList>
          <BreadcrumbItem>
            <BreadcrumbLink asChild>
              <Link href="/">{tc('home')}</Link>
            </BreadcrumbLink>
          </BreadcrumbItem>
          <BreadcrumbSeparator />
          <BreadcrumbItem>
            <BreadcrumbPage>{t('title')}</BreadcrumbPage>
          </BreadcrumbItem>
        </BreadcrumbList>
      </Breadcrumb>

      <PageHeader
        title={t('title')}
        description={t('description')}
        icon={GraduationCap}
        color="blue"
      />

      <EnterpriseStatusStrip
        title={statusT('schools.title')}
        description={statusT('schools.description')}
        items={[
          {
            tone: 'ready',
            label: statusT('schools.catalog'),
            value: statusT('states.ready'),
            description: statusT('schools.catalogDesc'),
            icon: Search,
          },
          {
            tone: 'attention',
            label: statusT('schools.portfolio'),
            value: statusT('states.attention'),
            description: statusT('schools.portfolioDesc'),
            icon: ListChecks,
          },
          {
            tone: 'attention',
            label: statusT('schools.recommend'),
            value: statusT('states.nextAction'),
            description: statusT('schools.recommendDesc'),
            icon: Lightbulb,
          },
          {
            tone: 'verified',
            label: statusT('schools.verification'),
            value: statusT('states.verified'),
            description: statusT('schools.verificationDesc'),
            icon: ShieldCheck,
          },
        ]}
      />

      <Tabs defaultValue={defaultTab} className="space-y-6">
        <TabsList className="mb-4 h-11 bg-muted/80 p-1">
          <TabsTrigger
            value="browse"
            className="h-9 gap-2 px-6 text-sm data-[state=active]:bg-background data-[state=active]:shadow-sm"
          >
            <GraduationCap className="h-4 w-4" />
            {t('tabBrowse')}
          </TabsTrigger>
          <TabsTrigger
            value="recommend"
            className="h-9 gap-2 px-6 text-sm data-[state=active]:bg-background data-[state=active]:shadow-sm"
          >
            <span className="rounded bg-blue-100 px-1.5 py-0.5 text-2xs font-bold text-blue-700 dark:bg-blue-900/40 dark:text-blue-300">
              AI
            </span>
            {t('tabAiRecommend')}
          </TabsTrigger>
        </TabsList>

        <TabsContent value="browse" className="mt-0 min-w-0">
          <BrowseTab />
        </TabsContent>

        <TabsContent value="recommend" className="mt-0">
          <RecommendTab />
        </TabsContent>
      </Tabs>
    </PageContainer>
  );
}
