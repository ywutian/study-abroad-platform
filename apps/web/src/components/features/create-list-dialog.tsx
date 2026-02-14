'use client';

import { useState } from 'react';
import { useTranslations, useLocale } from 'next-intl';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
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
import { Save, Loader2, Plus, X, GraduationCap } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { getSchoolName } from '@/lib/utils';
import { SchoolSelector } from './school-selector';

const CATEGORY_KEYS = [
  { value: 'school_ranking', labelKey: 'schoolRanking' },
  { value: 'major_ranking', labelKey: 'majorRanking' },
  { value: 'tips', labelKey: 'tips' },
  { value: 'other', labelKey: 'other' },
];

interface School {
  id: string;
  name: string;
  nameZh?: string;
  country: string;
  state?: string;
  usNewsRank?: number;
  acceptanceRate?: number;
}

interface CreateListDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function CreateListDialog({ open, onOpenChange }: CreateListDialogProps) {
  const t = useTranslations('createList');
  const tCommon = useTranslations('common');
  const locale = useLocale();
  const queryClient = useQueryClient();
  const [schoolSelectorOpen, setSchoolSelectorOpen] = useState(false);

  const [formData, setFormData] = useState({
    title: '',
    description: '',
    category: 'school_ranking',
    isPublic: true,
    schools: [] as School[],
  });

  const createMutation = useMutation({
    mutationFn: (data: {
      title: string;
      description?: string;
      category: string;
      isPublic: boolean;
      items: unknown[];
    }) => apiClient.post('/halls/lists', data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['publicLists'] });
      queryClient.invalidateQueries({ queryKey: ['myLists'] });
      toast.success(t('toast.success'));
      onOpenChange(false);
      resetForm();
    },
    onError: (error: Error) => {
      toast.error(error.message);
    },
  });

  const resetForm = () => {
    setFormData({
      title: '',
      description: '',
      category: 'school_ranking',
      isPublic: true,
      schools: [],
    });
  };

  const handleSubmit = () => {
    if (!formData.title.trim()) {
      toast.error(t('toast.titleRequired'));
      return;
    }

    if (formData.category === 'school_ranking' && formData.schools.length === 0) {
      toast.error(t('toast.schoolsRequired'));
      return;
    }

    createMutation.mutate({
      title: formData.title,
      description: formData.description || undefined,
      category: formData.category,
      isPublic: formData.isPublic,
      items: formData.schools.map((s, index) => ({
        rank: index + 1,
        schoolId: s.id,
        schoolName: getSchoolName(s, locale),
        usNewsRank: s.usNewsRank,
      })),
    });
  };

  const removeSchool = (schoolId: string) => {
    setFormData((p) => ({
      ...p,
      schools: p.schools.filter((s) => s.id !== schoolId),
    }));
  };

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>{t('title')}</DialogTitle>
            <DialogDescription>{t('description')}</DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>{t('titleLabel')} *</Label>
              <Input
                value={formData.title}
                onChange={(e) => setFormData((p) => ({ ...p, title: e.target.value }))}
                placeholder={t('titlePlaceholder')}
                maxLength={100}
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>{t('categoryLabel')}</Label>
                <Select
                  value={formData.category}
                  onValueChange={(v) => setFormData((p) => ({ ...p, category: v }))}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {CATEGORY_KEYS.map((c) => (
                      <SelectItem key={c.value} value={c.value}>
                        {t(`categories.${c.labelKey}`)}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label>{t('visibilityLabel')}</Label>
                <div className="flex items-center gap-2 pt-2">
                  <Switch
                    checked={formData.isPublic}
                    onCheckedChange={(checked) => setFormData((p) => ({ ...p, isPublic: checked }))}
                  />
                  <span className="text-sm text-muted-foreground">
                    {formData.isPublic ? t('public') : t('private')}
                  </span>
                </div>
              </div>
            </div>

            <div className="space-y-2">
              <Label>{t('descriptionLabel')}</Label>
              <Textarea
                value={formData.description}
                onChange={(e) => setFormData((p) => ({ ...p, description: e.target.value }))}
                placeholder={t('descriptionPlaceholder')}
                rows={3}
                maxLength={500}
              />
            </div>

            {formData.category === 'school_ranking' && (
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label>{t('schoolsLabel')}</Label>
                  <Button variant="outline" size="sm" onClick={() => setSchoolSelectorOpen(true)}>
                    <Plus className="mr-1 h-4 w-4" />
                    {t('addSchool')}
                  </Button>
                </div>

                {formData.schools.length > 0 ? (
                  <div className="space-y-2 rounded-lg border p-3">
                    {formData.schools.map((school, index) => (
                      <div
                        key={school.id}
                        className="flex items-center gap-2 rounded bg-muted/50 px-3 py-2"
                      >
                        <span className="flex h-6 w-6 items-center justify-center rounded-full bg-primary/10 text-xs font-medium text-primary">
                          {index + 1}
                        </span>
                        <GraduationCap className="h-4 w-4 text-muted-foreground" />
                        <span className="flex-1 text-sm">{getSchoolName(school, locale)}</span>
                        {school.usNewsRank && (
                          <Badge variant="outline" className="text-xs">
                            #{school.usNewsRank}
                          </Badge>
                        )}
                        <button
                          onClick={() => removeSchool(school.id)}
                          className="rounded-full p-1 hover:bg-muted"
                        >
                          <X className="h-3 w-3" />
                        </button>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="rounded-lg border-2 border-dashed p-6 text-center text-muted-foreground">
                    <GraduationCap className="mx-auto mb-2 h-8 w-8 opacity-50" />
                    <p className="text-sm">{t('noSchools')}</p>
                  </div>
                )}
              </div>
            )}
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => onOpenChange(false)}>
              {tCommon('cancel')}
            </Button>
            <Button onClick={handleSubmit} disabled={createMutation.isPending}>
              {createMutation.isPending ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <Save className="mr-2 h-4 w-4" />
              )}
              {t('createButton')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <SchoolSelector
        open={schoolSelectorOpen}
        onOpenChange={setSchoolSelectorOpen}
        selectedSchools={formData.schools}
        onSelect={(schools) => setFormData((p) => ({ ...p, schools }))}
        maxSelection={20}
        title={t('selectSchools')}
      />
    </>
  );
}
