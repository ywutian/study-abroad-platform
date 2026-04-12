'use client';

import { useEffect, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useTranslations } from 'next-intl';

import {
  adminRoutes,
  type ApplicationAnalysisGateSummary,
  type ApplicationAnalysisPolicyVersionRecord,
} from '@study-abroad/shared';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Skeleton } from '@/components/ui/skeleton';
import { apiClient } from '@/lib/api';

import { MetricCard } from './shared-cards';

export function GatesTab({ policies }: { policies: ApplicationAnalysisPolicyVersionRecord[] }) {
  const t = useTranslations('admin.applicationAnalysisWorkflow');
  const [selectedPolicyId, setSelectedPolicyId] = useState('');

  useEffect(() => {
    if (selectedPolicyId || policies.length === 0) return;
    const preferred = policies.find((policy) => policy.status === 'ACTIVE') ?? policies[0];
    setSelectedPolicyId(preferred.id);
  }, [policies, selectedPolicyId]);

  const { data, isLoading } = useQuery<ApplicationAnalysisGateSummary>({
    queryKey: ['applicationAnalysisGates', selectedPolicyId],
    queryFn: () =>
      apiClient.get(adminRoutes.applicationAnalysisWorkflowPolicyGates(selectedPolicyId)),
    enabled: Boolean(selectedPolicyId),
  });

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>{t('gates.title')}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label>{t('gates.policy')}</Label>
            <Select value={selectedPolicyId} onValueChange={setSelectedPolicyId}>
              <SelectTrigger>
                <SelectValue placeholder={t('gates.selectPolicy')} />
              </SelectTrigger>
              <SelectContent>
                {policies.map((policy) => (
                  <SelectItem key={policy.id} value={policy.id}>
                    {policy.version} · {policy.status}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          {isLoading ? (
            <Skeleton className="h-40 rounded-lg" />
          ) : data ? (
            <div className="space-y-4">
              <div className="flex items-center gap-2">
                <Badge variant={data.ready ? 'default' : 'outline'}>
                  {data.ready ? t('gates.ready') : t('gates.blocked')}
                </Badge>
              </div>
              <div className="grid gap-3 md:grid-cols-3">
                <MetricCard
                  label={t('evaluations.policyCorrectnessRate')}
                  value={data.metrics.policyCorrectnessRate}
                />
                <MetricCard
                  label={t('evaluations.weakStateCorrectnessRate')}
                  value={data.metrics.weakStateCorrectnessRate}
                />
                <MetricCard
                  label={t('evaluations.actionabilityMean')}
                  value={data.metrics.actionabilityMean}
                />
              </div>
              <div className="rounded-lg border p-4">
                <div className="font-medium">{t('gates.failures')}</div>
                <ul className="mt-3 space-y-2 text-sm text-muted-foreground">
                  {data.failures.length > 0 ? (
                    data.failures.map((failure) => <li key={failure}>• {failure}</li>)
                  ) : (
                    <li>{t('gates.noFailures')}</li>
                  )}
                </ul>
              </div>
            </div>
          ) : null}
        </CardContent>
      </Card>
    </div>
  );
}
