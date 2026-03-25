'use client';

import { useState } from 'react';
import { useTranslations } from 'next-intl';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { toast } from 'sonner';
import { apiClient } from '@/lib/api';
import { profileRoutes } from '@study-abroad/shared';
import { Save, Loader2 } from 'lucide-react';

const AWARD_LEVEL_KEYS = [
  { value: 'SCHOOL', labelKey: 'school' },
  { value: 'REGIONAL', labelKey: 'regional' },
  { value: 'STATE', labelKey: 'state' },
  { value: 'NATIONAL', labelKey: 'national' },
  { value: 'INTERNATIONAL', labelKey: 'international' },
];

const AWARD_CATEGORIES = [
  { value: 'STEM', labelKey: 'stem' },
  { value: 'MATH', labelKey: 'math' },
  { value: 'SCIENCE', labelKey: 'science' },
  { value: 'COMPUTER_SCIENCE', labelKey: 'computerScience' },
  { value: 'ENGINEERING', labelKey: 'engineering' },
  { value: 'BUSINESS', labelKey: 'business' },
  { value: 'ARTS', labelKey: 'arts' },
  { value: 'HUMANITIES', labelKey: 'humanities' },
  { value: 'SOCIAL_SCIENCE', labelKey: 'socialScience' },
  { value: 'LANGUAGE', labelKey: 'language' },
  { value: 'SPORTS', labelKey: 'sports' },
  { value: 'COMMUNITY_SERVICE', labelKey: 'communityService' },
  { value: 'LEADERSHIP', labelKey: 'leadership' },
  { value: 'OTHER', labelKey: 'other' },
];

interface Award {
  id: string;
  name: string;
  level: string;
  category?: string;
  year?: number;
  description?: string;
  competitionId?: string;
}

interface AwardFormProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  editingAward?: Award | null;
}

export function AwardForm({ open, onOpenChange, editingAward }: AwardFormProps) {
  const t = useTranslations('profile');
  const tCommon = useTranslations('common');
  const queryClient = useQueryClient();
  const isEditing = !!editingAward;

  const [formData, setFormData] = useState({
    name: editingAward?.name || '',
    level: editingAward?.level || '',
    category: editingAward?.category || '',
    year: editingAward?.year?.toString() || '',
    description: editingAward?.description || '',
  });

  const createMutation = useMutation({
    mutationFn: (data: unknown) => apiClient.post(profileRoutes.awards(), data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['profile'] });
      toast.success(t('toast.awardAdded'));
      onOpenChange(false);
      resetForm();
    },
  });

  const updateMutation = useMutation({
    mutationFn: (data: unknown) => apiClient.put(profileRoutes.award(editingAward!.id), data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['profile'] });
      toast.success(t('toast.awardUpdated'));
      onOpenChange(false);
    },
  });

  const resetForm = () => {
    setFormData({
      name: '',
      level: '',
      category: '',
      year: '',
      description: '',
    });
  };

  const handleSubmit = () => {
    if (!formData.name || !formData.level) {
      toast.error(t('validation.awardRequired'));
      return;
    }

    const data = {
      name: formData.name,
      level: formData.level,
      category: formData.category || undefined,
      year: formData.year ? parseInt(formData.year) : undefined,
      description: formData.description || undefined,
    };

    if (isEditing) {
      updateMutation.mutate(data);
    } else {
      createMutation.mutate(data);
    }
  };

  const isPending = createMutation.isPending || updateMutation.isPending;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{isEditing ? t('form.editAward') : t('form.addAward')}</DialogTitle>
        </DialogHeader>

        <div className="space-y-4 py-4">
          <div className="space-y-2">
            <Label>{t('form.awardName')} *</Label>
            <Input
              value={formData.name}
              onChange={(e) => setFormData((p) => ({ ...p, name: e.target.value }))}
              placeholder={t('form.awardNamePlaceholder')}
              maxLength={200}
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>{t('form.level')} *</Label>
              <Select
                value={formData.level}
                onValueChange={(v) => setFormData((p) => ({ ...p, level: v }))}
              >
                <SelectTrigger>
                  <SelectValue placeholder={t('form.selectLevel')} />
                </SelectTrigger>
                <SelectContent>
                  {AWARD_LEVEL_KEYS.map((l) => (
                    <SelectItem key={l.value} value={l.value}>
                      {t(`awardLevels.${l.labelKey}`)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>{t('form.awardCategory')}</Label>
              <Select
                value={formData.category}
                onValueChange={(v) => setFormData((p) => ({ ...p, category: v }))}
              >
                <SelectTrigger>
                  <SelectValue placeholder={t('form.selectCategory')} />
                </SelectTrigger>
                <SelectContent>
                  {AWARD_CATEGORIES.map((c) => (
                    <SelectItem key={c.value} value={c.value}>
                      {t(`awardCategories.${c.labelKey}`)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="space-y-2">
            <Label>{t('form.awardYear')}</Label>
            <Input
              type="number"
              value={formData.year}
              onChange={(e) => setFormData((p) => ({ ...p, year: e.target.value }))}
              placeholder="2025"
              min={2000}
              max={2030}
            />
          </div>

          <div className="space-y-2">
            <Label>{t('form.awardDescription')}</Label>
            <Textarea
              value={formData.description}
              onChange={(e) => setFormData((p) => ({ ...p, description: e.target.value }))}
              placeholder={t('form.awardDescPlaceholder')}
              rows={3}
              maxLength={500}
            />
            <p className="text-xs text-muted-foreground">{formData.description.length}/500</p>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            {tCommon('cancel')}
          </Button>
          <Button onClick={handleSubmit} disabled={isPending}>
            {isPending ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <Save className="mr-2 h-4 w-4" />
            )}
            {tCommon('save')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
