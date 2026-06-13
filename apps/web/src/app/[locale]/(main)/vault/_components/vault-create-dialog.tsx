'use client';

import { useState, useEffect, useCallback } from 'react';
import { useTranslations } from 'next-intl';
import { Lock, Eye, EyeOff, RefreshCw, X, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { toast } from 'sonner';
import { MAX_VAULT_TAGS } from '@study-abroad/shared';
import { apiClient as api } from '@/lib/api';
import type { VaultItemType, VaultItemDetail, CredentialData, ApiResponse } from './vault-types';
import { typeIcons, typeColors, VAULT_ITEM_TYPES } from './vault-constants';

interface VaultCreateDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  editingItem: VaultItemDetail | null;
  onSaved: () => void;
}

function parseCredentialData(data: string): CredentialData {
  try {
    return JSON.parse(data);
  } catch {
    return { notes: data };
  }
}

export function VaultCreateDialog({
  open,
  onOpenChange,
  editingItem,
  onSaved,
}: VaultCreateDialogProps) {
  const t = useTranslations('vault');

  // All form state is internal
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

  // Populate form when editingItem changes
  useEffect(() => {
    if (!open) return;

    if (editingItem) {
      setFormType(editingItem.type);
      setFormTitle(editingItem.title);
      setFormCategory(editingItem.category || '');
      setFormTags(editingItem.tags);

      if (editingItem.type === 'CREDENTIAL') {
        const credData = parseCredentialData(editingItem.data);
        setFormUsername(credData.username || '');
        setFormPassword(credData.password || '');
        setFormWebsite(credData.website || '');
        setFormNotes(credData.notes || '');
      } else {
        setFormData(editingItem.data);
      }
    } else {
      // Reset for create mode
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
    }
  }, [open, editingItem]);

  const handleTagInput = useCallback(
    (e: React.KeyboardEvent<HTMLInputElement>) => {
      if (e.key === 'Enter' && formTagInput.trim()) {
        e.preventDefault();
        if (formTags.length >= MAX_VAULT_TAGS) {
          toast.error(t('tooManyTags', { max: MAX_VAULT_TAGS }));
          return;
        }
        if (!formTags.includes(formTagInput.trim())) {
          setFormTags((prev) => [...prev, formTagInput.trim()]);
        }
        setFormTagInput('');
      }
    },
    [formTagInput, formTags, t]
  );

  const removeTag = useCallback((tag: string) => {
    setFormTags((prev) => prev.filter((t) => t !== tag));
  }, []);

  const generatePassword = useCallback(async () => {
    try {
      const res = await api.get<ApiResponse<{ password: string }>>(
        '/vaults/generate-password?length=16'
      );
      if (res.success) {
        setFormPassword(res.data.password);
      }
    } catch {
      const chars = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789!@#$%^&*';
      let pass = '';
      for (let i = 0; i < 16; i++) {
        pass += chars.charAt(Math.floor(Math.random() * chars.length));
      }
      setFormPassword(pass);
    }
  }, []);

  const handleSave = useCallback(async () => {
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

      onOpenChange(false);
      onSaved();
    } catch {
      toast.error(t('saveError'));
    } finally {
      setSubmitting(false);
    }
  }, [
    formTitle,
    formData,
    formType,
    formUsername,
    formPassword,
    formWebsite,
    formNotes,
    formCategory,
    formTags,
    editingItem,
    onOpenChange,
    onSaved,
    t,
  ]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg bg-card border-border text-foreground">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Lock className="h-5 w-5 text-emerald-500 dark:text-emerald-400" />
            {editingItem ? t('editTitle') : t('createTitle')}
          </DialogTitle>
        </DialogHeader>
        <div className="space-y-4 mt-4">
          {/* Type Selection */}
          {!editingItem && (
            <div className="grid grid-cols-4 gap-2">
              {VAULT_ITEM_TYPES.map((type) => (
                <Button
                  key={type}
                  variant={formType === type ? 'default' : 'outline'}
                  className={`flex flex-col items-center gap-1 h-auto py-3 ${
                    formType === type
                      ? `bg-gradient-to-r ${typeColors[type]} border-0 text-white`
                      : 'border-border text-muted-foreground hover:bg-muted'
                  }`}
                  onClick={() => setFormType(type)}
                >
                  {typeIcons[type]}
                  <span className="text-xs">{t(type.toLowerCase())}</span>
                </Button>
              ))}
            </div>
          )}

          {/* Title */}
          <div>
            <label className="text-sm font-medium text-muted-foreground">{t('itemTitle')}</label>
            <Input
              value={formTitle}
              onChange={(e) => setFormTitle(e.target.value)}
              placeholder={t('itemTitlePlaceholder')}
              className="mt-1 bg-muted border-border text-foreground"
            />
          </div>

          {/* Category */}
          <div>
            <label className="text-sm font-medium text-muted-foreground">{t('itemCategory')}</label>
            <Input
              value={formCategory}
              onChange={(e) => setFormCategory(e.target.value)}
              placeholder={t('itemCategoryPlaceholder')}
              className="mt-1 bg-muted border-border text-foreground"
            />
          </div>

          {/* Tags */}
          <div>
            <label className="text-sm font-medium text-muted-foreground">{t('itemTags')}</label>
            <div className="flex flex-wrap gap-2 mt-2">
              {formTags.map((tag) => (
                <Badge key={tag} variant="secondary" className="bg-muted pl-2 pr-1 py-1">
                  {tag}
                  <button onClick={() => removeTag(tag)} className="ml-1 hover:text-destructive">
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
              className="mt-2 bg-muted border-border text-foreground"
            />
          </div>

          {/* Type-specific content */}
          {formType === 'CREDENTIAL' ? (
            <>
              <div>
                <label className="text-sm font-medium text-muted-foreground">{t('website')}</label>
                <Input
                  value={formWebsite}
                  onChange={(e) => setFormWebsite(e.target.value)}
                  placeholder={t('websitePlaceholder')}
                  className="mt-1 bg-muted border-border text-foreground"
                />
              </div>
              <div>
                <label className="text-sm font-medium text-muted-foreground">{t('username')}</label>
                <Input
                  value={formUsername}
                  onChange={(e) => setFormUsername(e.target.value)}
                  placeholder={t('usernamePlaceholder')}
                  className="mt-1 bg-muted border-border text-foreground"
                />
              </div>
              <div>
                <label className="text-sm font-medium text-muted-foreground">{t('password')}</label>
                <div className="flex gap-2 mt-1">
                  <div className="relative flex-1">
                    <Input
                      type={showPassword ? 'text' : 'password'}
                      value={formPassword}
                      onChange={(e) => setFormPassword(e.target.value)}
                      placeholder={t('passwordPlaceholder')}
                      className="bg-muted border-border text-foreground pr-10"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword((prev) => !prev)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                    >
                      {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </button>
                  </div>
                  <Button
                    type="button"
                    variant="outline"
                    onClick={generatePassword}
                    className="border-border text-muted-foreground hover:bg-muted"
                  >
                    <RefreshCw className="h-4 w-4" />
                  </Button>
                </div>
              </div>
              <div>
                <label className="text-sm font-medium text-muted-foreground">{t('notes')}</label>
                <Textarea
                  value={formNotes}
                  onChange={(e) => setFormNotes(e.target.value)}
                  placeholder={t('notesPlaceholder')}
                  className="mt-1 bg-muted border-border text-foreground min-h-[80px]"
                />
              </div>
            </>
          ) : (
            <div>
              <label className="text-sm font-medium text-muted-foreground">{t('itemData')}</label>
              <Textarea
                value={formData}
                onChange={(e) => setFormData(e.target.value)}
                placeholder={t('itemDataPlaceholder')}
                className="mt-1 bg-muted border-border text-foreground min-h-[150px]"
              />
            </div>
          )}

          <DialogFooter className="gap-2">
            <Button
              variant="outline"
              onClick={() => onOpenChange(false)}
              className="border-border text-muted-foreground"
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
  );
}
