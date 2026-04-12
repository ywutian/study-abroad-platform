'use client';

import { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useTranslations } from 'next-intl';
import { toast } from 'sonner';

import type { ApplicationAnalysisPolicyVersionRecord } from '@study-abroad/shared';
import { adminRoutes } from '@study-abroad/shared';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { apiClient } from '@/lib/api';

import { humanizeEnum } from './utils';

export function PoliciesTab({ policies }: { policies: ApplicationAnalysisPolicyVersionRecord[] }) {
  const t = useTranslations('admin.applicationAnalysisWorkflow');
  const queryClient = useQueryClient();
  const [version, setVersion] = useState('');
  const [analysisVersion, setAnalysisVersion] = useState('application-analysis-v2');
  const [promptVersion, setPromptVersion] = useState('application-analysis-prompt-v2');
  const [ruleBundleVersion, setRuleBundleVersion] = useState('application-analysis-rules-v2');

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: ['applicationAnalysisPolicies'] });
    queryClient.invalidateQueries({ queryKey: ['applicationAnalysisGates'] });
    queryClient.invalidateQueries({ queryKey: ['applicationAnalysisEvaluations'] });
  };

  const createMutation = useMutation({
    mutationFn: () =>
      apiClient.post(adminRoutes.applicationAnalysisWorkflowPolicies(), {
        version,
        analysisVersion,
        promptVersion,
        ruleBundleVersion,
      }),
    onSuccess: () => {
      toast.success(t('policies.created'));
      invalidate();
      setVersion('');
    },
  });

  const candidateMutation = useMutation({
    mutationFn: (id: string) =>
      apiClient.post(adminRoutes.applicationAnalysisWorkflowPolicyCandidate(id), {}),
    onSuccess: () => {
      toast.success(t('policies.candidateSuccess'));
      invalidate();
    },
  });

  const shadowMutation = useMutation({
    mutationFn: (id: string) =>
      apiClient.post(adminRoutes.applicationAnalysisWorkflowPolicyShadow(id), {}),
    onSuccess: () => {
      toast.success(t('policies.shadowSuccess'));
      invalidate();
    },
  });

  const refreshMutation = useMutation({
    mutationFn: (id: string) =>
      apiClient.post(adminRoutes.applicationAnalysisWorkflowPolicyShadowRefresh(id), {}),
    onSuccess: () => {
      toast.success(t('policies.shadowRefreshSuccess'));
      invalidate();
    },
  });

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>{t('policies.createTitle')}</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-4 md:grid-cols-2">
          <div className="space-y-2">
            <Label>{t('policies.version')}</Label>
            <Input value={version} onChange={(e) => setVersion(e.target.value)} />
          </div>
          <div className="space-y-2">
            <Label>{t('policies.analysisVersion')}</Label>
            <Input value={analysisVersion} onChange={(e) => setAnalysisVersion(e.target.value)} />
          </div>
          <div className="space-y-2">
            <Label>{t('policies.promptVersion')}</Label>
            <Input value={promptVersion} onChange={(e) => setPromptVersion(e.target.value)} />
          </div>
          <div className="space-y-2">
            <Label>{t('policies.ruleBundleVersion')}</Label>
            <Input
              value={ruleBundleVersion}
              onChange={(e) => setRuleBundleVersion(e.target.value)}
            />
          </div>
          <div className="md:col-span-2 flex justify-end">
            <Button
              onClick={() => createMutation.mutate()}
              disabled={!version || createMutation.isPending}
            >
              {t('policies.create')}
            </Button>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>{t('policies.tableTitle')}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {policies.map((policy) => (
            <div key={policy.id} className="rounded-lg border p-4">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="space-y-1">
                  <div className="font-medium">{policy.version}</div>
                  <div className="text-sm text-muted-foreground">
                    {policy.analysisVersion} · {policy.promptVersion ?? '—'} ·{' '}
                    {policy.ruleBundleVersion ?? '—'}
                  </div>
                </div>
                <Badge variant="outline">{humanizeEnum(policy.status)}</Badge>
              </div>
              <div className="mt-4 flex flex-wrap gap-2">
                {policy.status === 'DRAFT' ? (
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => candidateMutation.mutate(policy.id)}
                  >
                    {t('policies.promoteCandidate')}
                  </Button>
                ) : null}
                {policy.status === 'CANDIDATE' ? (
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => shadowMutation.mutate(policy.id)}
                  >
                    {t('policies.promoteShadow')}
                  </Button>
                ) : null}
                {policy.status === 'SHADOW' ? (
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => refreshMutation.mutate(policy.id)}
                  >
                    {t('policies.refreshShadow')}
                  </Button>
                ) : null}
              </div>
            </div>
          ))}
          {policies.length === 0 ? (
            <div className="rounded-lg border border-dashed p-8 text-sm text-muted-foreground">
              {t('policies.empty')}
            </div>
          ) : null}
        </CardContent>
      </Card>
    </div>
  );
}
