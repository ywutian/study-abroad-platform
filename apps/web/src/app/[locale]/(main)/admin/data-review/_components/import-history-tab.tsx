'use client';

import { useState } from 'react';
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
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { CardSkeleton } from '@/components/ui/loading-state';
import { EmptyState } from '@/components/ui/empty-state';
import { PaginationControls } from '../../_components/pagination-controls';
import { apiClient } from '@/lib/api';
import { adminRoutes } from '@study-abroad/shared';
import { toast } from 'sonner';
import { History, Loader2, Undo2 } from 'lucide-react';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface ImportBatch {
  id: string;
  source: string;
  itemCount: number;
  createdAt: string;
  dataType?: string;
}

interface PaginatedBatches {
  items: ImportBatch[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
}

const PAGE_SIZE = 20;

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function ImportHistoryTab() {
  const t = useTranslations('admin.dataReview.history');
  const format = useFormatter();
  const queryClient = useQueryClient();

  const [page, setPage] = useState(1);
  const [rollbackId, setRollbackId] = useState<string | null>(null);

  const { data, isLoading } = useQuery<PaginatedBatches>({
    queryKey: ['importBatches', page],
    queryFn: () =>
      apiClient.get<PaginatedBatches>(adminRoutes.reviewBatches(), {
        params: { page, limit: PAGE_SIZE },
      }),
  });

  const rollbackMutation = useMutation({
    mutationFn: (batchId: string) => apiClient.post(adminRoutes.reviewBatchRollback(batchId), {}),
    onSuccess: () => {
      toast.success(t('rollbackSuccess'));
      setRollbackId(null);
      queryClient.invalidateQueries({ queryKey: ['importBatches'] });
      queryClient.invalidateQueries({ queryKey: ['reviewQueue'] });
      queryClient.invalidateQueries({ queryKey: ['reviewStats'] });
    },
  });

  const items = data?.items || [];

  return (
    <div>
      {isLoading ? (
        <div className="space-y-3">
          <CardSkeleton />
          <CardSkeleton />
          <CardSkeleton />
        </div>
      ) : items.length === 0 ? (
        <EmptyState
          icon={<History className="h-12 w-12" />}
          title={t('noHistory')}
          description={t('noHistoryDesc')}
        />
      ) : (
        <ScrollArea className="rounded-md border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{t('batchId')}</TableHead>
                <TableHead>{t('count')}</TableHead>
                <TableHead>
                  <span className="sr-only">Type</span>
                </TableHead>
                <TableHead>{t('importedAt')}</TableHead>
                <TableHead className="text-right">
                  <span className="sr-only">Actions</span>
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {items.map((batch) => (
                <TableRow key={batch.id}>
                  <TableCell className="font-mono text-xs max-w-[200px] truncate">
                    {batch.id}
                  </TableCell>
                  <TableCell>
                    <Badge variant="secondary" className="font-mono">
                      {batch.itemCount}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-xs text-muted-foreground">
                    {batch.source || batch.dataType || '—'}
                  </TableCell>
                  <TableCell className="text-xs text-muted-foreground whitespace-nowrap">
                    {format.dateTime(new Date(batch.createdAt), {
                      year: 'numeric',
                      month: 'short',
                      day: 'numeric',
                      hour: '2-digit',
                      minute: '2-digit',
                    })}
                  </TableCell>
                  <TableCell className="text-right">
                    <Button variant="destructive" size="sm" onClick={() => setRollbackId(batch.id)}>
                      <Undo2 className="h-3.5 w-3.5 mr-1" />
                      {t('rollback')}
                    </Button>
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

      {/* Rollback Confirm Dialog */}
      <AlertDialog
        open={!!rollbackId}
        onOpenChange={(open) => {
          if (!open) setRollbackId(null);
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t('rollbackConfirm')}</AlertDialogTitle>
            <AlertDialogDescription>{t('rollbackDesc')}</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={rollbackMutation.isPending}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={() => rollbackId && rollbackMutation.mutate(rollbackId)}
              disabled={rollbackMutation.isPending}
            >
              {rollbackMutation.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              {t('rollback')}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
