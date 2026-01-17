'use client';

import { useState, useEffect, useCallback } from 'react';
import { useTranslations, useFormatter } from 'next-intl';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Lock,
  Key,
  FileText,
  StickyNote,
  Award,
  Plus,
  Search,
  Eye,
  EyeOff,
  Copy,
  Edit,
  Trash2,
  Shield,
  RefreshCw,
  X,
  Tag,
  Folder,
  ChevronRight,
  Loader2,
  Check,
  AlertTriangle,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
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
import { Badge } from '@/components/ui/badge';
import { apiClient as api } from '@/lib/api';

// API 响应类型
interface ApiResponse<T> {
  success: boolean;
  data: T;
  message?: string;
}

type VaultItemType = 'CREDENTIAL' | 'DOCUMENT' | 'NOTE' | 'CERTIFICATE';

interface VaultItem {
  id: string;
  type: VaultItemType;
  title: string;
  category?: string;
  tags: string[];
  icon?: string;
  createdAt: string;
  updatedAt: string;
}

interface VaultItemDetail extends VaultItem {
  data: string;
}

interface VaultStats {
  totalItems: number;
  credentialCount: number;
  documentCount: number;
  noteCount: number;
  certificateCount: number;
  categories: string[];
}

// Credential data structure
interface CredentialData {
  username?: string;
  password?: string;
  website?: string;
  notes?: string;
}

const typeIcons: Record<VaultItemType, React.ReactNode> = {
  CREDENTIAL: <Key className="h-5 w-5" />,
  DOCUMENT: <FileText className="h-5 w-5" />,
  NOTE: <StickyNote className="h-5 w-5" />,
  CERTIFICATE: <Award className="h-5 w-5" />,
};

const typeColors: Record<VaultItemType, string> = {
  CREDENTIAL: 'from-amber-500 to-orange-600',
  DOCUMENT: 'from-blue-500 to-cyan-600',
  NOTE: 'from-emerald-500 to-green-600',
  CERTIFICATE: 'from-primary to-primary',
};

const typeBgColors: Record<VaultItemType, string> = {
  CREDENTIAL: 'bg-amber-100 text-amber-700',
  DOCUMENT: 'bg-blue-100 text-blue-700',
  NOTE: 'bg-emerald-100 text-emerald-700',
  CERTIFICATE: 'bg-violet-100 text-violet-700',
};

export default function VaultPage() {
  const t = useTranslations('vault');
  const format = useFormatter();

  const [items, setItems] = useState<VaultItem[]>([]);
  const [stats, setStats] = useState<VaultStats | null>(null);
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
  const [, setLoadingItem] = useState(false);
  const [copied, setCopied] = useState(false);

  // Fetch items and stats
  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (selectedType !== 'ALL') params.append('type', selectedType);
      if (selectedCategory) params.append('category', selectedCategory);
      if (searchQuery) params.append('search', searchQuery);

      const [itemsRes, statsRes] = await Promise.all([
        api.get<ApiResponse<VaultItem[]>>(`/vault?${params.toString()}`),
        api.get<ApiResponse<VaultStats>>('/vault/stats'),
      ]);

      if (itemsRes.success) {
        setItems(itemsRes.data);
      }
      if (statsRes.success) {
        setStats(statsRes.data);
      }
    } catch (error) {
      console.error('Failed to fetch vault data:', error);
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
  }, [selectedType, selectedCategory, searchQuery]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // View item detail
  const viewItem = async (itemId: string) => {
    setLoadingItem(true);
    try {
      const res = await api.get<ApiResponse<VaultItemDetail>>(`/vault/${itemId}`);
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
    } finally {
      setLoadingItem(false);
    }
  };

  // Parse credential data
  const parseCredentialData = (data: string): CredentialData => {
    try {
      return JSON.parse(data);
    } catch {
      return { notes: data };
    }
  };

  // Create/Update item
  const handleSave = async () => {
    if (!formTitle.trim()) return;

    setSubmitting(true);
    try {
      let dataToSave = formData;

      // For credentials, structure the data
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
        await api.put(`/vault/${editingItem.id}`, payload);
      } else {
        await api.post('/vault', payload);
      }

      setShowCreateDialog(false);
      resetForm();
      fetchData();
    } catch (error) {
      console.error('Failed to save item:', error);
    } finally {
      setSubmitting(false);
    }
  };

  // Delete item
  const handleDelete = async (itemId: string) => {
    try {
      await api.delete(`/vault/${itemId}`);
      setShowDeleteDialog(null);
      setShowViewDialog(null);
      fetchData();
    } catch (error) {
      console.error('Failed to delete item:', error);
    }
  };

  // Generate password
  const generatePassword = async () => {
    try {
      const res = await api.get<ApiResponse<{ password: string }>>(
        '/vault/generate-password?length=16'
      );
      if (res.success) {
        setFormPassword(res.data.password);
      }
    } catch (_error) {
      // Generate locally
      const chars = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789!@#$%^&*';
      let pass = '';
      for (let i = 0; i < 16; i++) {
        pass += chars.charAt(Math.floor(Math.random() * chars.length));
      }
      setFormPassword(pass);
    }
  };

  // Copy to clipboard
  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
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

  const formatDate = (dateStr: string) => {
    return format.dateTime(new Date(dateStr), 'medium');
  };

  return (
    <div className="min-h-screen bg-slate-900">
      {/* Hero Header */}
      <div className="relative overflow-hidden">
        <div className="absolute inset-0 bg-[url('data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNjAiIGhlaWdodD0iNjAiIHZpZXdCb3g9IjAgMCA2MCA2MCIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48ZyBmaWxsPSJub25lIiBmaWxsLXJ1bGU9ImV2ZW5vZGQiPjxnIGZpbGw9IiNmZmYiIGZpbGwtb3BhY2l0eT0iMC4wMyI+PGNpcmNsZSBjeD0iMzAiIGN5PSIzMCIgcj0iMiIvPjwvZz48L2c+PC9zdmc+')] opacity-50" />
        <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="text-center"
          >
            <div className="inline-flex items-center gap-2 px-4 py-2 bg-emerald-500/20 backdrop-blur-sm rounded-full mb-4 border border-emerald-500/30">
              <Lock className="h-5 w-5 text-emerald-400" />
              <span className="text-emerald-300 font-medium">{t('title')}</span>
            </div>
            <h1 className="text-title-lg text-white mb-4">{t('description')}</h1>
            <p className="text-slate-400">{t('subtitle')}</p>

            {/* Security badges */}
            <div className="flex items-center justify-center gap-4 mt-6">
              <div className="flex items-center gap-2 px-3 py-1.5 bg-slate-800/50 rounded-full text-sm">
                <Shield className="h-4 w-4 text-emerald-400" />
                <span className="text-slate-300">{t('security.encryption')}</span>
              </div>
              <div className="flex items-center gap-2 px-3 py-1.5 bg-slate-800/50 rounded-full text-sm">
                <Lock className="h-4 w-4 text-emerald-400" />
                <span className="text-slate-300">{t('security.zeroKnowledge')}</span>
              </div>
            </div>

            <Button
              onClick={() => setShowCreateDialog(true)}
              className="mt-8 bg-success hover:bg-success/90"
            >
              <Plus className="h-4 w-4 mr-2" />
              {t('addItem')}
            </Button>
          </motion.div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Stats Cards */}
        {stats && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="grid grid-cols-2 md:grid-cols-5 gap-4 mb-8"
          >
            <Card className="bg-slate-800/50 border-slate-700 backdrop-blur-sm">
              <CardContent className="p-4 text-center">
                <div className="text-3xl font-bold text-white">{stats.totalItems}</div>
                <div className="text-slate-400 text-sm">{t('stats.total')}</div>
              </CardContent>
            </Card>
            <Card className="bg-slate-800/50 border-slate-700 backdrop-blur-sm">
              <CardContent className="p-4 text-center">
                <div className="text-3xl font-bold text-amber-400">{stats.credentialCount}</div>
                <div className="text-slate-400 text-sm">{t('stats.credentials')}</div>
              </CardContent>
            </Card>
            <Card className="bg-slate-800/50 border-slate-700 backdrop-blur-sm">
              <CardContent className="p-4 text-center">
                <div className="text-3xl font-bold text-blue-400">{stats.documentCount}</div>
                <div className="text-slate-400 text-sm">{t('stats.documents')}</div>
              </CardContent>
            </Card>
            <Card className="bg-slate-800/50 border-slate-700 backdrop-blur-sm">
              <CardContent className="p-4 text-center">
                <div className="text-3xl font-bold text-emerald-400">{stats.noteCount}</div>
                <div className="text-slate-400 text-sm">{t('stats.notes')}</div>
              </CardContent>
            </Card>
            <Card className="bg-slate-800/50 border-slate-700 backdrop-blur-sm">
              <CardContent className="p-4 text-center">
                <div className="text-3xl font-bold text-violet-400">{stats.certificateCount}</div>
                <div className="text-slate-400 text-sm">{t('stats.certificates')}</div>
              </CardContent>
            </Card>
          </motion.div>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
          {/* Sidebar */}
          <div className="space-y-6">
            {/* Type Filter */}
            <Card className="bg-slate-800/50 border-slate-700 backdrop-blur-sm">
              <CardHeader className="pb-3">
                <CardTitle className="text-white text-lg flex items-center gap-2">
                  <Folder className="h-5 w-5 text-emerald-400" />
                  {t('categories')}
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                <Button
                  variant={selectedType === 'ALL' ? 'default' : 'ghost'}
                  className={`w-full justify-start ${selectedType === 'ALL' ? 'bg-emerald-500' : 'text-slate-300 hover:bg-slate-700'}`}
                  onClick={() => setSelectedType('ALL')}
                >
                  {t('allItems')}
                </Button>
                {(['CREDENTIAL', 'DOCUMENT', 'NOTE', 'CERTIFICATE'] as VaultItemType[]).map(
                  (type) => (
                    <Button
                      key={type}
                      variant={selectedType === type ? 'default' : 'ghost'}
                      className={`w-full justify-start gap-2 ${
                        selectedType === type
                          ? `bg-gradient-to-r ${typeColors[type]}`
                          : 'text-slate-300 hover:bg-slate-700'
                      }`}
                      onClick={() => setSelectedType(type)}
                    >
                      {typeIcons[type]}
                      {t(type.toLowerCase())}
                    </Button>
                  )
                )}
              </CardContent>
            </Card>

            {/* Categories */}
            {stats && stats.categories.length > 0 && (
              <Card className="bg-slate-800/50 border-slate-700 backdrop-blur-sm">
                <CardHeader className="pb-3">
                  <CardTitle className="text-white text-lg flex items-center gap-2">
                    <Tag className="h-5 w-5 text-emerald-400" />
                    {t('categories')}
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-2">
                  <Button
                    variant={selectedCategory === null ? 'default' : 'ghost'}
                    className={`w-full justify-start ${selectedCategory === null ? 'bg-emerald-500' : 'text-slate-300 hover:bg-slate-700'}`}
                    onClick={() => setSelectedCategory(null)}
                  >
                    {t('allCategories')}
                  </Button>
                  {stats.categories.map((cat) => (
                    <Button
                      key={cat}
                      variant={selectedCategory === cat ? 'default' : 'ghost'}
                      className={`w-full justify-start ${selectedCategory === cat ? 'bg-slate-600' : 'text-slate-300 hover:bg-slate-700'}`}
                      onClick={() => setSelectedCategory(cat)}
                    >
                      {cat}
                    </Button>
                  ))}
                </CardContent>
              </Card>
            )}
          </div>

          {/* Main Content */}
          <div className="lg:col-span-3 space-y-6">
            {/* Search */}
            <Card className="bg-slate-800/50 border-slate-700 backdrop-blur-sm">
              <CardContent className="py-4">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                  <Input
                    placeholder={t('search')}
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="pl-10 bg-slate-900/50 border-slate-600 text-white placeholder:text-slate-500"
                  />
                </div>
              </CardContent>
            </Card>

            {/* Items Grid */}
            <AnimatePresence mode="popLayout">
              {loading ? (
                <div className="flex justify-center py-12">
                  <Loader2 className="h-8 w-8 animate-spin text-emerald-500" />
                </div>
              ) : items.length === 0 ? (
                <Card className="bg-slate-800/50 border-slate-700 backdrop-blur-sm">
                  <CardContent className="py-12 text-center">
                    <Lock className="h-12 w-12 mx-auto text-slate-600 mb-4" />
                    <h3 className="text-lg font-medium text-slate-300">{t('noItems')}</h3>
                    <p className="text-slate-500 mt-1">{t('noItemsDesc')}</p>
                  </CardContent>
                </Card>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {items.map((item, index) => (
                    <motion.div
                      key={item.id}
                      initial={{ opacity: 0, y: 20 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: -20 }}
                      transition={{ delay: index * 0.05 }}
                    >
                      <Card
                        className="bg-slate-800/50 border-slate-700 backdrop-blur-sm hover:bg-slate-800/70 transition-all cursor-pointer group"
                        onClick={() => viewItem(item.id)}
                      >
                        <CardContent className="p-5">
                          <div className="flex items-start gap-4">
                            <div
                              className={`p-3 rounded-xl bg-gradient-to-br ${typeColors[item.type]}`}
                            >
                              {typeIcons[item.type]}
                            </div>
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2 mb-1">
                                <Badge className={typeBgColors[item.type]}>
                                  {t(item.type.toLowerCase())}
                                </Badge>
                                {item.category && (
                                  <Badge
                                    variant="outline"
                                    className="border-slate-600 text-slate-400"
                                  >
                                    {item.category}
                                  </Badge>
                                )}
                              </div>
                              <h3 className="font-semibold text-white group-hover:text-emerald-400 transition-colors truncate">
                                {item.title}
                              </h3>
                              <div className="flex items-center gap-2 mt-2">
                                {item.tags.slice(0, 2).map((tag) => (
                                  <Badge
                                    key={tag}
                                    variant="secondary"
                                    className="bg-slate-700 text-slate-300 text-xs"
                                  >
                                    {tag}
                                  </Badge>
                                ))}
                                {item.tags.length > 2 && (
                                  <span className="text-xs text-slate-500">
                                    +{item.tags.length - 2}
                                  </span>
                                )}
                              </div>
                              <div className="text-xs text-slate-500 mt-2">
                                {formatDate(item.updatedAt)}
                              </div>
                            </div>
                            <ChevronRight className="h-5 w-5 text-slate-600 group-hover:text-emerald-400 transition-colors" />
                          </div>
                        </CardContent>
                      </Card>
                    </motion.div>
                  ))}
                </div>
              )}
            </AnimatePresence>
          </div>
        </div>
      </div>

      {/* Create/Edit Dialog */}
      <Dialog
        open={showCreateDialog}
        onOpenChange={(open) => {
          if (!open) {
            setShowCreateDialog(false);
            resetForm();
          }
        }}
      >
        <DialogContent className="max-w-lg bg-slate-800 border-slate-700 text-white">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Lock className="h-5 w-5 text-emerald-400" />
              {editingItem ? t('editTitle') : t('createTitle')}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 mt-4">
            {/* Type Selection */}
            {!editingItem && (
              <div className="grid grid-cols-4 gap-2">
                {(['CREDENTIAL', 'DOCUMENT', 'NOTE', 'CERTIFICATE'] as VaultItemType[]).map(
                  (type) => (
                    <Button
                      key={type}
                      variant={formType === type ? 'default' : 'outline'}
                      className={`flex flex-col items-center gap-1 h-auto py-3 ${
                        formType === type
                          ? `bg-gradient-to-r ${typeColors[type]} border-0`
                          : 'border-slate-600 text-slate-300 hover:bg-slate-700'
                      }`}
                      onClick={() => setFormType(type)}
                    >
                      {typeIcons[type]}
                      <span className="text-xs">{t(type.toLowerCase())}</span>
                    </Button>
                  )
                )}
              </div>
            )}

            {/* Title */}
            <div>
              <label className="text-sm font-medium text-slate-300">{t('itemTitle')}</label>
              <Input
                value={formTitle}
                onChange={(e) => setFormTitle(e.target.value)}
                placeholder={t('itemTitlePlaceholder')}
                className="mt-1 bg-slate-900/50 border-slate-600 text-white"
              />
            </div>

            {/* Category */}
            <div>
              <label className="text-sm font-medium text-slate-300">{t('itemCategory')}</label>
              <Input
                value={formCategory}
                onChange={(e) => setFormCategory(e.target.value)}
                placeholder={t('itemCategoryPlaceholder')}
                className="mt-1 bg-slate-900/50 border-slate-600 text-white"
              />
            </div>

            {/* Tags */}
            <div>
              <label className="text-sm font-medium text-slate-300">{t('itemTags')}</label>
              <div className="flex flex-wrap gap-2 mt-2">
                {formTags.map((tag) => (
                  <Badge key={tag} variant="secondary" className="bg-slate-700 pl-2 pr-1 py-1">
                    {tag}
                    <button onClick={() => removeTag(tag)} className="ml-1 hover:text-red-400">
                      <X className="h-3 w-3" />
                    </button>
                  </Badge>
                ))}
              </div>
              <Input
                value={formTagInput}
                onChange={(e) => setFormTagInput(e.target.value)}
                onKeyDown={handleTagInput}
                placeholder={t('itemTagsPlaceholder')}
                className="mt-2 bg-slate-900/50 border-slate-600 text-white"
              />
            </div>

            {/* Type-specific content */}
            {formType === 'CREDENTIAL' ? (
              <>
                <div>
                  <label className="text-sm font-medium text-slate-300">{t('website')}</label>
                  <Input
                    value={formWebsite}
                    onChange={(e) => setFormWebsite(e.target.value)}
                    placeholder={t('websitePlaceholder')}
                    className="mt-1 bg-slate-900/50 border-slate-600 text-white"
                  />
                </div>
                <div>
                  <label className="text-sm font-medium text-slate-300">{t('username')}</label>
                  <Input
                    value={formUsername}
                    onChange={(e) => setFormUsername(e.target.value)}
                    placeholder={t('usernamePlaceholder')}
                    className="mt-1 bg-slate-900/50 border-slate-600 text-white"
                  />
                </div>
                <div>
                  <label className="text-sm font-medium text-slate-300">{t('password')}</label>
                  <div className="flex gap-2 mt-1">
                    <div className="relative flex-1">
                      <Input
                        type={showPassword ? 'text' : 'password'}
                        value={formPassword}
                        onChange={(e) => setFormPassword(e.target.value)}
                        placeholder={t('passwordPlaceholder')}
                        className="bg-slate-900/50 border-slate-600 text-white pr-10"
                      />
                      <button
                        type="button"
                        onClick={() => setShowPassword(!showPassword)}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-white"
                      >
                        {showPassword ? (
                          <EyeOff className="h-4 w-4" />
                        ) : (
                          <Eye className="h-4 w-4" />
                        )}
                      </button>
                    </div>
                    <Button
                      type="button"
                      variant="outline"
                      onClick={generatePassword}
                      className="border-slate-600 text-slate-300 hover:bg-slate-700"
                    >
                      <RefreshCw className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
                <div>
                  <label className="text-sm font-medium text-slate-300">{t('notes')}</label>
                  <Textarea
                    value={formNotes}
                    onChange={(e) => setFormNotes(e.target.value)}
                    placeholder={t('notesPlaceholder')}
                    className="mt-1 bg-slate-900/50 border-slate-600 text-white min-h-[80px]"
                  />
                </div>
              </>
            ) : (
              <div>
                <label className="text-sm font-medium text-slate-300">{t('itemData')}</label>
                <Textarea
                  value={formData}
                  onChange={(e) => setFormData(e.target.value)}
                  placeholder={t('itemDataPlaceholder')}
                  className="mt-1 bg-slate-900/50 border-slate-600 text-white min-h-[150px]"
                />
              </div>
            )}

            <DialogFooter className="gap-2">
              <Button
                variant="outline"
                onClick={() => {
                  setShowCreateDialog(false);
                  resetForm();
                }}
                className="border-slate-600 text-slate-300"
              >
                {t('cancel')}
              </Button>
              <Button
                onClick={handleSave}
                disabled={submitting || !formTitle.trim()}
                className="bg-success"
              >
                {submitting ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
                {t('save')}
              </Button>
            </DialogFooter>
          </div>
        </DialogContent>
      </Dialog>

      {/* View Dialog */}
      <Dialog open={!!showViewDialog} onOpenChange={() => setShowViewDialog(null)}>
        <DialogContent className="max-w-lg bg-slate-800 border-slate-700 text-white">
          {showViewDialog && (
            <>
              <DialogHeader>
                <div className="flex items-center gap-3">
                  <div
                    className={`p-3 rounded-xl bg-gradient-to-br ${typeColors[showViewDialog.type]}`}
                  >
                    {typeIcons[showViewDialog.type]}
                  </div>
                  <div>
                    <DialogTitle className="text-xl">{showViewDialog.title}</DialogTitle>
                    <div className="flex items-center gap-2 mt-1">
                      <Badge className={typeBgColors[showViewDialog.type]}>
                        {t(showViewDialog.type.toLowerCase())}
                      </Badge>
                      {showViewDialog.category && (
                        <Badge variant="outline" className="border-slate-600 text-slate-400">
                          {showViewDialog.category}
                        </Badge>
                      )}
                    </div>
                  </div>
                </div>
              </DialogHeader>

              <div className="space-y-4 mt-4">
                {showViewDialog.type === 'CREDENTIAL' ? (
                  <>
                    {(() => {
                      const cred = parseCredentialData(showViewDialog.data);
                      return (
                        <>
                          {cred.website && (
                            <div className="bg-slate-900/50 rounded-lg p-3">
                              <label className="text-xs text-slate-500">{t('website')}</label>
                              <div className="flex items-center justify-between mt-1">
                                <a
                                  href={cred.website}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="text-emerald-400 hover:underline"
                                >
                                  {cred.website}
                                </a>
                                <Button
                                  size="icon"
                                  variant="ghost"
                                  onClick={() => copyToClipboard(cred.website!)}
                                >
                                  {copied ? (
                                    <Check className="h-4 w-4 text-green-500" />
                                  ) : (
                                    <Copy className="h-4 w-4 text-slate-400" />
                                  )}
                                </Button>
                              </div>
                            </div>
                          )}
                          {cred.username && (
                            <div className="bg-slate-900/50 rounded-lg p-3">
                              <label className="text-xs text-slate-500">{t('username')}</label>
                              <div className="flex items-center justify-between mt-1">
                                <span className="text-white font-mono">{cred.username}</span>
                                <Button
                                  size="icon"
                                  variant="ghost"
                                  onClick={() => copyToClipboard(cred.username!)}
                                >
                                  {copied ? (
                                    <Check className="h-4 w-4 text-green-500" />
                                  ) : (
                                    <Copy className="h-4 w-4 text-slate-400" />
                                  )}
                                </Button>
                              </div>
                            </div>
                          )}
                          {cred.password && (
                            <div className="bg-slate-900/50 rounded-lg p-3">
                              <label className="text-xs text-slate-500">{t('password')}</label>
                              <div className="flex items-center justify-between mt-1">
                                <span className="text-white font-mono">
                                  {showPassword ? cred.password : '••••••••••••'}
                                </span>
                                <div className="flex gap-1">
                                  <Button
                                    size="icon"
                                    variant="ghost"
                                    onClick={() => setShowPassword(!showPassword)}
                                  >
                                    {showPassword ? (
                                      <EyeOff className="h-4 w-4 text-slate-400" />
                                    ) : (
                                      <Eye className="h-4 w-4 text-slate-400" />
                                    )}
                                  </Button>
                                  <Button
                                    size="icon"
                                    variant="ghost"
                                    onClick={() => copyToClipboard(cred.password!)}
                                  >
                                    {copied ? (
                                      <Check className="h-4 w-4 text-green-500" />
                                    ) : (
                                      <Copy className="h-4 w-4 text-slate-400" />
                                    )}
                                  </Button>
                                </div>
                              </div>
                            </div>
                          )}
                          {cred.notes && (
                            <div className="bg-slate-900/50 rounded-lg p-3">
                              <label className="text-xs text-slate-500">{t('notes')}</label>
                              <p className="text-slate-300 mt-1 whitespace-pre-wrap">
                                {cred.notes}
                              </p>
                            </div>
                          )}
                        </>
                      );
                    })()}
                  </>
                ) : (
                  <div className="bg-slate-900/50 rounded-lg p-4">
                    <p className="text-slate-300 whitespace-pre-wrap">{showViewDialog.data}</p>
                  </div>
                )}

                {showViewDialog.tags.length > 0 && (
                  <div className="flex items-center gap-2 flex-wrap">
                    {showViewDialog.tags.map((tag) => (
                      <Badge key={tag} variant="secondary" className="bg-slate-700 text-slate-300">
                        {tag}
                      </Badge>
                    ))}
                  </div>
                )}

                <div className="text-xs text-slate-500">
                  {t('updatedAt', { date: formatDate(showViewDialog.updatedAt) })}
                </div>

                <DialogFooter className="gap-2">
                  <Button
                    variant="outline"
                    onClick={() => setShowDeleteDialog(showViewDialog.id)}
                    className="border-red-500/50 text-red-400 hover:bg-red-500/20"
                  >
                    <Trash2 className="h-4 w-4 mr-2" />
                    {t('delete')}
                  </Button>
                  <Button onClick={() => openEditDialog(showViewDialog)} className="bg-success">
                    <Edit className="h-4 w-4 mr-2" />
                    {t('edit')}
                  </Button>
                </DialogFooter>
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation */}
      <AlertDialog open={!!showDeleteDialog} onOpenChange={() => setShowDeleteDialog(null)}>
        <AlertDialogContent className="bg-slate-800 border-slate-700">
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2 text-white">
              <AlertTriangle className="h-5 w-5 text-red-500" />
              {t('confirmDelete')}
            </AlertDialogTitle>
            <AlertDialogDescription className="text-slate-400">
              {t('deleteConfirm')}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="border-slate-600 text-slate-300 hover:bg-slate-700">
              {t('cancel')}
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={() => showDeleteDialog && handleDelete(showDeleteDialog)}
              className="bg-red-600 hover:bg-red-700"
            >
              {t('delete')}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
