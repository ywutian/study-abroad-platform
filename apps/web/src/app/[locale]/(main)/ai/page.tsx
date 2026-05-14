'use client';

import { useTranslations } from 'next-intl';
import { MessageCircle } from 'lucide-react';
import { PageContainer, PageHeader } from '@/components/layout';
import { AgentChat } from '@/components/features/agent-chat/agent-chat';

export default function AIPage() {
  const t = useTranslations('agentChat');

  return (
    <PageContainer maxWidth="4xl" className="lg:flex lg:flex-col lg:h-[calc(100dvh-7.5rem)]">
      <PageHeader
        title={t('title')}
        description={t('welcomeDesc')}
        icon={MessageCircle}
        color="violet"
      />

      <div className="bg-card rounded-xl border shadow-sm overflow-hidden lg:flex-1 lg:min-h-0 lg:flex lg:flex-col">
        <AgentChat
          showHeader={true}
          showQuickActions={true}
          className="min-h-[500px] lg:flex-1 lg:min-h-0"
        />
      </div>
    </PageContainer>
  );
}
