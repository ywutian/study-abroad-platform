'use client';

import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useTranslations } from 'next-intl';
import { ShieldCheck, FileSearch, ExternalLink } from 'lucide-react';
import { outcomeRoutes } from '@study-abroad/shared';

import { PageContainer, PageHeader } from '@/components/layout';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { EmptyState } from '@/components/ui/empty-state';
import { apiClient } from '@/lib/api';
import { toast } from 'sonner';

interface PendingOutcome {
  id: string;
  predictionResultId: string;
  result: string;
  status: string;
  notes: string | null;
  evidenceUrl: string | null;
  round: string | null;
  reportedBy: string | null;
  createdAt: string;
  schoolName?: string;
  predictionProbability?: number;
}

/**
 * /admin/outcomes-verification — Admin queue for verifying user-reported outcomes.
 *
 * Lists SELF_REPORTED outcomes. Admin can upgrade to:
 *  - COUNSELOR_VERIFIED (no document required)
 *  - DOCUMENT_VERIFIED (only if evidence URL exists)
 *  - REJECTED (claims look fishy)
 */
export default function OutcomesVerificationPage() {
  const t = useTranslations('Outcome');
  const queryClient = useQueryClient();
  const [reviewNotes, setReviewNotes] = useState<Record<string, string>>({});

  const { data: pending } = useQuery<PendingOutcome[]>({
    queryKey: ['admin', 'outcomes', 'pending'],
    queryFn: () => apiClient.get<PendingOutcome[]>(outcomeRoutes.adminPendingVerification()),
  });

  const verify = useMutation({
    mutationFn: async ({
      id,
      status,
      reviewNote,
    }: {
      id: string;
      status: string;
      reviewNote?: string;
    }) => {
      return apiClient.post(outcomeRoutes.adminVerify(id), { status, reviewNote });
    },
    onSuccess: () => {
      toast.success(t('reportSuccess'));
      queryClient.invalidateQueries({ queryKey: ['admin', 'outcomes', 'pending'] });
    },
    onError: () => toast.error(t('reportError')),
  });

  return (
    <PageContainer>
      <PageHeader
        title={t('adminQueueTitle')}
        description={t('adminQueueDescription')}
        color="indigo"
        icon={ShieldCheck}
      />

      {!pending || pending.length === 0 ? (
        <EmptyState
          icon={<FileSearch className="h-12 w-12 text-muted-foreground" />}
          title={t('adminEmpty')}
        />
      ) : (
        <div className="space-y-3">
          {pending.map((o) => (
            <Card key={o.id}>
              <CardContent className="p-5">
                <div className="flex items-start justify-between gap-3 mb-3">
                  <div>
                    <div className="flex items-center gap-2">
                      <Badge variant="outline">{o.round ?? 'RD'}</Badge>
                      <Badge>{o.result}</Badge>
                      {o.evidenceUrl && (
                        <Badge variant="default" className="bg-emerald-600">
                          {t('evidenceUploaded')}
                        </Badge>
                      )}
                    </div>
                    <h3 className="font-semibold text-base mt-2">{o.schoolName ?? '—'}</h3>
                    {o.predictionProbability !== undefined && (
                      <p className="text-xs text-muted-foreground mt-1">
                        Predicted: {(o.predictionProbability * 100).toFixed(1)}%
                      </p>
                    )}
                    {o.notes && (
                      <p className="text-sm text-muted-foreground mt-2 max-w-2xl">
                        {o.notes.replace(/\[share=true\]/g, ' (opt-in share)').trim()}
                      </p>
                    )}
                    {o.evidenceUrl && (
                      <a
                        href={o.evidenceUrl}
                        target="_blank"
                        rel="noreferrer"
                        className="text-sm text-primary inline-flex items-center gap-1 mt-2"
                      >
                        View evidence <ExternalLink className="h-3 w-3" />
                      </a>
                    )}
                    <p className="text-xs text-muted-foreground mt-2">
                      Reported by user {o.reportedBy ?? '?'} on{' '}
                      {new Date(o.createdAt).toLocaleString()}
                    </p>
                  </div>
                </div>

                <Textarea
                  placeholder={t('adminReviewNote')}
                  value={reviewNotes[o.id] ?? ''}
                  onChange={(e) => setReviewNotes((r) => ({ ...r, [o.id]: e.target.value }))}
                  className="mb-3"
                />

                <div className="flex gap-2 flex-wrap">
                  <Button
                    size="sm"
                    disabled={verify.isPending}
                    onClick={() =>
                      verify.mutate({
                        id: o.id,
                        status: 'COUNSELOR_VERIFIED',
                        reviewNote: reviewNotes[o.id],
                      })
                    }
                  >
                    {t('adminVerifyCounselor')}
                  </Button>
                  <Button
                    size="sm"
                    disabled={verify.isPending || !o.evidenceUrl}
                    onClick={() =>
                      verify.mutate({
                        id: o.id,
                        status: 'DOCUMENT_VERIFIED',
                        reviewNote: reviewNotes[o.id],
                      })
                    }
                  >
                    {t('adminVerifyDocument')}
                  </Button>
                  <Button
                    size="sm"
                    variant="destructive"
                    disabled={verify.isPending}
                    onClick={() =>
                      verify.mutate({
                        id: o.id,
                        status: 'REJECTED',
                        reviewNote: reviewNotes[o.id],
                      })
                    }
                  >
                    {t('adminReject')}
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </PageContainer>
  );
}
