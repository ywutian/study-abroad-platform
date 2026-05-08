'use client';

import { useState, useCallback } from 'react';
import { useTranslations, useFormatter } from 'next-intl';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { ScrollArea } from '@/components/ui/scroll-area';
import { CardSkeleton } from '@/components/ui/loading-state';
import { EmptyState } from '@/components/ui/empty-state';
import { PaginationControls } from '../../_components/pagination-controls';
import { QualityScoreBadge } from './quality-score-badge';
import { RejectReasonDialog } from './reject-reason-dialog';
import { CaseDetailDialog } from './pending-cases/CaseDetailDialog';
import { apiClient } from '@/lib/api';
import { adminRoutes } from '@study-abroad/shared';
import { toast } from 'sonner';
import { Check, X, Eye, Loader2, FileCheck, GraduationCap } from 'lucide-react';
import { cn } from '@/lib/utils';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface TestScore {
  type: string;
  score?: number;
  range?: string;
}

interface ActivitySummary {
  category?: string;
  description?: string;
  role?: string;
}

interface AwardSummary {
  name?: string;
  level?: string;
}

interface PendingCase {
  id: string;
  school?: { name: string; nameZh?: string; usNewsRank?: number };
  admissionYear?: number;
  admissionSeason?: string;
  admissionResult?: string;
  gpa?: { range?: string; scale?: number };
  sat?: { range?: string };
  qualityScore?: number;
  source?: string;
  reviewStatus: string;
  createdAt: string;
  // Enrichment fields
  testScores?: TestScore[];
  activities?: ActivitySummary[];
  activitiesCount?: number;
  activitiesSummary?: string;
  awards?: AwardSummary[];
  awardsCount?: number;
  awardsSummary?: string;
  apCount?: number;
  apSubjects?: string[];
  ibScore?: number;
  highSchoolType?: string;
  curriculumType?: string;
  demographicTags?: string[];
  financialAid?: string;
  enrollmentStatus?: string;
  narrative?: string;
}

interface PaginatedCases {
  items: PendingCase[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
}

const PAGE_SIZE = 20;

const RESULT_COLORS: Record<string, string> = {
  ADMITTED: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400',
  REJECTED: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400',
  WAITLISTED: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400',
  DEFERRED: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400',
};

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function PendingCasesTab() {
  const t = useTranslations('admin.dataReview');
  const ta = useTranslations('admin.dataReview.actions');
  const te = useTranslations('admin.dataReview.enums');
  const format = useFormatter();
  const queryClient = useQueryClient();

  const [page, setPage] = useState(1);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [detailCase, setDetailCase] = useState<PendingCase | null>(null);
  const [rejectId, setRejectId] = useState<string | null>(null);

  // Query
  const { data, isLoading } = useQuery<PaginatedCases>({
    queryKey: ['pendingCases', page],
    queryFn: () =>
      apiClient.get<PaginatedCases>(adminRoutes.reviewPendingCases(), {
        params: { page, limit: PAGE_SIZE },
      }),
  });

  // Mutations
  const approveMutation = useMutation({
    mutationFn: (id: string) => apiClient.post(adminRoutes.reviewCaseApprove(id), {}),
    onSuccess: () => {
      toast.success(t('toast.approved'));
      invalidateAll();
      setDetailCase(null);
    },
    onError: (err: { response?: { status?: number } }) => {
      if (err?.response?.status === 409) toast.error(t('toast.conflict'));
    },
  });

  const rejectMutation = useMutation({
    mutationFn: ({ id, reason }: { id: string; reason: string }) =>
      apiClient.post(adminRoutes.reviewCaseReject(id), { reason }),
    onSuccess: () => {
      toast.success(t('toast.rejected'));
      invalidateAll();
      setDetailCase(null);
      setRejectId(null);
    },
    onError: (err: { response?: { status?: number } }) => {
      if (err?.response?.status === 409) toast.error(t('toast.conflict'));
    },
  });

  const batchMutation = useMutation({
    mutationFn: ({
      ids,
      action,
      reason,
    }: {
      ids: string[];
      action: 'approve' | 'reject';
      reason?: string;
    }) => apiClient.post(adminRoutes.reviewBatch(), { ids, action, reason }),
    onSuccess: (_data, vars) => {
      toast.success(t('toast.batchSuccess', { count: vars.ids.length }));
      invalidateAll();
      setSelected(new Set());
    },
  });

  const invalidateAll = () => {
    queryClient.invalidateQueries({ queryKey: ['pendingCases'] });
    queryClient.invalidateQueries({ queryKey: ['reviewStats'] });
    queryClient.invalidateQueries({ queryKey: ['adminStats'] });
  };

  const items = data?.items || [];
  const allSelected = items.length > 0 && items.every((c) => selected.has(c.id));
  const isPending = approveMutation.isPending || rejectMutation.isPending;

  const toggleSelect = (id: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const toggleAll = () => {
    if (allSelected) setSelected(new Set());
    else setSelected(new Set(items.map((c) => c.id)));
  };

  const openDetail = useCallback((c: PendingCase) => setDetailCase(c), []);

  const getSchoolName = (c: PendingCase) => c.school?.nameZh || c.school?.name || '—';

  return (
    <div>
      {/* Batch action bar */}
      {selected.size > 0 && (
        <div className="flex items-center gap-3 mb-3 px-3 py-2 bg-muted rounded-lg">
          <span className="text-sm font-medium">
            {t('table.selected', { count: selected.size })}
          </span>
          <Button
            size="sm"
            onClick={() => batchMutation.mutate({ ids: [...selected], action: 'approve' })}
            disabled={batchMutation.isPending}
          >
            {batchMutation.isPending ? (
              <Loader2 className="h-3.5 w-3.5 mr-1 animate-spin" />
            ) : (
              <Check className="h-3.5 w-3.5 mr-1" />
            )}
            {ta('batchApprove')}
          </Button>
          <Button
            size="sm"
            variant="destructive"
            onClick={() => setRejectId('__batch__')}
            disabled={batchMutation.isPending}
          >
            <X className="h-3.5 w-3.5 mr-1" />
            {ta('batchReject')}
          </Button>
        </div>
      )}

      {/* Table */}
      {isLoading ? (
        <div className="space-y-3">
          <CardSkeleton />
          <CardSkeleton />
          <CardSkeleton />
        </div>
      ) : items.length === 0 ? (
        <EmptyState
          icon={<FileCheck className="h-12 w-12" />}
          title={t('table.noData')}
          description={t('table.noDataDesc')}
        />
      ) : (
        <ScrollArea className="rounded-md border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-10">
                  <Checkbox
                    checked={allSelected}
                    onCheckedChange={toggleAll}
                    aria-label={t('table.selectAll')}
                  />
                </TableHead>
                <TableHead>{t('table.school')}</TableHead>
                <TableHead>{t('table.year')}</TableHead>
                <TableHead>{t('table.round')}</TableHead>
                <TableHead>{t('table.result')}</TableHead>
                <TableHead>{t('table.gpa')}</TableHead>
                <TableHead className="text-center">{t('table.qualityScore')}</TableHead>
                <TableHead>{t('table.source')}</TableHead>
                <TableHead>{t('table.submittedAt')}</TableHead>
                <TableHead className="text-right">{t('table.actions')}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {items.map((c) => (
                <TableRow key={c.id} className={cn(selected.has(c.id) && 'bg-muted/50')}>
                  <TableCell>
                    <Checkbox
                      checked={selected.has(c.id)}
                      onCheckedChange={() => toggleSelect(c.id)}
                      aria-label={`Select ${c.id}`}
                    />
                  </TableCell>
                  <TableCell className="text-sm font-medium max-w-[180px] truncate">
                    <span className="flex items-center gap-1.5">
                      <GraduationCap className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                      {getSchoolName(c)}
                    </span>
                  </TableCell>
                  <TableCell className="text-sm tabular-nums">{c.admissionYear || '—'}</TableCell>
                  <TableCell className="text-xs">{c.admissionSeason || '—'}</TableCell>
                  <TableCell>
                    {c.admissionResult ? (
                      <Badge className={cn('text-xs', RESULT_COLORS[c.admissionResult] || '')}>
                        {te.has(`result.${c.admissionResult}`)
                          ? te(`result.${c.admissionResult}` as never)
                          : c.admissionResult}
                      </Badge>
                    ) : (
                      '—'
                    )}
                  </TableCell>
                  <TableCell className="text-xs font-mono">{c.gpa?.range || '—'}</TableCell>
                  <TableCell className="text-center">
                    <QualityScoreBadge score={c.qualityScore} />
                  </TableCell>
                  <TableCell className="text-xs text-muted-foreground max-w-[100px] truncate">
                    {c.source || '—'}
                  </TableCell>
                  <TableCell className="text-xs text-muted-foreground whitespace-nowrap">
                    {format.dateTime(new Date(c.createdAt), { month: 'short', day: 'numeric' })}
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex items-center justify-end gap-1">
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-10 w-10 md:h-8 md:w-8"
                        onClick={() => approveMutation.mutate(c.id)}
                        disabled={isPending}
                        aria-label={ta('approve')}
                      >
                        <Check className="h-3.5 w-3.5 text-emerald-600 dark:text-emerald-400" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-10 w-10 md:h-8 md:w-8"
                        onClick={() => setRejectId(c.id)}
                        disabled={isPending}
                        aria-label={ta('reject')}
                      >
                        <X className="h-3.5 w-3.5 text-red-600 dark:text-red-400" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-10 w-10 md:h-8 md:w-8"
                        onClick={() => openDetail(c)}
                        aria-label={ta('viewDetail')}
                      >
                        <Eye className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </ScrollArea>
      )}

      {/* Pagination */}
      {data && data.totalPages > 1 && (
        <div className="mt-4">
          <PaginationControls
            page={page}
            totalPages={data.totalPages}
            total={data.total}
            pageSize={PAGE_SIZE}
            onPageChange={setPage}
          />
        </div>
      )}

      {/* Case Detail Dialog */}
      <CaseDetailDialog
        case_={detailCase}
        open={!!detailCase}
        onOpenChange={(open) => {
          if (!open) setDetailCase(null);
        }}
        onApprove={(id) => approveMutation.mutate(id)}
        onReject={(id) => setRejectId(id)}
        isPending={isPending}
        locale=""
      />

      {/* Reject Reason Dialog */}
      <RejectReasonDialog
        open={!!rejectId}
        onOpenChange={(open) => {
          if (!open) setRejectId(null);
        }}
        onConfirm={(reason) => {
          if (rejectId === '__batch__') {
            batchMutation.mutate({ ids: [...selected], action: 'reject', reason });
            setRejectId(null);
          } else if (rejectId) {
            rejectMutation.mutate({ id: rejectId, reason });
          }
        }}
        isPending={rejectMutation.isPending || batchMutation.isPending}
      />
    </div>
  );
}
