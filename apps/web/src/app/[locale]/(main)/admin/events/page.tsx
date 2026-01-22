'use client';

import { useState } from 'react';
import { useTranslations, useFormatter, useLocale } from 'next-intl';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Textarea } from '@/components/ui/textarea';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
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
import { PageHeader } from '@/components/layout';
import { ListSkeleton } from '@/components/ui/loading-state';
import { EmptyState } from '@/components/ui/empty-state';
import { PaginationControls } from '../_components/pagination-controls';
import { apiClient } from '@/lib/api';
import { toast } from 'sonner';
import { Globe, Plus, Pencil, Trash2, Loader2 } from 'lucide-react';

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

const CATEGORY_COLORS: Record<string, string> = {
  TEST: 'bg-blue-500/10 text-blue-600 border-blue-500/20',
  COMPETITION: 'bg-amber-500/10 text-amber-600 border-amber-500/20',
  SUMMER_PROGRAM: 'bg-emerald-500/10 text-emerald-600 border-emerald-500/20',
  FINANCIAL_AID: 'bg-violet-500/10 text-violet-600 border-violet-500/20',
  APPLICATION: 'bg-pink-500/10 text-pink-600 border-pink-500/20',
  OTHER: 'bg-slate-500/10 text-slate-600 border-slate-500/20',
};

const emptyForm = {
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

export default function AdminEventsPage() {
  const t = useTranslations('admin');
  const fmt = useFormatter();
  const locale = useLocale();
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
    onError: (error: Error) => toast.error(error.message),
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
    onError: (error: Error) => toast.error(error.message),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => apiClient.delete(`/admin/global-events/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['adminEvents'] });
      setDeleteId(null);
      toast.success(t('events.deleted'));
    },
    onError: (error: Error) => toast.error(error.message),
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

  const getTitle = (e: GlobalEvent) => (locale === 'zh' && e.titleZh ? e.titleZh : e.title);

  const isPending = createMutation.isPending || updateMutation.isPending;

  return (
    <>
      <PageHeader
        title={t('events.title')}
        description={t('events.description')}
        icon={Globe}
        color="violet"
      />

      <div className="mt-6">
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

        {isLoading ? (
          <ListSkeleton count={5} />
        ) : data?.data && data.data.length > 0 ? (
          <>
            <Card>
              <ScrollArea className="h-[500px]">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>{t('events.eventTitle')}</TableHead>
                      <TableHead>{t('events.category')}</TableHead>
                      <TableHead>{t('events.eventDate')}</TableHead>
                      <TableHead>{t('events.regDeadline')}</TableHead>
                      <TableHead>{t('events.active')}</TableHead>
                      <TableHead className="w-[80px]">{t('deadlines.actions')}</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {data.data.map((event) => (
                      <TableRow key={event.id}>
                        <TableCell>
                          <div>
                            <div className="font-medium">{getTitle(event)}</div>
                            {locale === 'zh' && event.titleZh && event.title !== event.titleZh && (
                              <div className="text-xs text-muted-foreground">{event.title}</div>
                            )}
                          </div>
                        </TableCell>
                        <TableCell>
                          <Badge
                            variant="outline"
                            className={CATEGORY_COLORS[event.category] || ''}
                          >
                            {getCategoryLabel(event.category)}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-sm">
                          {fmt.dateTime(new Date(event.eventDate), 'medium')}
                        </TableCell>
                        <TableCell className="text-sm text-muted-foreground">
                          {event.registrationDeadline
                            ? fmt.dateTime(new Date(event.registrationDeadline), 'medium')
                            : '-'}
                        </TableCell>
                        <TableCell>
                          <Badge variant={event.isActive ? 'success' : 'secondary'}>
                            {event.isActive ? t('events.activeYes') : t('events.activeNo')}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <div className="flex gap-1">
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-7 w-7"
                              onClick={() => openEdit(event)}
                            >
                              <Pencil className="h-3.5 w-3.5" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-7 w-7 text-destructive"
                              onClick={() => setDeleteId(event.id)}
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </ScrollArea>
            </Card>
            <PaginationControls
              page={page}
              totalPages={data.totalPages ?? 1}
              total={data.total ?? 0}
              pageSize={pageSize}
              onPageChange={setPage}
            />
          </>
        ) : (
          <EmptyState
            icon={<Globe className="h-12 w-12" />}
            title={t('events.empty')}
            description={t('events.emptyDesc')}
          />
        )}
      </div>

      {/* Create/Edit Dialog */}
      <Dialog
        open={dialogOpen}
        onOpenChange={(open) => {
          if (!open) {
            setDialogOpen(false);
            resetForm();
          }
        }}
      >
        <DialogContent className="max-w-lg max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editingId ? t('events.edit') : t('events.create')}</DialogTitle>
            <DialogDescription>{t('events.formDesc')}</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>{t('events.titleEn')} *</Label>
              <Input
                value={form.title}
                onChange={(e) => setForm({ ...form, title: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label>{t('events.titleZh')}</Label>
              <Input
                value={form.titleZh}
                onChange={(e) => setForm({ ...form, titleZh: e.target.value })}
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>{t('events.category')} *</Label>
                <Select
                  value={form.category}
                  onValueChange={(v) => setForm({ ...form, category: v })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {CATEGORIES.map((c) => (
                      <SelectItem key={c} value={c}>
                        {getCategoryLabel(c)}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>{t('deadlines.year')} *</Label>
                <Select
                  value={String(form.year)}
                  onValueChange={(v) => setForm({ ...form, year: Number(v) })}
                >
                  <SelectTrigger>
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
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>{t('events.eventDate')} *</Label>
                <Input
                  type="date"
                  value={form.eventDate}
                  onChange={(e) => setForm({ ...form, eventDate: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label>{t('events.regDeadline')}</Label>
                <Input
                  type="date"
                  value={form.registrationDeadline}
                  onChange={(e) => setForm({ ...form, registrationDeadline: e.target.value })}
                />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>{t('events.lateDeadline')}</Label>
                <Input
                  type="date"
                  value={form.lateDeadline}
                  onChange={(e) => setForm({ ...form, lateDeadline: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label>{t('events.resultDate')}</Label>
                <Input
                  type="date"
                  value={form.resultDate}
                  onChange={(e) => setForm({ ...form, resultDate: e.target.value })}
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label>{t('events.descriptionEn')}</Label>
              <Textarea
                value={form.description}
                onChange={(e) => setForm({ ...form, description: e.target.value })}
                rows={2}
              />
            </div>
            <div className="space-y-2">
              <Label>{t('events.descriptionZh')}</Label>
              <Textarea
                value={form.descriptionZh}
                onChange={(e) => setForm({ ...form, descriptionZh: e.target.value })}
                rows={2}
              />
            </div>
            <div className="space-y-2">
              <Label>URL</Label>
              <Input
                value={form.url}
                onChange={(e) => setForm({ ...form, url: e.target.value })}
                placeholder="https://..."
              />
            </div>
            <div className="flex items-center gap-6">
              <div className="flex items-center gap-2">
                <Switch
                  checked={form.isRecurring}
                  onCheckedChange={(v) => setForm({ ...form, isRecurring: v })}
                />
                <Label>{t('events.recurring')}</Label>
              </div>
              <div className="flex items-center gap-2">
                <Switch
                  checked={form.isActive}
                  onCheckedChange={(v) => setForm({ ...form, isActive: v })}
                />
                <Label>{t('events.active')}</Label>
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setDialogOpen(false);
                resetForm();
              }}
            >
              {t('dialogs.cancel')}
            </Button>
            <Button onClick={handleSubmit} disabled={isPending || !form.title || !form.eventDate}>
              {isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {editingId ? t('events.save') : t('events.create')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation */}
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
