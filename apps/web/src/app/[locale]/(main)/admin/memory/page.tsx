'use client';

import { useTranslations } from 'next-intl';
import { PageHeader } from '@/components/layout';
import { Brain } from 'lucide-react';
import { GlobalStatsSection } from './_components/global-stats-section';
import { UserQuerySection } from './_components/user-query-section';
import { MemoryBrowserSection } from './_components/memory-browser-section';
import { ConversationsSection } from './_components/conversations-section';
import { EntitiesSection } from './_components/entities-section';
import { DecaySection } from './_components/decay-section';

export default function AdminMemoryPage() {
  const t = useTranslations('admin.memory');

  return (
    <>
      <PageHeader title={t('title')} description={t('desc')} icon={Brain} color="violet" />

      <div className="mt-6 space-y-6">
        <GlobalStatsSection />
        <UserQuerySection />
        <MemoryBrowserSection />
        <ConversationsSection />
        <EntitiesSection />
        <DecaySection />
      </div>
    </>
  );
}
