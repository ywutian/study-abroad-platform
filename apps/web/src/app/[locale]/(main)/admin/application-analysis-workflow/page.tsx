'use client';

import { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useTranslations } from 'next-intl';
import { FileCheck2 } from 'lucide-react';

import { adminRoutes, type PaginatedApplicationAnalysisPolicyResponse } from '@study-abroad/shared';
import { PageHeader } from '@/components/layout';
import { Skeleton } from '@/components/ui/skeleton';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { apiClient } from '@/lib/api';

import { ActivateRollbackTab } from './_components/activate-rollback-tab';
import { AutomationTab } from './_components/automation-tab';
import { EvaluationsTab } from './_components/evaluations-tab';
import { EvidenceTab } from './_components/evidence-tab';
import { ExperimentsTab } from './_components/experiments-tab';
import { GatesTab } from './_components/gates-tab';
import { IncidentsTab } from './_components/incidents-tab';
import { LiveSignalsTab } from './_components/live-signals-tab';
import { PoliciesTab } from './_components/policies-tab';
import { ReplaysTab } from './_components/replays-tab';

export default function AdminApplicationAnalysisWorkflowPage() {
  const t = useTranslations('admin.applicationAnalysisWorkflow');
  const [tab, setTab] = useState('evidence');

  const { data, isLoading } = useQuery<PaginatedApplicationAnalysisPolicyResponse>({
    queryKey: ['applicationAnalysisPolicies'],
    queryFn: () =>
      apiClient.get(adminRoutes.applicationAnalysisWorkflowPolicies(), {
        params: { page: 1, pageSize: 50 },
      }),
  });

  const policies = useMemo(() => data?.items ?? [], [data]);

  return (
    <>
      <PageHeader
        title={t('title')}
        description={t('description')}
        icon={FileCheck2}
        color="violet"
      />

      {isLoading ? (
        <div className="mt-6 space-y-4">
          <Skeleton className="h-10 w-80 rounded-lg" />
          <Skeleton className="h-64 rounded-lg" />
        </div>
      ) : (
        <Tabs value={tab} onValueChange={setTab} className="mt-6">
          <TabsList>
            <TabsTrigger value="evidence">{t('tabs.evidence')}</TabsTrigger>
            <TabsTrigger value="policies">{t('tabs.policies')}</TabsTrigger>
            <TabsTrigger value="evaluations">{t('tabs.evaluations')}</TabsTrigger>
            <TabsTrigger value="replays">{t('tabs.replays')}</TabsTrigger>
            <TabsTrigger value="gates">{t('tabs.gates')}</TabsTrigger>
            <TabsTrigger value="activate">{t('tabs.activate')}</TabsTrigger>
            <TabsTrigger value="experiments">{t('tabs.experiments')}</TabsTrigger>
            <TabsTrigger value="automation">{t('tabs.automation')}</TabsTrigger>
            <TabsTrigger value="incidents">{t('tabs.incidents')}</TabsTrigger>
            <TabsTrigger value="liveSignals">{t('tabs.liveSignals')}</TabsTrigger>
          </TabsList>

          <TabsContent value="evidence" className="mt-4">
            <EvidenceTab policiesReady={policies.length > 0} />
          </TabsContent>
          <TabsContent value="policies" className="mt-4">
            <PoliciesTab policies={policies} />
          </TabsContent>
          <TabsContent value="evaluations" className="mt-4">
            <EvaluationsTab />
          </TabsContent>
          <TabsContent value="replays" className="mt-4">
            <ReplaysTab />
          </TabsContent>
          <TabsContent value="gates" className="mt-4">
            <GatesTab policies={policies} />
          </TabsContent>
          <TabsContent value="activate" className="mt-4">
            <ActivateRollbackTab policies={policies} />
          </TabsContent>
          <TabsContent value="experiments" className="mt-4">
            <ExperimentsTab policies={policies} />
          </TabsContent>
          <TabsContent value="automation" className="mt-4">
            <AutomationTab />
          </TabsContent>
          <TabsContent value="incidents" className="mt-4">
            <IncidentsTab />
          </TabsContent>
          <TabsContent value="liveSignals" className="mt-4">
            <LiveSignalsTab />
          </TabsContent>
        </Tabs>
      )}
    </>
  );
}
