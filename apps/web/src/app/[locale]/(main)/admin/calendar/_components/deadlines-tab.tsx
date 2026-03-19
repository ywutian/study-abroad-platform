/* eslint-disable @typescript-eslint/no-explicit-any */
'use client';

import { useState } from 'react';
import { useTranslations, useLocale } from 'next-intl';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
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
import { apiClient } from '@/lib/api';
import { toast } from 'sonner';
import { Plus, Loader2 } from 'lucide-react';
import { DeadlineFormDialog } from './deadline-form-dialog';
import type { DeadlineFormData } from './deadline-form-dialog';
import { DeadlinesTable } from './deadlines-table';
import type { SchoolDeadline } from './deadlines-table';

interface SchoolOption {
  id: string;
  name: string;
  nameZh?: string;
}

const YEARS = [2025, 2026, 2027];

const emptyForm: DeadlineFormData = {
  schoolId: '',
  year: 2026,
  round: 'RD',
  applicationDeadline: '',
  financialAidDeadline: '',
  decisionDate: '',
  essayCount: 0,
  interviewRequired: false,
  applicationFee: 0,
  notes: '',
};

export function DeadlinesTab() {
  const t = useTranslations('admin');
  const locale = useLocale();
  const queryClient = useQueryClient();

  const [yearFilter, setYearFilter] = useState('2026');
  const [page, setPage] = useState(1);
  const pageSize = 50;

  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<DeadlineFormData>(emptyForm);
  const [deleteId, setDeleteId] = useState<string | null>(null);

  const [schoolQuery, setSchoolQuery] = useState('');
  const { data: schoolOptions } = useQuery({
    queryKey: ['schoolSearch', schoolQuery],
    queryFn: () =>
      apiClient.get<{ items: SchoolOption[] }>('/schools', {
        params: { search: schoolQuery, pageSize: '10' },
      }),
    enabled: schoolQuery.length >= 2,
  });

  const { data, isLoading } = useQuery({
    queryKey: ['adminDeadlines', yearFilter, page],
    queryFn: () =>
      apiClient.get<{ data: SchoolDeadline[]; total: number; totalPages: number }>(
        '/admin/school-deadlines',
        { params: { year: yearFilter, page: String(page), pageSize: String(pageSize) } }
      ),
  });

  const createMutation = useMutation({
    mutationFn: (data: DeadlineFormData) => apiClient.post('/admin/school-deadlines', data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['adminDeadlines'] });
      setDialogOpen(false);
      resetForm();
      toast.success(t('deadlines.created'));
    },
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: Partial<DeadlineFormData> }) =>
      apiClient.put(`/admin/school-deadlines/${id}`, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['adminDeadlines'] });
      setDialogOpen(false);
      resetForm();
      toast.success(t('deadlines.updated'));
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => apiClient.delete(`/admin/school-deadlines/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['adminDeadlines'] });
      setDeleteId(null);
      toast.success(t('deadlines.deleted'));
    },
  });

  const resetForm = () => {
    setForm(emptyForm);
    setEditingId(null);
    setSchoolQuery('');
  };

  const openCreate = () => {
    resetForm();
    setDialogOpen(true);
  };

  const openEdit = (d: SchoolDeadline) => {
    setEditingId(d.id);
    setForm({
      schoolId: d.schoolId,
      year: d.year,
      round: d.round,
      applicationDeadline: d.applicationDeadline?.split('T')[0] || '',
      financialAidDeadline: d.financialAidDeadline?.split('T')[0] || '',
      decisionDate: d.decisionDate?.split('T')[0] || '',
      essayCount: d.essayCount || 0,
      interviewRequired: d.interviewRequired,
      applicationFee: d.applicationFee || 0,
      notes: d.notes || '',
    });
    setSchoolQuery(d.school.name);
    setDialogOpen(true);
  };

  const getSchoolDisplayName = (school: { name: string; nameZh?: string }) =>
    locale === 'zh' && school.nameZh ? school.nameZh : school.name;

  const handleSubmit = () => {
    const payload = {
      ...form,
      essayCount: Number(form.essayCount) || undefined,
      applicationFee: Number(form.applicationFee) || undefined,
      financialAidDeadline: form.financialAidDeadline || undefined,
      decisionDate: form.decisionDate || undefined,
      notes: form.notes || undefined,
    };
    if (editingId) {
      updateMutation.mutate({ id: editingId, data: payload });
    } else {
      createMutation.mutate(payload as any);
    }
  };

  const handleSchoolSelect = (school: SchoolOption) => {
    setForm({ ...form, schoolId: school.id });
    setSchoolQuery(getSchoolDisplayName(school));
  };

  const isPending = createMutation.isPending || updateMutation.isPending;

  return (
    <>
      <div className="mb-4 flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Select
            value={yearFilter}
            onValueChange={(v) => {
              setYearFilter(v);
              setPage(1);
            }}
          >
            <SelectTrigger className="w-[120px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {YEARS.map((y) => (
                <SelectItem key={y} value={String(y)}>
                  {y}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <Button onClick={openCreate}>
          <Plus className="mr-2 h-4 w-4" />
          {t('deadlines.create')}
        </Button>
      </div>

      <DeadlinesTable
        deadlines={data?.data ?? []}
        isLoading={isLoading}
        page={page}
        totalPages={data?.totalPages ?? 1}
        total={data?.total ?? 0}
        pageSize={pageSize}
        onPageChange={setPage}
        onEdit={openEdit}
        onDelete={setDeleteId}
      />

      <DeadlineFormDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        editingId={editingId}
        form={form}
        onFormChange={setForm}
        onSubmit={handleSubmit}
        onReset={resetForm}
        isPending={isPending}
        schoolQuery={schoolQuery}
        onSchoolQueryChange={setSchoolQuery}
        schoolOptions={schoolOptions?.items ?? []}
        onSchoolSelect={handleSchoolSelect}
        getSchoolDisplayName={getSchoolDisplayName}
      />

      <AlertDialog open={!!deleteId} onOpenChange={() => setDeleteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t('deadlines.confirmDelete')}</AlertDialogTitle>
            <AlertDialogDescription>{t('deadlines.confirmDeleteDesc')}</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t('dialogs.cancel')}</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => deleteId && deleteMutation.mutate(deleteId)}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {deleteMutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {t('dialogs.delete')}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
