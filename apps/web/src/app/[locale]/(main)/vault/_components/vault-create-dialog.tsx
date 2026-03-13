'use client';

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
import type { VaultItemType, VaultItemDetail } from './vault-types';
import { typeIcons, typeColors, VAULT_ITEM_TYPES } from './vault-constants';

interface VaultCreateDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  editingItem: VaultItemDetail | null;
  // Form state
  formType: VaultItemType;
  formTitle: string;
  formCategory: string;
  formTags: string[];
  formTagInput: string;
  formData: string;
  formUsername: string;
  formPassword: string;
  formWebsite: string;
  formNotes: string;
  showPassword: boolean;
  submitting: boolean;
  // Callbacks
  onFormTypeChange: (type: VaultItemType) => void;
  onFormTitleChange: (title: string) => void;
  onFormCategoryChange: (category: string) => void;
  onFormTagInputChange: (input: string) => void;
  onFormDataChange: (data: string) => void;
  onFormUsernameChange: (username: string) => void;
  onFormPasswordChange: (password: string) => void;
  onFormWebsiteChange: (website: string) => void;
  onFormNotesChange: (notes: string) => void;
  onToggleShowPassword: () => void;
  onTagInput: (e: React.KeyboardEvent<HTMLInputElement>) => void;
  onRemoveTag: (tag: string) => void;
  onGeneratePassword: () => void;
  onSave: () => void;
  onCancel: () => void;
}

export function VaultCreateDialog({
  open,
  onOpenChange,
  editingItem,
  formType,
  formTitle,
  formCategory,
  formTags,
  formTagInput,
  formData,
  formUsername,
  formPassword,
  formWebsite,
  formNotes,
  showPassword,
  submitting,
  onFormTypeChange,
  onFormTitleChange,
  onFormCategoryChange,
  onFormTagInputChange,
  onFormDataChange,
  onFormUsernameChange,
  onFormPasswordChange,
  onFormWebsiteChange,
  onFormNotesChange,
  onToggleShowPassword,
  onTagInput,
  onRemoveTag,
  onGeneratePassword,
  onSave,
  onCancel,
}: VaultCreateDialogProps) {
  const t = useTranslations('vault');

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
                  onClick={() => onFormTypeChange(type)}
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
              onChange={(e) => onFormTitleChange(e.target.value)}
              placeholder={t('itemTitlePlaceholder')}
              className="mt-1 bg-muted border-border text-foreground"
            />
          </div>

          {/* Category */}
          <div>
            <label className="text-sm font-medium text-muted-foreground">{t('itemCategory')}</label>
            <Input
              value={formCategory}
              onChange={(e) => onFormCategoryChange(e.target.value)}
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
                  <button onClick={() => onRemoveTag(tag)} className="ml-1 hover:text-destructive">
                    <X className="h-3 w-3" />
                  </button>
                </Badge>
              ))}
            </div>
            <Input
              value={formTagInput}
              onChange={(e) => onFormTagInputChange(e.target.value)}
              onKeyDown={onTagInput}
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
                  onChange={(e) => onFormWebsiteChange(e.target.value)}
                  placeholder={t('websitePlaceholder')}
                  className="mt-1 bg-muted border-border text-foreground"
                />
              </div>
              <div>
                <label className="text-sm font-medium text-muted-foreground">{t('username')}</label>
                <Input
                  value={formUsername}
                  onChange={(e) => onFormUsernameChange(e.target.value)}
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
                      onChange={(e) => onFormPasswordChange(e.target.value)}
                      placeholder={t('passwordPlaceholder')}
                      className="bg-muted border-border text-foreground pr-10"
                    />
                    <button
                      type="button"
                      onClick={onToggleShowPassword}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                    >
                      {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </button>
                  </div>
                  <Button
                    type="button"
                    variant="outline"
                    onClick={onGeneratePassword}
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
                  onChange={(e) => onFormNotesChange(e.target.value)}
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
                onChange={(e) => onFormDataChange(e.target.value)}
                placeholder={t('itemDataPlaceholder')}
                className="mt-1 bg-muted border-border text-foreground min-h-[150px]"
              />
            </div>
          )}

          <DialogFooter className="gap-2">
            <Button
              variant="outline"
              onClick={onCancel}
              className="border-border text-muted-foreground"
            >
              {t('cancel')}
            </Button>
            <Button
              onClick={onSave}
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
