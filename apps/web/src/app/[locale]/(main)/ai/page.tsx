'use client';

import { useTranslations } from 'next-intl';
import { AgentChat } from '@/components/features/agent-chat/agent-chat';

export default function AIPage() {
  const t = useTranslations('agentChat');

  return (
    <div className="container mx-auto py-6 px-4 max-w-4xl">
      <div className="mb-6">
        <h1 className="text-title">{t('title')}</h1>
        <p className="text-muted-foreground mt-1">{t('welcomeDesc')}</p>
      </div>

      <div className="bg-card rounded-xl border shadow-sm overflow-hidden">
        <AgentChat
          showHeader={true}
          showQuickActions={true}
          className="h-[calc(100vh-250px)] min-h-[500px]"
        />
      </div>
    </div>
  );
}
