'use client';

import { useState, useCallback } from 'react';
import { useTranslations, useFormatter } from 'next-intl';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { PageHeader } from '@/components/layout';
import { CardSkeleton } from '@/components/ui/loading-state';
import { EmptyState } from '@/components/ui/empty-state';
import { PaginationControls } from '../_components/pagination-controls';
import { VerificationStatsCards } from './_components/verification-stats-cards';
import { VerificationDetailDialog } from './_components/verification-detail-dialog';
import { VerificationConfirmDialog } from './_components/verification-confirm-dialog';
import { apiClient } from '@/lib/api';
import { toast } from 'sonner';
import { ShieldCheck, Clock, CheckCircle, XCircle, FileText, GraduationCap } from 'lucide-react';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface VerificationStats {
  pending: number;
  approved: number;
  rejected: number;
  total: number;
}

interface VerificationItem {
  id: string;
  userId: string;
  caseId: string;
  proofType: string;
  proofUrl?: string;
  status: 'PENDING' | 'APPROVED' | 'REJECTED';
  reviewNote?: string;
  createdAt: string;
  reviewedAt?: string;
  user?: {
    email: string;
    profile?: { nickname?: string; avatarUrl?: string };
  };
  case?: {
    school?: { name: string; nameZh?: string };
    admissionResult?: string;
  };
}

interface VerificationDetail extends VerificationItem {
  proofData?: string;
  reviewer?: { email: string; profile?: { nickname?: string } };
}

interface PaginatedResponse {
  items: VerificationItem[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
}

type StatusFilter = 'all' | 'PENDING' | 'APPROVED' | 'REJECTED';

const STATUS_BADGE: Record<
  string,
  { variant: 'default' | 'secondary' | 'destructive'; icon: typeof Clock }
> = {
  PENDING: { variant: 'secondary', icon: Clock },
  APPROVED: { variant: 'default', icon: CheckCircle },
  REJECTED: { variant: 'destructive', icon: XCircle },
};

const PAGE_SIZE = 20;

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

export default function AdminVerificationsPage() {
  const t = useTranslations('admin');
  const format = useFormatter();
  const queryClient = useQueryClient();

  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');
  const [page, setPage] = useState(1);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [detailOpen, setDetailOpen] = useState(false);
  const [reviewNote, setReviewNote] = useState('');
  const [confirmAction, setConfirmAction] = useState<'APPROVE' | 'REJECT' | null>(null);

  // Stats
  const { data: stats } = useQuery<VerificationStats>({
    queryKey: ['adminVerificationStats'],
    queryFn: () => apiClient.get<VerificationStats>('/verifications/stats'),
  });

  // List
  const { data: listData, isLoading } = useQuery<PaginatedResponse>({
    queryKey: ['adminVerifications', statusFilter, page],
    queryFn: () =>
      apiClient.get<PaginatedResponse>('/verifications/pending', {
        params: {
          page,
          pageSize: PAGE_SIZE,
          ...(statusFilter !== 'all' && { status: statusFilter }),
        },
      }),
  });

  // Detail
  const { data: detail, isLoading: detailLoading } = useQuery<VerificationDetail>({
    queryKey: ['adminVerificationDetail', selectedId],
    queryFn: () => apiClient.get<VerificationDetail>(`/verifications/${selectedId}`),
    enabled: !!selectedId,
  });

  // Review mutation
  const reviewMutation = useMutation({
    mutationFn: ({ id, action, note }: { id: string; action: string; note?: string }) =>
      apiClient.post(`/verifications/${id}/review`, { action, note: note || undefined }),
    onSuccess: (_data, variables) => {
      const isApproved = variables.action === 'APPROVE';
      toast.success(t(isApproved ? 'verifications.approved' : 'verifications.rejected'));
      queryClient.invalidateQueries({ queryKey: ['adminVerifications'] });
      queryClient.invalidateQueries({ queryKey: ['adminVerificationStats'] });
      queryClient.invalidateQueries({ queryKey: ['adminStats'] });
      setDetailOpen(false);
      setSelectedId(null);
      setReviewNote('');
      setConfirmAction(null);
    },
  });

  const openDetail = useCallback((id: string) => {
    setSelectedId(id);
    setReviewNote('');
    setDetailOpen(true);
  }, []);

  const handleReview = useCallback(() => {
    if (!selectedId || !confirmAction) return;
    reviewMutation.mutate({ id: selectedId, action: confirmAction, note: reviewNote });
  }, [selectedId, confirmAction, reviewNote, reviewMutation]);

  const handleDetailOpenChange = useCallback((open: boolean) => {
    setDetailOpen(open);
    if (!open) setSelectedId(null);
  }, []);

  const handleConfirmOpenChange = useCallback((open: boolean) => {
    if (!open) setConfirmAction(null);
  }, []);

  const items = listData?.items || [];
  const totalPages = listData?.totalPages || 0;
  const total = listData?.total || 0;

  return (
    <div>
      <PageHeader
        title={t('verifications.title')}
        description={t('verifications.description')}
        icon={ShieldCheck}
        color="blue"
      />

      {/* Stats Cards */}
      {stats && <VerificationStatsCards stats={stats} />}

      {/* Filter */}
      <div className="flex items-center gap-3 mb-4">
        <Select
          value={statusFilter}
          onValueChange={(v) => {
            setStatusFilter(v as StatusFilter);
            setPage(1);
          }}
        >
          <SelectTrigger className="w-[180px]">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">{t('verifications.filterAll')}</SelectItem>
            <SelectItem value="PENDING">{t('verifications.filterPending')}</SelectItem>
            <SelectItem value="APPROVED">{t('verifications.filterApproved')}</SelectItem>
            <SelectItem value="REJECTED">{t('verifications.filterRejected')}</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* List */}
      {isLoading ? (
        <div className="space-y-3">
          <CardSkeleton />
          <CardSkeleton />
          <CardSkeleton />
        </div>
      ) : items.length === 0 ? (
        <EmptyState
          icon={<ShieldCheck className="h-12 w-12" />}
          title={t('verifications.empty')}
          description={t('verifications.emptyDesc')}
        />
      ) : (
        <div className="space-y-2">
          {items.map((item) => {
            const badge = STATUS_BADGE[item.status] || STATUS_BADGE.PENDING;
            const StatusIcon = badge.icon;
            const userName = item.user?.profile?.nickname || item.user?.email || '—';
            const schoolName = item.case?.school?.nameZh || item.case?.school?.name || '—';

            return (
              <Card
                key={item.id}
                className="cursor-pointer hover:bg-muted/50 transition-colors"
                onClick={() => openDetail(item.id)}
              >
                <CardContent className="py-4 flex items-center gap-4">
                  <Avatar className="h-9 w-9 shrink-0">
                    <AvatarImage src={item.user?.profile?.avatarUrl} />
                    <AvatarFallback className="text-xs">
                      {userName[0]?.toUpperCase()}
                    </AvatarFallback>
                  </Avatar>

                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="font-medium text-sm truncate">{userName}</span>
                      <Badge variant={badge.variant} className="gap-1 shrink-0">
                        <StatusIcon className="h-3 w-3" />
                        {item.status}
                      </Badge>
                    </div>
                    <div className="flex items-center gap-3 text-xs text-muted-foreground mt-0.5">
                      <span className="flex items-center gap-1">
                        <FileText className="h-3 w-3" />
                        {t(`verifications.proofTypes.${item.proofType}` as Parameters<typeof t>[0])}
                      </span>
                      <span className="flex items-center gap-1">
                        <GraduationCap className="h-3 w-3" />
                        {schoolName}
                      </span>
                      <span>
                        {format.dateTime(new Date(item.createdAt), {
                          month: 'short',
                          day: 'numeric',
                        })}
                      </span>
                    </div>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="mt-4">
          <PaginationControls
            page={page}
            totalPages={totalPages}
            total={total}
            pageSize={PAGE_SIZE}
            onPageChange={setPage}
          />
        </div>
      )}

      {/* Detail Dialog */}
      <VerificationDetailDialog
        open={detailOpen}
        onOpenChange={handleDetailOpenChange}
        detail={detail}
        detailLoading={detailLoading}
        reviewNote={reviewNote}
        onReviewNoteChange={setReviewNote}
        onApprove={() => setConfirmAction('APPROVE')}
        onReject={() => setConfirmAction('REJECT')}
        isReviewPending={reviewMutation.isPending}
      />

      {/* Confirm Dialog */}
      <VerificationConfirmDialog
        confirmAction={confirmAction}
        onOpenChange={handleConfirmOpenChange}
        onConfirm={handleReview}
        isReviewPending={reviewMutation.isPending}
      />
    </div>
  );
}
