'use client';

import { useState } from 'react';
import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useLocale, useTranslations } from 'next-intl';
import { toast } from 'sonner';
import { AlertTriangle, CheckCircle2, ShieldCheck } from 'lucide-react';

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
import { Checkbox } from '@/components/ui/checkbox';
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
import type { PredictionWorkflowOutcome } from './prediction-workflow-types';

const PAGE_SIZE = 10;

const OUTCOME_STATUSES = [
  'all',
  'SELF_REPORTED',
  'COUNSELOR_VERIFIED',
  'DOCUMENT_VERIFIED',
  'REQUEST_EVIDENCE',
  'REJECTED',
  'CONFLICTED',
  'CENSORED',
] as const;

const OUTCOME_RESULTS = [
  'all',
  'ADMITTED',
  'REJECTED',
  'WAITLISTED',
  'DEFERRED',
  'WITHDRAWN',
] as const;

function humanizeEnum(value: string) {
  return value
    .toLowerCase()
    .split('_')
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ');
}

export function OutcomesTab() {
  const t = useTranslations('admin.calibrations.outcomes');
  const locale = useLocale();
  const queryClient = useQueryClient();

  const [page, setPage] = useState(1);
  const [statusFilter, setStatusFilter] = useState<(typeof OUTCOME_STATUSES)[number]>('all');
  const [resultFilter, setResultFilter] = useState<(typeof OUTCOME_RESULTS)[number]>('all');
  const [eligibleOnly, setEligibleOnly] = useState(false);
  const [selectedOutcome, setSelectedOutcome] = useState<PredictionWorkflowOutcome | null>(null);
  const [reviewStatus, setReviewStatus] =
    useState<(typeof OUTCOME_STATUSES)[number]>('COUNSELOR_VERIFIED');
  const [reviewNotes, setReviewNotes] = useState('');
  const [evidenceUrl, setEvidenceUrl] = useState('');
  const [round, setRound] = useState('');
  const [isFinal, setIsFinal] = useState(false);

  const { data, isLoading } = useQuery<PaginatedResponse<PredictionWorkflowOutcome>>({
    // Keeps the rows on screen while the next page/filter loads.
    placeholderData: keepPreviousData,
    queryKey: ['predictionWorkflowOutcomes', page, statusFilter, resultFilter, eligibleOnly],
    queryFn: () =>
      apiClient.get(adminRoutes.predictionWorkflowOutcomes(), {
        params: {
          page,
          pageSize: PAGE_SIZE,
          status: statusFilter === 'all' ? undefined : statusFilter,
          result: resultFilter === 'all' ? undefined : resultFilter,
          eligibleOnly: eligibleOnly || undefined,
        },
      }),
  });

  const reviewMutation = useMutation({
    mutationFn: (payload: {
      id: string;
      status: string;
      notes?: string;
      evidenceUrl?: string;
      round?: string;
      isFinal?: boolean;
    }) =>
      apiClient.patch(adminRoutes.predictionWorkflowOutcomeReview(payload.id), {
        status: payload.status,
        notes: payload.notes || undefined,
        evidenceUrl: payload.evidenceUrl || undefined,
        round: payload.round || undefined,
        isFinal: payload.isFinal ?? undefined,
      }),
    onSuccess: () => {
      toast.success(t('reviewSaved'));
      queryClient.invalidateQueries({ queryKey: ['predictionWorkflowOutcomes'] });
      setSelectedOutcome(null);
    },
  });

  const openReview = (outcome: PredictionWorkflowOutcome) => {
    setSelectedOutcome(outcome);
    setReviewStatus(
      (outcome.status === 'SELF_REPORTED'
        ? 'COUNSELOR_VERIFIED'
        : outcome.status) as (typeof OUTCOME_STATUSES)[number]
    );
    setReviewNotes('');
    setEvidenceUrl(outcome.evidenceUrl ?? '');
    setRound(outcome.round ?? outcome.applicationRound ?? '');
    setIsFinal(outcome.isFinal);
  };

  const submitReview = () => {
    if (!selectedOutcome) return;
    reviewMutation.mutate({
      id: selectedOutcome.id,
      status: reviewStatus,
      notes: reviewNotes,
      evidenceUrl,
      round,
      isFinal,
    });
  };

  const items = data?.items ?? [];

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <ShieldCheck className="h-4 w-4" />
            {t('title')}
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
                {OUTCOME_STATUSES.map((status) => (
                  <SelectItem key={status} value={status}>
                    {status === 'all' ? t('allStatuses') : humanizeEnum(status)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Select
              value={resultFilter}
              onValueChange={(value) => setResultFilter(value as typeof resultFilter)}
            >
              <SelectTrigger className="w-[220px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {OUTCOME_RESULTS.map((result) => (
                  <SelectItem key={result} value={result}>
                    {result === 'all' ? t('allResults') : humanizeEnum(result)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            <div className="flex items-center gap-2">
              <Checkbox
                checked={eligibleOnly}
                onCheckedChange={(checked) => setEligibleOnly(Boolean(checked))}
                id="eligible-only"
              />
              <Label htmlFor="eligible-only">{t('eligibleOnly')}</Label>
            </div>
          </div>

          {isLoading ? (
            <div className="space-y-3">
              {Array.from({ length: 5 }).map((_, index) => (
                <Skeleton key={index} className="h-12 rounded-lg" />
              ))}
            </div>
          ) : items.length === 0 ? (
            <div className="rounded-lg border border-dashed p-8 text-sm text-muted-foreground">
              {t('empty')}
            </div>
          ) : (
            <div className="rounded-lg border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>{t('school')}</TableHead>
                    <TableHead>{t('reported')}</TableHead>
                    <TableHead>{t('status')}</TableHead>
                    <TableHead>{t('eligible')}</TableHead>
                    <TableHead>{t('evidence')}</TableHead>
                    <TableHead className="text-right">{t('actions')}</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {items.map((item) => (
                    <TableRow key={item.id}>
                      <TableCell>
                        <div className="space-y-1">
                          <div className="font-medium">
                            {item.school ? getSchoolName(item.school, locale) : item.schoolId}
                          </div>
                          <div className="text-xs text-muted-foreground">
                            {item.cohortKey ?? '—'} · {item.round ?? item.applicationRound ?? '—'}
                          </div>
                          {item.suspiciousFlags?.length ? (
                            <div className="flex flex-wrap gap-1 pt-1">
                              {item.suspiciousFlags.map((flag) => (
                                <Badge key={flag} variant="destructive" className="text-2xs">
                                  {humanizeEnum(flag)}
                                </Badge>
                              ))}
                            </div>
                          ) : null}
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="space-y-1">
                          <div>{humanizeEnum(item.result)}</div>
                          <div className="text-xs text-muted-foreground">
                            {new Date(item.reportedAt).toLocaleString()}
                          </div>
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline">{humanizeEnum(item.status)}</Badge>
                      </TableCell>
                      <TableCell>
                        {item.calibrationEligible ? (
                          <Badge>{t('statusReady')}</Badge>
                        ) : (
                          <Badge variant="outline">No</Badge>
                        )}
                      </TableCell>
                      <TableCell>
                        {item.evidenceUrl ? (
                          <a
                            href={item.evidenceUrl}
                            target="_blank"
                            rel="noreferrer"
                            className="text-sm text-primary underline-offset-4 hover:underline"
                          >
                            {t('viewEvidence')}
                          </a>
                        ) : (
                          <span className="text-sm text-muted-foreground">—</span>
                        )}
                      </TableCell>
                      <TableCell className="text-right">
                        <Button variant="outline" size="sm" onClick={() => openReview(item)}>
                          {t('review')}
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>

              <PaginationControls
                page={data?.page ?? 1}
                totalPages={data?.totalPages ?? 1}
                total={data?.total ?? 0}
                pageSize={data?.pageSize ?? PAGE_SIZE}
                onPageChange={setPage}
              />
            </div>
          )}
        </CardContent>
      </Card>

      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardContent className="pt-4">
            <div className="text-sm text-muted-foreground">{t('readyCount')}</div>
            <div className="text-2xl font-semibold">
              {items.filter((item) => item.calibrationEligible).length}
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4">
            <div className="text-sm text-muted-foreground">{t('conflictedCount')}</div>
            <div className="text-2xl font-semibold">
              {items.filter((item) => item.status === 'CONFLICTED').length}
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4">
            <div className="text-sm text-muted-foreground">{t('selfReportedCount')}</div>
            <div className="text-2xl font-semibold">
              {items.filter((item) => item.status === 'SELF_REPORTED').length}
            </div>
          </CardContent>
        </Card>
      </div>

      <Dialog
        open={Boolean(selectedOutcome)}
        onOpenChange={(open) => !open && setSelectedOutcome(null)}
      >
        <DialogContent className="sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle>{t('reviewDialogTitle')}</DialogTitle>
          </DialogHeader>
          {selectedOutcome && (
            <div className="space-y-4">
              <div className="rounded-lg border bg-muted/30 p-3 text-sm">
                <div className="font-medium">
                  {selectedOutcome.school
                    ? getSchoolName(selectedOutcome.school, locale)
                    : selectedOutcome.schoolId}
                </div>
                <div className="mt-1 text-muted-foreground">
                  {humanizeEnum(selectedOutcome.result)} · {humanizeEnum(selectedOutcome.status)}
                </div>
                {selectedOutcome.latestOutcomeLabel && (
                  <div className="mt-3 flex items-center gap-2 text-xs text-muted-foreground">
                    {selectedOutcome.calibrationEligible ? (
                      <CheckCircle2 className="h-4 w-4 text-emerald-500" />
                    ) : (
                      <AlertTriangle className="h-4 w-4 text-amber-500" />
                    )}
                    <span>
                      {t('canonicalLabel')}:{' '}
                      {humanizeEnum(selectedOutcome.latestOutcomeLabel.result)} /{' '}
                      {humanizeEnum(selectedOutcome.latestOutcomeLabel.status)}
                    </span>
                  </div>
                )}
                {selectedOutcome.suspiciousFlags?.length ? (
                  <div className="mt-3 rounded-md border border-amber-300 bg-amber-50 p-2 text-xs text-amber-900 dark:border-amber-900/50 dark:bg-amber-950/30 dark:text-amber-200">
                    Review flags: {selectedOutcome.suspiciousFlags.map(humanizeEnum).join(', ')}
                  </div>
                ) : null}
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
                      {OUTCOME_STATUSES.filter((status) => status !== 'all').map((status) => (
                        <SelectItem key={status} value={status}>
                          {humanizeEnum(status)}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label>{t('round')}</Label>
                  <Input value={round} onChange={(event) => setRound(event.target.value)} />
                </div>

                <div className="space-y-2 md:col-span-2">
                  <Label>{t('evidenceUrl')}</Label>
                  <Input
                    value={evidenceUrl}
                    onChange={(event) => setEvidenceUrl(event.target.value)}
                    placeholder="https://..."
                  />
                </div>

                <div className="space-y-2 md:col-span-2">
                  <Label>{t('notes')}</Label>
                  <Textarea
                    value={reviewNotes}
                    onChange={(event) => setReviewNotes(event.target.value)}
                    placeholder={t('notesPlaceholder')}
                  />
                </div>

                <div className="flex items-center gap-2 md:col-span-2">
                  <Checkbox
                    checked={isFinal}
                    onCheckedChange={(checked) => setIsFinal(Boolean(checked))}
                    id="is-final"
                  />
                  <Label htmlFor="is-final">{t('markFinal')}</Label>
                </div>
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setSelectedOutcome(null)}>
              {t('cancel')}
            </Button>
            <Button onClick={submitReview} disabled={reviewMutation.isPending}>
              {t('saveReview')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
