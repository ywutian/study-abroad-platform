'use client';

import { useState } from 'react';
import { useTranslations } from 'next-intl';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Label } from '@/components/ui/label';
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
import { Layers, Plus, Pencil, Trash2, Loader2, Search } from 'lucide-react';

interface ActivityTemplate {
  id: string;
  name: string;
  nameZh?: string | null;
  aliases: string[];
  category: string;
  tier: number;
  description?: string | null;
  isActive: boolean;
}

const CATEGORIES = [
  'ACADEMIC',
  'ARTS',
  'ATHLETICS',
  'COMMUNITY_SERVICE',
  'LEADERSHIP',
  'WORK',
  'RESEARCH',
  'INTERNSHIP',
  'CLUB',
  'HOBBY',
  'OTHER',
] as const;

const TIER_LABELS: Record<number, string> = {
  1: 'Elite',
  2: 'Significant',
  3: 'Notable',
  4: 'General',
};

const TIER_COLORS: Record<number, string> = {
  1: 'bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-400',
  2: 'bg-slate-100 text-slate-800 dark:bg-slate-900/30 dark:text-slate-400',
  3: 'bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-400',
  4: 'bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400',
};

const emptyForm = {
  name: '',
  nameZh: '',
  category: 'OTHER' as (typeof CATEGORIES)[number],
  tier: 4,
  aliases: '',
  description: '',
};

export default function AdminActivityTemplatesPage() {
  const t = useTranslations('admin');
  const queryClient = useQueryClient();

  const [search, setSearch] = useState('');
  const [tierFilter, setTierFilter] = useState<string>('ALL');
  const [categoryFilter, setCategoryFilter] = useState<string>('ALL');
  const [page, setPage] = useState(1);
  const pageSize = 20;

  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState(emptyForm);
  const [deleteId, setDeleteId] = useState<string | null>(null);

  const { data, isLoading } = useQuery({
    queryKey: ['adminActivityTemplates', search, tierFilter, categoryFilter, page],
    queryFn: () => {
      const params: Record<string, string> = {
        page: String(page),
        limit: String(pageSize),
      };
      if (search.trim()) params.search = search.trim();
      if (tierFilter !== 'ALL') params.tier = tierFilter;
      if (categoryFilter !== 'ALL') params.category = categoryFilter;
      return apiClient.get<{
        items: ActivityTemplate[];
        total: number;
        page: number;
        limit: number;
        totalPages: number;
      }>('/admin/activity-templates', { params });
    },
  });

  const createMutation = useMutation({
    mutationFn: (payload: {
      name: string;
      nameZh?: string;
      category: string;
      tier: number;
      aliases?: string[];
      description?: string;
    }) => apiClient.post('/admin/activity-templates', payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['adminActivityTemplates'] });
      setDialogOpen(false);
      resetForm();
      toast.success('Activity template created');
    },
  });

  const updateMutation = useMutation({
    mutationFn: ({
      id,
      data,
    }: {
      id: string;
      data: {
        name?: string;
        nameZh?: string;
        category?: string;
        tier?: number;
        aliases?: string[];
        description?: string;
      };
    }) => apiClient.put(`/admin/activity-templates/${id}`, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['adminActivityTemplates'] });
      setDialogOpen(false);
      resetForm();
      toast.success('Activity template updated');
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => apiClient.delete(`/admin/activity-templates/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['adminActivityTemplates'] });
      setDeleteId(null);
      toast.success('Activity template deleted');
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

  const openEdit = (item: ActivityTemplate) => {
    setEditingId(item.id);
    setForm({
      name: item.name,
      nameZh: item.nameZh || '',
      category: item.category as (typeof CATEGORIES)[number],
      tier: item.tier,
      aliases: item.aliases?.join(', ') || '',
      description: item.description || '',
    });
    setDialogOpen(true);
  };

  const handleSubmit = () => {
    const payload = {
      name: form.name.trim(),
      nameZh: form.nameZh.trim() || undefined,
      category: form.category,
      tier: form.tier,
      aliases: form.aliases
        .split(',')
        .map((a) => a.trim())
        .filter(Boolean),
      description: form.description.trim() || undefined,
    };
    if (editingId) {
      updateMutation.mutate({ id: editingId, data: payload });
    } else {
      createMutation.mutate(payload);
    }
  };

  const isPending = createMutation.isPending || updateMutation.isPending;
  const items = data?.items ?? [];
  const total = data?.total ?? 0;
  const totalPages = data?.totalPages ?? 1;

  return (
    <>
      <PageHeader
        title={t('sidebar.activityTemplates')}
        description="Manage activity templates (name, category, tier) for student profiles"
        icon={Layers}
        color="violet"
      />

      <div className="mt-6">
        <div className="mb-4 flex flex-wrap items-center gap-4">
          <div className="relative flex-1 min-w-[200px]">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder="Search by name, Chinese name, or aliases..."
              value={search}
              onChange={(e) => {
                setSearch(e.target.value);
                setPage(1);
              }}
              className="pl-9"
            />
          </div>
          <Select
            value={tierFilter}
            onValueChange={(v) => {
              setTierFilter(v);
              setPage(1);
            }}
          >
            <SelectTrigger className="w-[130px]">
              <SelectValue placeholder="Tier" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="ALL">All Tiers</SelectItem>
              {[1, 2, 3, 4].map((tier) => (
                <SelectItem key={tier} value={String(tier)}>
                  Tier {tier} ({TIER_LABELS[tier]})
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select
            value={categoryFilter}
            onValueChange={(v) => {
              setCategoryFilter(v);
              setPage(1);
            }}
          >
            <SelectTrigger className="w-[180px]">
              <SelectValue placeholder="Category" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="ALL">All Categories</SelectItem>
              {CATEGORIES.map((cat) => (
                <SelectItem key={cat} value={cat}>
                  {cat}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Button onClick={openCreate}>
            <Plus className="mr-2 h-4 w-4" />
            Create
          </Button>
        </div>

        {isLoading ? (
          <ListSkeleton count={5} />
        ) : items.length > 0 ? (
          <>
            <Card>
              <ScrollArea className="h-[500px]">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Name</TableHead>
                      <TableHead>Chinese Name</TableHead>
                      <TableHead>Category</TableHead>
                      <TableHead>Tier</TableHead>
                      <TableHead>Aliases</TableHead>
                      <TableHead>Active</TableHead>
                      <TableHead className="w-[100px]">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {items.map((item) => (
                      <TableRow key={item.id}>
                        <TableCell className="font-medium">{item.name}</TableCell>
                        <TableCell className="text-muted-foreground">
                          {item.nameZh || '-'}
                        </TableCell>
                        <TableCell>{item.category}</TableCell>
                        <TableCell>
                          <Badge
                            variant="secondary"
                            className={TIER_COLORS[item.tier] ?? TIER_COLORS[4]}
                          >
                            {TIER_LABELS[item.tier] ?? `Tier ${item.tier}`}
                          </Badge>
                        </TableCell>
                        <TableCell className="max-w-[200px] truncate text-sm text-muted-foreground">
                          {item.aliases?.length ? item.aliases.join(', ') : '-'}
                        </TableCell>
                        <TableCell>
                          <Badge
                            variant={item.isActive ? 'default' : 'secondary'}
                            className={
                              item.isActive
                                ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-400'
                                : 'bg-muted text-muted-foreground'
                            }
                          >
                            {item.isActive ? 'Yes' : 'No'}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <div className="flex gap-1">
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-7 w-7"
                              onClick={() => openEdit(item)}
                            >
                              <Pencil className="h-3.5 w-3.5" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-7 w-7 text-destructive"
                              onClick={() => setDeleteId(item.id)}
                              disabled={!item.isActive}
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
              totalPages={totalPages}
              total={total}
              pageSize={pageSize}
              onPageChange={setPage}
            />
          </>
        ) : (
          <EmptyState
            icon={<Layers className="h-12 w-12" />}
            title="No Activity Templates"
            description="Click Create to add a new activity template"
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
            <DialogTitle>
              {editingId ? 'Edit Activity Template' : 'Create Activity Template'}
            </DialogTitle>
            <DialogDescription>
              {editingId
                ? 'Update activity template details'
                : 'Add a new activity template for student profiles'}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Name *</Label>
              <Input
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                placeholder="e.g. Student Council President"
              />
            </div>
            <div className="space-y-2">
              <Label>Chinese Name</Label>
              <Input
                value={form.nameZh}
                onChange={(e) => setForm({ ...form, nameZh: e.target.value })}
                placeholder="中文名称"
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Category</Label>
                <Select
                  value={form.category}
                  onValueChange={(v) =>
                    setForm({ ...form, category: v as (typeof CATEGORIES)[number] })
                  }
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {CATEGORIES.map((cat) => (
                      <SelectItem key={cat} value={cat}>
                        {cat}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Tier (1-4)</Label>
                <Select
                  value={String(form.tier)}
                  onValueChange={(v) => setForm({ ...form, tier: Number(v) })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {[1, 2, 3, 4].map((t) => (
                      <SelectItem key={t} value={String(t)}>
                        {t} - {TIER_LABELS[t]}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="space-y-2">
              <Label>Aliases (comma-separated)</Label>
              <Input
                value={form.aliases}
                onChange={(e) => setForm({ ...form, aliases: e.target.value })}
                placeholder="e.g. SCP, president, 学生会主席"
              />
            </div>
            <div className="space-y-2">
              <Label>Description</Label>
              <Textarea
                value={form.description}
                onChange={(e) => setForm({ ...form, description: e.target.value })}
                placeholder="Optional description"
                rows={3}
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
            <Button onClick={handleSubmit} disabled={isPending || !form.name.trim()}>
              {isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {editingId ? 'Save' : 'Create'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation */}
      <AlertDialog open={!!deleteId} onOpenChange={() => setDeleteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Activity Template</AlertDialogTitle>
            <AlertDialogDescription>
              This will soft-delete the template (set inactive). It will no longer appear in
              selection lists.
            </AlertDialogDescription>
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
