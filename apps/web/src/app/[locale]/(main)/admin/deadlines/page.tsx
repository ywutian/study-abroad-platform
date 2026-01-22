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
import { Calendar, Plus, Pencil, Trash2, Loader2 } from 'lucide-react';

interface SchoolDeadline {
  id: string;
  schoolId: string;
  year: number;
  round: string;
  applicationDeadline: string;
  financialAidDeadline?: string;
  decisionDate?: string;
  essayCount?: number;
  interviewRequired: boolean;
  applicationFee?: number;
  notes?: string;
  school: { id: string; name: string; nameZh?: string };
}

interface SchoolOption {
  id: string;
  name: string;
  nameZh?: string;
}

const ROUNDS = ['ED', 'ED2', 'EA', 'REA', 'RD', 'Rolling'];
const YEARS = [2025, 2026, 2027];

const ROUND_COLORS: Record<string, string> = {
  ED: 'bg-red-500/10 text-red-600 border-red-500/20',
  ED2: 'bg-red-500/10 text-red-600 border-red-500/20',
  EA: 'bg-blue-500/10 text-blue-600 border-blue-500/20',
  REA: 'bg-violet-500/10 text-violet-600 border-violet-500/20',
  RD: 'bg-emerald-500/10 text-emerald-600 border-emerald-500/20',
  Rolling: 'bg-slate-500/10 text-slate-600 border-slate-500/20',
};

const emptyForm = {
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

export default function AdminDeadlinesPage() {
  const t = useTranslations('admin');
  const fmt = useFormatter();
  const locale = useLocale();
  const queryClient = useQueryClient();

  const [yearFilter, setYearFilter] = useState('2026');
  const [schoolSearch, setSchoolSearch] = useState('');
  const [page, setPage] = useState(1);
  const pageSize = 50;

  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState(emptyForm);
  const [deleteId, setDeleteId] = useState<string | null>(null);

  // School search for form
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
    mutationFn: (data: typeof emptyForm) => apiClient.post('/admin/school-deadlines', data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['adminDeadlines'] });
      setDialogOpen(false);
      resetForm();
      toast.success(t('deadlines.created'));
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: Partial<typeof emptyForm> }) =>
      apiClient.put(`/admin/school-deadlines/${id}`, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['adminDeadlines'] });
      setDialogOpen(false);
      resetForm();
      toast.success(t('deadlines.updated'));
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => apiClient.delete(`/admin/school-deadlines/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['adminDeadlines'] });
      setDeleteId(null);
      toast.success(t('deadlines.deleted'));
    },
    onError: (error: Error) => toast.error(error.message),
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

  const getSchoolDisplayName = (school: { name: string; nameZh?: string }) =>
    locale === 'zh' && school.nameZh ? school.nameZh : school.name;

  const isPending = createMutation.isPending || updateMutation.isPending;

  return (
    <>
      <PageHeader
        title={t('deadlines.title')}
        description={t('deadlines.description')}
        icon={Calendar}
        color="blue"
      />

      <div className="mt-6">
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

        {isLoading ? (
          <ListSkeleton count={5} />
        ) : data?.data && data.data.length > 0 ? (
          <>
            <Card>
              <ScrollArea className="h-[500px]">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>{t('deadlines.school')}</TableHead>
                      <TableHead>{t('deadlines.year')}</TableHead>
                      <TableHead>{t('deadlines.round')}</TableHead>
                      <TableHead>{t('deadlines.appDeadline')}</TableHead>
                      <TableHead>{t('deadlines.aidDeadline')}</TableHead>
                      <TableHead>{t('deadlines.decisionDate')}</TableHead>
                      <TableHead>{t('deadlines.essays')}</TableHead>
                      <TableHead className="w-[80px]">{t('deadlines.actions')}</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {data.data.map((d) => (
                      <TableRow key={d.id}>
                        <TableCell className="font-medium">
                          {getSchoolDisplayName(d.school)}
                        </TableCell>
                        <TableCell>{d.year}</TableCell>
                        <TableCell>
                          <Badge variant="outline" className={ROUND_COLORS[d.round] || ''}>
                            {d.round}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-sm">
                          {fmt.dateTime(new Date(d.applicationDeadline), 'medium')}
                        </TableCell>
                        <TableCell className="text-sm text-muted-foreground">
                          {d.financialAidDeadline
                            ? fmt.dateTime(new Date(d.financialAidDeadline), 'medium')
                            : '-'}
                        </TableCell>
                        <TableCell className="text-sm text-muted-foreground">
                          {d.decisionDate ? fmt.dateTime(new Date(d.decisionDate), 'medium') : '-'}
                        </TableCell>
                        <TableCell>{d.essayCount || '-'}</TableCell>
                        <TableCell>
                          <div className="flex gap-1">
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-7 w-7"
                              onClick={() => openEdit(d)}
                            >
                              <Pencil className="h-3.5 w-3.5" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-7 w-7 text-destructive"
                              onClick={() => setDeleteId(d.id)}
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
            icon={<Calendar className="h-12 w-12" />}
            title={t('deadlines.empty')}
            description={t('deadlines.emptyDesc')}
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
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>{editingId ? t('deadlines.edit') : t('deadlines.create')}</DialogTitle>
            <DialogDescription>{t('deadlines.formDesc')}</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            {/* School search */}
            {!editingId && (
              <div className="space-y-2">
                <Label>{t('deadlines.school')}</Label>
                <Input
                  placeholder={t('deadlines.searchSchool')}
                  value={schoolQuery}
                  onChange={(e) => setSchoolQuery(e.target.value)}
                />
                {schoolOptions?.items && schoolOptions.items.length > 0 && !form.schoolId && (
                  <div className="border rounded-md max-h-32 overflow-y-auto">
                    {schoolOptions.items.map((s) => (
                      <button
                        key={s.id}
                        className="w-full text-left px-3 py-2 text-sm hover:bg-muted"
                        onClick={() => {
                          setForm({ ...form, schoolId: s.id });
                          setSchoolQuery(getSchoolDisplayName(s));
                        }}
                      >
                        {getSchoolDisplayName(s)}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            )}
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>{t('deadlines.year')}</Label>
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
              <div className="space-y-2">
                <Label>{t('deadlines.round')}</Label>
                <Select value={form.round} onValueChange={(v) => setForm({ ...form, round: v })}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {ROUNDS.map((r) => (
                      <SelectItem key={r} value={r}>
                        {r}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="space-y-2">
              <Label>{t('deadlines.appDeadline')} *</Label>
              <Input
                type="date"
                value={form.applicationDeadline}
                onChange={(e) => setForm({ ...form, applicationDeadline: e.target.value })}
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>{t('deadlines.aidDeadline')}</Label>
                <Input
                  type="date"
                  value={form.financialAidDeadline}
                  onChange={(e) => setForm({ ...form, financialAidDeadline: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label>{t('deadlines.decisionDate')}</Label>
                <Input
                  type="date"
                  value={form.decisionDate}
                  onChange={(e) => setForm({ ...form, decisionDate: e.target.value })}
                />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>{t('deadlines.essayCount')}</Label>
                <Input
                  type="number"
                  min={0}
                  value={form.essayCount}
                  onChange={(e) => setForm({ ...form, essayCount: Number(e.target.value) })}
                />
              </div>
              <div className="space-y-2">
                <Label>{t('deadlines.appFee')}</Label>
                <Input
                  type="number"
                  min={0}
                  value={form.applicationFee}
                  onChange={(e) => setForm({ ...form, applicationFee: Number(e.target.value) })}
                />
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Switch
                checked={form.interviewRequired}
                onCheckedChange={(v) => setForm({ ...form, interviewRequired: v })}
              />
              <Label>{t('deadlines.interviewRequired')}</Label>
            </div>
            <div className="space-y-2">
              <Label>{t('deadlines.notes')}</Label>
              <Input
                value={form.notes}
                onChange={(e) => setForm({ ...form, notes: e.target.value })}
              />
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
            <Button
              onClick={handleSubmit}
              disabled={isPending || (!editingId && !form.schoolId) || !form.applicationDeadline}
            >
              {isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {editingId ? t('deadlines.save') : t('deadlines.create')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation */}
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
