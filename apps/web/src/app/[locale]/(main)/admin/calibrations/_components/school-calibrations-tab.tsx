'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  ArrowUpDown,
  Loader2,
  Pencil,
  Plus,
  SlidersHorizontal,
  Trash2,
  Upload,
} from 'lucide-react';
import { useLocale, useTranslations } from 'next-intl';
import { useMemo, useState } from 'react';
import { toast } from 'sonner';

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
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Skeleton } from '@/components/ui/skeleton';
import { Textarea } from '@/components/ui/textarea';
import { apiClient } from '@/lib/api';
import { getSchoolName } from '@/lib/utils';

import { CalibrationFormDialog } from './calibration-form-dialog';

interface SchoolCalibration {
  id: string;
  schoolId: string;
  multiplier: string;
  reason: string | null;
  createdAt: string;
  updatedAt: string;
  school: {
    id: string;
    name: string;
    nameZh: string | null;
    usNewsRank: number | null;
  };
}

type FilterType = 'all' | 'boosted' | 'reduced';
type SortType = 'school' | 'adjustment' | 'updatedAt';

function multiplierToPercent(m: number): number {
  return Math.round((m - 1) * 100);
}

export function SchoolCalibrationsTab() {
  const t = useTranslations('admin.calibrations');
  const locale = useLocale();
  const queryClient = useQueryClient();

  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingCal, setEditingCal] = useState<SchoolCalibration | null>(null);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [filter, setFilter] = useState<FilterType>('all');
  const [sortBy, setSortBy] = useState<SortType>('updatedAt');
  const [bulkOpen, setBulkOpen] = useState(false);
  const [bulkJson, setBulkJson] = useState('');

  const { data: calibrations = [], isLoading } = useQuery<SchoolCalibration[]>({
    queryKey: ['adminCalibrations'],
    queryFn: () => apiClient.get('/admin/calibrations'),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => apiClient.delete(`/admin/calibrations/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['adminCalibrations'] });
      queryClient.invalidateQueries({ queryKey: ['adminCalibrationStats'] });
      queryClient.invalidateQueries({ queryKey: ['adminCalibrationSuggestions'] });
      setDeleteId(null);
      toast.success(t('deleted'));
    },
  });

  const bulkMutation = useMutation({
    mutationFn: async (items: Array<{ schoolId: string; multiplier: number; reason?: string }>) => {
      const result = await apiClient.post('/admin/calibrations/bulk', { items });
      return result as { created: number; updated: number; failed: number };
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['adminCalibrations'] });
      queryClient.invalidateQueries({ queryKey: ['adminCalibrationStats'] });
      queryClient.invalidateQueries({ queryKey: ['adminCalibrationSuggestions'] });
      setBulkOpen(false);
      setBulkJson('');
      const msg = t('bulk.importSuccess', {
        created: data.created,
        updated: data.updated,
      });
      toast.success(
        data.failed > 0 ? `${msg} · ${t('bulk.importFailed', { failed: data.failed })}` : msg
      );
    },
  });

  function handleEdit(cal: SchoolCalibration) {
    setEditingCal(cal);
    setDialogOpen(true);
  }

  function handleBulkImport() {
    try {
      const parsed = JSON.parse(bulkJson);
      const items = Array.isArray(parsed) ? parsed : [parsed];
      bulkMutation.mutate(items);
    } catch {
      toast.error('Invalid JSON');
    }
  }

  // Filter and sort
  const filtered = useMemo(() => {
    let result = [...calibrations];

    if (filter === 'boosted') {
      result = result.filter((c) => Number(c.multiplier) > 1);
    } else if (filter === 'reduced') {
      result = result.filter((c) => Number(c.multiplier) < 1);
    }

    result.sort((a, b) => {
      switch (sortBy) {
        case 'school':
          return getSchoolName(a.school, locale).localeCompare(getSchoolName(b.school, locale));
        case 'adjustment':
          return Math.abs(Number(b.multiplier) - 1) - Math.abs(Number(a.multiplier) - 1);
        case 'updatedAt':
        default:
          return new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime();
      }
    });

    return result;
  }, [calibrations, filter, sortBy, locale]);

  if (isLoading) {
    return (
      <div className="space-y-3">
        {Array.from({ length: 5 }).map((_, i) => (
          <Skeleton key={i} className="h-14 rounded" />
        ))}
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Toolbar */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          {/* Filter */}
          {(['all', 'boosted', 'reduced'] as const).map((f) => (
            <Button
              key={f}
              variant={filter === f ? 'default' : 'outline'}
              size="sm"
              onClick={() => setFilter(f)}
            >
              {t(`filter.${f}`)}
            </Button>
          ))}
        </div>
        <div className="flex items-center gap-2">
          {/* Sort */}
          <Button
            variant="ghost"
            size="sm"
            onClick={() => {
              const order: SortType[] = ['updatedAt', 'school', 'adjustment'];
              const idx = order.indexOf(sortBy);
              setSortBy(order[(idx + 1) % order.length]);
            }}
          >
            <ArrowUpDown className="h-3.5 w-3.5 mr-1" />
            {t(`sort.${sortBy}`)}
          </Button>
          <Button variant="outline" size="sm" onClick={() => setBulkOpen(true)}>
            <Upload className="h-3.5 w-3.5 mr-1" />
            {t('bulk.import')}
          </Button>
          <Button
            size="sm"
            onClick={() => {
              setEditingCal(null);
              setDialogOpen(true);
            }}
          >
            <Plus className="h-3.5 w-3.5 mr-1" />
            {t('create')}
          </Button>
        </div>
      </div>

      {/* Table */}
      {filtered.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 text-center">
          <div className="rounded-full bg-muted p-4 mb-4">
            <SlidersHorizontal className="h-8 w-8 text-muted-foreground" />
          </div>
          <h3 className="font-semibold text-lg mb-1">
            {calibrations.length === 0 ? t('emptyState.title') : t('noCalibrations')}
          </h3>
          <p className="text-sm text-muted-foreground max-w-sm">
            {calibrations.length === 0 ? t('emptyState.description') : ''}
          </p>
        </div>
      ) : (
        <div className="rounded-lg border bg-card">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b bg-muted/50">
                  <th className="px-4 py-3 text-left font-medium">{t('school')}</th>
                  <th className="px-4 py-3 text-left font-medium">{t('adjustment')}</th>
                  <th className="px-4 py-3 text-left font-medium">{t('reason')}</th>
                  <th className="px-4 py-3 text-right font-medium">{t('actions')}</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((cal) => {
                  const mult = Number(cal.multiplier);
                  const pct = multiplierToPercent(mult);
                  const pctLabel = pct >= 0 ? `+${pct}%` : `${pct}%`;
                  return (
                    <tr key={cal.id} className="border-b last:border-0">
                      <td className="px-4 py-3">
                        <div>
                          <p className="font-medium">{getSchoolName(cal.school, locale)}</p>
                          {cal.school.usNewsRank && (
                            <span className="text-xs text-muted-foreground">
                              US News #{cal.school.usNewsRank}
                            </span>
                          )}
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <Badge
                          variant="outline"
                          className={
                            pct > 0
                              ? 'border-green-500/50 text-green-600 dark:text-green-400'
                              : pct < 0
                                ? 'border-red-500/50 text-red-600 dark:text-red-400'
                                : ''
                          }
                        >
                          {pctLabel}
                          {pct > 0 ? ' ↑' : pct < 0 ? ' ↓' : ''}
                        </Badge>
                      </td>
                      <td className="px-4 py-3 text-muted-foreground max-w-xs truncate">
                        {cal.reason || '—'}
                      </td>
                      <td className="px-4 py-3 text-right">
                        <div className="flex justify-end gap-1">
                          <Button variant="ghost" size="sm" onClick={() => handleEdit(cal)}>
                            <Pencil className="h-3.5 w-3.5" />
                          </Button>
                          <Button variant="ghost" size="sm" onClick={() => setDeleteId(cal.id)}>
                            <Trash2 className="h-3.5 w-3.5 text-destructive" />
                          </Button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Create/Edit Dialog */}
      <CalibrationFormDialog
        open={dialogOpen}
        onOpenChange={(open) => {
          setDialogOpen(open);
          if (!open) setEditingCal(null);
        }}
        editingCalibration={editingCal}
      />

      {/* Delete Confirmation */}
      <AlertDialog open={!!deleteId} onOpenChange={() => setDeleteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t('confirmDelete')}</AlertDialogTitle>
            <AlertDialogDescription>{t('confirmDeleteDesc')}</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t('cancel')}</AlertDialogCancel>
            <AlertDialogAction onClick={() => deleteId && deleteMutation.mutate(deleteId)}>
              {t('delete')}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Bulk Import Dialog */}
      <Dialog open={bulkOpen} onOpenChange={setBulkOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t('bulk.importTitle')}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <p className="text-sm text-muted-foreground">{t('bulk.importDesc')}</p>
            <div className="space-y-2">
              <Label>JSON</Label>
              <Textarea
                value={bulkJson}
                onChange={(e) => setBulkJson(e.target.value)}
                rows={8}
                placeholder={`[
  { "schoolId": "...", "multiplier": 1.15, "reason": "..." },
  { "schoolId": "...", "multiplier": 0.9 }
]`}
                className="font-mono text-xs"
              />
            </div>
            <Button
              onClick={handleBulkImport}
              disabled={bulkMutation.isPending || !bulkJson.trim()}
              className="w-full"
            >
              {bulkMutation.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              {t('bulk.import')}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
