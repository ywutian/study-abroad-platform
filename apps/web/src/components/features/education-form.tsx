/* eslint-disable @typescript-eslint/no-explicit-any */
'use client';

import { useState, useEffect, useCallback } from 'react';
import { useTranslations } from 'next-intl';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
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
import { apiClient } from '@/lib/api';
import { toast } from 'sonner';
import { Loader2, Save, ChevronsUpDown, Check, X } from 'lucide-react';
import { cn } from '@/lib/utils';

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
      const data = await apiClient.get<HighSchool[]>('/high-schools', {
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

  const [formData, setFormData] = useState({
    schoolName: '',
    schoolType: '',
    degree: '',
    major: '',
    startDate: '',
    endDate: '',
    gpa: '',
    gpaScale: '4.0',
    gpaSystem: '' as string,
    description: '',
    highSchoolId: '' as string | undefined,
  });

  const [hsPopoverOpen, setHsPopoverOpen] = useState(false);
  const isHighSchool = formData.schoolType === 'HIGH_SCHOOL';
  const { search, setSearch, results, loading } = useHighSchoolSearch(
    isHighSchool && hsPopoverOpen
  );

  useEffect(() => {
    if (education) {
      setFormData({
        schoolName: education.schoolName || '',
        schoolType: education.schoolType || '',
        degree: education.degree || '',
        major: education.major || '',
        startDate: education.startDate?.slice(0, 10) || '',
        endDate: education.endDate?.slice(0, 10) || '',
        gpa: education.gpa?.toString() || '',
        gpaScale: education.gpaScale?.toString() || '4.0',
        gpaSystem: '',
        description: education.description || '',
        highSchoolId: education.highSchoolId || undefined,
      });
    } else {
      setFormData({
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
        highSchoolId: undefined,
      });
    }
  }, [education, open]);

  const createMutation = useMutation({
    mutationFn: (data: any) => apiClient.post('/profiles/me/education', data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['profile'] });
      onOpenChange(false);
      toast.success(t('toast.educationAdded'));
      onSuccess?.();
    },
  });

  const updateMutation = useMutation({
    mutationFn: (data: any) => apiClient.put(`/profiles/me/education/${education?.id}`, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['profile'] });
      onOpenChange(false);
      toast.success(t('toast.educationUpdated'));
      onSuccess?.();
    },
  });

  const handleSubmit = () => {
    const data: any = {
      schoolName: formData.schoolName,
      schoolType: formData.schoolType || undefined,
      degree: formData.degree || undefined,
      major: formData.major || undefined,
      startDate: formData.startDate || undefined,
      endDate: formData.endDate || undefined,
      gpa: formData.gpa ? parseFloat(formData.gpa) : undefined,
      gpaScale: formData.gpaScale ? parseFloat(formData.gpaScale) : undefined,
      gpaSystem: formData.gpaSystem || undefined,
      description: formData.description || undefined,
    };

    if (isHighSchool) {
      data.highSchoolId = formData.highSchoolId || undefined;
    }

    if (isEditing) {
      updateMutation.mutate(data);
    } else {
      createMutation.mutate(data);
    }
  };

  const handleSelectHighSchool = (hs: HighSchool) => {
    setFormData({
      ...formData,
      schoolName: hs.nameZh || hs.name,
      highSchoolId: hs.id,
    });
    setHsPopoverOpen(false);
  };

  const handleClearHighSchool = () => {
    setFormData({ ...formData, highSchoolId: undefined });
  };

  const handleSchoolTypeChange = (value: string) => {
    setFormData({
      ...formData,
      schoolType: value,
      // Clear highSchoolId when switching away from HIGH_SCHOOL
      highSchoolId: value === 'HIGH_SCHOOL' ? formData.highSchoolId : undefined,
    });
  };

  const handleGpaSystemChange = (value: string) => {
    const option = GPA_SYSTEM_OPTIONS.find((o) => o.value === value);
    setFormData({
      ...formData,
      gpaSystem: value,
      gpaScale: option?.gpaScale || formData.gpaScale,
    });
  };

  const isPending = createMutation.isPending || updateMutation.isPending;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>{isEditing ? t('form.editEducation') : t('form.addEducation')}</DialogTitle>
          <DialogDescription>
            {isEditing ? t('form.editEducationDesc') : t('form.addEducationDesc')}
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-4">
          {/* School Type selector — placed first so high school search can appear */}
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label>{t('form.schoolType')}</Label>
              <Select value={formData.schoolType} onValueChange={handleSchoolTypeChange}>
                <SelectTrigger>
                  <SelectValue placeholder={t('form.selectType')} />
                </SelectTrigger>
                <SelectContent>
                  {SCHOOL_TYPE_KEYS.map((type) => (
                    <SelectItem key={type.value} value={type.value}>
                      {t(`form.educationTypes.${type.labelKey}`)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>{t('form.degree')}</Label>
              <Input
                placeholder={t('form.degreePlaceholder')}
                value={formData.degree}
                onChange={(e) => setFormData({ ...formData, degree: e.target.value })}
              />
            </div>
          </div>

          {/* School Name — Combobox for HIGH_SCHOOL, plain Input otherwise */}
          <div className="space-y-2">
            <Label>{t('form.schoolName')} *</Label>
            {isHighSchool ? (
              <div className="flex gap-2">
                <Popover open={hsPopoverOpen} onOpenChange={setHsPopoverOpen} modal>
                  <PopoverTrigger asChild>
                    <Button
                      variant="outline"
                      role="combobox"
                      aria-expanded={hsPopoverOpen}
                      className="w-full justify-between font-normal"
                    >
                      <span className="truncate">
                        {formData.schoolName || t('form.searchHighSchool')}
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
                                onClick={async () => {
                                  try {
                                    await apiClient.post('/high-schools/suggest', {
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
                                    formData.highSchoolId === hs.id ? 'opacity-100' : 'opacity-0'
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
                        value={formData.schoolName}
                        onChange={(e) =>
                          setFormData({
                            ...formData,
                            schoolName: e.target.value,
                            highSchoolId: undefined,
                          })
                        }
                        className="h-8 text-sm"
                      />
                    </div>
                  </PopoverContent>
                </Popover>
                {formData.highSchoolId && (
                  <Button
                    variant="ghost"
                    size="icon"
                    className="shrink-0"
                    onClick={handleClearHighSchool}
                  >
                    <X className="h-4 w-4" />
                  </Button>
                )}
              </div>
            ) : (
              <Input
                placeholder={t('form.schoolNamePlaceholder')}
                value={formData.schoolName}
                onChange={(e) => setFormData({ ...formData, schoolName: e.target.value })}
              />
            )}
          </div>

          <div className="space-y-2">
            <Label>{t('form.major')}</Label>
            <Input
              placeholder={t('form.majorPlaceholder')}
              value={formData.major}
              onChange={(e) => setFormData({ ...formData, major: e.target.value })}
            />
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label>{t('form.startDate')}</Label>
              <Input
                type="date"
                value={formData.startDate}
                onChange={(e) => setFormData({ ...formData, startDate: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label>{t('form.endDate')}</Label>
              <Input
                type="date"
                value={formData.endDate}
                onChange={(e) => setFormData({ ...formData, endDate: e.target.value })}
              />
            </div>
          </div>

          <div className="grid gap-4 sm:grid-cols-3">
            <div className="space-y-2">
              <Label>GPA</Label>
              <Input
                type="number"
                step="0.01"
                placeholder="3.85"
                value={formData.gpa}
                onChange={(e) => setFormData({ ...formData, gpa: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              {/* TODO: add i18n key for "GPA System" */}
              <Label>{t('form.gpaSystem')}</Label>
              <Select value={formData.gpaSystem} onValueChange={handleGpaSystemChange}>
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
            <div className="space-y-2">
              <Label>{t('form.gpaMax')}</Label>
              <Input
                type="number"
                step="0.1"
                placeholder="4.0"
                value={formData.gpaScale}
                onChange={(e) => setFormData({ ...formData, gpaScale: e.target.value })}
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label>{t('form.description')}</Label>
            <Textarea
              placeholder={t('form.descriptionPlaceholder')}
              value={formData.description}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              rows={3}
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            {tCommon('cancel')}
          </Button>
          <Button onClick={handleSubmit} disabled={!formData.schoolName || isPending}>
            {isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            <Save className="mr-2 h-4 w-4" />
            {tCommon('save')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
