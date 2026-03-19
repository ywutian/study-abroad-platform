/* eslint-disable @typescript-eslint/no-explicit-any */
'use client';

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { PaginationControls } from '../../_components/pagination-controls';
import { apiClient } from '@/lib/api';
import { useTranslations } from 'next-intl';
import { toast } from 'sonner';
import { ShieldAlert, CheckCircle2, XCircle, Loader2, AlertTriangle } from 'lucide-react';

interface SecurityEvent {
  id: string;
  userId: string | null;
  sessionId: string | null;
  eventType: string;
  severity: string;
  description: string;
  payload: any;
  mitigationAction: string | null;
  resolved: boolean;
  resolvedAt: string | null;
  resolvedBy: string | null;
  createdAt: string;
}

const SEVERITY_VARIANT: Record<string, 'destructive' | 'warning' | 'secondary' | 'outline'> = {
  CRITICAL: 'destructive',
  HIGH: 'destructive',
  MEDIUM: 'warning',
  LOW: 'secondary',
};

export function AiModerationTab() {
  const t = useTranslations('admin');
  const queryClient = useQueryClient();

  const [page, setPage] = useState(1);
  const [severityFilter, setSeverityFilter] = useState('ALL');
  const [resolvedFilter, setResolvedFilter] = useState('false');
  const [reviewEvent, setReviewEvent] = useState<SecurityEvent | null>(null);
  const [reviewAction, setReviewAction] = useState<'approve' | 'reject'>('approve');
  const [reviewReason, setReviewReason] = useState('');

  const { data, isLoading } = useQuery({
    queryKey: ['securityEvents', page, severityFilter, resolvedFilter],
    queryFn: () =>
      apiClient.get<{ data: SecurityEvent[]; total: number; page: number; pageSize: number }>(
        '/admin/ai-agent/security-events',
        {
          params: {
            page: String(page),
            pageSize: '20',
            ...(severityFilter !== 'ALL' && { severity: severityFilter }),
            ...(resolvedFilter !== 'ALL' && { resolved: resolvedFilter }),
          },
        }
      ),
  });

  const resolveMutation = useMutation({
    mutationFn: ({ id, action, reason }: { id: string; action: string; reason?: string }) =>
      apiClient.put(`/admin/ai-agent/security-events/${id}/resolve`, { action, reason }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['securityEvents'] });
      toast.success(t('moderation.resolved'));
      setReviewEvent(null);
      setReviewReason('');
    },
  });

  const events = data?.data || [];
  const total = data?.total || 0;
  const totalPages = Math.ceil(total / 20);

  return (
    <div className="space-y-4">
      {/* Filters */}
      <div className="flex flex-wrap gap-3">
        <Select value={severityFilter} onValueChange={setSeverityFilter}>
          <SelectTrigger className="w-[150px]">
            <SelectValue placeholder={t('moderation.severity')} />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="ALL">{t('moderation.allSeverity')}</SelectItem>
            <SelectItem value="CRITICAL">Critical</SelectItem>
            <SelectItem value="HIGH">High</SelectItem>
            <SelectItem value="MEDIUM">Medium</SelectItem>
            <SelectItem value="LOW">Low</SelectItem>
          </SelectContent>
        </Select>

        <Select value={resolvedFilter} onValueChange={setResolvedFilter}>
          <SelectTrigger className="w-[150px]">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="ALL">{t('moderation.allStatus')}</SelectItem>
            <SelectItem value="false">{t('moderation.unresolved')}</SelectItem>
            <SelectItem value="true">{t('moderation.resolvedStatus')}</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Event list */}
      {isLoading ? (
        <div className="space-y-3">
          {[...Array(3)].map((_, i) => (
            <div key={i} className="h-24 rounded-lg border bg-muted/30 animate-pulse" />
          ))}
        </div>
      ) : events.length > 0 ? (
        <div className="space-y-3">
          {events.map((event) => (
            <Card key={event.id}>
              <CardContent className="p-4">
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1 min-w-0 space-y-2">
                    <div className="flex items-center gap-2 flex-wrap">
                      <ShieldAlert className="h-4 w-4 text-muted-foreground shrink-0" />
                      <Badge variant={SEVERITY_VARIANT[event.severity] || 'outline'}>
                        {event.severity}
                      </Badge>
                      <Badge variant="outline">{event.eventType.replace(/_/g, ' ')}</Badge>
                      {event.resolved ? (
                        <Badge variant="success">
                          <CheckCircle2 className="h-3 w-3 mr-1" />
                          {t('moderation.resolvedStatus')}
                        </Badge>
                      ) : (
                        <Badge variant="warning">
                          <AlertTriangle className="h-3 w-3 mr-1" />
                          {t('moderation.unresolved')}
                        </Badge>
                      )}
                    </div>
                    <p className="text-sm">{event.description}</p>
                    <div className="flex gap-4 text-xs text-muted-foreground">
                      {event.userId && <span>User: {event.userId.slice(0, 8)}...</span>}
                      <span>{new Date(event.createdAt).toLocaleString()}</span>
                      {event.mitigationAction && (
                        <span>
                          {t('moderation.action')}: {event.mitigationAction}
                        </span>
                      )}
                    </div>
                  </div>
                  {!event.resolved && (
                    <div className="flex gap-2 shrink-0">
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => {
                          setReviewEvent(event);
                          setReviewAction('approve');
                        }}
                      >
                        <CheckCircle2 className="h-3.5 w-3.5 mr-1" />
                        {t('moderation.approve')}
                      </Button>
                      <Button
                        size="sm"
                        variant="destructive"
                        onClick={() => {
                          setReviewEvent(event);
                          setReviewAction('reject');
                        }}
                      >
                        <XCircle className="h-3.5 w-3.5 mr-1" />
                        {t('moderation.reject')}
                      </Button>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      ) : (
        <div className="text-center py-8 text-sm text-muted-foreground">
          {t('moderation.noEvents')}
        </div>
      )}

      {totalPages > 1 && (
        <PaginationControls
          page={page}
          totalPages={totalPages}
          total={total}
          pageSize={20}
          onPageChange={setPage}
        />
      )}

      {/* Review dialog */}
      <Dialog open={!!reviewEvent} onOpenChange={(open) => !open && setReviewEvent(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {reviewAction === 'approve'
                ? t('moderation.approveTitle')
                : t('moderation.rejectTitle')}
            </DialogTitle>
            <DialogDescription>{reviewEvent?.description}</DialogDescription>
          </DialogHeader>
          <div className="space-y-3 py-2">
            <div className="space-y-2">
              <Label>{t('moderation.reason')}</Label>
              <Textarea
                value={reviewReason}
                onChange={(e) => setReviewReason(e.target.value)}
                placeholder={t('moderation.reasonPlaceholder')}
                rows={3}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setReviewEvent(null)}>
              {t('contentMod.cancel')}
            </Button>
            <Button
              variant={reviewAction === 'reject' ? 'destructive' : 'default'}
              disabled={resolveMutation.isPending}
              onClick={() => {
                if (!reviewEvent) return;
                resolveMutation.mutate({
                  id: reviewEvent.id,
                  action: reviewAction,
                  reason: reviewReason || undefined,
                });
              }}
            >
              {resolveMutation.isPending && <Loader2 className="mr-2 h-3 w-3 animate-spin" />}
              {reviewAction === 'approve' ? t('moderation.approve') : t('moderation.reject')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
