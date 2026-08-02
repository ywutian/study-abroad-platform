'use client';

import { useState, useEffect, useCallback } from 'react';
import { useTranslations } from 'next-intl';
import { Shield, Plus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { PageHeader, PageContainer } from '@/components/layout';
import { toast } from 'sonner';
import { apiClient as api } from '@/lib/api';
import { vaultRoutes } from '@study-abroad/shared';

import type {
  VaultItem,
  VaultItemDetail,
  VaultStats as VaultStatsType,
} from './_components/vault-types';
import { VaultStats } from './_components/vault-stats';
import { VaultSidebar } from './_components/vault-sidebar';
import { VaultItemsGrid } from './_components/vault-items-grid';
import { VaultCreateDialog } from './_components/vault-create-dialog';
import { VaultViewDialog } from './_components/vault-view-dialog';
import { VaultDeleteDialog } from './_components/vault-delete-dialog';

export default function VaultPage() {
  const t = useTranslations('vault');

  // Data state
  const [items, setItems] = useState<VaultItem[]>([]);
  const [stats, setStats] = useState<VaultStatsType | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);
  const [selectedType, setSelectedType] = useState<'ALL' | VaultItem['type']>('ALL');
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');

  // Dialog states
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [showViewDialog, setShowViewDialog] = useState<VaultItemDetail | null>(null);
  const [showDeleteDialog, setShowDeleteDialog] = useState<string | null>(null);
  const [editingItem, setEditingItem] = useState<VaultItemDetail | null>(null);

  // Fetch items and stats
  const fetchData = useCallback(async () => {
    setLoading(true);
    setLoadError(false);
    try {
      const params = new URLSearchParams();
      if (selectedType !== 'ALL') params.append('type', selectedType);
      if (selectedCategory) params.append('category', selectedCategory);
      if (searchQuery) params.append('search', searchQuery);

      const [itemsRes, statsRes] = await Promise.all([
        api.get<VaultItem[]>(`${vaultRoutes.list()}?${params.toString()}`),
        api.get<VaultStatsType>(vaultRoutes.stats()),
      ]);

      setItems(itemsRes);
      setStats(statsRes);
    } catch (_error) {
      setItems([]);
      setStats(null);
      setLoadError(true);
    } finally {
      setLoading(false);
    }
  }, [selectedType, selectedCategory, searchQuery]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // View item detail
  const viewItem = async (itemId: string) => {
    try {
      const res = await api.get<VaultItemDetail>(vaultRoutes.byId(itemId));
      setShowViewDialog(res);
    } catch (_error) {
      toast.error(t('loadError'));
    }
  };

  // Delete item
  const handleDelete = async (itemId: string) => {
    try {
      await api.delete(vaultRoutes.byId(itemId));
      setShowDeleteDialog(null);
      setShowViewDialog(null);
      fetchData();
    } catch (_error) {
      toast.error(t('deleteError'));
    }
  };

  // Open edit dialog from view dialog
  const openEditDialog = (item: VaultItemDetail) => {
    setEditingItem(item);
    setShowViewDialog(null);
    setShowCreateDialog(true);
  };

  return (
    <>
      <PageHeader
        title={t('title')}
        description={t('subtitle')}
        icon={Shield}
        color="emerald"
        actions={
          <Button
            onClick={() => setShowCreateDialog(true)}
            className="bg-success hover:bg-success/90"
          >
            <Plus className="h-4 w-4 mr-2" />
            {t('addItem')}
          </Button>
        }
      />

      <PageContainer maxWidth="7xl">
        {loadError && (
          <div className="mb-6 flex items-center justify-between rounded-lg border border-destructive/30 bg-destructive/5 p-4 text-sm">
            <span>{t('loadError')}</span>
            <Button variant="outline" size="sm" onClick={fetchData}>
              {t('retry')}
            </Button>
          </div>
        )}
        {/* Stats Cards */}
        {stats && <VaultStats stats={stats} />}

        <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
          {/* Sidebar */}
          <VaultSidebar
            selectedType={selectedType}
            selectedCategory={selectedCategory}
            stats={stats}
            onTypeChange={setSelectedType}
            onCategoryChange={setSelectedCategory}
          />

          {/* Main Content */}
          <VaultItemsGrid
            items={items}
            loading={loading}
            searchQuery={searchQuery}
            onSearchChange={setSearchQuery}
            onViewItem={viewItem}
          />
        </div>
      </PageContainer>

      {/* Create/Edit Dialog — self-contained, manages own form state */}
      <VaultCreateDialog
        open={showCreateDialog}
        onOpenChange={(open) => {
          setShowCreateDialog(open);
          if (!open) setEditingItem(null);
        }}
        editingItem={editingItem}
        onSaved={fetchData}
      />

      {/* View Dialog */}
      <VaultViewDialog
        item={showViewDialog}
        onClose={() => setShowViewDialog(null)}
        onEdit={openEditDialog}
        onDelete={(id) => setShowDeleteDialog(id)}
      />

      {/* Delete Confirmation */}
      <VaultDeleteDialog
        itemId={showDeleteDialog}
        onClose={() => setShowDeleteDialog(null)}
        onConfirm={handleDelete}
      />
    </>
  );
}
