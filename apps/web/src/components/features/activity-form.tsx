'use client';

import { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { useTranslations } from 'next-intl';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Checkbox } from '@/components/ui/checkbox';
import { Badge } from '@/components/ui/badge';
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
import { Save, Loader2, Sparkles, HelpCircle } from 'lucide-react';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { createActivitySchema, type ActivityFormValues } from '@/lib/validations/profile';

const ACTIVITY_CATEGORY_KEYS = [
  { value: 'ACADEMIC', labelKey: 'academic' },
  { value: 'ARTS', labelKey: 'arts' },
  { value: 'ATHLETICS', labelKey: 'athletics' },
  { value: 'COMMUNITY_SERVICE', labelKey: 'communityService' },
  { value: 'LEADERSHIP', labelKey: 'leadership' },
  { value: 'WORK', labelKey: 'work' },
  { value: 'RESEARCH', labelKey: 'research' },
  { value: 'INTERNSHIP', labelKey: 'internship' },
  { value: 'CLUB', labelKey: 'club' },
  { value: 'HOBBY', labelKey: 'hobby' },
  { value: 'OTHER', labelKey: 'other' },
];

const GRADE_LEVELS = [
  { value: 9, labelKey: 'grade9' },
  { value: 10, labelKey: 'grade10' },
  { value: 11, labelKey: 'grade11' },
  { value: 12, labelKey: 'grade12' },
];

const TIMING_OPTIONS = [
  { value: 'SCHOOL_YEAR', labelKey: 'schoolYear' },
  { value: 'SCHOOL_BREAK', labelKey: 'schoolBreak' },
  { value: 'ALL_YEAR', labelKey: 'allYear' },
];

const TIER_CONFIG: Record<number, { label: string; className: string }> = {
  1: {
    label: 'Elite',
    className: 'bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-400',
  },
  2: {
    label: 'Significant',
    className: 'bg-slate-100 text-slate-800 dark:bg-slate-900/30 dark:text-slate-400',
  },
  3: {
    label: 'Notable',
    className: 'bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-400',
  },
  4: {
    label: 'General',
    className: 'bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400',
  },
};

interface ActivityTemplate {
  id: string;
  name: string;
  nameZh?: string;
  category: string;
  tier: number;
}

interface Activity {
  id: string;
  name: string;
  category: string;
  role: string;
  organization?: string;
  description?: string;
  commonAppDescription?: string;
  startDate?: string;
  endDate?: string;
  hoursPerWeek?: number;
  weeksPerYear?: number;
  isOngoing?: boolean;
  gradeLevels?: number[];
  timing?: string;
  activityTemplateId?: string;
  activityTemplate?: ActivityTemplate;
}

interface ActivityFormProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  editingActivity?: Activity | null;
}

const DEFAULT_VALUES: ActivityFormValues = {
  name: '',
  category: undefined as unknown as ActivityFormValues['category'],
  role: '',
  organization: '',
  description: '',
  commonAppDescription: '',
  startDate: '',
  endDate: '',
  hoursPerWeek: '',
  weeksPerYear: '',
  isOngoing: false,
  gradeLevels: [],
  timing: '',
  activityTemplateId: '',
};

export function ActivityForm({ open, onOpenChange, editingActivity }: ActivityFormProps) {
  const t = useTranslations('profile');
  const tCommon = useTranslations('common');
  const queryClient = useQueryClient();
  const isEditing = !!editingActivity;

  const schema = useMemo(() => createActivitySchema(t), [t]);
  const form = useForm<ActivityFormValues>({
    resolver: zodResolver(schema),
    defaultValues: DEFAULT_VALUES,
  });

  const [selectedTemplate, setSelectedTemplate] = useState<ActivityTemplate | null>(null);
  const [suggestions, setSuggestions] = useState<ActivityTemplate[]>([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const searchTimeoutRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const suggestionsRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (open) {
      if (editingActivity) {
        form.reset({
          name: editingActivity.name || '',
          category:
            (editingActivity.category as ActivityFormValues['category']) ||
            (undefined as unknown as ActivityFormValues['category']),
          role: editingActivity.role || '',
          organization: editingActivity.organization || '',
          description: editingActivity.description || '',
          commonAppDescription: editingActivity.commonAppDescription || '',
          startDate: editingActivity.startDate?.slice(0, 10) || '',
          endDate: editingActivity.endDate?.slice(0, 10) || '',
          hoursPerWeek: editingActivity.hoursPerWeek?.toString() || '',
          weeksPerYear: editingActivity.weeksPerYear?.toString() || '',
          isOngoing: editingActivity.isOngoing || false,
          gradeLevels: editingActivity.gradeLevels || [],
          timing: (editingActivity.timing as ActivityFormValues['timing']) || '',
          activityTemplateId: editingActivity.activityTemplateId || '',
        });
        setSelectedTemplate(editingActivity.activityTemplate || null);
      } else {
        form.reset(DEFAULT_VALUES);
        setSelectedTemplate(null);
        setSuggestions([]);
        setShowSuggestions(false);
      }
    }
  }, [editingActivity, open, form]);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (suggestionsRef.current && !suggestionsRef.current.contains(e.target as Node)) {
        setShowSuggestions(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const searchTemplates = useCallback(async (query: string) => {
    if (query.length < 1) {
      setSuggestions([]);
      return;
    }
    try {
      const results = await apiClient.get<ActivityTemplate[]>(
        `/profiles/activity-templates/search?q=${encodeURIComponent(query)}&limit=6`
      );
      setSuggestions(results);
      setShowSuggestions(results.length > 0);
    } catch {
      setSuggestions([]);
    }
  }, []);

  const handleNameChange = (value: string) => {
    form.setValue('name', value);
    setSelectedTemplate(null);
    form.setValue('activityTemplateId', '');

    if (searchTimeoutRef.current) clearTimeout(searchTimeoutRef.current);
    searchTimeoutRef.current = setTimeout(() => searchTemplates(value), 300);
  };

  const handleSelectTemplate = (template: ActivityTemplate) => {
    setSelectedTemplate(template);
    form.setValue('name', template.name);
    form.setValue('category', template.category as ActivityFormValues['category']);
    form.setValue('activityTemplateId', template.id);
    setShowSuggestions(false);
    setSuggestions([]);
  };

  const handleGradeLevelToggle = (grade: number) => {
    const current = form.getValues('gradeLevels');
    const updated = current.includes(grade)
      ? current.filter((g) => g !== grade)
      : [...current, grade].sort();
    form.setValue('gradeLevels', updated);
  };

  const createMutation = useMutation({
    mutationFn: (data: unknown) => apiClient.post(profileRoutes.activities(), data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['profile'] });
      toast.success(t('toast.activityAdded'));
      onOpenChange(false);
    },
    onError: (error) => {
      toast.error(error instanceof Error ? error.message : t('toast.saveFailed'));
    },
  });

  const updateMutation = useMutation({
    mutationFn: (data: unknown) => apiClient.put(profileRoutes.activity(editingActivity!.id), data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['profile'] });
      toast.success(t('toast.activityUpdated'));
      onOpenChange(false);
    },
    onError: (error) => {
      toast.error(error instanceof Error ? error.message : t('toast.saveFailed'));
    },
  });

  const refineMutation = useMutation({
    mutationFn: (activityId: string) =>
      apiClient.post<{ refined: string; tips: string }>(
        `/profiles/me/activities/${activityId}/refine`
      ),
    onSuccess: (data) => {
      form.setValue('description', data.refined);
      if (data.tips) {
        toast.success(data.tips);
      } else {
        toast.success(t('toast.activityRefined'));
      }
    },
    onError: (error) => {
      toast.error(error instanceof Error ? error.message : t('toast.saveFailed'));
    },
  });

  const generateCommonAppMutation = useMutation({
    mutationFn: (activityId: string) =>
      apiClient.post<{ commonAppDescription: string }>(
        `/profiles/me/activities/${activityId}/generate-common-app-description`,
        { description: form.getValues('description') }
      ),
    onSuccess: (data) => {
      form.setValue('commonAppDescription', data.commonAppDescription);
      toast.success(t('form.aiGenerateSuccess'));
    },
    onError: (error) => {
      toast.error(error instanceof Error ? error.message : t('toast.saveFailed'));
    },
  });

  const onSubmit = (data: ActivityFormValues) => {
    const payload: Record<string, unknown> = {
      name: data.name,
      category: data.category,
      role: data.role,
      organization: data.organization || undefined,
      description: data.description || undefined,
      commonAppDescription: data.commonAppDescription || undefined,
      startDate: data.startDate || undefined,
      endDate: data.isOngoing ? undefined : data.endDate || undefined,
      hoursPerWeek: data.hoursPerWeek ? parseInt(data.hoursPerWeek) : undefined,
      weeksPerYear: data.weeksPerYear ? parseInt(data.weeksPerYear) : undefined,
      isOngoing: data.isOngoing,
      gradeLevels: data.gradeLevels.length > 0 ? data.gradeLevels : undefined,
      timing: data.timing || undefined,
      activityTemplateId: data.activityTemplateId || undefined,
    };

    if (isEditing) {
      updateMutation.mutate(payload);
    } else {
      createMutation.mutate(payload);
    }
  };

  const isPending = createMutation.isPending || updateMutation.isPending;
  const watchedDescription = form.watch('description') || '';
  const watchedCommonApp = form.watch('commonAppDescription') || '';
  const watchedIsOngoing = form.watch('isOngoing');
  const watchedGradeLevels = form.watch('gradeLevels');

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{isEditing ? t('form.editActivity') : t('form.addActivity')}</DialogTitle>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4 py-4">
            {/* Name with template autocomplete */}
            <FormField
              control={form.control}
              name="name"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>{t('form.activityName')} *</FormLabel>
                  <div className="relative" ref={suggestionsRef}>
                    <FormControl>
                      <Input
                        value={field.value}
                        onChange={(e) => handleNameChange(e.target.value)}
                        onBlur={field.onBlur}
                        onFocus={() => {
                          if (suggestions.length > 0) setShowSuggestions(true);
                        }}
                        placeholder={t('form.activityNamePlaceholder')}
                        maxLength={100}
                      />
                    </FormControl>
                    {showSuggestions && suggestions.length > 0 && (
                      <div className="absolute z-50 mt-1 w-full rounded-md border bg-popover shadow-lg">
                        {suggestions.map((tmpl) => {
                          const tierCfg = TIER_CONFIG[tmpl.tier] || TIER_CONFIG[4];
                          return (
                            <button
                              key={tmpl.id}
                              type="button"
                              className="flex w-full items-center justify-between px-3 py-2 text-sm hover:bg-accent"
                              onClick={() => handleSelectTemplate(tmpl)}
                            >
                              <span className="truncate">
                                {tmpl.name}
                                {tmpl.nameZh && (
                                  <span className="ml-1 text-muted-foreground">
                                    ({tmpl.nameZh})
                                  </span>
                                )}
                              </span>
                              <Badge
                                variant="outline"
                                className={`ml-2 shrink-0 text-xs ${tierCfg.className}`}
                              >
                                <Sparkles className="mr-1 h-3 w-3" />T{tmpl.tier}
                              </Badge>
                            </button>
                          );
                        })}
                      </div>
                    )}
                  </div>
                  {selectedTemplate && (
                    <div className="flex items-center gap-2 text-sm text-muted-foreground">
                      <Badge
                        variant="outline"
                        className={`text-xs ${TIER_CONFIG[selectedTemplate.tier]?.className}`}
                      >
                        <Sparkles className="mr-1 h-3 w-3" />
                        Tier {selectedTemplate.tier} — {TIER_CONFIG[selectedTemplate.tier]?.label}
                      </Badge>
                      <span>{t('linkedToTemplate')}</span>
                    </div>
                  )}
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
                    <FormLabel>{t('form.activityCategory')} *</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder={t('form.selectCategory')} />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {ACTIVITY_CATEGORY_KEYS.map((c) => (
                          <SelectItem key={c.value} value={c.value}>
                            {t(`activityCategories.${c.labelKey}`)}
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
                name="role"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>{t('form.role')} *</FormLabel>
                    <FormControl>
                      <Input {...field} placeholder={t('form.rolePlaceholder')} maxLength={100} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <FormField
              control={form.control}
              name="organization"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>{t('form.organization')}</FormLabel>
                  <FormControl>
                    <Input
                      {...field}
                      placeholder={t('form.organizationPlaceholder')}
                      maxLength={100}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <div className="space-y-2">
              <div className="flex items-center gap-1.5">
                <Label>{t('form.detailedDescription')}</Label>
                <TooltipProvider>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <HelpCircle className="h-3.5 w-3.5 text-muted-foreground cursor-help" />
                    </TooltipTrigger>
                    <TooltipContent
                      side="top"
                      className="max-w-xs bg-popover text-popover-foreground border shadow-md"
                    >
                      <p className="text-xs">{t('form.activityDescTooltip')}</p>
                    </TooltipContent>
                  </Tooltip>
                </TooltipProvider>
              </div>
              <p className="text-xs text-muted-foreground">{t('form.detailedDescriptionHelper')}</p>
              <Textarea
                value={watchedDescription}
                onChange={(e) => form.setValue('description', e.target.value)}
                placeholder={t('form.activityDescPlaceholder')}
                rows={3}
                maxLength={500}
              />
              {/* Segmented indicator bar */}
              <div className="h-0.5 w-full rounded-full bg-muted overflow-hidden">
                <div className="relative h-full">
                  <div
                    className="absolute h-full bg-success rounded-full transition-all"
                    style={{ width: `${Math.min((watchedDescription.length / 500) * 100, 30)}%` }}
                  />
                  {watchedDescription.length > 150 && (
                    <div
                      className={`absolute h-full rounded-r-full transition-all ${watchedDescription.length > 400 ? 'bg-warning' : 'bg-muted-foreground/30'}`}
                      style={{
                        left: '30%',
                        width: `${Math.min(((watchedDescription.length - 150) / 500) * 100, 70)}%`,
                      }}
                    />
                  )}
                  <div className="absolute top-0 h-full w-px bg-border" style={{ left: '30%' }} />
                </div>
              </div>
              <div className="flex items-center justify-between">
                <p className="text-xs text-muted-foreground">
                  {watchedDescription.length === 0
                    ? t('form.activityDescHelperEmpty')
                    : watchedDescription.length <= 150
                      ? t('form.activityDescHelperWithin')
                      : t('form.activityDescHelperOver')}
                </p>
                <p
                  className={`text-xs tabular-nums ${
                    watchedDescription.length === 0
                      ? 'text-muted-foreground'
                      : watchedDescription.length <= 150
                        ? 'text-success'
                        : watchedDescription.length > 400
                          ? 'text-warning'
                          : 'text-muted-foreground'
                  }`}
                >
                  {t('form.activityCharCount', { count: watchedDescription.length, max: 500 })}
                </p>
              </div>
              {isEditing && editingActivity && watchedDescription.length > 150 && (
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="gap-1.5 text-xs w-full"
                  onClick={() => refineMutation.mutate(editingActivity.id)}
                  disabled={refineMutation.isPending}
                >
                  {refineMutation.isPending ? (
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  ) : (
                    <Sparkles className="h-3.5 w-3.5" />
                  )}
                  {t('form.aiRefineDesc')}
                </Button>
              )}
            </div>

            {/* AI Generate Common App Description */}
            {isEditing && editingActivity && watchedDescription.length > 150 && (
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="gap-1.5 text-xs w-full"
                onClick={() => generateCommonAppMutation.mutate(editingActivity.id)}
                disabled={generateCommonAppMutation.isPending}
              >
                {generateCommonAppMutation.isPending ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                ) : (
                  <Sparkles className="h-3.5 w-3.5" />
                )}
                {t('form.aiGenerate')}
              </Button>
            )}

            {/* Common App Description */}
            <div className="space-y-2">
              <Label>{t('form.commonAppDescription')}</Label>
              <p className="text-xs text-muted-foreground">
                {t('form.commonAppDescriptionHelper')}
              </p>
              <Textarea
                value={watchedCommonApp}
                onChange={(e) => form.setValue('commonAppDescription', e.target.value)}
                placeholder={t('form.commonAppDescriptionPlaceholder')}
                rows={2}
                maxLength={150}
              />
              <div className="flex items-center justify-end">
                <p
                  className={`text-xs tabular-nums ${
                    watchedCommonApp.length === 0
                      ? 'text-muted-foreground'
                      : watchedCommonApp.length <= 150
                        ? 'text-success'
                        : 'text-warning'
                  }`}
                >
                  {t('form.activityCharCount', { count: watchedCommonApp.length, max: 150 })}
                </p>
              </div>
            </div>

            {/* Grade Levels */}
            <div className="space-y-2">
              <Label>{t('form.gradeLevels')}</Label>
              <div className="flex gap-2">
                {GRADE_LEVELS.map((gl) => (
                  <button
                    key={gl.value}
                    type="button"
                    onClick={() => handleGradeLevelToggle(gl.value)}
                    className={`rounded-full border px-3 py-1 text-sm transition-colors ${
                      watchedGradeLevels.includes(gl.value)
                        ? 'border-primary bg-primary/10 text-primary'
                        : 'border-border text-muted-foreground hover:border-primary/50'
                    }`}
                  >
                    {t(`form.${gl.labelKey}`)}
                  </button>
                ))}
              </div>
            </div>

            {/* Timing */}
            <div className="space-y-2">
              <Label>{t('form.timing')}</Label>
              <Select
                value={form.watch('timing')}
                onValueChange={(v) => form.setValue('timing', v as ActivityFormValues['timing'])}
              >
                <SelectTrigger>
                  <SelectValue placeholder={t('form.selectTiming')} />
                </SelectTrigger>
                <SelectContent>
                  {TIMING_OPTIONS.map((opt) => (
                    <SelectItem key={opt.value} value={opt.value}>
                      {t(
                        `form.timing${opt.value === 'SCHOOL_YEAR' ? 'SchoolYear' : opt.value === 'SCHOOL_BREAK' ? 'SchoolBreak' : 'AllYear'}`
                      )}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>{t('form.startDate')}</Label>
                <Input type="date" {...form.register('startDate')} />
              </div>

              <div className="space-y-2">
                <Label>{t('form.endDate')}</Label>
                <Input type="date" {...form.register('endDate')} disabled={watchedIsOngoing} />
              </div>
            </div>

            <div className="flex items-center space-x-2">
              <Checkbox
                id="isOngoing"
                checked={watchedIsOngoing}
                onCheckedChange={(checked) => form.setValue('isOngoing', !!checked)}
              />
              <Label htmlFor="isOngoing" className="cursor-pointer">
                {t('form.ongoing')}
              </Label>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>{t('form.hoursPerWeek')}</Label>
                <Input
                  type="number"
                  {...form.register('hoursPerWeek')}
                  placeholder="1 - 40"
                  min={1}
                  max={40}
                />
              </div>

              <div className="space-y-2">
                <Label>{t('form.weeksPerYear')}</Label>
                <Input
                  type="number"
                  {...form.register('weeksPerYear')}
                  placeholder="1 - 52"
                  min={1}
                  max={52}
                />
              </div>
            </div>

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
