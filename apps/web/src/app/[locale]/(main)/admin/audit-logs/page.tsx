'use client';

import { useTranslations } from 'next-intl';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { PageHeader } from '@/components/layout';
import { ScrollText, MessageCircle } from 'lucide-react';
import { AdminAuditTab } from './_components/admin-audit-tab';
import { AgentAuditTab } from './_components/agent-audit-tab';

export default function AdminAuditLogsPage() {
  const t = useTranslations('admin');

  return (
    <>
      <PageHeader
        title={t('auditLogs.title')}
        description={t('auditLogs.description')}
        icon={ScrollText}
        color="slate"
      />

      <Tabs defaultValue="admin" className="mt-6">
        <TabsList>
          <TabsTrigger value="admin">{t('auditLogs.adminTab')}</TabsTrigger>
          <TabsTrigger value="agent">
            <MessageCircle className="h-3.5 w-3.5 mr-1.5" />
            {t('auditLogs.agentTab')}
          </TabsTrigger>
        </TabsList>

        <TabsContent value="admin">
          <AdminAuditTab />
        </TabsContent>

        <TabsContent value="agent">
          <AgentAuditTab />
        </TabsContent>
      </Tabs>
    </>
  );
}
