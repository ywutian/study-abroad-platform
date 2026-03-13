'use client';

import { useState, useEffect, useCallback } from 'react';
import { useTranslations } from 'next-intl';
import { Shield, Plus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { PageHeader, PageContainer } from '@/components/layout';
import { toast } from 'sonner';
import { apiClient as api } from '@/lib/api';

import type {
  VaultItemType,
  VaultItem,
  VaultItemDetail,
  VaultStats as VaultStatsType,
  CredentialData,
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
  const [selectedType, setSelectedType] = useState<VaultItemType | 'ALL'>('ALL');
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');

  // Dialog states
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [showViewDialog, setShowViewDialog] = useState<VaultItemDetail | null>(null);
  const [showDeleteDialog, setShowDeleteDialog] = useState<string | null>(null);
  const [editingItem, setEditingItem] = useState<VaultItemDetail | null>(null);

  // Form states
  const [formType, setFormType] = useState<VaultItemType>('CREDENTIAL');
  const [formTitle, setFormTitle] = useState('');
  const [formCategory, setFormCategory] = useState('');
  const [formTags, setFormTags] = useState<string[]>([]);
  const [formTagInput, setFormTagInput] = useState('');
  const [formData, setFormData] = useState('');

  // Credential specific
  const [formUsername, setFormUsername] = useState('');
  const [formPassword, setFormPassword] = useState('');
  const [formWebsite, setFormWebsite] = useState('');
  const [formNotes, setFormNotes] = useState('');
  const [showPassword, setShowPassword] = useState(false);

  const [submitting, setSubmitting] = useState(false);

  // Parse credential data
  const parseCredentialData = (data: string): CredentialData => {
    try {
      return JSON.parse(data);
    } catch {
      return { notes: data };
    }
  };

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
    } catch (error) {
      // Fetch failed — fall back to demo data
      // Demo data
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

  // Create/Update item
  const handleSave = async () => {
    if (!formTitle.trim()) return;

    setSubmitting(true);
    try {
      let dataToSave = formData;

      if (formType === 'CREDENTIAL') {
        dataToSave = JSON.stringify({
          username: formUsername,
          password: formPassword,
          website: formWebsite,
          notes: formNotes,
        });
      }

      const payload = {
        type: formType,
        title: formTitle,
        data: dataToSave,
        category: formCategory || undefined,
        tags: formTags,
      };

      if (editingItem) {
        await api.put(`/vaults/${editingItem.id}`, payload);
      } else {
        await api.post('/vaults', payload);
      }

      setShowCreateDialog(false);
      resetForm();
      fetchData();
    } catch (error) {
      toast.error(t('saveError'));
    } finally {
      setSubmitting(false);
    }
  };

  // Delete item
  const handleDelete = async (itemId: string) => {
    try {
      await api.delete(`/vaults/${itemId}`);
      setShowDeleteDialog(null);
      setShowViewDialog(null);
      fetchData();
    } catch (error) {
      toast.error(t('deleteError'));
    }
  };

  // Generate password
  const generatePassword = async () => {
    try {
      const res = await api.get<ApiResponse<{ password: string }>>(
        '/vaults/generate-password?length=16'
      );
      if (res.success) {
        setFormPassword(res.data.password);
      }
    } catch (_error) {
      const chars = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789!@#$%^&*';
      let pass = '';
      for (let i = 0; i < 16; i++) {
        pass += chars.charAt(Math.floor(Math.random() * chars.length));
      }
      setFormPassword(pass);
    }
  };

  // Reset form
  const resetForm = () => {
    setFormType('CREDENTIAL');
    setFormTitle('');
    setFormCategory('');
    setFormTags([]);
    setFormTagInput('');
    setFormData('');
    setFormUsername('');
    setFormPassword('');
    setFormWebsite('');
    setFormNotes('');
    setShowPassword(false);
    setEditingItem(null);
  };

  // Open edit dialog
  const openEditDialog = (item: VaultItemDetail) => {
    setEditingItem(item);
    setFormType(item.type);
    setFormTitle(item.title);
    setFormCategory(item.category || '');
    setFormTags(item.tags);

    if (item.type === 'CREDENTIAL') {
      const credData = parseCredentialData(item.data);
      setFormUsername(credData.username || '');
      setFormPassword(credData.password || '');
      setFormWebsite(credData.website || '');
      setFormNotes(credData.notes || '');
    } else {
      setFormData(item.data);
    }

    setShowViewDialog(null);
    setShowCreateDialog(true);
  };

  const handleTagInput = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' && formTagInput.trim()) {
      e.preventDefault();
      if (!formTags.includes(formTagInput.trim())) {
        setFormTags([...formTags, formTagInput.trim()]);
      }
      setFormTagInput('');
    }
  };

  const removeTag = (tag: string) => {
    setFormTags(formTags.filter((t) => t !== tag));
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

      {/* Create/Edit Dialog */}
      <VaultCreateDialog
        open={showCreateDialog}
        onOpenChange={(open) => {
          if (!open) {
            setShowCreateDialog(false);
            resetForm();
          }
        }}
        editingItem={editingItem}
        formType={formType}
        formTitle={formTitle}
        formCategory={formCategory}
        formTags={formTags}
        formTagInput={formTagInput}
        formData={formData}
        formUsername={formUsername}
        formPassword={formPassword}
        formWebsite={formWebsite}
        formNotes={formNotes}
        showPassword={showPassword}
        submitting={submitting}
        onFormTypeChange={setFormType}
        onFormTitleChange={setFormTitle}
        onFormCategoryChange={setFormCategory}
        onFormTagInputChange={setFormTagInput}
        onFormDataChange={setFormData}
        onFormUsernameChange={setFormUsername}
        onFormPasswordChange={setFormPassword}
        onFormWebsiteChange={setFormWebsite}
        onFormNotesChange={setFormNotes}
        onToggleShowPassword={() => setShowPassword(!showPassword)}
        onTagInput={handleTagInput}
        onRemoveTag={removeTag}
        onGeneratePassword={generatePassword}
        onSave={handleSave}
        onCancel={() => {
          setShowCreateDialog(false);
          resetForm();
        }}
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
