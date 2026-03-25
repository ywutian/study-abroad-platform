'use client';

import { useState } from 'react';
import { useTranslations } from 'next-intl';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
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
import { PageHeader } from '@/components/layout';
import { apiClient } from '@/lib/api';
import { API_ROUTES } from '@study-abroad/shared';
import { toast } from 'sonner';
import { Layers, Plus, Loader2, Search } from 'lucide-react';
import { TemplatesTable } from './_components/templates-table';
import {
  TemplateFormDialog,
  CATEGORIES,
  type TemplateFormData,
} from './_components/template-form-dialog';

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

const TIER_LABELS: Record<number, string> = {
  1: 'Elite',
  2: 'Significant',
  3: 'Notable',
  4: 'General',
};

const emptyForm: TemplateFormData = {
  name: '',
  nameZh: '',
  category: 'OTHER',
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
  const [form, setForm] = useState<TemplateFormData>(emptyForm);
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
    }) => apiClient.post(`${API_ROUTES.ADMIN}/activity-templates`, payload),
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
    }) => apiClient.put(`${API_ROUTES.ADMIN}/activity-templates/${id}`, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['adminActivityTemplates'] });
      setDialogOpen(false);
      resetForm();
      toast.success('Activity template updated');
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => apiClient.delete(`${API_ROUTES.ADMIN}/activity-templates/${id}`),
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
      category: item.category as TemplateFormData['category'],
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

        <TemplatesTable
          items={items}
          isLoading={isLoading}
          page={page}
          totalPages={totalPages}
          total={total}
          pageSize={pageSize}
          onPageChange={setPage}
          onEdit={openEdit}
          onDelete={setDeleteId}
        />
      </div>

      <TemplateFormDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        editingId={editingId}
        form={form}
        onFormChange={setForm}
        onSubmit={handleSubmit}
        onReset={resetForm}
        isPending={isPending}
      />

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
