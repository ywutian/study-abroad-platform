'use client';

import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useTranslations } from 'next-intl';
import { Coins, Inbox, CheckCircle2, AlertTriangle } from 'lucide-react';
import { pointsAdminRoutes } from '@study-abroad/shared';

import { PageContainer, PageHeader } from '@/components/layout';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { EmptyState } from '@/components/ui/empty-state';
import { apiClient } from '@/lib/api';
import { toast } from 'sonner';

interface Redemption {
  id: string;
  type: string;
  pointsSpent: number;
  status: string;
  createdAt: string;
  fulfilledAt: string | null;
  metadata: {
    fulfillment?: { bookingUrl?: string };
    outcome?: {
      attended?: boolean;
      intent?: string;
      quotedAmount?: number;
      converted?: boolean;
      lostReason?: string;
      counselorId?: string;
    };
  } | null;
  user?: { id: string; email?: string; profile?: { realName?: string } };
}

/** The form state for one consultation row, before it is sent. */
interface OutcomeDraft {
  attended: boolean;
  intent?: 'HOT' | 'WARM' | 'COLD';
  quotedAmount?: string;
  converted?: boolean;
  lostReason?: string;
  counselorId?: string;
}

/**
 * /admin/points-redemptions — the operator side of the points economy.
 *
 * Two queues, because a redemption has two steps and only the first had any UI:
 *   1. PENDING → an operator sends the booking link and marks it delivered
 *   2. FULFILLED → the session happens, and its result gets recorded
 *
 * Step 2 existed only as an API route until this page. Without it a fulfilled
 * consultation disappeared from every operator surface, so the three numbers
 * that decide pricing — attendance, conversion, whether 2000 points is the
 * right threshold — had nowhere to come from.
 */
export default function PointsRedemptionsPage() {
  const t = useTranslations('admin.pointsRedemptions');
  const queryClient = useQueryClient();
  const [cancelReasons, setCancelReasons] = useState<Record<string, string>>({});
  const [drafts, setDrafts] = useState<Record<string, OutcomeDraft>>({});

  const { data: pending } = useQuery<Redemption[]>({
    queryKey: ['admin', 'redemptions', 'pending'],
    queryFn: () => apiClient.get<Redemption[]>(pointsAdminRoutes.pendingRedemptions()),
  });

  const { data: consultations } = useQuery<Redemption[]>({
    queryKey: ['admin', 'redemptions', 'consultations'],
    queryFn: () => apiClient.get<Redemption[]>(pointsAdminRoutes.fulfilledConsultations()),
  });

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: ['admin', 'redemptions'] });
  };

  const fulfil = useMutation({
    // @cache-invalidation-allowed: onSuccess calls invalidate(), which invalidates the shared admin redemption prefix.
    mutationFn: ({ id, bookingUrl }: { id: string; bookingUrl?: string }) =>
      apiClient.patch(pointsAdminRoutes.fulfil(id), {
        fulfillment: bookingUrl ? { bookingUrl } : undefined,
      }),
    onSuccess: () => {
      toast.success(t('fulfilled'));
      invalidate();
    },
    onError: () => toast.error(t('actionFailed')),
  });

  const cancel = useMutation({
    // @cache-invalidation-allowed: onSuccess calls invalidate(), which invalidates the shared admin redemption prefix.
    mutationFn: ({ id, reason }: { id: string; reason: string }) =>
      apiClient.patch(pointsAdminRoutes.cancel(id), { reason }),
    onSuccess: () => {
      toast.success(t('cancelled'));
      invalidate();
    },
    onError: () => toast.error(t('actionFailed')),
  });

  const recordOutcome = useMutation({
    // @cache-invalidation-allowed: onSuccess calls invalidate(), which invalidates the shared admin redemption prefix.
    mutationFn: ({ id, draft }: { id: string; draft: OutcomeDraft }) =>
      apiClient.patch(pointsAdminRoutes.recordOutcome(id), {
        attended: draft.attended,
        // Everything below only makes sense for a session that happened.
        ...(draft.attended
          ? {
              intent: draft.intent,
              quotedAmount: draft.quotedAmount ? Number(draft.quotedAmount) : undefined,
              converted: draft.converted,
              lostReason: draft.lostReason || undefined,
              counselorId: draft.counselorId || undefined,
            }
          : {}),
      }),
    onSuccess: () => {
      toast.success(t('saved'));
      invalidate();
    },
    onError: () => toast.error(t('saveFailed')),
  });

  const draftFor = (id: string, existing: Redemption['metadata']) =>
    drafts[id] ?? {
      attended: existing?.outcome?.attended ?? true,
      intent: existing?.outcome?.intent as OutcomeDraft['intent'],
      quotedAmount: existing?.outcome?.quotedAmount?.toString(),
      converted: existing?.outcome?.converted,
      lostReason: existing?.outcome?.lostReason,
      counselorId: existing?.outcome?.counselorId,
    };

  const patchDraft = (id: string, patch: Partial<OutcomeDraft>) =>
    setDrafts((d) => ({ ...d, [id]: { ...draftFor(id, null), ...d[id], ...patch } }));

  const who = (r: Redemption) => r.user?.profile?.realName || r.user?.email || r.user?.id || '—';

  return (
    <PageContainer>
      <PageHeader title={t('title')} description={t('description')} color="amber" icon={Coins} />

      <div className="mb-6 flex items-start gap-2 rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900 dark:border-amber-800 dark:bg-amber-950/30 dark:text-amber-200">
        <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
        <p className="min-w-0">{t('warning')}</p>
      </div>

      <section className="mb-10">
        <h2 className="mb-3 text-title">{t('pendingTitle')}</h2>
        {!pending || pending.length === 0 ? (
          <EmptyState
            icon={<Inbox className="h-12 w-12 text-muted-foreground" />}
            title={t('pendingEmpty')}
          />
        ) : (
          <div className="space-y-3">
            {pending.map((r) => (
              <Card key={r.id}>
                <CardContent className="p-5">
                  <div className="mb-3 flex flex-wrap items-center gap-2">
                    <Badge variant="outline">{r.type}</Badge>
                    <Badge>
                      {t('spent')} {r.pointsSpent}
                    </Badge>
                    <span className="min-w-0 truncate text-sm text-muted-foreground">
                      {who(r)} · {new Date(r.createdAt).toLocaleString()}
                    </span>
                  </div>

                  <Input
                    placeholder={t('bookingUrl')}
                    className="mb-3"
                    value={cancelReasons[`url:${r.id}`] ?? ''}
                    onChange={(e) =>
                      setCancelReasons((s) => ({
                        ...s,
                        [`url:${r.id}`]: e.target.value,
                      }))
                    }
                  />
                  <Textarea
                    placeholder={t('cancelReason')}
                    className="mb-3"
                    value={cancelReasons[r.id] ?? ''}
                    onChange={(e) => setCancelReasons((s) => ({ ...s, [r.id]: e.target.value }))}
                  />

                  <div className="flex flex-wrap gap-2">
                    <Button
                      size="sm"
                      disabled={fulfil.isPending}
                      onClick={() =>
                        fulfil.mutate({
                          id: r.id,
                          bookingUrl: cancelReasons[`url:${r.id}`],
                        })
                      }
                    >
                      {t('fulfil')}
                    </Button>
                    <Button
                      size="sm"
                      variant="destructive"
                      disabled={cancel.isPending || !cancelReasons[r.id]}
                      onClick={() =>
                        cancel.mutate({
                          id: r.id,
                          reason: cancelReasons[r.id] ?? '',
                        })
                      }
                    >
                      {t('cancel')}
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </section>

      <section>
        <h2 className="mb-3 text-title">{t('consultTitle')}</h2>
        {!consultations || consultations.length === 0 ? (
          <EmptyState
            icon={<CheckCircle2 className="h-12 w-12 text-muted-foreground" />}
            title={t('consultEmpty')}
          />
        ) : (
          <div className="space-y-3">
            {consultations.map((r) => {
              const draft = draftFor(r.id, r.metadata);
              const recorded = !!r.metadata?.outcome;
              return (
                <Card key={r.id}>
                  <CardContent className="p-5">
                    <div className="mb-3 flex flex-wrap items-center gap-2">
                      <Badge
                        variant={recorded ? 'default' : 'outline'}
                        className={recorded ? 'bg-emerald-600' : ''}
                      >
                        {recorded ? t('outcomeRecorded') : t('outcomeMissing')}
                      </Badge>
                      <span className="min-w-0 truncate text-sm text-muted-foreground">
                        {who(r)} · {r.fulfilledAt ? new Date(r.fulfilledAt).toLocaleString() : '—'}
                      </span>
                    </div>

                    <div className="mb-3 flex flex-wrap gap-2">
                      <Button
                        size="sm"
                        variant={draft.attended ? 'default' : 'outline'}
                        onClick={() => patchDraft(r.id, { attended: true })}
                      >
                        {t('attended')}
                      </Button>
                      <Button
                        size="sm"
                        variant={!draft.attended ? 'default' : 'outline'}
                        onClick={() => patchDraft(r.id, { attended: false })}
                      >
                        {t('noShow')}
                      </Button>
                    </div>

                    {draft.attended && (
                      <div className="mb-3 space-y-3">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="text-sm text-muted-foreground">{t('intent')}</span>
                          {(['HOT', 'WARM', 'COLD'] as const).map((level) => (
                            <Button
                              key={level}
                              size="sm"
                              variant={draft.intent === level ? 'default' : 'outline'}
                              onClick={() => patchDraft(r.id, { intent: level })}
                            >
                              {level === 'HOT'
                                ? t('intentHot')
                                : level === 'WARM'
                                  ? t('intentWarm')
                                  : t('intentCold')}
                            </Button>
                          ))}
                        </div>

                        <div className="grid gap-3 sm:grid-cols-2">
                          <Input
                            type="number"
                            min={0}
                            placeholder={t('quotedAmount')}
                            value={draft.quotedAmount ?? ''}
                            onChange={(e) => patchDraft(r.id, { quotedAmount: e.target.value })}
                          />
                          <Input
                            placeholder={t('counselorId')}
                            value={draft.counselorId ?? ''}
                            onChange={(e) => patchDraft(r.id, { counselorId: e.target.value })}
                          />
                        </div>

                        <div className="flex flex-wrap gap-2">
                          <Button
                            size="sm"
                            variant={draft.converted ? 'default' : 'outline'}
                            onClick={() => patchDraft(r.id, { converted: !draft.converted })}
                          >
                            {t('converted')}
                          </Button>
                        </div>

                        {!draft.converted && (
                          <Textarea
                            placeholder={t('lostReason')}
                            value={draft.lostReason ?? ''}
                            onChange={(e) => patchDraft(r.id, { lostReason: e.target.value })}
                          />
                        )}
                      </div>
                    )}

                    <Button
                      size="sm"
                      disabled={recordOutcome.isPending}
                      onClick={() => recordOutcome.mutate({ id: r.id, draft })}
                    >
                      {t('save')}
                    </Button>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}
      </section>
    </PageContainer>
  );
}
