'use client';

import { useState, useMemo, useEffect } from 'react';
import { useTranslations, useLocale } from 'next-intl';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
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
import { hallRoutes } from '@study-abroad/shared';
import { Save, Loader2, Plus, X, GraduationCap } from 'lucide-react';
import { RankingBadge } from '@/components/ui/ranking-badge';
import type { SchoolRanking } from '@/lib/utils/ranking';
import { getSchoolName } from '@/lib/utils';
import { createListSchema, type ListFormValues } from '@/lib/validations/profile';
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
  rankings?: SchoolRanking[];
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
  const [schools, setSchools] = useState<School[]>([]);

  const schema = useMemo(() => createListSchema(t), [t]);
  const form = useForm<ListFormValues>({
    resolver: zodResolver(schema),
    defaultValues: {
      title: '',
      description: '',
      category: 'school_ranking',
      isPublic: true,
    },
  });

  // Reset form when dialog opens
  useEffect(() => {
    if (open) {
      form.reset();
      setSchools([]);
    }
  }, [open, form]);

  const createMutation = useMutation({
    mutationFn: (data: {
      title: string;
      description?: string;
      category: string;
      isPublic: boolean;
      items: unknown[];
    }) => apiClient.post(hallRoutes.lists(), data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['hall', 'publicLists'] });
      queryClient.invalidateQueries({ queryKey: ['myLists'] });
      toast.success(t('toast.success'));
      onOpenChange(false);
    },
    onError: (error) => {
      toast.error(error instanceof Error ? error.message : t('toast.createFailed'));
    },
  });

  const onSubmit = (values: ListFormValues) => {
    if (values.category === 'school_ranking' && schools.length === 0) {
      toast.error(t('toast.schoolsRequired'));
      return;
    }

    createMutation.mutate({
      title: values.title,
      description: values.description || undefined,
      category: values.category,
      isPublic: values.isPublic,
      items: schools.map((s, index) => ({
        rank: index + 1,
        schoolId: s.id,
        schoolName: getSchoolName(s, locale),
        usNewsRank: s.usNewsRank,
      })),
    });
  };

  const removeSchool = (schoolId: string) => {
    setSchools((prev) => prev.filter((s) => s.id !== schoolId));
  };

  const category = form.watch('category');

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>{t('title')}</DialogTitle>
            <DialogDescription>{t('description')}</DialogDescription>
          </DialogHeader>

          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4 py-4">
              <FormField
                control={form.control}
                name="title"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>{t('titleLabel')} *</FormLabel>
                    <FormControl>
                      <Input placeholder={t('titlePlaceholder')} maxLength={100} {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <div className="grid grid-cols-2 gap-4">
                <FormField
                  control={form.control}
                  name="category"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>{t('categoryLabel')}</FormLabel>
                      <Select onValueChange={field.onChange} value={field.value}>
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {CATEGORY_KEYS.map((c) => (
                            <SelectItem key={c.value} value={c.value}>
                              {t(`categories.${c.labelKey}`)}
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
                  name="isPublic"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>{t('visibilityLabel')}</FormLabel>
                      <div className="flex items-center gap-2 pt-2">
                        <Switch checked={field.value} onCheckedChange={field.onChange} />
                        <span className="text-sm text-muted-foreground">
                          {field.value ? t('public') : t('private')}
                        </span>
                      </div>
                    </FormItem>
                  )}
                />
              </div>

              <FormField
                control={form.control}
                name="description"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>{t('descriptionLabel')}</FormLabel>
                    <FormControl>
                      <Textarea
                        placeholder={t('descriptionPlaceholder')}
                        rows={3}
                        maxLength={500}
                        {...field}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              {category === 'school_ranking' && (
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <FormLabel>{t('schoolsLabel')}</FormLabel>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => setSchoolSelectorOpen(true)}
                    >
                      <Plus className="mr-1 h-4 w-4" />
                      {t('addSchool')}
                    </Button>
                  </div>

                  {schools.length > 0 ? (
                    <div className="space-y-2 rounded-lg border p-3">
                      {schools.map((school, index) => (
                        <div
                          key={school.id}
                          className="flex items-center gap-2 rounded bg-muted/50 px-3 py-2"
                        >
                          <span className="flex h-6 w-6 items-center justify-center rounded-full bg-primary/10 text-xs font-medium text-primary">
                            {index + 1}
                          </span>
                          <GraduationCap className="h-4 w-4 text-muted-foreground" />
                          <span className="flex-1 text-sm">{getSchoolName(school, locale)}</span>
                          <RankingBadge rankings={school.rankings} usNewsRank={school.usNewsRank} />
                          <button
                            type="button"
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

              <DialogFooter>
                <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
                  {tCommon('cancel')}
                </Button>
                <Button type="submit" disabled={createMutation.isPending}>
                  {createMutation.isPending ? (
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  ) : (
                    <Save className="mr-2 h-4 w-4" />
                  )}
                  {t('createButton')}
                </Button>
              </DialogFooter>
            </form>
          </Form>
        </DialogContent>
      </Dialog>

      <SchoolSelector
        open={schoolSelectorOpen}
        onOpenChange={setSchoolSelectorOpen}
        selectedSchools={schools}
        onSelect={setSchools}
        maxSelection={20}
        title={t('selectSchools')}
      />
    </>
  );
}
