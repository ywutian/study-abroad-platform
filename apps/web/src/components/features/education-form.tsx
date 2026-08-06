'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import { useTranslations } from 'next-intl';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@/lib/zod-resolver';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from '@/components/ui/command';
import {
  Form,
  FormField,
  FormItem,
  FormLabel,
  FormControl,
  FormMessage,
} from '@/components/ui/form';
import { apiClient } from '@/lib/api';
import { profileRoutes, highSchoolRoutes } from '@study-abroad/shared';
import { toast } from 'sonner';
import { Loader2, Save, ChevronsUpDown, Check, X } from 'lucide-react';
import { cn } from '@/lib/utils';
import { createEducationSchema, type EducationFormValues } from '@/lib/validations/profile';

const GPA_SYSTEM_OPTIONS = [
  { value: 'SCALE_4_UW', label: '4.0 Scale (Unweighted)', gpaScale: '4.0' },
  { value: 'SCALE_4_W', label: '4.0+ Scale (Weighted)', gpaScale: '4.0' },
  { value: 'SCALE_5', label: '5.0 Scale', gpaScale: '5.0' },
  { value: 'PCT_100', label: 'Percentage (100)', gpaScale: '100' },
  { value: 'IB_45', label: 'IB (45 points)', gpaScale: '45' },
  { value: 'A_LEVEL', label: 'A-Level', gpaScale: '6' },
];

const SCHOOL_TYPE_KEYS = [
  { value: 'HIGH_SCHOOL', labelKey: 'highSchool' },
  { value: 'COLLEGE', labelKey: 'college' },
  { value: 'GRADUATE', labelKey: 'graduate' },
  { value: 'OTHER', labelKey: 'other' },
];

interface HighSchool {
  id: string;
  name: string;
  nameZh?: string;
  country: string;
  state?: string;
  type: string;
  tier: number;
}

interface Education {
  id: string;
  schoolName: string;
  schoolType?: string;
  degree?: string;
  major?: string;
  startDate?: string;
  endDate?: string;
  gpa?: number;
  gpaScale?: number;
  description?: string;
  highSchoolId?: string;
}

interface EducationFormProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  education?: Education | null;
  onSuccess?: () => void;
}

function useHighSchoolSearch(enabled: boolean) {
  const [search, setSearch] = useState('');
  const [results, setResults] = useState<HighSchool[]>([]);
  const [loading, setLoading] = useState(false);

  const doSearch = useCallback(async (term: string) => {
    if (!term || term.length < 1) {
      setResults([]);
      return;
    }
    setLoading(true);
    try {
      const data = await apiClient.get<HighSchool[]>(highSchoolRoutes.list(), {
        params: { search: term, pageSize: '20' },
      });
      setResults(Array.isArray(data) ? data : []);
    } catch {
      setResults([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!enabled) return;
    const timer = setTimeout(() => doSearch(search), 300);
    return () => clearTimeout(timer);
  }, [search, enabled, doSearch]);

  return { search, setSearch, results, loading };
}

export function EducationForm({ open, onOpenChange, education, onSuccess }: EducationFormProps) {
  const t = useTranslations('profile');
  const tCommon = useTranslations('common');
  const queryClient = useQueryClient();
  const isEditing = !!education;

  const schema = useMemo(() => createEducationSchema(t), [t]);
  const form = useForm<EducationFormValues>({
    resolver: zodResolver(schema),
    defaultValues: {
      schoolName: '',
      schoolType: '',
      degree: '',
      major: '',
      startDate: '',
      endDate: '',
      gpa: '',
      gpaScale: '4.0',
      gpaSystem: '',
      description: '',
      highSchoolId: '',
    },
  });

  const [hsPopoverOpen, setHsPopoverOpen] = useState(false);
  const schoolType = form.watch('schoolType');
  const isHighSchool = schoolType === 'HIGH_SCHOOL';
  const { search, setSearch, results, loading } = useHighSchoolSearch(
    isHighSchool && hsPopoverOpen
  );

  // Reset form when dialog opens/closes or editing target changes
  useEffect(() => {
    if (open) {
      if (education) {
        form.reset({
          schoolName: education.schoolName || '',
          schoolType: (education.schoolType as EducationFormValues['schoolType']) || '',
          degree: education.degree || '',
          major: education.major || '',
          startDate: education.startDate?.slice(0, 10) || '',
          endDate: education.endDate?.slice(0, 10) || '',
          gpa: education.gpa?.toString() || '',
          gpaScale: education.gpaScale?.toString() || '4.0',
          gpaSystem: '',
          description: education.description || '',
          highSchoolId: education.highSchoolId || '',
        });
      } else {
        form.reset();
      }
    }
  }, [education, open, form]);

  const createMutation = useMutation({
    mutationFn: (data: Record<string, unknown>) =>
      apiClient.post(`${profileRoutes.me()}/education`, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['profile'] });
      onOpenChange(false);
      toast.success(t('toast.educationAdded'));
      onSuccess?.();
    },
    onError: (error) => {
      toast.error(error instanceof Error ? error.message : t('toast.saveFailed'));
    },
  });

  const updateMutation = useMutation({
    mutationFn: (data: Record<string, unknown>) =>
      apiClient.put(`${profileRoutes.me()}/education/${education?.id}`, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['profile'] });
      onOpenChange(false);
      toast.success(t('toast.educationUpdated'));
      onSuccess?.();
    },
    onError: (error) => {
      toast.error(error instanceof Error ? error.message : t('toast.saveFailed'));
    },
  });

  const onSubmit = (values: EducationFormValues) => {
    const data: Record<string, unknown> = {
      schoolName: values.schoolName,
      schoolType: values.schoolType || undefined,
      degree: values.degree || undefined,
      major: values.major || undefined,
      startDate: values.startDate || undefined,
      endDate: values.endDate || undefined,
      gpa: values.gpa ? parseFloat(values.gpa) : undefined,
      gpaScale: values.gpaScale ? parseFloat(values.gpaScale) : undefined,
      gpaSystem: values.gpaSystem || undefined,
      description: values.description || undefined,
    };

    if (isHighSchool) {
      data.highSchoolId = values.highSchoolId || undefined;
    }

    if (isEditing) {
      updateMutation.mutate(data);
    } else {
      createMutation.mutate(data);
    }
  };

  const handleSelectHighSchool = (hs: HighSchool) => {
    form.setValue('schoolName', hs.nameZh || hs.name);
    form.setValue('highSchoolId', hs.id);
    setHsPopoverOpen(false);
  };

  const handleClearHighSchool = () => {
    form.setValue('highSchoolId', '');
  };

  const handleSchoolTypeChange = (value: string) => {
    form.setValue('schoolType', value as EducationFormValues['schoolType']);
    if (value !== 'HIGH_SCHOOL') {
      form.setValue('highSchoolId', '');
    }
  };

  const handleGpaSystemChange = (value: string) => {
    const option = GPA_SYSTEM_OPTIONS.find((o) => o.value === value);
    form.setValue('gpaSystem', value);
    if (option) {
      form.setValue('gpaScale', option.gpaScale);
    }
  };

  const isPending = createMutation.isPending || updateMutation.isPending;
  const highSchoolId = form.watch('highSchoolId');
  const schoolName = form.watch('schoolName');

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{isEditing ? t('form.editEducation') : t('form.addEducation')}</DialogTitle>
          <DialogDescription>
            {isEditing ? t('form.editEducationDesc') : t('form.addEducationDesc')}
          </DialogDescription>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="grid gap-4">
            {/* School Type selector */}
            <div className="grid gap-4 sm:grid-cols-2">
              <FormField
                control={form.control}
                name="schoolType"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>{t('form.schoolType')}</FormLabel>
                    <Select onValueChange={handleSchoolTypeChange} value={field.value}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder={t('form.selectType')} />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {SCHOOL_TYPE_KEYS.map((type) => (
                          <SelectItem key={type.value} value={type.value}>
                            {t(`form.educationTypes.${type.labelKey}`)}
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
                name="degree"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>{t('form.degree')}</FormLabel>
                    <FormControl>
                      <Input placeholder={t('form.degreePlaceholder')} {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            {/* School Name — Combobox for HIGH_SCHOOL, plain Input otherwise */}
            <FormField
              control={form.control}
              name="schoolName"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>{t('form.schoolName')} *</FormLabel>
                  {isHighSchool ? (
                    <div className="flex gap-2">
                      <Popover open={hsPopoverOpen} onOpenChange={setHsPopoverOpen} modal>
                        <PopoverTrigger asChild>
                          <Button
                            variant="outline"
                            role="combobox"
                            aria-expanded={hsPopoverOpen}
                            className="w-full justify-between font-normal"
                            type="button"
                          >
                            <span className="truncate">
                              {schoolName || t('form.searchHighSchool')}
                            </span>
                            <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                          </Button>
                        </PopoverTrigger>
                        <PopoverContent
                          className="w-[var(--radix-popover-trigger-width)] p-0"
                          align="start"
                        >
                          <Command shouldFilter={false}>
                            <CommandInput
                              placeholder={t('form.searchHighSchoolPlaceholder')}
                              value={search}
                              onValueChange={setSearch}
                            />
                            <CommandList>
                              <CommandEmpty>
                                {loading ? (
                                  t('form.searching')
                                ) : search.length > 0 ? (
                                  <div className="flex flex-col items-center gap-2 py-1">
                                    <span>{t('form.noHighSchoolFound')}</span>
                                    <Button
                                      variant="outline"
                                      size="sm"
                                      type="button"
                                      onClick={async () => {
                                        try {
                                          await apiClient.post(highSchoolRoutes.suggest(), {
                                            name: search,
                                            country: 'Unknown',
                                          });
                                          toast.success(t('form.schoolSuggested'));
                                        } catch {
                                          toast.error(t('form.schoolSuggestFailed'));
                                        }
                                      }}
                                    >
                                      {t('form.suggestSchool')}
                                    </Button>
                                  </div>
                                ) : (
                                  t('form.typeToSearch')
                                )}
                              </CommandEmpty>
                              {results.length > 0 && (
                                <CommandGroup>
                                  {results.map((hs) => (
                                    <CommandItem
                                      key={hs.id}
                                      value={hs.id}
                                      onSelect={() => handleSelectHighSchool(hs)}
                                    >
                                      <Check
                                        className={cn(
                                          'mr-2 h-4 w-4',
                                          highSchoolId === hs.id ? 'opacity-100' : 'opacity-0'
                                        )}
                                      />
                                      <div className="flex flex-col">
                                        <span className="font-medium">
                                          {hs.nameZh || hs.name}
                                          {hs.nameZh && hs.name !== hs.nameZh && (
                                            <span className="ml-1 text-muted-foreground text-xs">
                                              {hs.name}
                                            </span>
                                          )}
                                        </span>
                                        <span className="text-xs text-muted-foreground">
                                          Tier {hs.tier} · {hs.type.replace(/_/g, ' ')} ·{' '}
                                          {hs.state || hs.country}
                                        </span>
                                      </div>
                                    </CommandItem>
                                  ))}
                                </CommandGroup>
                              )}
                            </CommandList>
                          </Command>
                          {/* Allow custom input */}
                          <div className="border-t p-2">
                            <Input
                              placeholder={t('form.customHighSchool')}
                              value={field.value}
                              onChange={(e) => {
                                field.onChange(e.target.value);
                                form.setValue('highSchoolId', '');
                              }}
                              className="h-8 text-sm"
                            />
                          </div>
                        </PopoverContent>
                      </Popover>
                      {highSchoolId && (
                        <Button
                          variant="ghost"
                          size="icon"
                          className="shrink-0"
                          type="button"
                          onClick={handleClearHighSchool}
                        >
                          <X className="h-4 w-4" />
                        </Button>
                      )}
                    </div>
                  ) : (
                    <FormControl>
                      <Input placeholder={t('form.schoolNamePlaceholder')} {...field} />
                    </FormControl>
                  )}
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="major"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>{t('form.major')}</FormLabel>
                  <FormControl>
                    <Input placeholder={t('form.majorPlaceholder')} {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <div className="grid gap-4 sm:grid-cols-2">
              <FormField
                control={form.control}
                name="startDate"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>{t('form.startDate')}</FormLabel>
                    <FormControl>
                      <Input type="date" {...field} />
                    </FormControl>
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="endDate"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>{t('form.endDate')}</FormLabel>
                    <FormControl>
                      <Input type="date" {...field} />
                    </FormControl>
                  </FormItem>
                )}
              />
            </div>

            <div className="grid gap-4 sm:grid-cols-3">
              <FormField
                control={form.control}
                name="gpa"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>GPA</FormLabel>
                    <FormControl>
                      <Input type="number" step="0.01" placeholder="3.85" {...field} />
                    </FormControl>
                  </FormItem>
                )}
              />
              <div className="space-y-2">
                <FormLabel>{t('form.gpaSystem')}</FormLabel>
                <Select value={form.watch('gpaSystem') || ''} onValueChange={handleGpaSystemChange}>
                  <SelectTrigger>
                    <SelectValue placeholder={t('form.selectType')} />
                  </SelectTrigger>
                  <SelectContent>
                    {GPA_SYSTEM_OPTIONS.map((opt) => (
                      <SelectItem key={opt.value} value={opt.value}>
                        {opt.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <FormField
                control={form.control}
                name="gpaScale"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>{t('form.gpaMax')}</FormLabel>
                    <FormControl>
                      <Input type="number" step="0.1" placeholder="4.0" {...field} />
                    </FormControl>
                  </FormItem>
                )}
              />
            </div>

            <FormField
              control={form.control}
              name="description"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>{t('form.description')}</FormLabel>
                  <FormControl>
                    <Textarea placeholder={t('form.descriptionPlaceholder')} rows={3} {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
                {tCommon('cancel')}
              </Button>
              <Button type="submit" disabled={isPending}>
                {isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                <Save className="mr-2 h-4 w-4" />
                {tCommon('save')}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
