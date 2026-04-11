'use client';

import { useEffect, useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useLocale, useTranslations } from 'next-intl';
import { toast } from 'sonner';
import { Beaker, FileCheck2, Scale, ShieldCheck } from 'lucide-react';

import {
  type ApplicationAnalysisExperimentGateSummary,
  type ApplicationAnalysisFeedbackRecord,
  type ApplicationAnalysisExperimentIncidentRecord,
  type ApplicationAnalysisExperimentSweepSummary,
  type ApplicationAnalysisExperimentSweepRunRecord,
  type ApplicationAnalysisExperimentVersionRecord,
  adminRoutes,
  type ApplicationAnalysisGateSummary,
  type ApplicationAnalysisFairnessReport,
  type ApplicationAnalysisPolicyVersionRecord,
  type ApplicationAnalysisRecoursePreview,
  type ApplicationAnalysisUncertaintyPreview,
  type PaginatedApplicationAnalysisExperimentEvaluationResponse,
  type PaginatedApplicationAnalysisExperimentFeedbackResponse,
  type PaginatedApplicationAnalysisExperimentIncidentResponse,
  type PaginatedApplicationAnalysisExperimentResponse,
  type PaginatedApplicationAnalysisExperimentSweepResponse,
  type PaginatedApplicationAnalysisEvaluationResponse,
  type PaginatedApplicationAnalysisEvidenceResponse,
  type PaginatedApplicationAnalysisPolicyResponse,
} from '@study-abroad/shared';
import { PageHeader } from '@/components/layout';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Skeleton } from '@/components/ui/skeleton';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Textarea } from '@/components/ui/textarea';
import { apiClient } from '@/lib/api';
import { getSchoolName } from '@/lib/utils';

const EVIDENCE_DIMENSIONS = ['TESTING', 'INTL_AID', 'ROUND', 'OTHER'] as const;
const EXPERIMENT_CAPABILITIES = ['RECOURSE', 'UNCERTAINTY', 'FAIRNESS'] as const;
const EVIDENCE_REVIEW_STATUSES = ['UNDER_REVIEW', 'APPROVED', 'REJECTED', 'EXPIRED'] as const;

function humanizeEnum(value: string) {
  return value
    .toLowerCase()
    .split('_')
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ');
}

function formatDateTime(value?: string | null) {
  if (!value) return '—';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '—';
  return date.toLocaleString();
}

function formatMetric(value: unknown) {
  if (typeof value === 'number') return value.toFixed(3);
  if (typeof value === 'boolean') return value ? 'Pass' : 'Fail';
  return '—';
}

function asRecord(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return {};
  }
  return value as Record<string, unknown>;
}

function getRolloutSnapshot(experiment: ApplicationAnalysisExperimentVersionRecord) {
  const rolloutConfig = asRecord(experiment.rolloutConfig);
  const monitoringConfig = asRecord(experiment.monitoringConfig);
  const percentages = Array.isArray(rolloutConfig.rolloutPercentages)
    ? rolloutConfig.rolloutPercentages.join(', ')
    : Array.isArray(rolloutConfig.stages)
      ? rolloutConfig.stages.join(', ')
      : '5, 25, 100';
  return {
    percentages,
    currentPercentage:
      typeof rolloutConfig.currentPercentage === 'number' ? rolloutConfig.currentPercentage : null,
    nextEligiblePromotionAt:
      typeof rolloutConfig.nextEligiblePromotionAt === 'string'
        ? rolloutConfig.nextEligiblePromotionAt
        : null,
    minStageHours:
      typeof rolloutConfig.minStageHours === 'number' ? rolloutConfig.minStageHours : 24,
    autoPromote:
      typeof rolloutConfig.autoPromoteStages === 'boolean' ? rolloutConfig.autoPromoteStages : true,
    autoRetire:
      typeof rolloutConfig.autoRetireOnFailure === 'boolean'
        ? rolloutConfig.autoRetireOnFailure
        : true,
    automationPaused:
      typeof rolloutConfig.automationPaused === 'boolean' ? rolloutConfig.automationPaused : false,
    lastSweepAt:
      typeof monitoringConfig.latestSweepAt === 'string' ? monitoringConfig.latestSweepAt : null,
  };
}

function EvidenceTab({ policiesReady }: { policiesReady: boolean }) {
  const t = useTranslations('admin.applicationAnalysisWorkflow');
  const locale = useLocale();
  const queryClient = useQueryClient();
  const [schoolId, setSchoolId] = useState('');
  const [dimension, setDimension] = useState<(typeof EVIDENCE_DIMENSIONS)[number]>('TESTING');
  const [policyValue, setPolicyValue] = useState('');
  const [sourceName, setSourceName] = useState('Manual research');
  const [sourceUrl, setSourceUrl] = useState('');
  const [notes, setNotes] = useState('');

  const { data, isLoading } = useQuery<PaginatedApplicationAnalysisEvidenceResponse>({
    queryKey: ['applicationAnalysisEvidence'],
    queryFn: () =>
      apiClient.get(adminRoutes.applicationAnalysisWorkflowEvidence(), {
        params: { page: 1, pageSize: 20 },
      }),
  });

  const createMutation = useMutation({
    mutationFn: () =>
      apiClient.post(adminRoutes.applicationAnalysisWorkflowEvidence(), {
        schoolId,
        policyDimension: dimension,
        policyValue,
        sourceName,
        sourceUrl: sourceUrl || undefined,
        notes: notes || undefined,
      }),
    onSuccess: () => {
      toast.success(t('evidence.created'));
      queryClient.invalidateQueries({ queryKey: ['applicationAnalysisEvidence'] });
      setSchoolId('');
      setPolicyValue('');
      setSourceUrl('');
      setNotes('');
    },
  });

  const reviewMutation = useMutation({
    mutationFn: (payload: { id: string; status: (typeof EVIDENCE_REVIEW_STATUSES)[number] }) =>
      apiClient.patch(adminRoutes.applicationAnalysisWorkflowEvidenceReview(payload.id), {
        status: payload.status,
      }),
    onSuccess: () => {
      toast.success(t('evidence.reviewSaved'));
      queryClient.invalidateQueries({ queryKey: ['applicationAnalysisEvidence'] });
    },
  });

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>{t('evidence.createTitle')}</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-4 md:grid-cols-2">
          <div className="space-y-2">
            <Label>{t('evidence.schoolId')}</Label>
            <Input value={schoolId} onChange={(e) => setSchoolId(e.target.value)} />
          </div>
          <div className="space-y-2">
            <Label>{t('evidence.dimension')}</Label>
            <Select
              value={dimension}
              onValueChange={(value) => setDimension(value as typeof dimension)}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {EVIDENCE_DIMENSIONS.map((item) => (
                  <SelectItem key={item} value={item}>
                    {humanizeEnum(item)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label>{t('evidence.policyValue')}</Label>
            <Input value={policyValue} onChange={(e) => setPolicyValue(e.target.value)} />
          </div>
          <div className="space-y-2">
            <Label>{t('evidence.sourceName')}</Label>
            <Input value={sourceName} onChange={(e) => setSourceName(e.target.value)} />
          </div>
          <div className="space-y-2 md:col-span-2">
            <Label>{t('evidence.sourceUrl')}</Label>
            <Input value={sourceUrl} onChange={(e) => setSourceUrl(e.target.value)} />
          </div>
          <div className="space-y-2 md:col-span-2">
            <Label>{t('evidence.notes')}</Label>
            <Textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={3} />
          </div>
          <div className="md:col-span-2 flex justify-end">
            <Button
              onClick={() => createMutation.mutate()}
              disabled={!schoolId || !policyValue || createMutation.isPending}
            >
              {t('evidence.create')}
            </Button>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>{t('evidence.queueTitle')}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {!policiesReady ? (
            <div className="text-sm text-muted-foreground">{t('evidence.policyHint')}</div>
          ) : null}
          {isLoading ? (
            <div className="space-y-2">
              {Array.from({ length: 4 }).map((_, index) => (
                <Skeleton key={index} className="h-16 rounded-lg" />
              ))}
            </div>
          ) : (
            <div className="space-y-3">
              {(data?.items ?? []).map((item) => (
                <div key={item.id} className="rounded-lg border p-4">
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div className="space-y-1">
                      <div className="font-medium">
                        {item.school ? getSchoolName(item.school, locale) : item.schoolId}
                      </div>
                      <div className="text-sm text-muted-foreground">
                        {humanizeEnum(item.policyDimension)} · {item.policyValue} ·{' '}
                        {item.sourceName}
                      </div>
                    </div>
                    <Badge variant="outline">{humanizeEnum(item.status)}</Badge>
                  </div>
                  <div className="mt-3 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                    <span>
                      {t('evidence.updatedAt')}: {formatDateTime(item.updatedAt)}
                    </span>
                    <span>
                      {t('evidence.reviewedAt')}: {formatDateTime(item.reviewedAt)}
                    </span>
                  </div>
                  <div className="mt-4 flex flex-wrap gap-2">
                    {EVIDENCE_REVIEW_STATUSES.map((status) => (
                      <Button
                        key={status}
                        size="sm"
                        variant="outline"
                        onClick={() => reviewMutation.mutate({ id: item.id, status })}
                        disabled={reviewMutation.isPending}
                      >
                        {humanizeEnum(status)}
                      </Button>
                    ))}
                  </div>
                </div>
              ))}
              {(data?.items?.length ?? 0) === 0 ? (
                <div className="rounded-lg border border-dashed p-8 text-sm text-muted-foreground">
                  {t('evidence.empty')}
                </div>
              ) : null}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function PoliciesTab({ policies }: { policies: ApplicationAnalysisPolicyVersionRecord[] }) {
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

function EvaluationsTab() {
  const t = useTranslations('admin.applicationAnalysisWorkflow');
  const { data, isLoading } = useQuery<PaginatedApplicationAnalysisEvaluationResponse>({
    queryKey: ['applicationAnalysisEvaluations'],
    queryFn: () =>
      apiClient.get(adminRoutes.applicationAnalysisWorkflowEvaluations(), {
        params: { page: 1, pageSize: 20 },
      }),
  });

  return (
    <Card>
      <CardHeader>
        <CardTitle>{t('evaluations.title')}</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {isLoading ? (
          <div className="space-y-2">
            {Array.from({ length: 4 }).map((_, index) => (
              <Skeleton key={index} className="h-16 rounded-lg" />
            ))}
          </div>
        ) : (
          <div className="space-y-3">
            {(data?.items ?? []).map((item) => (
              <div key={item.id} className="rounded-lg border p-4">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div className="space-y-1">
                    <div className="font-medium">
                      {item.policyVersion?.version ?? item.policyVersionId}
                    </div>
                    <div className="text-sm text-muted-foreground">
                      {humanizeEnum(item.mode)} · {humanizeEnum(item.status)}
                    </div>
                  </div>
                  <Badge variant="outline">
                    {formatDateTime(item.finishedAt ?? item.createdAt)}
                  </Badge>
                </div>
                <div className="mt-4 grid gap-3 md:grid-cols-3">
                  <MetricCard
                    label={t('evaluations.policyCorrectnessRate')}
                    value={item.metrics?.policyCorrectnessRate}
                  />
                  <MetricCard
                    label={t('evaluations.weakStateCorrectnessRate')}
                    value={item.metrics?.weakStateCorrectnessRate}
                  />
                  <MetricCard
                    label={t('evaluations.actionabilityMean')}
                    value={item.metrics?.actionabilityMean}
                  />
                </div>
              </div>
            ))}
            {(data?.items?.length ?? 0) === 0 ? (
              <div className="rounded-lg border border-dashed p-8 text-sm text-muted-foreground">
                {t('evaluations.empty')}
              </div>
            ) : null}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function GatesTab({ policies }: { policies: ApplicationAnalysisPolicyVersionRecord[] }) {
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

function ActivateRollbackTab({ policies }: { policies: ApplicationAnalysisPolicyVersionRecord[] }) {
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
      toast.success(t('activate.activateSuccess'));
      invalidate();
    },
  });

  const rollbackMutation = useMutation({
    mutationFn: () => apiClient.post(adminRoutes.applicationAnalysisWorkflowPolicyRollback(), {}),
    onSuccess: () => {
      toast.success(t('activate.rollbackSuccess'));
      invalidate();
    },
  });

  const recourseMutation = useMutation({
    mutationFn: () =>
      apiClient.post<ApplicationAnalysisRecoursePreview>(
        adminRoutes.applicationAnalysisWorkflowRecoursePreview(),
        { policyVersionId: selectedPolicyId }
      ),
    onSuccess: setRecoursePreview,
  });

  const uncertaintyMutation = useMutation({
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

function ExperimentsTab({ policies }: { policies: ApplicationAnalysisPolicyVersionRecord[] }) {
  const t = useTranslations('admin.applicationAnalysisWorkflow');
  const queryClient = useQueryClient();
  const [capability, setCapability] =
    useState<(typeof EXPERIMENT_CAPABILITIES)[number]>('RECOURSE');
  const [version, setVersion] = useState('');
  const [methodVersion, setMethodVersion] = useState('method-v1');
  const [linkedPolicyId, setLinkedPolicyId] = useState('');
  const [selectedExperimentId, setSelectedExperimentId] = useState('');
  const [recoursePreview, setRecoursePreview] = useState<ApplicationAnalysisRecoursePreview | null>(
    null
  );
  const [uncertaintyPreview, setUncertaintyPreview] =
    useState<ApplicationAnalysisUncertaintyPreview | null>(null);
  const [fairnessReport, setFairnessReport] = useState<ApplicationAnalysisFairnessReport | null>(
    null
  );

  const { data: experimentsData, isLoading: experimentsLoading } =
    useQuery<PaginatedApplicationAnalysisExperimentResponse>({
      queryKey: ['applicationAnalysisExperiments'],
      queryFn: () =>
        apiClient.get(adminRoutes.applicationAnalysisWorkflowExperiments(), {
          params: { page: 1, pageSize: 50 },
        }),
    });

  const { data: experimentEvaluations, isLoading: experimentEvalLoading } =
    useQuery<PaginatedApplicationAnalysisExperimentEvaluationResponse>({
      queryKey: ['applicationAnalysisExperimentEvaluations'],
      queryFn: () =>
        apiClient.get(adminRoutes.applicationAnalysisWorkflowExperimentEvaluations(), {
          params: { page: 1, pageSize: 20 },
        }),
    });

  const experiments = experimentsData?.items ?? [];
  const selectedExperiment = experiments.find((item) => item.id === selectedExperimentId);

  useEffect(() => {
    if (selectedExperimentId || experiments.length === 0) return;
    const preferred =
      experiments.find((item) => item.status === 'CANARY') ??
      experiments.find((item) => item.status === 'ACTIVE') ??
      experiments[0];
    setSelectedExperimentId(preferred.id);
  }, [experiments, selectedExperimentId]);

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: ['applicationAnalysisExperiments'] });
    queryClient.invalidateQueries({
      queryKey: ['applicationAnalysisExperimentEvaluations'],
    });
    queryClient.invalidateQueries({
      queryKey: ['applicationAnalysisExperimentGates'],
    });
  };

  const { data: experimentGates, isLoading: gatesLoading } =
    useQuery<ApplicationAnalysisExperimentGateSummary>({
      queryKey: ['applicationAnalysisExperimentGates', selectedExperimentId],
      queryFn: () =>
        apiClient.get(adminRoutes.applicationAnalysisWorkflowExperimentGates(selectedExperimentId)),
      enabled: Boolean(selectedExperimentId),
    });

  const createMutation = useMutation({
    mutationFn: () =>
      apiClient.post(adminRoutes.applicationAnalysisWorkflowExperiments(), {
        capability,
        version,
        methodVersion,
        policyVersionId: linkedPolicyId || undefined,
      }),
    onSuccess: () => {
      toast.success(t('experiments.created'));
      invalidate();
      setVersion('');
    },
  });

  const shadowMutation = useMutation({
    mutationFn: (id: string) =>
      apiClient.post(adminRoutes.applicationAnalysisWorkflowExperimentShadow(id), {}),
    onSuccess: () => {
      toast.success(t('experiments.shadowSuccess'));
      invalidate();
    },
  });

  const canaryMutation = useMutation({
    mutationFn: (id: string) =>
      apiClient.post(adminRoutes.applicationAnalysisWorkflowExperimentCanary(id), {}),
    onSuccess: () => {
      toast.success(t('experiments.canarySuccess'));
      invalidate();
    },
  });

  const evaluateMutation = useMutation({
    mutationFn: (id: string) =>
      apiClient.post(adminRoutes.applicationAnalysisWorkflowExperimentEvaluate(id), {}),
    onSuccess: () => {
      toast.success(t('experiments.evaluateSuccess'));
      invalidate();
    },
  });

  const activateMutation = useMutation({
    mutationFn: (id: string) =>
      apiClient.post(adminRoutes.applicationAnalysisWorkflowExperimentActivate(id), {}),
    onSuccess: () => {
      toast.success(t('experiments.activateSuccess'));
      invalidate();
    },
  });

  const retireMutation = useMutation({
    mutationFn: (id: string) =>
      apiClient.post(adminRoutes.applicationAnalysisWorkflowExperimentRetire(id), {}),
    onSuccess: () => {
      toast.success(t('experiments.retireSuccess'));
      invalidate();
    },
  });

  const sweepMutation = useMutation({
    mutationFn: () =>
      apiClient.post<ApplicationAnalysisExperimentSweepSummary>(
        adminRoutes.applicationAnalysisWorkflowExperimentSweep(),
        {}
      ),
    onSuccess: (summary) => {
      toast.success(
        t('experiments.sweepSuccess', {
          activated: summary.activated.length,
          retired: summary.retired.length,
          promoted: summary.promotedToCanary.length,
        })
      );
      invalidate();
    },
  });

  const recourseMutation = useMutation({
    mutationFn: () =>
      apiClient.post<ApplicationAnalysisRecoursePreview>(
        adminRoutes.applicationAnalysisWorkflowRecoursePreview(),
        {
          policyVersionId: selectedExperiment?.policyVersionId ?? linkedPolicyId,
          experimentVersionId: selectedExperimentId,
        }
      ),
    onSuccess: setRecoursePreview,
  });

  const uncertaintyMutation = useMutation({
    mutationFn: () =>
      apiClient.post<ApplicationAnalysisUncertaintyPreview>(
        adminRoutes.applicationAnalysisWorkflowUncertaintyPreview(),
        {
          policyVersionId: selectedExperiment?.policyVersionId ?? linkedPolicyId,
          experimentVersionId: selectedExperimentId,
        }
      ),
    onSuccess: setUncertaintyPreview,
  });

  const fairnessMutation = useMutation({
    mutationFn: () =>
      apiClient.get<ApplicationAnalysisFairnessReport>(
        adminRoutes.applicationAnalysisWorkflowFairnessReport(),
        {
          params: {
            policyVersionId: selectedExperiment?.policyVersionId ?? linkedPolicyId,
            experimentVersionId: selectedExperimentId,
          },
        }
      ),
    onSuccess: setFairnessReport,
  });

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>{t('experiments.createTitle')}</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-4 md:grid-cols-2">
          <div className="space-y-2">
            <Label>{t('experiments.capability')}</Label>
            <Select
              value={capability}
              onValueChange={(value) =>
                setCapability(value as (typeof EXPERIMENT_CAPABILITIES)[number])
              }
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {EXPERIMENT_CAPABILITIES.map((item) => (
                  <SelectItem key={item} value={item}>
                    {item}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label>{t('experiments.version')}</Label>
            <Input value={version} onChange={(e) => setVersion(e.target.value)} />
          </div>
          <div className="space-y-2">
            <Label>{t('experiments.methodVersion')}</Label>
            <Input value={methodVersion} onChange={(e) => setMethodVersion(e.target.value)} />
          </div>
          <div className="space-y-2">
            <Label>{t('experiments.linkedPolicy')}</Label>
            <Select value={linkedPolicyId} onValueChange={setLinkedPolicyId}>
              <SelectTrigger>
                <SelectValue placeholder={t('experiments.selectPolicy')} />
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
          <div className="md:col-span-2 flex justify-end">
            <Button
              onClick={() => createMutation.mutate()}
              disabled={!version || !methodVersion || createMutation.isPending}
            >
              {t('experiments.create')}
            </Button>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <div className="flex flex-wrap items-center justify-between gap-3">
            <CardTitle>{t('experiments.tableTitle')}</CardTitle>
            <Button
              variant="outline"
              onClick={() => sweepMutation.mutate()}
              disabled={sweepMutation.isPending}
            >
              {t('experiments.runSweep')}
            </Button>
          </div>
        </CardHeader>
        <CardContent className="space-y-3">
          {experimentsLoading ? (
            <div className="space-y-2">
              {Array.from({ length: 3 }).map((_, index) => (
                <Skeleton key={index} className="h-16 rounded-lg" />
              ))}
            </div>
          ) : experiments.length === 0 ? (
            <div className="rounded-lg border border-dashed p-8 text-sm text-muted-foreground">
              {t('experiments.empty')}
            </div>
          ) : (
            experiments.map((experiment) => (
              <div
                key={experiment.id}
                className="rounded-lg border p-4"
                onClick={() => setSelectedExperimentId(experiment.id)}
              >
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div className="space-y-1">
                    <div className="font-medium">
                      {experiment.capability} · {experiment.version}
                    </div>
                    <div className="text-sm text-muted-foreground">
                      {experiment.methodVersion} ·{' '}
                      {experiment.policyVersion?.version ?? 'No linked policy'}
                    </div>
                  </div>
                  <Badge variant="outline">{humanizeEnum(experiment.status)}</Badge>
                </div>
                <div className="mt-4 flex flex-wrap gap-2">
                  {experiment.status === 'DRAFT' ? (
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => shadowMutation.mutate(experiment.id)}
                    >
                      {t('experiments.promoteShadow')}
                    </Button>
                  ) : null}
                  {experiment.status === 'SHADOW' ? (
                    <>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => evaluateMutation.mutate(experiment.id)}
                      >
                        {t('experiments.refreshEvaluation')}
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => canaryMutation.mutate(experiment.id)}
                      >
                        {t('experiments.promoteCanary')}
                      </Button>
                    </>
                  ) : null}
                  {experiment.status === 'CANARY' ? (
                    <>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => evaluateMutation.mutate(experiment.id)}
                      >
                        {t('experiments.refreshEvaluation')}
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => activateMutation.mutate(experiment.id)}
                      >
                        {t('experiments.activate')}
                      </Button>
                    </>
                  ) : null}
                  {experiment.status === 'ACTIVE' ? (
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => retireMutation.mutate(experiment.id)}
                    >
                      {t('experiments.retire')}
                    </Button>
                  ) : null}
                </div>
              </div>
            ))
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>{t('experiments.gatesTitle')}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label>{t('experiments.selectedExperiment')}</Label>
            <Select value={selectedExperimentId} onValueChange={setSelectedExperimentId}>
              <SelectTrigger>
                <SelectValue placeholder={t('experiments.selectExperiment')} />
              </SelectTrigger>
              <SelectContent>
                {experiments.map((experiment) => (
                  <SelectItem key={experiment.id} value={experiment.id}>
                    {experiment.capability} · {experiment.version}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          {gatesLoading ? (
            <Skeleton className="h-32 rounded-lg" />
          ) : experimentGates ? (
            <div className="space-y-4">
              <Badge variant={experimentGates.ready ? 'default' : 'outline'}>
                {experimentGates.ready ? t('gates.ready') : t('gates.blocked')}
              </Badge>
              <div className="grid gap-3 md:grid-cols-3">
                {Object.entries(experimentGates.metrics)
                  .slice(0, 3)
                  .map(([key, value]) => (
                    <MetricCard key={key} label={key} value={value} />
                  ))}
              </div>
              <div className="rounded-lg border p-4">
                <div className="font-medium">{t('gates.failures')}</div>
                <ul className="mt-3 space-y-2 text-sm text-muted-foreground">
                  {experimentGates.failures.length > 0 ? (
                    experimentGates.failures.map((failure) => <li key={failure}>• {failure}</li>)
                  ) : (
                    <li>{t('gates.noFailures')}</li>
                  )}
                </ul>
              </div>
            </div>
          ) : null}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>{t('experiments.previewTitle')}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex flex-wrap gap-3">
            <Button
              variant="outline"
              onClick={() => recourseMutation.mutate()}
              disabled={!selectedExperiment?.policyVersionId}
            >
              {t('experiments.recourse')}
            </Button>
            <Button
              variant="outline"
              onClick={() => uncertaintyMutation.mutate()}
              disabled={!selectedExperiment?.policyVersionId}
            >
              {t('experiments.uncertainty')}
            </Button>
            <Button
              variant="outline"
              onClick={() => fairnessMutation.mutate()}
              disabled={!selectedExperiment?.policyVersionId}
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
                `${uncertaintyPreview.intervalLabel}: ${
                  uncertaintyPreview.probabilityLow?.toFixed(2) ?? '—'
                } - ${uncertaintyPreview.probabilityHigh?.toFixed(2) ?? '—'}`,
                ...uncertaintyPreview.reasons,
              ]}
            />
          ) : null}

          {fairnessReport ? (
            <PreviewCard
              icon={ShieldCheck}
              title={t('experiments.fairnessPreview')}
              content={[
                `status: ${fairnessReport.status}`,
                ...fairnessReport.notes,
                ...fairnessReport.appliesTo,
              ]}
            />
          ) : null}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>{t('experiments.evaluationsTitle')}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {experimentEvalLoading ? (
            <div className="space-y-2">
              {Array.from({ length: 3 }).map((_, index) => (
                <Skeleton key={index} className="h-16 rounded-lg" />
              ))}
            </div>
          ) : (
            <div className="space-y-3">
              {(experimentEvaluations?.items ?? []).map((item) => (
                <div key={item.id} className="rounded-lg border p-4">
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div className="space-y-1">
                      <div className="font-medium">
                        {item.experimentVersion?.capability ?? 'Experiment'} ·{' '}
                        {item.experimentVersion?.version ?? item.experimentVersionId}
                      </div>
                      <div className="text-sm text-muted-foreground">
                        {humanizeEnum(item.mode)} · {humanizeEnum(item.status)}
                      </div>
                    </div>
                    <Badge variant="outline">
                      {formatDateTime(item.finishedAt ?? item.createdAt)}
                    </Badge>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function AutomationTab() {
  const t = useTranslations('admin.applicationAnalysisWorkflow');
  const queryClient = useQueryClient();
  const [selectedExperimentId, setSelectedExperimentId] = useState('');
  const [rolloutPercentages, setRolloutPercentages] = useState('5, 25, 100');
  const [minStageHours, setMinStageHours] = useState('24');
  const [autoPromote, setAutoPromote] = useState('true');
  const [autoRetire, setAutoRetire] = useState('true');
  const [automationPaused, setAutomationPaused] = useState('false');

  const { data: experimentsData } = useQuery<PaginatedApplicationAnalysisExperimentResponse>({
    queryKey: ['applicationAnalysisExperiments'],
    queryFn: () =>
      apiClient.get(adminRoutes.applicationAnalysisWorkflowExperiments(), {
        params: { page: 1, pageSize: 50 },
      }),
  });
  const { data: sweepsData, isLoading } =
    useQuery<PaginatedApplicationAnalysisExperimentSweepResponse>({
      queryKey: ['applicationAnalysisExperimentSweeps'],
      queryFn: () =>
        apiClient.get(adminRoutes.applicationAnalysisWorkflowExperimentSweeps(), {
          params: { page: 1, pageSize: 20 },
        }),
    });

  const experiments = experimentsData?.items ?? [];
  const selectedExperiment = experiments.find((item) => item.id === selectedExperimentId);

  useEffect(() => {
    if (!selectedExperimentId && experiments[0]) {
      setSelectedExperimentId(experiments[0].id);
      return;
    }
    if (!selectedExperiment) return;
    const snapshot = getRolloutSnapshot(selectedExperiment);
    setRolloutPercentages(snapshot.percentages);
    setMinStageHours(String(snapshot.minStageHours));
    setAutoPromote(String(snapshot.autoPromote));
    setAutoRetire(String(snapshot.autoRetire));
    setAutomationPaused(String(snapshot.automationPaused));
  }, [selectedExperiment, selectedExperimentId, experiments]);

  const patchMutation = useMutation({
    mutationFn: () =>
      apiClient.patch(
        adminRoutes.applicationAnalysisWorkflowExperimentConfig(selectedExperimentId),
        {
          rolloutPercentages: rolloutPercentages
            .split(',')
            .map((value) => Number(value.trim()))
            .filter((value) => Number.isFinite(value)),
          minStageHours: Number(minStageHours),
          autoPromote: autoPromote === 'true',
          autoRetire: autoRetire === 'true',
          automationPaused: automationPaused === 'true',
        }
      ),
    onSuccess: () => {
      toast.success(t('automation.configSaved'));
      queryClient.invalidateQueries({ queryKey: ['applicationAnalysisExperiments'] });
    },
  });

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>{t('automation.title')}</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-4 md:grid-cols-2">
          <div className="space-y-2 md:col-span-2">
            <Label>{t('automation.experiment')}</Label>
            <Select value={selectedExperimentId} onValueChange={setSelectedExperimentId}>
              <SelectTrigger>
                <SelectValue placeholder={t('experiments.selectExperiment')} />
              </SelectTrigger>
              <SelectContent>
                {experiments.map((experiment) => (
                  <SelectItem key={experiment.id} value={experiment.id}>
                    {experiment.capability} · {experiment.version}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label>{t('automation.rolloutPercentages')}</Label>
            <Input
              value={rolloutPercentages}
              onChange={(e) => setRolloutPercentages(e.target.value)}
            />
          </div>
          <div className="space-y-2">
            <Label>{t('automation.minStageHours')}</Label>
            <Input value={minStageHours} onChange={(e) => setMinStageHours(e.target.value)} />
          </div>
          <div className="space-y-2">
            <Label>{t('automation.autoPromote')}</Label>
            <Select value={autoPromote} onValueChange={setAutoPromote}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="true">{t('automation.enabled')}</SelectItem>
                <SelectItem value="false">{t('automation.disabled')}</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label>{t('automation.autoRetire')}</Label>
            <Select value={autoRetire} onValueChange={setAutoRetire}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="true">{t('automation.enabled')}</SelectItem>
                <SelectItem value="false">{t('automation.disabled')}</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label>{t('automation.paused')}</Label>
            <Select value={automationPaused} onValueChange={setAutomationPaused}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="false">{t('automation.enabled')}</SelectItem>
                <SelectItem value="true">{t('automation.disabled')}</SelectItem>
              </SelectContent>
            </Select>
          </div>
          {selectedExperiment ? (
            <div className="rounded-lg border p-4 text-sm text-muted-foreground md:col-span-2">
              {t('automation.currentPercentage')}:{' '}
              {getRolloutSnapshot(selectedExperiment).currentPercentage ?? '—'} ·{' '}
              {t('automation.lastSweep')}:{' '}
              {formatDateTime(getRolloutSnapshot(selectedExperiment).lastSweepAt)} ·{' '}
              {t('automation.nextEligiblePromotion')}:{' '}
              {formatDateTime(getRolloutSnapshot(selectedExperiment).nextEligiblePromotionAt)}
            </div>
          ) : null}
          <div className="md:col-span-2 flex justify-end">
            <Button
              onClick={() => patchMutation.mutate()}
              disabled={!selectedExperimentId || patchMutation.isPending}
            >
              {t('automation.save')}
            </Button>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>{t('automation.sweepHistory')}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {isLoading ? (
            <Skeleton className="h-32 rounded-lg" />
          ) : (
            (sweepsData?.items ?? []).map((item) => (
              <div key={item.id} className="rounded-lg border p-4">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div className="space-y-1">
                    <div className="font-medium">
                      {humanizeEnum(item.mode)} · {humanizeEnum(item.status)}
                    </div>
                    <div className="text-sm text-muted-foreground">
                      {t('automation.lastSweep')}:{' '}
                      {formatDateTime(item.finishedAt ?? item.startedAt)}
                    </div>
                  </div>
                  <Badge variant="outline">{item.actorId ?? 'system'}</Badge>
                </div>
              </div>
            ))
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function IncidentsTab() {
  const t = useTranslations('admin.applicationAnalysisWorkflow');
  const queryClient = useQueryClient();
  const { data, isLoading } = useQuery<PaginatedApplicationAnalysisExperimentIncidentResponse>({
    queryKey: ['applicationAnalysisExperimentIncidents'],
    queryFn: () =>
      apiClient.get(adminRoutes.applicationAnalysisWorkflowExperimentIncidents(), {
        params: { page: 1, pageSize: 20 },
      }),
  });

  const acknowledgeMutation = useMutation({
    mutationFn: (id: string) =>
      apiClient.patch(adminRoutes.applicationAnalysisWorkflowExperimentIncidentAcknowledge(id), {}),
    onSuccess: () => {
      toast.success(t('incidents.acknowledged'));
      queryClient.invalidateQueries({ queryKey: ['applicationAnalysisExperimentIncidents'] });
    },
  });

  return (
    <Card>
      <CardHeader>
        <CardTitle>{t('incidents.title')}</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {isLoading ? (
          <Skeleton className="h-32 rounded-lg" />
        ) : (
          (data?.items ?? []).map((item) => (
            <div key={item.id} className="rounded-lg border p-4">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="space-y-1">
                  <div className="font-medium">{item.title}</div>
                  <div className="text-sm text-muted-foreground">{item.message}</div>
                </div>
                <div className="flex gap-2">
                  <Badge variant="outline">{item.severity}</Badge>
                  <Badge variant="secondary">{item.status}</Badge>
                </div>
              </div>
              <div className="mt-3 text-xs text-muted-foreground">
                {item.capability ?? '—'} · {formatDateTime(item.createdAt)}
              </div>
              {item.status === 'OPEN' ? (
                <div className="mt-4 flex justify-end">
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => acknowledgeMutation.mutate(item.id)}
                  >
                    {t('incidents.acknowledge')}
                  </Button>
                </div>
              ) : null}
            </div>
          ))
        )}
      </CardContent>
    </Card>
  );
}

function LiveSignalsTab() {
  const t = useTranslations('admin.applicationAnalysisWorkflow');
  const { data, isLoading } = useQuery<PaginatedApplicationAnalysisExperimentFeedbackResponse>({
    queryKey: ['applicationAnalysisExperimentFeedback'],
    queryFn: () =>
      apiClient.get(adminRoutes.applicationAnalysisWorkflowExperimentFeedback(), {
        params: { page: 1, pageSize: 50 },
      }),
  });

  const grouped = useMemo(() => {
    const items = data?.items ?? [];
    return items.reduce<Record<string, number>>((acc, item) => {
      const key = `${item.capability}:${item.category}:${item.sentiment}`;
      acc[key] = (acc[key] ?? 0) + 1;
      return acc;
    }, {});
  }, [data]);

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>{t('liveSignals.title')}</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-3 md:grid-cols-3">
          {Object.entries(grouped).length > 0 ? (
            Object.entries(grouped).map(([key, value]) => (
              <MetricCard key={key} label={key} value={value} />
            ))
          ) : (
            <div className="text-sm text-muted-foreground">{t('liveSignals.empty')}</div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>{t('liveSignals.feedback')}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {isLoading ? (
            <Skeleton className="h-32 rounded-lg" />
          ) : (
            (data?.items ?? []).map((item) => (
              <div key={item.id} className="rounded-lg border p-4">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div className="space-y-1">
                    <div className="font-medium">
                      {item.capability} · {humanizeEnum(item.sentiment)}
                    </div>
                    <div className="text-sm text-muted-foreground">
                      {humanizeEnum(item.category)}
                      {item.schoolId ? ` · ${item.schoolId}` : ''}
                    </div>
                  </div>
                  <Badge variant="outline">{formatDateTime(item.createdAt)}</Badge>
                </div>
                {item.notes ? (
                  <div className="mt-2 text-sm text-muted-foreground">{item.notes}</div>
                ) : null}
              </div>
            ))
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function MetricCard({ label, value }: { label: string; value: unknown }) {
  return (
    <Card>
      <CardContent className="pt-4">
        <div className="text-sm text-muted-foreground">{label}</div>
        <div className="text-2xl font-semibold">{formatMetric(value)}</div>
      </CardContent>
    </Card>
  );
}

function PreviewCard({
  icon: Icon,
  title,
  content,
}: {
  icon: typeof Beaker;
  title: string;
  content: string[];
}) {
  return (
    <div className="rounded-lg border p-4">
      <div className="flex items-center gap-2 font-medium">
        <Icon className="h-4 w-4" />
        {title}
      </div>
      <ul className="mt-3 space-y-2 text-sm text-muted-foreground">
        {content.map((item) => (
          <li key={item}>• {item}</li>
        ))}
      </ul>
    </div>
  );
}

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
