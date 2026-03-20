'use client';

import { useState, useCallback } from 'react';
import { useTranslations } from 'next-intl';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
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
import { Save, Loader2 } from 'lucide-react';
import type { UseFormReturn } from 'react-hook-form';
import type { EssayFormData } from '@/lib/validations/essay';
import type { Essay } from '@/types/essay';
import { PromptSelector, type SelectedPrompt } from './prompt-selector';

interface EssayFormDialogProps {
  isFormOpen: boolean;
  setIsFormOpen: (open: boolean) => void;
  selectedEssay: Essay | null;
  essayForm: UseFormReturn<EssayFormData>;
  onSubmit: (e?: React.BaseSyntheticEvent) => void;
  isSaving: boolean;
  getWordCount: (text: string) => number;
  essayPromptId?: string | null;
  onEssayPromptIdChange?: (id: string | null) => void;
}

export function EssayFormDialog({
  isFormOpen,
  setIsFormOpen,
  selectedEssay,
  essayForm,
  onSubmit,
  isSaving,
  getWordCount,
  essayPromptId,
  onEssayPromptIdChange,
}: EssayFormDialogProps) {
  const t = useTranslations();

  const [selectedPrompt, setSelectedPrompt] = useState<SelectedPrompt | null>(null);

  const handlePromptSelect = useCallback(
    (prompt: SelectedPrompt) => {
      setSelectedPrompt(prompt);
      onEssayPromptIdChange?.(prompt.id);

      // Auto-fill title with school + type
      const typeLabel = prompt.type
        .split('_')
        .map((w) => w.charAt(0) + w.slice(1).toLowerCase())
        .join(' ');
      const currentTitle = essayForm.getValues('title');
      if (!currentTitle) {
        essayForm.setValue('title', `${prompt.schoolName} - ${typeLabel}`);
      }

      // Auto-fill prompt text
      essayForm.setValue('prompt', prompt.prompt);
    },
    [essayForm, onEssayPromptIdChange]
  );

  const handlePromptClear = useCallback(() => {
    setSelectedPrompt(null);
    onEssayPromptIdChange?.(null);
  }, [onEssayPromptIdChange]);

  // Clear linked prompt if user manually edits the prompt field
  const handlePromptFieldChange = useCallback(
    (e: React.ChangeEvent<HTMLTextAreaElement>) => {
      essayForm.register('prompt').onChange(e);
      if (selectedPrompt) {
        setSelectedPrompt(null);
        onEssayPromptIdChange?.(null);
      }
    },
    [essayForm, selectedPrompt, onEssayPromptIdChange]
  );

  // Reset linked prompt state when dialog opens/closes
  const handleOpenChange = useCallback(
    (open: boolean) => {
      if (!open) {
        setSelectedPrompt(null);
      } else if (selectedEssay?.essayPromptId && essayPromptId) {
        // If editing an essay that already has a linked prompt, we could restore it
        // but we don't have the full prompt data, so we leave it unlinked visually
      }
      setIsFormOpen(open);
    },
    [setIsFormOpen, selectedEssay, essayPromptId]
  );

  return (
    <Dialog open={isFormOpen} onOpenChange={handleOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>{selectedEssay ? t('essays.edit') : t('essays.create')}</DialogTitle>
          <DialogDescription>
            {selectedEssay ? t('essays.editDesc') : t('essays.createDesc')}
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={onSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label>{t('essays.label.title')}</Label>
            <Input placeholder={t('essays.placeholder.title')} {...essayForm.register('title')} />
            {essayForm.formState.errors.title && (
              <p className="text-xs text-destructive">{essayForm.formState.errors.title.message}</p>
            )}
          </div>

          {/* Prompt Selector */}
          <div className="space-y-2">
            <PromptSelector
              onSelect={handlePromptSelect}
              onClear={handlePromptClear}
              selectedPrompt={selectedPrompt}
            />
          </div>

          <div className="space-y-2">
            <Label>{t('essays.label.prompt')}</Label>
            <Textarea
              placeholder={t('essays.placeholder.prompt')}
              {...essayForm.register('prompt')}
              onChange={handlePromptFieldChange}
              rows={3}
            />
          </div>

          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label>{t('essays.label.content')}</Label>
              <span className="text-xs text-muted-foreground">
                {t('essays.wordCount', { count: getWordCount(essayForm.watch('content')) })}
              </span>
            </div>
            <Textarea
              placeholder={t('essays.placeholder.content')}
              {...essayForm.register('content')}
              rows={12}
              className="font-mono text-sm"
            />
            {essayForm.formState.errors.content && (
              <p className="text-xs text-destructive">
                {essayForm.formState.errors.content.message}
              </p>
            )}
          </div>

          <DialogFooter>
            <Button variant="outline" type="button" onClick={() => setIsFormOpen(false)}>
              {t('common.cancel')}
            </Button>
            <Button type="submit" disabled={isSaving}>
              {isSaving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              <Save className="mr-2 h-4 w-4" />
              {t('common.save')}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

interface EssayDeleteDialogProps {
  isDeleteOpen: boolean;
  setIsDeleteOpen: (open: boolean) => void;
  onConfirmDelete: () => void;
  isDeleting: boolean;
}

export function EssayDeleteDialog({
  isDeleteOpen,
  setIsDeleteOpen,
  onConfirmDelete,
  isDeleting,
}: EssayDeleteDialogProps) {
  const t = useTranslations();

  return (
    <AlertDialog open={isDeleteOpen} onOpenChange={setIsDeleteOpen}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>{t('essays.dialog.deleteTitle')}</AlertDialogTitle>
          <AlertDialogDescription>{t('essays.dialog.deleteDesc')}</AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>{t('common.cancel')}</AlertDialogCancel>
          <AlertDialogAction
            onClick={onConfirmDelete}
            className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
          >
            {isDeleting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            {t('common.delete')}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
