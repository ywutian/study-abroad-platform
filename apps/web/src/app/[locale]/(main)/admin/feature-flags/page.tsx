'use client';

import { useState } from 'react';
import { useTranslations } from 'next-intl';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
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
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { Textarea } from '@/components/ui/textarea';
import { PageHeader } from '@/components/layout';
import { CardSkeleton } from '@/components/ui/loading-state';
import { EmptyState } from '@/components/ui/empty-state';
import { apiClient } from '@/lib/api';
import { adminFeatureFlagRoutes } from '@study-abroad/shared/constants';
import { toast } from 'sonner';
import { ToggleRight, Plus, Pencil, Trash2, RefreshCw, Loader2 } from 'lucide-react';

interface FeatureFlag {
  id: string;
  key: string;
  description: string | null;
  enabled: boolean;
  rules: {
    roles?: string[];
    userIds?: string[];
    percentage?: number;
  } | null;
  createdAt: string;
  updatedAt: string;
}

interface FlagFormData {
  key: string;
  description: string;
  enabled: boolean;
  rulesJson: string;
}

const EMPTY_FORM: FlagFormData = {
  key: '',
  description: '',
  enabled: false,
  rulesJson: '',
};

function parseRulesJson(json: string): Record<string, unknown> | undefined {
  if (!json.trim()) return undefined;
  return JSON.parse(json);
}

function formatRules(rules: FeatureFlag['rules']): string {
  if (!rules) return '';
  const parts: string[] = [];
  if (rules.roles?.length) parts.push(`roles: ${rules.roles.join(', ')}`);
  if (rules.userIds?.length) parts.push(`${rules.userIds.length} user(s)`);
  if (typeof rules.percentage === 'number') parts.push(`${rules.percentage}%`);
  return parts.join(' · ');
}

export default function AdminFeatureFlagsPage() {
  const t = useTranslations('admin.featureFlags');
  const queryClient = useQueryClient();
  const [showCreate, setShowCreate] = useState(false);
  const [editingFlag, setEditingFlag] = useState<FeatureFlag | null>(null);
  const [form, setForm] = useState<FlagFormData>(EMPTY_FORM);
  const [deleteId, setDeleteId] = useState<string | null>(null);

  const { data: flags, isLoading } = useQuery({
    queryKey: ['adminFeatureFlags'],
    queryFn: () => apiClient.get<FeatureFlag[]>(adminFeatureFlagRoutes.list()),
  });

  const createMutation = useMutation({
    mutationFn: (data: {
      key: string;
      description?: string;
      enabled?: boolean;
      rules?: Record<string, unknown>;
    }) => apiClient.post(adminFeatureFlagRoutes.list(), data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['adminFeatureFlags'] });
      setShowCreate(false);
      setForm(EMPTY_FORM);
      toast.success(t('created'));
    },
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: Record<string, unknown> }) =>
      apiClient.put(adminFeatureFlagRoutes.byId(id), data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['adminFeatureFlags'] });
      setEditingFlag(null);
      setForm(EMPTY_FORM);
      toast.success(t('updated'));
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => apiClient.delete(adminFeatureFlagRoutes.byId(id)),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['adminFeatureFlags'] });
      setDeleteId(null);
      toast.success(t('deleted'));
    },
  });

  const cacheMutation = useMutation({
    mutationFn: (id: string) => apiClient.post(adminFeatureFlagRoutes.invalidateCache(id)),
    onSuccess: () => {
      toast.success(t('cacheInvalidated'));
    },
  });

  const toggleMutation = useMutation({
    mutationFn: ({ id, enabled }: { id: string; enabled: boolean }) =>
      apiClient.put(adminFeatureFlagRoutes.byId(id), { enabled }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['adminFeatureFlags'] });
    },
  });

  const openCreate = () => {
    setForm(EMPTY_FORM);
    setShowCreate(true);
  };

  const openEdit = (flag: FeatureFlag) => {
    setForm({
      key: flag.key,
      description: flag.description ?? '',
      enabled: flag.enabled,
      rulesJson: flag.rules ? JSON.stringify(flag.rules, null, 2) : '',
    });
    setEditingFlag(flag);
  };

  const handleSubmit = () => {
    try {
      const rules = parseRulesJson(form.rulesJson);
      const data = {
        key: form.key,
        description: form.description || undefined,
        enabled: form.enabled,
        rules,
      };

      if (editingFlag) {
        updateMutation.mutate({ id: editingFlag.id, data });
      } else {
        createMutation.mutate(data);
      }
    } catch {
      toast.error(t('invalidJson'));
    }
  };

  const isDialogOpen = showCreate || !!editingFlag;
  const isPending = createMutation.isPending || updateMutation.isPending;

  return (
    <>
      <PageHeader
        title={t('title')}
        description={t('description')}
        icon={ToggleRight}
        color="indigo"
        actions={
          <Button onClick={openCreate}>
            <Plus className="mr-2 h-4 w-4" />
            {t('create')}
          </Button>
        }
      />

      <div className="mt-6">
        {isLoading ? (
          <CardSkeleton />
        ) : !flags?.length ? (
          <EmptyState title={t('noFlags')} description={t('noFlagsDesc')} />
        ) : (
          <Card>
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>{t('key')}</TableHead>
                    <TableHead>{t('descriptionCol')}</TableHead>
                    <TableHead>{t('status')}</TableHead>
                    <TableHead>{t('rules')}</TableHead>
                    <TableHead className="text-right">{t('actions')}</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {flags.map((flag) => (
                    <TableRow key={flag.id}>
                      <TableCell className="font-mono text-sm">{flag.key}</TableCell>
                      <TableCell className="text-muted-foreground text-sm max-w-[200px] truncate">
                        {flag.description || '—'}
                      </TableCell>
                      <TableCell>
                        <Switch
                          checked={flag.enabled}
                          onCheckedChange={(checked) =>
                            toggleMutation.mutate({ id: flag.id, enabled: checked })
                          }
                        />
                      </TableCell>
                      <TableCell>
                        {flag.rules ? (
                          <Badge variant="secondary" className="text-xs">
                            {formatRules(flag.rules)}
                          </Badge>
                        ) : (
                          <span className="text-muted-foreground text-xs">
                            {t('globalRollout')}
                          </span>
                        )}
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex justify-end gap-1">
                          <Button variant="ghost" size="sm" onClick={() => openEdit(flag)}>
                            <Pencil className="h-3.5 w-3.5" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => cacheMutation.mutate(flag.id)}
                            disabled={cacheMutation.isPending}
                          >
                            {cacheMutation.isPending ? (
                              <Loader2 className="h-3.5 w-3.5 animate-spin" />
                            ) : (
                              <RefreshCw className="h-3.5 w-3.5" />
                            )}
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            className="text-destructive hover:text-destructive"
                            onClick={() => setDeleteId(flag.id)}
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        )}
      </div>

      {/* Create / Edit Dialog */}
      <Dialog
        open={isDialogOpen}
        onOpenChange={(open) => {
          if (!open) {
            setShowCreate(false);
            setEditingFlag(null);
            setForm(EMPTY_FORM);
          }
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {editingFlag ? t('editDialog.title') : t('createDialog.title')}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label>{t('createDialog.keyLabel')}</Label>
              <Input
                value={form.key}
                onChange={(e) => setForm((f) => ({ ...f, key: e.target.value }))}
                placeholder={t('createDialog.keyPlaceholder')}
                disabled={!!editingFlag}
              />
            </div>
            <div className="space-y-2">
              <Label>{t('createDialog.descriptionLabel')}</Label>
              <Input
                value={form.description}
                onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
                placeholder={t('createDialog.descriptionPlaceholder')}
              />
            </div>
            <div className="flex items-center gap-2">
              <Switch
                checked={form.enabled}
                onCheckedChange={(checked) => setForm((f) => ({ ...f, enabled: checked }))}
              />
              <Label>{t('createDialog.enabledLabel')}</Label>
            </div>
            <div className="space-y-2">
              <Label>{t('createDialog.rulesLabel')}</Label>
              <Textarea
                value={form.rulesJson}
                onChange={(e) => setForm((f) => ({ ...f, rulesJson: e.target.value }))}
                placeholder='{"roles": ["ADMIN"], "percentage": 50}'
                className="font-mono text-sm"
                rows={4}
              />
              <p className="text-xs text-muted-foreground">{t('createDialog.rulesHint')}</p>
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setShowCreate(false);
                setEditingFlag(null);
              }}
            >
              {t('cancel')}
            </Button>
            <Button onClick={handleSubmit} disabled={!form.key.trim() || isPending}>
              {isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {editingFlag ? t('save') : t('create')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <Dialog open={!!deleteId} onOpenChange={(open) => !open && setDeleteId(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t('deleteConfirm')}</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">{t('deleteConfirmDesc')}</p>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteId(null)}>
              {t('cancel')}
            </Button>
            <Button
              variant="destructive"
              onClick={() => deleteId && deleteMutation.mutate(deleteId)}
              disabled={deleteMutation.isPending}
            >
              {deleteMutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {t('delete')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
