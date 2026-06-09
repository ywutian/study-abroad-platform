'use client';

import { useEffect, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useTranslations } from 'next-intl';
import { toast } from 'sonner';
import { Beaker, Scale, ShieldCheck } from 'lucide-react';

import {
  adminRoutes,
  type ApplicationAnalysisExperimentGateSummary,
  type ApplicationAnalysisExperimentSweepSummary,
  type ApplicationAnalysisFairnessReport,
  type ApplicationAnalysisPolicyVersionRecord,
  type ApplicationAnalysisRecoursePreview,
  type ApplicationAnalysisUncertaintyPreview,
  type PaginatedApplicationAnalysisExperimentEvaluationResponse,
  type PaginatedApplicationAnalysisExperimentResponse,
} from '@study-abroad/shared';
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
import { apiClient } from '@/lib/api';

import { MetricCard, PreviewCard } from './shared-cards';
import { EXPERIMENT_CAPABILITIES, formatDateTime, humanizeEnum } from './utils';

export function ExperimentsTab({
  policies,
}: {
  policies: ApplicationAnalysisPolicyVersionRecord[];
}) {
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
      // @cache-invalidation-allowed: invalidate() helper calls queryClient.invalidateQueries for the experiments/evaluations/gates keys
      toast.success(t('experiments.created'));
      invalidate();
      setVersion('');
    },
  });

  const shadowMutation = useMutation({
    mutationFn: (id: string) =>
      apiClient.post(adminRoutes.applicationAnalysisWorkflowExperimentShadow(id), {}),
    onSuccess: () => {
      // @cache-invalidation-allowed: invalidate() helper calls queryClient.invalidateQueries for the experiments/evaluations/gates keys
      toast.success(t('experiments.shadowSuccess'));
      invalidate();
    },
  });

  const canaryMutation = useMutation({
    mutationFn: (id: string) =>
      apiClient.post(adminRoutes.applicationAnalysisWorkflowExperimentCanary(id), {}),
    onSuccess: () => {
      // @cache-invalidation-allowed: invalidate() helper calls queryClient.invalidateQueries for the experiments/evaluations/gates keys
      toast.success(t('experiments.canarySuccess'));
      invalidate();
    },
  });

  const evaluateMutation = useMutation({
    mutationFn: (id: string) =>
      apiClient.post(adminRoutes.applicationAnalysisWorkflowExperimentEvaluate(id), {}),
    onSuccess: () => {
      // @cache-invalidation-allowed: invalidate() helper calls queryClient.invalidateQueries for the experiments/evaluations/gates keys
      toast.success(t('experiments.evaluateSuccess'));
      invalidate();
    },
  });

  const activateMutation = useMutation({
    mutationFn: (id: string) =>
      apiClient.post(adminRoutes.applicationAnalysisWorkflowExperimentActivate(id), {}),
    onSuccess: () => {
      // @cache-invalidation-allowed: invalidate() helper calls queryClient.invalidateQueries for the experiments/evaluations/gates keys
      toast.success(t('experiments.activateSuccess'));
      invalidate();
    },
  });

  const retireMutation = useMutation({
    mutationFn: (id: string) =>
      apiClient.post(adminRoutes.applicationAnalysisWorkflowExperimentRetire(id), {}),
    onSuccess: () => {
      // @cache-invalidation-allowed: invalidate() helper calls queryClient.invalidateQueries for the experiments/evaluations/gates keys
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
      // @cache-invalidation-allowed: invalidate() helper calls queryClient.invalidateQueries for the experiments/evaluations/gates keys
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
    // @cache-invalidation-allowed: preview-only — writes result to local React state (setRecoursePreview), no cached list/detail
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
    // @cache-invalidation-allowed: preview-only — writes result to local React state (setUncertaintyPreview), no cached list/detail
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
