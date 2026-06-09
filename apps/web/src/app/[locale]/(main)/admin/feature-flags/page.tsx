'use client';

import { useState } from 'react';
import { useTranslations } from 'next-intl';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
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
import { PageHeader } from '@/components/layout';
import { CardSkeleton } from '@/components/ui/loading-state';
import { EmptyState } from '@/components/ui/empty-state';
import { apiClient } from '@/lib/api';
import { adminFeatureFlagRoutes } from '@study-abroad/shared/constants';
import { toast } from 'sonner';
import { ToggleRight, Plus, Pencil, Trash2, RefreshCw, Loader2 } from 'lucide-react';

import { FlagFormDialog } from './_components/flag-form-dialog';
import { type FeatureFlag } from './_components/feature-flag-types';

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
  const [showFormDialog, setShowFormDialog] = useState(false);
  const [editingFlag, setEditingFlag] = useState<FeatureFlag | null>(null);
  const [deleteId, setDeleteId] = useState<string | null>(null);

  const { data: flags, isLoading } = useQuery({
    queryKey: ['adminFeatureFlags'],
    queryFn: () => apiClient.get<FeatureFlag[]>(adminFeatureFlagRoutes.list()),
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
    // @cache-invalidation-allowed: clears the server-side Redis flag cache (toast only); the flag's key/enabled/rules/description shown in the adminFeatureFlags table are unchanged
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
    setEditingFlag(null);
    setShowFormDialog(true);
  };

  const openEdit = (flag: FeatureFlag) => {
    setEditingFlag(flag);
    setShowFormDialog(true);
  };

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

      <FlagFormDialog
        open={showFormDialog}
        onOpenChange={(open) => {
          setShowFormDialog(open);
          if (!open) setEditingFlag(null);
        }}
        editingFlag={editingFlag}
        onSaved={() => queryClient.invalidateQueries({ queryKey: ['adminFeatureFlags'] })}
      />

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
