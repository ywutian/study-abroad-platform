'use client';

import { useEffect, useMemo } from 'react';
import { useTranslations } from 'next-intl';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
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
import {
  Form,
  FormField,
  FormItem,
  FormLabel,
  FormControl,
  FormMessage,
} from '@/components/ui/form';
import { toast } from 'sonner';
import { apiClient } from '@/lib/api';
import { profileRoutes } from '@study-abroad/shared';
import { Save, Loader2 } from 'lucide-react';
import { createAwardSchema, type AwardFormValues } from '@/lib/validations/profile';

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

  const schema = useMemo(() => createAwardSchema(t), [t]);
  const form = useForm<AwardFormValues>({
    resolver: zodResolver(schema),
    defaultValues: {
      name: '',
      level: undefined,
      category: '',
      year: '',
      description: '',
    },
  });

  // Reset form when dialog opens/closes or editing target changes
  useEffect(() => {
    if (open) {
      if (editingAward) {
        form.reset({
          name: editingAward.name,
          level: editingAward.level as AwardFormValues['level'],
          category: (editingAward.category as AwardFormValues['category']) || '',
          year: editingAward.year?.toString() || '',
          description: editingAward.description || '',
        });
      } else {
        form.reset({
          name: '',
          level: undefined,
          category: '',
          year: '',
          description: '',
        });
      }
    }
  }, [open, editingAward, form]);

  const createMutation = useMutation({
    mutationFn: (data: unknown) => apiClient.post(profileRoutes.awards(), data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['profile'] });
      toast.success(t('toast.awardAdded'));
      onOpenChange(false);
    },
    onError: (error) => {
      toast.error(error instanceof Error ? error.message : t('toast.saveFailed'));
    },
  });

  const updateMutation = useMutation({
    mutationFn: (data: unknown) => apiClient.put(profileRoutes.award(editingAward!.id), data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['profile'] });
      toast.success(t('toast.awardUpdated'));
      onOpenChange(false);
    },
    onError: (error) => {
      toast.error(error instanceof Error ? error.message : t('toast.saveFailed'));
    },
  });

  const onSubmit = (data: AwardFormValues) => {
    const payload = {
      name: data.name,
      level: data.level,
      category: data.category || undefined,
      year: data.year ? parseInt(data.year) : undefined,
      description: data.description || undefined,
    };

    if (isEditing) {
      updateMutation.mutate(payload);
    } else {
      createMutation.mutate(payload);
    }
  };

  const isPending = createMutation.isPending || updateMutation.isPending;
  const description = form.watch('description');

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{isEditing ? t('form.editAward') : t('form.addAward')}</DialogTitle>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4 py-4">
            <FormField
              control={form.control}
              name="name"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>{t('form.awardName')} *</FormLabel>
                  <FormControl>
                    <Input
                      {...field}
                      placeholder={t('form.awardNamePlaceholder')}
                      maxLength={200}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <div className="grid grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="level"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>{t('form.level')} *</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder={t('form.selectLevel')} />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {AWARD_LEVEL_KEYS.map((l) => (
                          <SelectItem key={l.value} value={l.value}>
                            {t(`awardLevels.${l.labelKey}`)}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="category"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>{t('form.awardCategory')}</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder={t('form.selectCategory')} />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {AWARD_CATEGORIES.map((c) => (
                          <SelectItem key={c.value} value={c.value}>
                            {t(`awardCategories.${c.labelKey}`)}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <FormField
              control={form.control}
              name="year"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>{t('form.awardYear')}</FormLabel>
                  <FormControl>
                    <Input type="number" {...field} placeholder="2025" min={2000} max={2030} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="description"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>{t('form.awardDescription')}</FormLabel>
                  <FormControl>
                    <Textarea
                      {...field}
                      placeholder={t('form.awardDescPlaceholder')}
                      rows={3}
                      maxLength={500}
                    />
                  </FormControl>
                  <p className="text-xs text-muted-foreground">{(description || '').length}/500</p>
                  <FormMessage />
                </FormItem>
              )}
            />

            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
                {tCommon('cancel')}
              </Button>
              <Button type="submit" disabled={isPending}>
                {isPending ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : (
                  <Save className="mr-2 h-4 w-4" />
                )}
                {tCommon('save')}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
