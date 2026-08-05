'use client';

import { useState, useCallback, useMemo, useEffect } from 'react';
import { useTranslations, useLocale } from 'next-intl';
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
import {
  Form,
  FormField,
  FormItem,
  FormLabel,
  FormControl,
  FormMessage,
} from '@/components/ui/form';
import { apiClient } from '@/lib/api';
import { qk } from '@/lib/query';
import { caseRoutes } from '@study-abroad/shared';
import { toast } from 'sonner';
import { Loader2, Send, GraduationCap } from 'lucide-react';
import { getSchoolName } from '@/lib/utils';
import { createSubmitCaseSchema, type SubmitCaseFormValues } from '@/lib/validations/profile';
import { SchoolSelector } from './school-selector';
import { EssaySection } from './submit-case/EssaySection';
import { DetailsSection } from './submit-case/DetailsSection';

const RESULT_KEYS = [
  { value: 'ADMITTED', labelKey: 'admitted' },
  { value: 'REJECTED', labelKey: 'rejected' },
  { value: 'WAITLISTED', labelKey: 'waitlisted' },
  { value: 'DEFERRED', labelKey: 'deferred' },
];

const ROUND_KEYS = [
  { value: 'ED', labelKey: 'ED' },
  { value: 'ED2', labelKey: 'ED2' },
  { value: 'EA', labelKey: 'EA' },
  { value: 'REA', labelKey: 'REA' },
  { value: 'RD', labelKey: 'RD' },
  { value: 'UC', labelKey: 'UC' },
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

interface SubmitCaseDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess?: () => void;
  defaultIncludeEssay?: boolean;
}

export function SubmitCaseDialog({
  open,
  onOpenChange,
  onSuccess,
  defaultIncludeEssay = false,
}: SubmitCaseDialogProps) {
  const t = useTranslations('submitCase');
  const tCommon = useTranslations('common');
  const locale = useLocale();
  const queryClient = useQueryClient();
  const [schoolSelectorOpen, setSchoolSelectorOpen] = useState(false);
  const [selectedSchool, setSelectedSchool] = useState<School | null>(null);
  const [includeEssay, setIncludeEssay] = useState(defaultIncludeEssay);
  const [demographicTags, setDemographicTags] = useState<string[]>([]);

  const schema = useMemo(() => createSubmitCaseSchema(t), [t]);
  const form = useForm<SubmitCaseFormValues>({
    resolver: zodResolver(schema),
    defaultValues: {
      year: new Date().getFullYear().toString(),
      round: '',
      result: undefined,
      major: '',
      gpaRange: '',
      gpa9: '',
      gpa10: '',
      gpa11: '',
      gpa12: '',
      ucCappedGpa: '',
      ucUncappedGpa: '',
      gpaScale: '4.0',
      satRange: '',
      actRange: '',
      toeflRange: '',
      nationality: '',
      apCount: '',
      apSubjects: '',
      ibScore: '',
      narrative: '',
      tags: '',
      activityList: '',
      essayType: '',
      essayPrompt: '',
      essayContent: '',
      visibility: 'ANONYMOUS',
    },
  });

  // Reset form when dialog opens
  useEffect(() => {
    if (open) {
      form.reset();
      setSelectedSchool(null);
      setDemographicTags([]);
      setIncludeEssay(defaultIncludeEssay);
    }
  }, [open, form, defaultIncludeEssay]);

  // Bridge for sub-components that use onFieldChange callback
  const handleFieldChange = useCallback(
    (field: string, value: string) => {
      form.setValue(field as keyof SubmitCaseFormValues, value, { shouldValidate: false });
    },
    [form]
  );

  const submitMutation = useMutation({
    mutationFn: (data: Record<string, unknown>) => apiClient.post(caseRoutes.list(), data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: qk.cases.all });
      onOpenChange(false);
      toast.success(t('toast.success'));
      setTimeout(() => {
        toast(t('toast.inviteSchoolmates'), { duration: 5000 });
      }, 1500);
      onSuccess?.();
    },
    onError: (error) => {
      toast.error(error instanceof Error ? error.message : t('toast.submitFailed'));
    },
  });

  const onSubmit = (values: SubmitCaseFormValues) => {
    if (!selectedSchool) {
      toast.error(t('toast.requiredFields'));
      return;
    }

    const data: Record<string, unknown> = {
      schoolId: selectedSchool.id,
      year: parseInt(values.year),
      round: values.round || undefined,
      result: values.result,
      major: values.major || undefined,
      gpaRange: values.gpaRange || undefined,
      gpa9: values.gpa9 ? parseFloat(values.gpa9) : undefined,
      gpa10: values.gpa10 ? parseFloat(values.gpa10) : undefined,
      gpa11: values.gpa11 ? parseFloat(values.gpa11) : undefined,
      gpa12: values.gpa12 ? parseFloat(values.gpa12) : undefined,
      ucCappedGpa: values.ucCappedGpa ? parseFloat(values.ucCappedGpa) : undefined,
      ucUncappedGpa: values.ucUncappedGpa ? parseFloat(values.ucUncappedGpa) : undefined,
      gpaScale: values.gpaScale ? parseFloat(values.gpaScale) : undefined,
      satRange: values.satRange || undefined,
      actRange: values.actRange || undefined,
      toeflRange: values.toeflRange || undefined,
      nationality: values.nationality || undefined,
      apCount: values.apCount ? parseInt(values.apCount) : undefined,
      apSubjects: values.apSubjects
        ? values.apSubjects
            .split(',')
            .map((s) => s.trim())
            .filter(Boolean)
        : undefined,
      ibScore: values.ibScore ? parseInt(values.ibScore) : undefined,
      narrative: values.narrative?.trim() || undefined,
      demographicTags: demographicTags.length > 0 ? demographicTags : undefined,
      tags: values.tags
        ? values.tags
            .split(',')
            .map((t) => t.trim())
            .filter(Boolean)
        : undefined,
      activityList: values.activityList?.trim() || undefined,
      visibility: values.visibility || 'ANONYMOUS',
    };

    // Add essay fields if included
    if (includeEssay) {
      if (values.essayType) data.essayType = values.essayType;
      if (values.essayPrompt) data.essayPrompt = values.essayPrompt;
      if (values.essayContent) data.essayContent = values.essayContent;
    }

    submitMutation.mutate(data);
  };

  const round = form.watch('round');

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <GraduationCap className="h-5 w-5" />
              {t('title')}
            </DialogTitle>
            <DialogDescription>{t('description')}</DialogDescription>
          </DialogHeader>

          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)}>
              <div className="grid gap-4 max-h-[60vh] overflow-y-auto pr-2">
                {/* School Selection */}
                <div className="space-y-2">
                  <FormLabel>{tCommon('search')} *</FormLabel>
                  <Button
                    type="button"
                    variant="outline"
                    className="w-full justify-start"
                    onClick={() => setSchoolSelectorOpen(true)}
                  >
                    {selectedSchool ? (
                      <span>{getSchoolName(selectedSchool, locale)}</span>
                    ) : (
                      <span className="text-muted-foreground">{t('selectSchool')}</span>
                    )}
                  </Button>
                </div>

                <div className="grid gap-4 sm:grid-cols-2">
                  <FormField
                    control={form.control}
                    name="year"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>{t('yearLabel')} *</FormLabel>
                        <Select onValueChange={field.onChange} value={field.value}>
                          <FormControl>
                            <SelectTrigger>
                              <SelectValue />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            {[2026, 2025, 2024, 2023, 2022].map((year) => (
                              <SelectItem key={year} value={year.toString()}>
                                {year}
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
                    name="round"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>{t('roundLabel')}</FormLabel>
                        <Select onValueChange={field.onChange} value={field.value}>
                          <FormControl>
                            <SelectTrigger>
                              <SelectValue placeholder={t('roundPlaceholder')} />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            {ROUND_KEYS.map((r) => (
                              <SelectItem key={r.value} value={r.value}>
                                {t(`rounds.${r.labelKey}`)}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>

                <div className="grid gap-4 sm:grid-cols-2">
                  <FormField
                    control={form.control}
                    name="result"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>{t('resultLabel')} *</FormLabel>
                        <Select onValueChange={field.onChange} value={field.value}>
                          <FormControl>
                            <SelectTrigger>
                              <SelectValue placeholder={t('resultPlaceholder')} />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            {RESULT_KEYS.map((r) => (
                              <SelectItem key={r.value} value={r.value}>
                                {t(`results.${r.labelKey}`)}
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
                    name="major"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>{t('majorLabel')}</FormLabel>
                        <FormControl>
                          <Input placeholder={t('majorPlaceholder')} {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>

                <div className="grid gap-4 sm:grid-cols-3">
                  <FormField
                    control={form.control}
                    name="gpaRange"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>{t('gpaLabel')}</FormLabel>
                        <FormControl>
                          <Input placeholder={t('gpaPlaceholder')} {...field} />
                        </FormControl>
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="gpa9"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>{t('gpa9Label')}</FormLabel>
                        <FormControl>
                          <Input
                            type="number"
                            step="0.01"
                            min="0"
                            max="5"
                            placeholder="9"
                            {...field}
                          />
                        </FormControl>
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="gpa10"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>{t('gpa10Label')}</FormLabel>
                        <FormControl>
                          <Input
                            type="number"
                            step="0.01"
                            min="0"
                            max="5"
                            placeholder="10"
                            {...field}
                          />
                        </FormControl>
                      </FormItem>
                    )}
                  />
                </div>
                <div className="grid gap-4 sm:grid-cols-3">
                  <FormField
                    control={form.control}
                    name="gpa11"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>{t('gpa11Label')}</FormLabel>
                        <FormControl>
                          <Input
                            type="number"
                            step="0.01"
                            min="0"
                            max="5"
                            placeholder="11"
                            {...field}
                          />
                        </FormControl>
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="gpa12"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>{t('gpa12Label')}</FormLabel>
                        <FormControl>
                          <Input
                            type="number"
                            step="0.01"
                            min="0"
                            max="5"
                            placeholder="12"
                            {...field}
                          />
                        </FormControl>
                      </FormItem>
                    )}
                  />
                  {round === 'UC' && (
                    <>
                      <FormField
                        control={form.control}
                        name="ucCappedGpa"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>{t('ucCappedGpaLabel')}</FormLabel>
                            <FormControl>
                              <Input
                                type="number"
                                step="0.01"
                                min="0"
                                max="5"
                                placeholder={t('ucCappedGpaLabel')}
                                {...field}
                              />
                            </FormControl>
                          </FormItem>
                        )}
                      />
                      <FormField
                        control={form.control}
                        name="ucUncappedGpa"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>{t('ucUncappedGpaLabel')}</FormLabel>
                            <FormControl>
                              <Input
                                type="number"
                                step="0.01"
                                min="0"
                                max="5"
                                placeholder={t('ucUncappedGpaLabel')}
                                {...field}
                              />
                            </FormControl>
                          </FormItem>
                        )}
                      />
                    </>
                  )}
                  <FormField
                    control={form.control}
                    name="satRange"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>{t('satLabel')}</FormLabel>
                        <FormControl>
                          <Input placeholder={t('satPlaceholder')} {...field} />
                        </FormControl>
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="toeflRange"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>{t('toeflLabel')}</FormLabel>
                        <FormControl>
                          <Input placeholder={t('toeflPlaceholder')} {...field} />
                        </FormControl>
                      </FormItem>
                    )}
                  />
                </div>

                <FormField
                  control={form.control}
                  name="tags"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>{t('tagsLabel')}</FormLabel>
                      <FormControl>
                        <Input placeholder={t('tagsPlaceholder')} {...field} />
                      </FormControl>
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="activityList"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>{t('activityListLabel')}</FormLabel>
                      <FormControl>
                        <Textarea
                          placeholder={t('activityListPlaceholder')}
                          rows={4}
                          className="resize-y"
                          {...field}
                        />
                      </FormControl>
                    </FormItem>
                  )}
                />

                <DetailsSection
                  nationality={form.watch('nationality') || ''}
                  actRange={form.watch('actRange') || ''}
                  apCount={form.watch('apCount') || ''}
                  apSubjects={form.watch('apSubjects') || ''}
                  ibScore={form.watch('ibScore') || ''}
                  narrative={form.watch('narrative') || ''}
                  demographicTags={demographicTags}
                  onFieldChange={handleFieldChange}
                  onDemographicTagsChange={setDemographicTags}
                />

                <EssaySection
                  includeEssay={includeEssay}
                  setIncludeEssay={setIncludeEssay}
                  essayType={form.watch('essayType') || ''}
                  essayPrompt={form.watch('essayPrompt') || ''}
                  essayContent={form.watch('essayContent') || ''}
                  visibility={form.watch('visibility') || 'ANONYMOUS'}
                  onFieldChange={handleFieldChange}
                />
              </div>

              <DialogFooter className="mt-4">
                <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
                  {tCommon('cancel')}
                </Button>
                <Button type="submit" disabled={!selectedSchool || submitMutation.isPending}>
                  {submitMutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  <Send className="mr-2 h-4 w-4" />
                  {t('submitButton')}
                </Button>
              </DialogFooter>
            </form>
          </Form>
        </DialogContent>
      </Dialog>

      <SchoolSelector
        open={schoolSelectorOpen}
        onOpenChange={setSchoolSelectorOpen}
        selectedSchools={selectedSchool ? [selectedSchool] : []}
        onSelect={(schools) => setSelectedSchool(schools[0] || null)}
        maxSelection={1}
        title={t('selectSchoolTitle')}
      />
    </>
  );
}
