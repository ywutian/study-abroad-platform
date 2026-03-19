/* eslint-disable @typescript-eslint/no-explicit-any */
'use client';

import { useState } from 'react';
import { useTranslations } from 'next-intl';
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
import { EventsTable } from './events-table';
import { EventFormDialog, type EventFormData } from './event-form-dialog';

interface GlobalEvent {
  id: string;
  title: string;
  titleZh?: string;
  category: string;
  eventDate: string;
  registrationDeadline?: string;
  lateDeadline?: string;
  resultDate?: string;
  description?: string;
  descriptionZh?: string;
  url?: string;
  year: number;
  isRecurring: boolean;
  isActive: boolean;
  createdAt: string;
}

const CATEGORIES = [
  'TEST',
  'COMPETITION',
  'SUMMER_PROGRAM',
  'FINANCIAL_AID',
  'APPLICATION',
  'OTHER',
];
const YEARS = [2025, 2026, 2027];

const emptyForm: EventFormData = {
  title: '',
  titleZh: '',
  category: 'TEST',
  eventDate: '',
  registrationDeadline: '',
  lateDeadline: '',
  resultDate: '',
  description: '',
  descriptionZh: '',
  url: '',
  year: 2026,
  isRecurring: true,
  isActive: true,
};

export function EventsTab() {
  const t = useTranslations('admin');
  const queryClient = useQueryClient();

  const [categoryFilter, setCategoryFilter] = useState('ALL');
  const [yearFilter, setYearFilter] = useState('2026');
  const [page, setPage] = useState(1);
  const pageSize = 50;

  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState(emptyForm);
  const [deleteId, setDeleteId] = useState<string | null>(null);

  const { data, isLoading } = useQuery({
    queryKey: ['adminEvents', categoryFilter, yearFilter, page],
    queryFn: () => {
      const params: Record<string, string> = {
        year: yearFilter,
        page: String(page),
        pageSize: String(pageSize),
      };
      if (categoryFilter !== 'ALL') params.category = categoryFilter;
      return apiClient.get<{ data: GlobalEvent[]; total: number; totalPages: number }>(
        '/admin/global-events',
        { params }
      );
    },
  });

  const createMutation = useMutation({
    mutationFn: (data: typeof emptyForm) => apiClient.post('/admin/global-events', data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['adminEvents'] });
      setDialogOpen(false);
      resetForm();
      toast.success(t('events.created'));
    },
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: Partial<typeof emptyForm> }) =>
      apiClient.put(`/admin/global-events/${id}`, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['adminEvents'] });
      setDialogOpen(false);
      resetForm();
      toast.success(t('events.updated'));
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => apiClient.delete(`/admin/global-events/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['adminEvents'] });
      setDeleteId(null);
      toast.success(t('events.deleted'));
    },
  });

  const resetForm = () => {
    setForm(emptyForm);
    setEditingId(null);
  };

  const openCreate = () => {
    resetForm();
    setDialogOpen(true);
  };

  const openEdit = (e: GlobalEvent) => {
    setEditingId(e.id);
    setForm({
      title: e.title,
      titleZh: e.titleZh || '',
      category: e.category,
      eventDate: e.eventDate?.split('T')[0] || '',
      registrationDeadline: e.registrationDeadline?.split('T')[0] || '',
      lateDeadline: e.lateDeadline?.split('T')[0] || '',
      resultDate: e.resultDate?.split('T')[0] || '',
      description: e.description || '',
      descriptionZh: e.descriptionZh || '',
      url: e.url || '',
      year: e.year,
      isRecurring: e.isRecurring,
      isActive: e.isActive,
    });
    setDialogOpen(true);
  };

  const handleSubmit = () => {
    const payload = {
      ...form,
      titleZh: form.titleZh || undefined,
      registrationDeadline: form.registrationDeadline || undefined,
      lateDeadline: form.lateDeadline || undefined,
      resultDate: form.resultDate || undefined,
      description: form.description || undefined,
      descriptionZh: form.descriptionZh || undefined,
      url: form.url || undefined,
    };
    if (editingId) {
      updateMutation.mutate({ id: editingId, data: payload });
    } else {
      createMutation.mutate(payload as any);
    }
  };

  const getCategoryLabel = (cat: string) => {
    const key = `events.categories.${cat}` as any;
    return t.has(key) ? t(key) : cat;
  };

  const isPending = createMutation.isPending || updateMutation.isPending;

  return (
    <>
      <div className="mb-4 flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Select
            value={categoryFilter}
            onValueChange={(v) => {
              setCategoryFilter(v);
              setPage(1);
            }}
          >
            <SelectTrigger className="w-[180px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="ALL">{t('events.allCategories')}</SelectItem>
              {CATEGORIES.map((c) => (
                <SelectItem key={c} value={c}>
                  {getCategoryLabel(c)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
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
          {t('events.create')}
        </Button>
      </div>

      <EventsTable
        events={data?.data ?? []}
        isLoading={isLoading}
        page={page}
        totalPages={data?.totalPages ?? 1}
        total={data?.total ?? 0}
        pageSize={pageSize}
        onPageChange={setPage}
        onEdit={openEdit}
        onDelete={setDeleteId}
      />

      <EventFormDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        editingId={editingId}
        form={form}
        onFormChange={setForm}
        onSubmit={handleSubmit}
        onReset={resetForm}
        isPending={isPending}
      />

      <AlertDialog open={!!deleteId} onOpenChange={() => setDeleteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t('events.confirmDelete')}</AlertDialogTitle>
            <AlertDialogDescription>{t('events.confirmDeleteDesc')}</AlertDialogDescription>
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
