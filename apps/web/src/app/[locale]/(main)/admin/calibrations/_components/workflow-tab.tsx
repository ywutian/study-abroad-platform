'use client';

import { useEffect, useMemo, useState } from 'react';
import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useLocale, useTranslations } from 'next-intl';
import { toast } from 'sonner';
import { Activity, Clock3, Filter, RefreshCcw, SearchCheck } from 'lucide-react';

import { adminRoutes } from '@study-abroad/shared';
import { apiClient } from '@/lib/api';
import { getSchoolName } from '@/lib/utils';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
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
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Textarea } from '@/components/ui/textarea';
import { PaginationControls } from '../../_components/pagination-controls';
import type { PaginatedResponse } from '@study-abroad/shared';
import type {
  PredictionSignalSummary,
  PredictionWorkflowObservation,
  PredictionWorkflowPolicy,
} from './prediction-workflow-types';

const PAGE_SIZE = 10;

const OBSERVATION_STATUSES = [
  'all',
  'RAW',
  'UNDER_REVIEW',
  'APPROVED_FOR_SIGNAL',
  'APPROVED_FOR_PRIOR',
  'REJECTED',
  'EXPIRED',
  'SUPERSEDED',
  'LICENSE_BLOCKED',
  'CONFLICT_FLAGGED',
] as const;

const OBSERVATION_SOURCES = [
  'all',
  'OFFICIAL_SCHOOL',
  'OFFICIAL_FEDERAL',
  'TRUSTED_THIRD_PARTY',
  'INTERNAL_CASES',
  'INTERNAL_OUTCOMES',
  'MANUAL_RESEARCH',
  'RELATIONSHIP_EVIDENCE',
] as const;

const REVIEW_TARGET_STATUSES = [
  'UNDER_REVIEW',
  'APPROVED_FOR_SIGNAL',
  'APPROVED_FOR_PRIOR',
  'REJECTED',
  'EXPIRED',
] as const;

function humanizeEnum(value: string) {
  return value
    .toLowerCase()
    .split('_')
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ');
}

function toDatetimeLocal(value?: string | null) {
  if (!value) return '';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  const pad = (num: number) => String(num).padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

export function WorkflowTab() {
  const t = useTranslations('admin.calibrations.workflow');
  const locale = useLocale();
  const queryClient = useQueryClient();

  const [page, setPage] = useState(1);
  const [statusFilter, setStatusFilter] = useState<(typeof OBSERVATION_STATUSES)[number]>('all');
  const [sourceFilter, setSourceFilter] = useState<(typeof OBSERVATION_SOURCES)[number]>('all');
  const [selectedPolicyId, setSelectedPolicyId] = useState<string>('');
  const [selectedObservation, setSelectedObservation] =
    useState<PredictionWorkflowObservation | null>(null);
  const [reviewStatus, setReviewStatus] =
    useState<(typeof REVIEW_TARGET_STATUSES)[number]>('UNDER_REVIEW');
  const [reviewAt, setReviewAt] = useState('');
  const [expiresAt, setExpiresAt] = useState('');
  const [reviewNotes, setReviewNotes] = useState('');

  const { data: policiesResponse, isLoading: policiesLoading } = useQuery<
    PaginatedResponse<PredictionWorkflowPolicy>
  >({
    // Keeps the rows on screen while the next page/filter loads.
    placeholderData: keepPreviousData,
    queryKey: ['predictionWorkflowPolicies', 'workflow-tab'],
    queryFn: () =>
      apiClient.get(adminRoutes.predictionWorkflowPolicies(), {
        params: { page: 1, pageSize: 50 },
      }),
  });

  const policies = useMemo(() => policiesResponse?.items ?? [], [policiesResponse]);

  useEffect(() => {
    if (selectedPolicyId || policies.length === 0) return;
    const preferred = policies.find((policy) => policy.status === 'ACTIVE') ?? policies[0];
    setSelectedPolicyId(preferred.id);
  }, [policies, selectedPolicyId]);

  const { data: observationsResponse, isLoading: observationsLoading } = useQuery<
    PaginatedResponse<PredictionWorkflowObservation>
  >({
    queryKey: ['predictionWorkflowObservations', page, statusFilter, sourceFilter],
    queryFn: () =>
      apiClient.get(adminRoutes.predictionWorkflowObservations(), {
        params: {
          page,
          pageSize: PAGE_SIZE,
          status: statusFilter === 'all' ? undefined : statusFilter,
          sourceType: sourceFilter === 'all' ? undefined : sourceFilter,
        },
      }),
  });

  const { data: signals, isLoading: signalsLoading } = useQuery<PredictionSignalSummary>({
    queryKey: ['predictionWorkflowSignals', selectedPolicyId],
    queryFn: () =>
      apiClient.get(adminRoutes.predictionWorkflowSignals(), {
        params: { policyVersionId: selectedPolicyId, limit: 6 },
      }),
    enabled: Boolean(selectedPolicyId),
  });

  const reviewMutation = useMutation({
    mutationFn: (payload: {
      id: string;
      status: string;
      reviewAt?: string;
      expiresAt?: string;
      notes?: string;
    }) =>
      apiClient.patch(adminRoutes.predictionWorkflowObservationReview(payload.id), {
        status: payload.status,
        reviewAt: payload.reviewAt || undefined,
        expiresAt: payload.expiresAt || undefined,
        notes: payload.notes || undefined,
      }),
    onSuccess: () => {
      toast.success(t('reviewSaved'));
      queryClient.invalidateQueries({
        queryKey: ['predictionWorkflowObservations'],
      });
      setSelectedObservation(null);
    },
  });

  const buildSignalsMutation = useMutation({
    mutationFn: () =>
      apiClient.post(adminRoutes.predictionWorkflowSignalsBuild(), {
        policyVersionId: selectedPolicyId,
      }),
    onSuccess: () => {
      toast.success(t('signalsBuilt'));
      queryClient.invalidateQueries({
        queryKey: ['predictionWorkflowSignals', selectedPolicyId],
      });
      queryClient.invalidateQueries({
        queryKey: ['predictionWorkflowPolicies'],
      });
    },
  });

  const selectedPolicy = useMemo(
    () => policies.find((policy) => policy.id === selectedPolicyId) ?? null,
    [policies, selectedPolicyId]
  );

  const openReview = (observation: PredictionWorkflowObservation) => {
    setSelectedObservation(observation);
    setReviewStatus(
      (observation.status === 'RAW'
        ? 'UNDER_REVIEW'
        : observation.status) as (typeof REVIEW_TARGET_STATUSES)[number]
    );
    setReviewAt(toDatetimeLocal(observation.reviewAt));
    setExpiresAt(toDatetimeLocal(observation.expiresAt));
    setReviewNotes('');
  };

  const handleSubmitReview = () => {
    if (!selectedObservation) return;
    reviewMutation.mutate({
      id: selectedObservation.id,
      status: reviewStatus,
      reviewAt,
      expiresAt,
      notes: reviewNotes,
    });
  };

  const observations = observationsResponse?.items ?? [];

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-body">
            <SearchCheck className="h-4 w-4" />
            {t('hubTitle')}
          </CardTitle>
        </CardHeader>
        <CardContent className="flex flex-wrap items-center gap-3">
          <div className="min-w-[240px]">
            <Label className="mb-2 block text-xs text-muted-foreground">{t('policyVersion')}</Label>
            <Select value={selectedPolicyId} onValueChange={setSelectedPolicyId}>
              <SelectTrigger>
                <SelectValue placeholder={t('selectPolicy')} />
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
          <div className="flex items-end gap-2">
            <Button
              onClick={() => buildSignalsMutation.mutate()}
              disabled={!selectedPolicyId || buildSignalsMutation.isPending}
            >
              <RefreshCcw className="mr-1.5 h-4 w-4" />
              {t('buildSignals')}
            </Button>
          </div>
          {selectedPolicy && (
            <div className="ml-auto flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
              <Badge variant="outline">{selectedPolicy.status}</Badge>
              <span>{selectedPolicy.version}</span>
              <span>{selectedPolicy.policyKey}</span>
            </div>
          )}
        </CardContent>
      </Card>

      <div className="grid min-w-0 gap-4 xl:grid-cols-[1.4fr_1fr]">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-body">
              <Filter className="h-4 w-4" />
              {t('observationsTitle')}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex flex-wrap items-center gap-3">
              <Select
                value={statusFilter}
                onValueChange={(value) => setStatusFilter(value as typeof statusFilter)}
              >
                <SelectTrigger className="w-[220px]">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {OBSERVATION_STATUSES.map((status) => (
                    <SelectItem key={status} value={status}>
                      {status === 'all' ? t('allStatuses') : humanizeEnum(status)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>

              <Select
                value={sourceFilter}
                onValueChange={(value) => setSourceFilter(value as typeof sourceFilter)}
              >
                <SelectTrigger className="w-[220px]">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {OBSERVATION_SOURCES.map((source) => (
                    <SelectItem key={source} value={source}>
                      {source === 'all' ? t('allSources') : humanizeEnum(source)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {observationsLoading ? (
              <div className="space-y-3">
                {Array.from({ length: 5 }).map((_, index) => (
                  <Skeleton key={index} className="h-12 rounded-lg" />
                ))}
              </div>
            ) : observations.length === 0 ? (
              <div className="rounded-lg border border-dashed p-8 text-sm text-muted-foreground">
                {t('emptyObservations')}
              </div>
            ) : (
              <div className="rounded-lg border">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>{t('school')}</TableHead>
                      <TableHead>{t('source')}</TableHead>
                      <TableHead>{t('stage')}</TableHead>
                      <TableHead>{t('status')}</TableHead>
                      <TableHead>{t('reviewWindow')}</TableHead>
                      <TableHead className="text-right">{t('actions')}</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {observations.map((observation) => (
                      <TableRow key={observation.id}>
                        <TableCell>
                          <div className="space-y-1">
                            <div className="font-medium">
                              {observation.school
                                ? getSchoolName(observation.school, locale)
                                : observation.metricType}
                            </div>
                            <div className="text-xs text-muted-foreground">
                              {observation.cohortKey ?? '—'} · {observation.round ?? '—'}
                            </div>
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className="space-y-1">
                            <div>{observation.sourceName}</div>
                            <div className="text-xs text-muted-foreground">
                              {humanizeEnum(observation.sourceType)}
                            </div>
                          </div>
                        </TableCell>
                        <TableCell>{humanizeEnum(observation.observationStage)}</TableCell>
                        <TableCell>
                          <Badge variant="outline">{humanizeEnum(observation.status)}</Badge>
                        </TableCell>
                        <TableCell className="text-xs text-muted-foreground">
                          {observation.reviewAt
                            ? new Date(observation.reviewAt).toLocaleDateString()
                            : '—'}
                          {' / '}
                          {observation.expiresAt
                            ? new Date(observation.expiresAt).toLocaleDateString()
                            : '—'}
                        </TableCell>
                        <TableCell className="text-right">
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => openReview(observation)}
                          >
                            {t('review')}
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
                <PaginationControls
                  page={observationsResponse?.page ?? 1}
                  totalPages={observationsResponse?.totalPages ?? 1}
                  total={observationsResponse?.total ?? 0}
                  pageSize={observationsResponse?.pageSize ?? PAGE_SIZE}
                  onPageChange={setPage}
                />
              </div>
            )}
          </CardContent>
        </Card>

        <div className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-body">
                <Activity className="h-4 w-4" />
                {t('activeSignalsTitle')}
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {signalsLoading || policiesLoading ? (
                <div className="space-y-3">
                  {Array.from({ length: 3 }).map((_, index) => (
                    <Skeleton key={index} className="h-16 rounded-lg" />
                  ))}
                </div>
              ) : !signals ? (
                <div className="text-sm text-muted-foreground">{t('selectPolicyHint')}</div>
              ) : (
                <>
                  <div className="grid gap-3 md:grid-cols-3 xl:grid-cols-1">
                    <Card>
                      <CardContent className="pt-4">
                        <div className="text-sm text-muted-foreground">{t('priors')}</div>
                        <div className="text-2xl font-semibold">{signals.counts.priors}</div>
                      </CardContent>
                    </Card>
                    <Card>
                      <CardContent className="pt-4">
                        <div className="text-sm text-muted-foreground">{t('driftSignals')}</div>
                        <div className="text-2xl font-semibold">{signals.counts.drifts}</div>
                      </CardContent>
                    </Card>
                    <Card>
                      <CardContent className="pt-4">
                        <div className="text-sm text-muted-foreground">
                          {t('relationshipSignals')}
                        </div>
                        <div className="text-2xl font-semibold">{signals.counts.relationships}</div>
                      </CardContent>
                    </Card>
                  </div>

                  <div className="space-y-3">
                    <div>
                      <p className="text-sm font-medium">{t('priors')}</p>
                      <div className="mt-2 space-y-2">
                        {signals.priors.slice(0, 3).map((prior) => (
                          <div key={prior.id} className="rounded-lg border p-3 text-sm">
                            <div className="font-medium">{getSchoolName(prior.school, locale)}</div>
                            <div className="text-muted-foreground">
                              {prior.cohortKey} · {prior.round} · {prior.priorRate}
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>

                    <div>
                      <p className="text-sm font-medium">{t('driftSignals')}</p>
                      <div className="mt-2 space-y-2">
                        {signals.drifts.slice(0, 3).map((drift) => (
                          <div key={drift.id} className="rounded-lg border p-3 text-sm">
                            <div className="font-medium">{getSchoolName(drift.school, locale)}</div>
                            <div className="text-muted-foreground">
                              {drift.signalType ?? 'drift'} · {drift.driftMultiplier ?? '—'}
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>

                    <div>
                      <p className="text-sm font-medium">{t('relationshipSignals')}</p>
                      <div className="mt-2 space-y-2">
                        {signals.relationships.slice(0, 3).map((relationship) => (
                          <div key={relationship.id} className="rounded-lg border p-3 text-sm">
                            <div className="font-medium">
                              {getSchoolName(relationship.targetSchool, locale)}
                            </div>
                            <div className="text-muted-foreground">
                              {relationship.sourceHighSchool?.name ?? relationship.relationshipType}
                              {' · '}
                              {relationship.signalStrength ?? '—'}
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                </>
              )}
            </CardContent>
          </Card>
        </div>
      </div>

      <Dialog
        open={Boolean(selectedObservation)}
        onOpenChange={(open) => !open && setSelectedObservation(null)}
      >
        <DialogContent className="sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle>{t('reviewDialogTitle')}</DialogTitle>
          </DialogHeader>
          {selectedObservation && (
            <div className="space-y-4">
              <div className="rounded-lg border bg-muted/30 p-3 text-sm">
                <div className="font-medium">
                  {selectedObservation.school
                    ? getSchoolName(selectedObservation.school, locale)
                    : selectedObservation.metricType}
                </div>
                <div className="mt-1 text-muted-foreground">
                  {selectedObservation.sourceName} · {humanizeEnum(selectedObservation.sourceType)}{' '}
                  · {humanizeEnum(selectedObservation.observationStage)}
                </div>
                {selectedObservation.notes && (
                  <pre className="mt-3 whitespace-pre-wrap text-xs text-muted-foreground">
                    {selectedObservation.notes}
                  </pre>
                )}
              </div>

              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-2">
                  <Label>{t('status')}</Label>
                  <Select
                    value={reviewStatus}
                    onValueChange={(value) => setReviewStatus(value as typeof reviewStatus)}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {REVIEW_TARGET_STATUSES.map((status) => (
                        <SelectItem key={status} value={status}>
                          {humanizeEnum(status)}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>{t('reviewAt')}</Label>
                  <Input
                    type="datetime-local"
                    value={reviewAt}
                    onChange={(e) => setReviewAt(e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label>{t('expiresAt')}</Label>
                  <Input
                    type="datetime-local"
                    value={expiresAt}
                    onChange={(e) => setExpiresAt(e.target.value)}
                  />
                </div>
                <div className="space-y-2 md:col-span-2">
                  <Label>{t('notes')}</Label>
                  <Textarea
                    value={reviewNotes}
                    onChange={(e) => setReviewNotes(e.target.value)}
                    placeholder={t('notesPlaceholder')}
                  />
                </div>
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setSelectedObservation(null)}>
              {t('cancel')}
            </Button>
            <Button onClick={handleSubmitReview} disabled={reviewMutation.isPending}>
              <Clock3 className="mr-1.5 h-4 w-4" />
              {t('saveReview')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
