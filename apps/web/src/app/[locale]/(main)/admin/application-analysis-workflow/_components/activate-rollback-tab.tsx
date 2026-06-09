'use client';

import { useEffect, useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useTranslations } from 'next-intl';
import { toast } from 'sonner';
import { Beaker, Scale, ShieldCheck } from 'lucide-react';

import {
  adminRoutes,
  type ApplicationAnalysisPolicyVersionRecord,
  type ApplicationAnalysisRecoursePreview,
  type ApplicationAnalysisUncertaintyPreview,
} from '@study-abroad/shared';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { apiClient } from '@/lib/api';

import { PreviewCard } from './shared-cards';

export function ActivateRollbackTab({
  policies,
}: {
  policies: ApplicationAnalysisPolicyVersionRecord[];
}) {
  const t = useTranslations('admin.applicationAnalysisWorkflow');
  const queryClient = useQueryClient();
  const [selectedPolicyId, setSelectedPolicyId] = useState('');
  const [recoursePreview, setRecoursePreview] = useState<ApplicationAnalysisRecoursePreview | null>(
    null
  );
  const [uncertaintyPreview, setUncertaintyPreview] =
    useState<ApplicationAnalysisUncertaintyPreview | null>(null);
  const [fairnessReport, setFairnessReport] = useState<Record<string, unknown> | null>(null);

  useEffect(() => {
    if (selectedPolicyId || policies.length === 0) return;
    const preferred =
      policies.find((policy) => policy.status === 'SHADOW') ??
      policies.find((policy) => policy.status === 'ACTIVE') ??
      policies[0];
    setSelectedPolicyId(preferred.id);
  }, [policies, selectedPolicyId]);

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: ['applicationAnalysisPolicies'] });
    queryClient.invalidateQueries({ queryKey: ['applicationAnalysisGates'] });
    queryClient.invalidateQueries({ queryKey: ['applicationAnalysisEvaluations'] });
  };

  const activateMutation = useMutation({
    mutationFn: (id: string) =>
      apiClient.post(adminRoutes.applicationAnalysisWorkflowPolicyActivate(id), {}),
    onSuccess: () => {
      // @cache-invalidation-allowed: invalidate() helper calls queryClient.invalidateQueries for the policy/gate/evaluation keys
      toast.success(t('activate.activateSuccess'));
      invalidate();
    },
  });

  const rollbackMutation = useMutation({
    mutationFn: () => apiClient.post(adminRoutes.applicationAnalysisWorkflowPolicyRollback(), {}),
    onSuccess: () => {
      // @cache-invalidation-allowed: invalidate() helper calls queryClient.invalidateQueries for the policy/gate/evaluation keys
      toast.success(t('activate.rollbackSuccess'));
      invalidate();
    },
  });

  const recourseMutation = useMutation({
    // @cache-invalidation-allowed: preview-only — writes result to local React state (setRecoursePreview), no cached list/detail
    mutationFn: () =>
      apiClient.post<ApplicationAnalysisRecoursePreview>(
        adminRoutes.applicationAnalysisWorkflowRecoursePreview(),
        { policyVersionId: selectedPolicyId }
      ),
    onSuccess: setRecoursePreview,
  });

  const uncertaintyMutation = useMutation({
    // @cache-invalidation-allowed: preview-only — writes result to local React state (setUncertaintyPreview), no cached list/detail
    mutationFn: () =>
      apiClient.post<ApplicationAnalysisUncertaintyPreview>(
        adminRoutes.applicationAnalysisWorkflowUncertaintyPreview(),
        { policyVersionId: selectedPolicyId }
      ),
    onSuccess: setUncertaintyPreview,
  });

  const fairnessMutation = useMutation({
    mutationFn: () =>
      apiClient.get<Record<string, unknown>>(
        adminRoutes.applicationAnalysisWorkflowFairnessReport(),
        { params: { policyVersionId: selectedPolicyId } }
      ),
    onSuccess: setFairnessReport,
  });

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>{t('activate.title')}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label>{t('activate.policy')}</Label>
            <Select value={selectedPolicyId} onValueChange={setSelectedPolicyId}>
              <SelectTrigger>
                <SelectValue placeholder={t('activate.selectPolicy')} />
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
          <div className="flex flex-wrap gap-3">
            <Button
              onClick={() => activateMutation.mutate(selectedPolicyId)}
              disabled={!selectedPolicyId || activateMutation.isPending}
            >
              {t('activate.activate')}
            </Button>
            <Button
              variant="outline"
              onClick={() => rollbackMutation.mutate()}
              disabled={rollbackMutation.isPending}
            >
              {t('activate.rollback')}
            </Button>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>{t('experiments.title')}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex flex-wrap gap-3">
            <Button
              variant="outline"
              onClick={() => recourseMutation.mutate()}
              disabled={!selectedPolicyId}
            >
              {t('experiments.recourse')}
            </Button>
            <Button
              variant="outline"
              onClick={() => uncertaintyMutation.mutate()}
              disabled={!selectedPolicyId}
            >
              {t('experiments.uncertainty')}
            </Button>
            <Button
              variant="outline"
              onClick={() => fairnessMutation.mutate()}
              disabled={!selectedPolicyId}
            >
              {t('experiments.fairness')}
            </Button>
          </div>

          {recoursePreview ? (
            <PreviewCard
              icon={Beaker}
              title={t('experiments.recoursePreview')}
              content={[
                recoursePreview.goal,
                ...recoursePreview.recommendedChanges.map(
                  (item) => `${item.action}: ${item.rationale}`
                ),
                ...recoursePreview.constraints,
                recoursePreview.whyNotGuaranteed,
              ]}
            />
          ) : null}

          {uncertaintyPreview ? (
            <PreviewCard
              icon={Scale}
              title={t('experiments.uncertaintyPreview')}
              content={[
                `${uncertaintyPreview.intervalLabel}: ${uncertaintyPreview.probabilityLow?.toFixed(2) ?? '—'} - ${uncertaintyPreview.probabilityHigh?.toFixed(2) ?? '—'}`,
                ...uncertaintyPreview.reasons,
              ]}
            />
          ) : null}

          {fairnessReport ? (
            <PreviewCard
              icon={ShieldCheck}
              title={t('experiments.fairnessPreview')}
              content={[
                `status: ${String(fairnessReport.status)}`,
                ...(Array.isArray(fairnessReport.notes) ? fairnessReport.notes.map(String) : []),
              ]}
            />
          ) : null}
        </CardContent>
      </Card>
    </div>
  );
}
