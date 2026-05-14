'use client';

import { useEffect, useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useTranslations } from 'next-intl';
import { toast } from 'sonner';
import { BadgeCheck, BarChart3, GitBranch, RotateCcw, Compass } from 'lucide-react';

import { adminRoutes } from '@study-abroad/shared';
import { apiClient } from '@/lib/api';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import type {
  PaginatedResponse,
  PredictionPolicyGateSummary,
  PredictionWorkflowPolicy,
} from './prediction-workflow-types';

function formatNumber(value: unknown) {
  return typeof value === 'number' ? value.toFixed(3) : '—';
}

export function PoliciesTab() {
  const t = useTranslations('admin.calibrations.policies');
  const queryClient = useQueryClient();
  const [selectedPolicyId, setSelectedPolicyId] = useState('');

  const { data, isLoading } = useQuery<PaginatedResponse<PredictionWorkflowPolicy>>({
    queryKey: ['predictionWorkflowPolicies', 'policies-tab'],
    queryFn: () =>
      apiClient.get(adminRoutes.predictionWorkflowPolicies(), {
        params: { page: 1, pageSize: 50 },
      }),
  });

  const policies = data?.items ?? [];

  useEffect(() => {
    if (selectedPolicyId || policies.length === 0) return;
    const preferred = policies.find((policy) => policy.status === 'ACTIVE') ?? policies[0];
    setSelectedPolicyId(preferred.id);
  }, [policies, selectedPolicyId]);

  const selectedPolicy = useMemo(
    () => policies.find((policy) => policy.id === selectedPolicyId) ?? null,
    [policies, selectedPolicyId]
  );

  const { data: gateSummary, isLoading: gateLoading } = useQuery<PredictionPolicyGateSummary>({
    queryKey: ['predictionWorkflowPolicyGates', selectedPolicyId],
    queryFn: () => apiClient.get(adminRoutes.predictionWorkflowPolicyGates(selectedPolicyId)),
    enabled: Boolean(selectedPolicyId),
  });

  const invalidatePolicies = () => {
    queryClient.invalidateQueries({ queryKey: ['predictionWorkflowPolicies'] });
    queryClient.invalidateQueries({
      queryKey: ['predictionWorkflowPolicyGates', selectedPolicyId],
    });
  };

  const candidateMutation = useMutation({
    mutationFn: (id: string) =>
      apiClient.post(adminRoutes.predictionWorkflowPolicyCandidate(id), {}),
    onSuccess: () => {
      toast.success(t('candidateSuccess'));
      invalidatePolicies();
    },
  });

  const shadowMutation = useMutation({
    mutationFn: (id: string) => apiClient.post(adminRoutes.predictionWorkflowPolicyShadow(id), {}),
    onSuccess: () => {
      toast.success(t('shadowSuccess'));
      invalidatePolicies();
    },
  });

  const refreshShadowMutation = useMutation({
    mutationFn: (id: string) =>
      apiClient.post(adminRoutes.predictionWorkflowPolicyShadowRefresh(id), {}),
    onSuccess: () => {
      toast.success(t('shadowRefreshSuccess'));
      invalidatePolicies();
    },
  });

  const activateMutation = useMutation({
    mutationFn: (id: string) =>
      apiClient.post(adminRoutes.predictionWorkflowPolicyActivate(id), {}),
    onSuccess: () => {
      toast.success(t('activateSuccess'));
      invalidatePolicies();
    },
  });

  const rollbackMutation = useMutation({
    mutationFn: () => apiClient.post(adminRoutes.predictionWorkflowPolicyRollback(), {}),
    onSuccess: () => {
      toast.success(t('rollbackSuccess'));
      invalidatePolicies();
    },
  });

  const shadowMetrics = (selectedPolicy?.monitoringConfig?.shadowMetrics ??
    gateSummary?.shadowMetrics ??
    {}) as Record<string, unknown>;

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <GitBranch className="h-4 w-4" />
            {t('title')}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {isLoading ? (
            <div className="space-y-3">
              {Array.from({ length: 4 }).map((_, index) => (
                <Skeleton key={index} className="h-12 rounded-lg" />
              ))}
            </div>
          ) : (
            <div className="rounded-lg border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>{t('version')}</TableHead>
                    <TableHead>{t('status')}</TableHead>
                    <TableHead>{t('sets')}</TableHead>
                    <TableHead>{t('updatedAt')}</TableHead>
                    <TableHead className="text-right">{t('actions')}</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {policies.map((policy) => (
                    <TableRow
                      key={policy.id}
                      className={policy.id === selectedPolicyId ? 'bg-muted/40' : undefined}
                      onClick={() => setSelectedPolicyId(policy.id)}
                    >
                      <TableCell>
                        <div className="space-y-1">
                          <div className="font-medium">{policy.version}</div>
                          <div className="text-xs text-muted-foreground">{policy.policyKey}</div>
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline">{policy.status}</Badge>
                      </TableCell>
                      <TableCell className="text-xs text-muted-foreground">
                        {policy.priorSetVersion ? 'P' : '—'} / {policy.driftSetVersion ? 'D' : '—'}{' '}
                        / {policy.relationshipSetVersion ? 'R' : '—'}
                      </TableCell>
                      <TableCell className="text-xs text-muted-foreground">
                        {new Date(policy.updatedAt).toLocaleString()}
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex justify-end gap-2">
                          {policy.status === 'DRAFT' && (
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={(event) => {
                                event.stopPropagation();
                                candidateMutation.mutate(policy.id);
                              }}
                            >
                              {t('promoteCandidate')}
                            </Button>
                          )}
                          {policy.status === 'CANDIDATE' && (
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={(event) => {
                                event.stopPropagation();
                                shadowMutation.mutate(policy.id);
                              }}
                            >
                              {t('promoteShadow')}
                            </Button>
                          )}
                          {policy.status === 'SHADOW' && (
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={(event) => {
                                event.stopPropagation();
                                refreshShadowMutation.mutate(policy.id);
                              }}
                            >
                              {t('refreshShadow')}
                            </Button>
                          )}
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      {selectedPolicy && (
        <div className="grid gap-4 xl:grid-cols-[1.1fr_0.9fr]">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <BarChart3 className="h-4 w-4" />
                {t('gateSummary')}
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {gateLoading ? (
                <div className="space-y-3">
                  {Array.from({ length: 3 }).map((_, index) => (
                    <Skeleton key={index} className="h-14 rounded-lg" />
                  ))}
                </div>
              ) : gateSummary ? (
                <>
                  <div className="grid gap-3 md:grid-cols-3">
                    <Card>
                      <CardContent className="pt-4">
                        <div className="text-sm text-muted-foreground">
                          {t('shadowPredictions')}
                        </div>
                        <div className="text-2xl font-semibold">
                          {gateSummary.counts.shadowPredictions}
                        </div>
                      </CardContent>
                    </Card>
                    <Card>
                      <CardContent className="pt-4">
                        <div className="text-sm text-muted-foreground">{t('resolvedLabels')}</div>
                        <div className="text-2xl font-semibold">
                          {gateSummary.counts.resolvedLabels}
                        </div>
                      </CardContent>
                    </Card>
                    <Card>
                      <CardContent className="pt-4">
                        <div className="text-sm text-muted-foreground">{t('status')}</div>
                        <div className="pt-1">
                          <Badge variant={gateSummary.ready ? 'default' : 'outline'}>
                            {gateSummary.ready ? t('ready') : t('blocked')}
                          </Badge>
                        </div>
                      </CardContent>
                    </Card>
                  </div>

                  <div className="rounded-lg border p-4">
                    <div className="mb-3 flex items-center gap-2">
                      <BadgeCheck className="h-4 w-4" />
                      <span className="font-medium">{t('metricDeltas')}</span>
                    </div>
                    <div className="grid gap-3 md:grid-cols-3">
                      <div>
                        <div className="text-xs text-muted-foreground">AUC Δ</div>
                        <div className="text-lg font-semibold">
                          {formatNumber(shadowMetrics.aucDelta)}
                        </div>
                      </div>
                      <div>
                        <div className="text-xs text-muted-foreground">Brier Δ</div>
                        <div className="text-lg font-semibold">
                          {formatNumber(shadowMetrics.brierDelta)}
                        </div>
                      </div>
                      <div>
                        <div className="text-xs text-muted-foreground">ECE Δ</div>
                        <div className="text-lg font-semibold">
                          {formatNumber(shadowMetrics.eceDelta)}
                        </div>
                      </div>
                    </div>
                  </div>

                  <div className="rounded-lg border p-4">
                    <div className="font-medium">{t('failures')}</div>
                    {gateSummary.failures.length === 0 ? (
                      <p className="mt-2 text-sm text-muted-foreground">{t('noFailures')}</p>
                    ) : (
                      <ul className="mt-2 space-y-2 text-sm text-muted-foreground">
                        {gateSummary.failures.map((failure) => (
                          <li key={failure}>• {failure}</li>
                        ))}
                      </ul>
                    )}
                  </div>
                </>
              ) : null}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <Compass className="h-4 w-4" />
                {t('releaseControls')}
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="rounded-lg border p-4 text-sm">
                <div className="font-medium">{selectedPolicy.version}</div>
                <div className="mt-1 text-muted-foreground">
                  {selectedPolicy.description || selectedPolicy.policyKey}
                </div>
              </div>

              <div className="flex flex-wrap gap-2">
                {selectedPolicy.status === 'SHADOW' && (
                  <>
                    <Button
                      onClick={() => refreshShadowMutation.mutate(selectedPolicy.id)}
                      disabled={refreshShadowMutation.isPending}
                      variant="outline"
                    >
                      {t('refreshShadow')}
                    </Button>
                    <Button
                      onClick={() => activateMutation.mutate(selectedPolicy.id)}
                      disabled={activateMutation.isPending || !gateSummary?.ready}
                    >
                      {t('activate')}
                    </Button>
                  </>
                )}

                <Button
                  variant="outline"
                  onClick={() => rollbackMutation.mutate()}
                  disabled={rollbackMutation.isPending}
                >
                  <RotateCcw className="mr-1.5 h-4 w-4" />
                  {t('rollback')}
                </Button>
              </div>

              {Array.isArray(shadowMetrics.buckets) && shadowMetrics.buckets.length > 0 && (
                <div className="rounded-lg border">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>{t('bucket')}</TableHead>
                        <TableHead>{t('count')}</TableHead>
                        <TableHead>{t('actualRate')}</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {(shadowMetrics.buckets as Array<Record<string, unknown>>)
                        .slice(0, 5)
                        .map((bucket, index) => (
                          <TableRow key={index}>
                            <TableCell className="text-xs">
                              {String(bucket.cohortKey ?? 'UNKNOWN')} /{' '}
                              {String(bucket.round ?? 'RD')} /{' '}
                              {String(bucket.selectivityBand ?? 'unknown')}
                            </TableCell>
                            <TableCell>{String(bucket.predictionCount ?? '—')}</TableCell>
                            <TableCell>{formatNumber(bucket.actualAdmitRate)}</TableCell>
                          </TableRow>
                        ))}
                    </TableBody>
                  </Table>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}
