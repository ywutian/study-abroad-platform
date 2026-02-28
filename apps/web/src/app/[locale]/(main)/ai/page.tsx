'use client';

import { useTranslations } from 'next-intl';
import { Bot } from 'lucide-react';
import { PageContainer, PageHeader } from '@/components/layout';
import { AgentChat } from '@/components/features/agent-chat/agent-chat';

export default function AIPage() {
  const t = useTranslations('agentChat');

  return (
    <PageContainer maxWidth="4xl">
      <PageHeader title={t('title')} description={t('welcomeDesc')} icon={Bot} color="violet" />

      <div className="bg-card rounded-xl border shadow-sm overflow-hidden">
        <AgentChat
          showHeader={true}
          showQuickActions={true}
          className="h-[calc(100vh-250px)] min-h-[500px]"
        />
      </div>
    </PageContainer>
  );
}
