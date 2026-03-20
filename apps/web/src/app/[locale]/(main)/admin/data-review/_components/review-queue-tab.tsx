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
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { ScrollArea } from '@/components/ui/scroll-area';
import { CardSkeleton } from '@/components/ui/loading-state';
import { EmptyState } from '@/components/ui/empty-state';
import { PaginationControls } from '../../_components/pagination-controls';
import { QualityScoreBadge } from './quality-score-badge';
import { SourceBadge } from './source-badge';
import { CompletenessBar } from './completeness-bar';
import { RejectReasonDialog } from './reject-reason-dialog';
import { apiClient } from '@/lib/api';
import { toast } from 'sonner';
import { Check, X, Eye, Pencil, Loader2, ClipboardList, RotateCcw } from 'lucide-react';
import { AdminFeatureGuide } from '../../_components/admin-feature-guide';
import { ContextualHelp } from '@/components/ui/contextual-help';
import { cn } from '@/lib/utils';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface StagingItem {
  id: string;
  dataType: string;
  source: string;
  rawData: Record<string, unknown>;
  qualityScore: number | null;
  completeness?: number | null;
  status: string;
  createdAt: string;
  batchId?: string;
  reviewedBy?: string;
  reviewNote?: string;
}

interface PaginatedStaging {
  items: StagingItem[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
}

const PAGE_SIZE = 20;
const DATA_TYPES = ['CASE', 'SCHOOL', 'ESSAY_PROMPT'] as const;

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function ReviewQueueTab() {
  const t = useTranslations('admin.dataReview');
  const ta = useTranslations('admin.dataReview.actions');
  const format = useFormatter();
  const queryClient = useQueryClient();

  // Filters
  const [typeFilter, setTypeFilter] = useState<string>('all');
  const [sourceFilter, setSourceFilter] = useState('');
  const [page, setPage] = useState(1);

  // Selection
  const [selected, setSelected] = useState<Set<string>>(new Set());

  // Detail dialog
  const [detailItem, setDetailItem] = useState<StagingItem | null>(null);
  const [editMode, setEditMode] = useState(false);
  const [editData, setEditData] = useState<Record<string, unknown>>({});
  const [note, setNote] = useState('');

  // Reject dialog
  const [rejectId, setRejectId] = useState<string | null>(null);

  // Query
  const { data, isLoading } = useQuery<PaginatedStaging>({
    queryKey: ['reviewQueue', typeFilter, sourceFilter, page],
    queryFn: () =>
      apiClient.get<PaginatedStaging>('/admin/review/queue', {
        params: {
          page,
          limit: PAGE_SIZE,
          ...(typeFilter !== 'all' && { type: typeFilter }),
          ...(sourceFilter && { source: sourceFilter }),
        },
      }),
  });

  // Mutations
  const approveMutation = useMutation({
    mutationFn: ({ id, noteText }: { id: string; noteText?: string }) =>
      apiClient.post(`/admin/review/${id}/approve`, { note: noteText }),
    onSuccess: () => {
      toast.success(t('toast.approved'));
      invalidateAll();
      closeDetail();
    },
    onError: (err: { response?: { status?: number } }) => {
      if (err?.response?.status === 409) toast.error(t('toast.conflict'));
    },
  });

  const rejectMutation = useMutation({
    mutationFn: ({ id, reason }: { id: string; reason: string }) =>
      apiClient.post(`/admin/review/${id}/reject`, { reason }),
    onSuccess: () => {
      toast.success(t('toast.rejected'));
      invalidateAll();
      closeDetail();
      setRejectId(null);
    },
    onError: (err: { response?: { status?: number } }) => {
      if (err?.response?.status === 409) toast.error(t('toast.conflict'));
    },
  });

  const editApproveMutation = useMutation({
    mutationFn: ({
      id,
      correctedData,
      noteText,
    }: {
      id: string;
      correctedData: Record<string, unknown>;
      noteText?: string;
    }) => apiClient.post(`/admin/review/${id}/edit-and-approve`, { correctedData, note: noteText }),
    onSuccess: () => {
      toast.success(t('toast.editApproved'));
      invalidateAll();
      closeDetail();
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
    }) => apiClient.post('/admin/review/batch', { ids, action, reason }),
    onSuccess: (_data, vars) => {
      toast.success(t('toast.batchSuccess', { count: vars.ids.length }));
      invalidateAll();
      setSelected(new Set());
    },
  });

  const invalidateAll = () => {
    queryClient.invalidateQueries({ queryKey: ['reviewQueue'] });
    queryClient.invalidateQueries({ queryKey: ['reviewStats'] });
    queryClient.invalidateQueries({ queryKey: ['adminStats'] });
  };

  const closeDetail = () => {
    setDetailItem(null);
    setEditMode(false);
    setEditData({});
    setNote('');
  };

  const openDetail = useCallback((item: StagingItem) => {
    setDetailItem(item);
    setEditData({ ...item.rawData });
    setNote('');
    setEditMode(false);
  }, []);

  // Selection helpers
  const items = data?.items || [];
  const allSelected = items.length > 0 && items.every((item) => selected.has(item.id));

  const toggleSelect = (id: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const toggleAll = () => {
    if (allSelected) {
      setSelected(new Set());
    } else {
      setSelected(new Set(items.map((i) => i.id)));
    }
  };

  // Helpers
  const getDisplayTitle = (item: StagingItem) => {
    const raw = item.rawData;
    if (item.dataType === 'CASE') return (raw.schoolName as string) || '—';
    if (item.dataType === 'ESSAY_PROMPT')
      return (raw.title as string) || (raw.prompt as string)?.slice(0, 60) || '—';
    if (item.dataType === 'SCHOOL') return (raw.name as string) || '—';
    return '—';
  };

  const isPending =
    approveMutation.isPending || rejectMutation.isPending || editApproveMutation.isPending;

  return (
    <div className="space-y-4">
      <AdminFeatureGuide
        title={t('guide.title') || 'Review Workflow'}
        steps={[
          t('guide.step1') || 'Check the review queue for new items',
          t('guide.step2') || 'Review the quality score and completeness',
          t('guide.step3') || 'Edit data if needed using inline editing',
          t('guide.step4') || 'Approve or reject with a reason',
          t('guide.step5') || 'Approved items become available to users and the AI system',
        ]}
      />

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-3 mb-4">
        <Select
          value={typeFilter}
          onValueChange={(v) => {
            setTypeFilter(v);
            setPage(1);
          }}
        >
          <SelectTrigger className="w-[180px]">
            <SelectValue placeholder={t('filter.dataType')} />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">{t('filter.allTypes')}</SelectItem>
            {DATA_TYPES.map((dt) => (
              <SelectItem key={dt} value={dt}>
                {dt}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Input
          value={sourceFilter}
          onChange={(e) => {
            setSourceFilter(e.target.value);
            setPage(1);
          }}
          placeholder={t('filter.sourcePlaceholder')}
          className="w-[200px]"
        />

        {(typeFilter !== 'all' || sourceFilter) && (
          <Button
            variant="ghost"
            size="sm"
            onClick={() => {
              setTypeFilter('all');
              setSourceFilter('');
              setPage(1);
            }}
          >
            <RotateCcw className="h-3.5 w-3.5 mr-1" />
            {t('filter.reset')}
          </Button>
        )}
      </div>

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
          icon={<ClipboardList className="h-12 w-12" />}
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
                <TableHead>{t('table.type')}</TableHead>
                <TableHead>{t('table.source')}</TableHead>
                <TableHead>{t('table.title')}</TableHead>
                <TableHead className="text-center">
                  <div className="inline-flex items-center gap-1">
                    {t('table.qualityScore')}
                    <ContextualHelp
                      variant="info"
                      title={t('help.qualityTitle') || 'Quality Score'}
                      description={
                        t('help.qualityDesc') ||
                        'Measures data correctness (0-100) based on required fields, score validity, and internal consistency.'
                      }
                      size="sm"
                    />
                  </div>
                </TableHead>
                <TableHead className="w-[120px]">
                  <div className="inline-flex items-center gap-1">
                    {t('table.completeness') || 'Completeness'}
                    <ContextualHelp
                      variant="info"
                      title={t('help.completenessTitle') || 'Completeness'}
                      description={
                        t('help.completenessDesc') ||
                        'Shows how many optional fields are filled (0-100%). Partial data is still valuable for predictions.'
                      }
                      size="sm"
                    />
                  </div>
                </TableHead>
                <TableHead>{t('table.submittedAt')}</TableHead>
                <TableHead className="text-right">{t('table.actions')}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {items.map((item) => (
                <TableRow key={item.id} className={cn(selected.has(item.id) && 'bg-muted/50')}>
                  <TableCell>
                    <Checkbox
                      checked={selected.has(item.id)}
                      onCheckedChange={() => toggleSelect(item.id)}
                      aria-label={`Select ${item.id}`}
                    />
                  </TableCell>
                  <TableCell>
                    <Badge variant="outline" className="font-mono text-xs">
                      {item.dataType}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <SourceBadge source={item.source} />
                  </TableCell>
                  <TableCell className="max-w-[200px] truncate text-sm font-medium">
                    {getDisplayTitle(item)}
                  </TableCell>
                  <TableCell className="text-center">
                    <QualityScoreBadge score={item.qualityScore} />
                  </TableCell>
                  <TableCell>
                    {item.completeness != null ? (
                      <CompletenessBar value={item.completeness} />
                    ) : (
                      <span className="text-xs text-muted-foreground">—</span>
                    )}
                  </TableCell>
                  <TableCell className="text-xs text-muted-foreground whitespace-nowrap">
                    {format.dateTime(new Date(item.createdAt), {
                      month: 'short',
                      day: 'numeric',
                      hour: '2-digit',
                      minute: '2-digit',
                    })}
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex items-center justify-end gap-1">
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7"
                        onClick={() => approveMutation.mutate({ id: item.id })}
                        disabled={isPending}
                        aria-label={ta('approve')}
                      >
                        <Check className="h-3.5 w-3.5 text-emerald-600 dark:text-emerald-400" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7"
                        onClick={() => setRejectId(item.id)}
                        disabled={isPending}
                        aria-label={ta('reject')}
                      >
                        <X className="h-3.5 w-3.5 text-red-600 dark:text-red-400" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7"
                        onClick={() => openDetail(item)}
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

      {/* Staging Detail Dialog */}
      <Dialog
        open={!!detailItem}
        onOpenChange={(open) => {
          if (!open) closeDetail();
        }}
      >
        <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              {t('detail.stagingDetail')}
              {detailItem && (
                <Badge variant="outline" className="font-mono text-xs">
                  {detailItem.dataType}
                </Badge>
              )}
            </DialogTitle>
          </DialogHeader>

          {detailItem && (
            <div className="space-y-4">
              {/* Quality score */}
              <div className="flex items-center gap-2">
                <span className="text-sm text-muted-foreground">{t('table.qualityScore')}:</span>
                <QualityScoreBadge score={detailItem.qualityScore} />
              </div>

              {/* Data fields */}
              <div className="rounded-lg border p-4 space-y-3">
                <div className="flex items-center justify-between">
                  <h4 className="text-sm font-medium">
                    {editMode ? t('detail.correctedData') : t('detail.rawData')}
                  </h4>
                  {!editMode && (
                    <Button variant="outline" size="sm" onClick={() => setEditMode(true)}>
                      <Pencil className="h-3.5 w-3.5 mr-1" />
                      {t('detail.editMode')}
                    </Button>
                  )}
                </div>

                {editMode ? (
                  <div className="grid gap-3">
                    {Object.entries(editData).map(([key, value]) => (
                      <div key={key} className="grid gap-1">
                        <Label className="text-xs text-muted-foreground">{key}</Label>
                        {typeof value === 'object' ? (
                          <Textarea
                            value={JSON.stringify(value, null, 2)}
                            onChange={(e) => {
                              try {
                                setEditData((prev) => ({
                                  ...prev,
                                  [key]: JSON.parse(e.target.value),
                                }));
                              } catch {
                                // Allow invalid JSON while typing
                              }
                            }}
                            rows={3}
                            className="font-mono text-xs"
                          />
                        ) : (
                          <Input
                            value={String(value ?? '')}
                            onChange={(e) =>
                              setEditData((prev) => ({ ...prev, [key]: e.target.value }))
                            }
                          />
                        )}
                      </div>
                    ))}
                  </div>
                ) : (
                  <pre className="text-xs bg-muted rounded-md p-3 overflow-auto max-h-[300px] whitespace-pre-wrap">
                    {JSON.stringify(detailItem.rawData, null, 2)}
                  </pre>
                )}
              </div>

              {/* Note */}
              <div className="space-y-1">
                <Label className="text-sm">{t('detail.note')}</Label>
                <Textarea
                  value={note}
                  onChange={(e) => setNote(e.target.value)}
                  placeholder={t('detail.notePlaceholder')}
                  rows={2}
                />
              </div>
            </div>
          )}

          <DialogFooter className="gap-2 sm:gap-0">
            <Button variant="outline" onClick={closeDetail} disabled={isPending}>
              {t('filter.reset')}
            </Button>
            <Button
              variant="destructive"
              onClick={() => detailItem && setRejectId(detailItem.id)}
              disabled={isPending}
            >
              <X className="h-4 w-4 mr-1" />
              {ta('reject')}
            </Button>
            {editMode ? (
              <Button
                onClick={() =>
                  detailItem &&
                  editApproveMutation.mutate({
                    id: detailItem.id,
                    correctedData: editData,
                    noteText: note || undefined,
                  })
                }
                disabled={isPending}
              >
                {editApproveMutation.isPending && <Loader2 className="h-4 w-4 mr-1 animate-spin" />}
                <Pencil className="h-4 w-4 mr-1" />
                {ta('editAndApprove')}
              </Button>
            ) : (
              <Button
                onClick={() =>
                  detailItem &&
                  approveMutation.mutate({ id: detailItem.id, noteText: note || undefined })
                }
                disabled={isPending}
              >
                {approveMutation.isPending && <Loader2 className="h-4 w-4 mr-1 animate-spin" />}
                <Check className="h-4 w-4 mr-1" />
                {ta('approve')}
              </Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>

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
