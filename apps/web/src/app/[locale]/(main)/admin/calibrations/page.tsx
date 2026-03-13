'use client';

import { useState } from 'react';
import { useTranslations, useLocale } from 'next-intl';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
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
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { PageHeader } from '@/components/layout';
import { apiClient } from '@/lib/api';
import { toast } from 'sonner';
import { SlidersHorizontal, Plus, Pencil, Trash2, Search, Loader2 } from 'lucide-react';
import { getSchoolName } from '@/lib/utils';

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

interface SchoolOption {
  id: string;
  name: string;
  nameZh?: string;
}

export default function AdminCalibrationsPage() {
  const t = useTranslations('admin');
  const locale = useLocale();
  const queryClient = useQueryClient();

  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [deleteId, setDeleteId] = useState<string | null>(null);

  // Form state
  const [schoolId, setSchoolId] = useState('');
  const [multiplier, setMultiplier] = useState('1.0');
  const [reason, setReason] = useState('');
  const [schoolQuery, setSchoolQuery] = useState('');

  // Data
  const { data: calibrations = [], isLoading } = useQuery<SchoolCalibration[]>({
    queryKey: ['adminCalibrations'],
    queryFn: () => apiClient.get('/admin/calibrations'),
  });

  const { data: schoolOptions = [] } = useQuery<SchoolOption[]>({
    queryKey: ['schoolSearch', schoolQuery],
    queryFn: async () => {
      const r = (await apiClient.get('/schools', {
        params: { search: schoolQuery, pageSize: 10 },
      })) as { items?: SchoolOption[] };
      return r.items ?? (r as unknown as SchoolOption[]);
    },
    enabled: schoolQuery.length >= 2,
  });

  const createMutation = useMutation({
    mutationFn: (data: { schoolId: string; multiplier: number; reason?: string }) =>
      apiClient.post('/admin/calibrations', data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['adminCalibrations'] });
      resetForm();
      toast.success(t('calibrations.created'));
    },
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: { multiplier?: number; reason?: string } }) =>
      apiClient.put(`/admin/calibrations/${id}`, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['adminCalibrations'] });
      resetForm();
      toast.success(t('calibrations.updated'));
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => apiClient.delete(`/admin/calibrations/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['adminCalibrations'] });
      setDeleteId(null);
      toast.success(t('calibrations.deleted'));
    },
  });

  function resetForm() {
    setDialogOpen(false);
    setEditingId(null);
    setSchoolId('');
    setMultiplier('1.0');
    setReason('');
    setSchoolQuery('');
  }

  function handleEdit(cal: SchoolCalibration) {
    setEditingId(cal.id);
    setSchoolId(cal.schoolId);
    setMultiplier(String(cal.multiplier));
    setReason(cal.reason || '');
    setDialogOpen(true);
  }

  function handleSubmit() {
    const mult = parseFloat(multiplier);
    if (isNaN(mult) || mult < 0.5 || mult > 2.0) return;

    if (editingId) {
      updateMutation.mutate({
        id: editingId,
        data: { multiplier: mult, reason: reason || undefined },
      });
    } else {
      createMutation.mutate({
        schoolId,
        multiplier: mult,
        reason: reason || undefined,
      });
    }
  }

  const isPending = createMutation.isPending || updateMutation.isPending;

  return (
    <div className="space-y-6">
      <PageHeader
        title={t('calibrations.title')}
        icon={SlidersHorizontal}
        color="violet"
        actions={
          <Button
            onClick={() => {
              resetForm();
              setDialogOpen(true);
            }}
          >
            <Plus className="h-4 w-4 mr-2" />
            {t('calibrations.create')}
          </Button>
        }
      />

      {/* Calibrations Table */}
      {isLoading ? (
        <div className="flex justify-center py-12">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      ) : calibrations.length === 0 ? (
        <div className="text-center py-12 text-muted-foreground">
          {t('calibrations.noCalibrations')}
        </div>
      ) : (
        <div className="rounded-lg border bg-card">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b bg-muted/50">
                  <th className="px-4 py-3 text-left font-medium">{t('calibrations.school')}</th>
                  <th className="px-4 py-3 text-left font-medium">
                    {t('calibrations.multiplier')}
                  </th>
                  <th className="px-4 py-3 text-left font-medium">{t('calibrations.reason')}</th>
                  <th className="px-4 py-3 text-right font-medium">{t('calibrations.actions')}</th>
                </tr>
              </thead>
              <tbody>
                {calibrations.map((cal) => {
                  const mult = Number(cal.multiplier);
                  return (
                    <tr key={cal.id} className="border-b last:border-0">
                      <td className="px-4 py-3">
                        <div>
                          <p className="font-medium">{getSchoolName(cal.school, locale)}</p>
                          {cal.school.usNewsRank && (
                            <span className="text-xs text-muted-foreground">
                              #{cal.school.usNewsRank}
                            </span>
                          )}
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <Badge
                          variant="outline"
                          className={
                            mult > 1
                              ? 'border-green-500/50 text-green-600 dark:text-green-400'
                              : mult < 1
                                ? 'border-red-500/50 text-red-600 dark:text-red-400'
                                : ''
                          }
                        >
                          {mult.toFixed(3)}x{mult > 1 ? ' ↑' : mult < 1 ? ' ↓' : ''}
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
      <Dialog
        open={dialogOpen}
        onOpenChange={(open) => {
          if (!open) resetForm();
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {editingId ? t('calibrations.editTitle') : t('calibrations.create')}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            {/* School Search (only for create) */}
            {!editingId && (
              <div className="space-y-2">
                <Label>{t('calibrations.school')}</Label>
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    className="pl-9"
                    placeholder={t('calibrations.searchSchool')}
                    value={schoolQuery}
                    onChange={(e) => {
                      setSchoolQuery(e.target.value);
                      setSchoolId('');
                    }}
                  />
                </div>
                {schoolOptions.length > 0 && !schoolId && (
                  <div className="border rounded-md max-h-40 overflow-auto">
                    {schoolOptions.map((s) => (
                      <button
                        key={s.id}
                        type="button"
                        className="w-full px-3 py-2 text-left text-sm hover:bg-muted/50 transition-colors"
                        onClick={() => {
                          setSchoolId(s.id);
                          setSchoolQuery(getSchoolName(s, locale));
                        }}
                      >
                        {getSchoolName(s, locale)}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* Multiplier */}
            <div className="space-y-2">
              <Label>{t('calibrations.multiplier')}</Label>
              <Input
                type="number"
                step="0.01"
                min="0.5"
                max="2.0"
                value={multiplier}
                onChange={(e) => setMultiplier(e.target.value)}
              />
              <p className="text-xs text-muted-foreground">{t('calibrations.multiplierHelper')}</p>
            </div>

            {/* Reason */}
            <div className="space-y-2">
              <Label>{t('calibrations.reason')}</Label>
              <Textarea
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                maxLength={1000}
                rows={3}
              />
            </div>

            <Button
              onClick={handleSubmit}
              disabled={isPending || (!editingId && !schoolId)}
              className="w-full"
            >
              {isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              {editingId ? t('calibrations.save') : t('calibrations.create')}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation */}
      <AlertDialog open={!!deleteId} onOpenChange={() => setDeleteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t('calibrations.confirmDelete')}</AlertDialogTitle>
            <AlertDialogDescription>{t('calibrations.confirmDeleteDesc')}</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t('calibrations.cancel')}</AlertDialogCancel>
            <AlertDialogAction onClick={() => deleteId && deleteMutation.mutate(deleteId)}>
              {t('calibrations.delete')}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
