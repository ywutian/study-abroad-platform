'use client';

import { useState, useEffect, useCallback } from 'react';
import { useTranslations } from 'next-intl';
import { Shield, Plus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { PageHeader, PageContainer } from '@/components/layout';
import { toast } from 'sonner';
import { apiClient as api } from '@/lib/api';

import type {
  VaultItem,
  VaultItemDetail,
  VaultStats as VaultStatsType,
  ApiResponse,
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
    try {
      const params = new URLSearchParams();
      if (selectedType !== 'ALL') params.append('type', selectedType);
      if (selectedCategory) params.append('category', selectedCategory);
      if (searchQuery) params.append('search', searchQuery);

      const [itemsRes, statsRes] = await Promise.all([
        api.get<ApiResponse<VaultItem[]>>(`/vaults?${params.toString()}`),
        api.get<ApiResponse<VaultStatsType>>('/vaults/stats'),
      ]);

      if (itemsRes.success) {
        setItems(itemsRes.data);
      }
      if (statsRes.success) {
        setStats(statsRes.data);
      }
    } catch (_error) {
      // Fetch failed — fall back to demo data
      setItems([
        {
          id: '1',
          type: 'CREDENTIAL',
          title: t('demo.commonAppTitle'),
          category: t('demo.applicationCategory'),
          tags: [t('demo.applicationTag'), t('demo.importantTag')],
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        },
        {
          id: '2',
          type: 'DOCUMENT',
          title: t('demo.satTitle'),
          category: t('demo.testScoreCategory'),
          tags: ['SAT', t('demo.standardizedTag')],
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        },
        {
          id: '3',
          type: 'NOTE',
          title: t('demo.schoolNotesTitle'),
          category: t('demo.planningCategory'),
          tags: [t('demo.schoolSelectionTag')],
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        },
      ]);
      setStats({
        totalItems: 3,
        credentialCount: 1,
        documentCount: 1,
        noteCount: 1,
        certificateCount: 0,
        categories: [
          t('demo.applicationCategory'),
          t('demo.testScoreCategory'),
          t('demo.planningCategory'),
        ],
      });
    } finally {
      setLoading(false);
    }
  }, [selectedType, selectedCategory, searchQuery, t]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // View item detail
  const viewItem = async (itemId: string) => {
    try {
      const res = await api.get<ApiResponse<VaultItemDetail>>(`/vaults/${itemId}`);
      if (res.success) {
        setShowViewDialog(res.data);
      }
    } catch (_error) {
      // Demo data
      setShowViewDialog({
        id: itemId,
        type: 'CREDENTIAL',
        title: t('demo.commonAppTitle'),
        category: t('demo.applicationCategory'),
        tags: [t('demo.applicationTag'), t('demo.importantTag')],
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        data: JSON.stringify({
          username: 'student@email.com',
          password: 'SecurePass123!',
          website: 'https://commonapp.org',
          notes: t('demo.mainAccountNote'),
        }),
      });
    }
  };

  // Delete item
  const handleDelete = async (itemId: string) => {
    try {
      await api.delete(`/vaults/${itemId}`);
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
