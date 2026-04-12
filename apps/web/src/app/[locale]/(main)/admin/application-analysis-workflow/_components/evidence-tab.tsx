'use client';

import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useLocale, useTranslations } from 'next-intl';
import { toast } from 'sonner';

import {
  adminRoutes,
  type PaginatedApplicationAnalysisEvidenceResponse,
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
import { Textarea } from '@/components/ui/textarea';
import { apiClient } from '@/lib/api';
import { getSchoolName } from '@/lib/utils';

import {
  EVIDENCE_DIMENSIONS,
  EVIDENCE_REVIEW_STATUSES,
  formatDateTime,
  humanizeEnum,
} from './utils';

export function EvidenceTab({ policiesReady }: { policiesReady: boolean }) {
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
