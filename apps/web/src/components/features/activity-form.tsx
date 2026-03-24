'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { useTranslations } from 'next-intl';
import { useMutation, useQueryClient } from '@tanstack/react-query';
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
import { toast } from 'sonner';
import { apiClient } from '@/lib/api';
import { Save, Loader2, Sparkles, HelpCircle } from 'lucide-react';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';

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

export function ActivityForm({ open, onOpenChange, editingActivity }: ActivityFormProps) {
  const t = useTranslations('profile');
  const tCommon = useTranslations('common');
  const queryClient = useQueryClient();
  const isEditing = !!editingActivity;

  const [formData, setFormData] = useState({
    name: '',
    category: '',
    role: '',
    organization: '',
    description: '',
    commonAppDescription: '',
    startDate: '',
    endDate: '',
    hoursPerWeek: '',
    weeksPerYear: '',
    isOngoing: false,
    gradeLevels: [] as number[],
    timing: '',
    activityTemplateId: '',
  });

  const [selectedTemplate, setSelectedTemplate] = useState<ActivityTemplate | null>(null);
  const [suggestions, setSuggestions] = useState<ActivityTemplate[]>([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const searchTimeoutRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const suggestionsRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (editingActivity) {
      setFormData({
        name: editingActivity.name || '',
        category: editingActivity.category || '',
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
        timing: editingActivity.timing || '',
        activityTemplateId: editingActivity.activityTemplateId || '',
      });
      setSelectedTemplate(editingActivity.activityTemplate || null);
    } else {
      resetForm();
    }
  }, [editingActivity, open]);

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
    setFormData((p) => ({ ...p, name: value }));
    setSelectedTemplate(null);
    setFormData((p) => ({ ...p, activityTemplateId: '' }));

    if (searchTimeoutRef.current) clearTimeout(searchTimeoutRef.current);
    searchTimeoutRef.current = setTimeout(() => searchTemplates(value), 300);
  };

  const handleSelectTemplate = (template: ActivityTemplate) => {
    setSelectedTemplate(template);
    setFormData((p) => ({
      ...p,
      name: template.name,
      category: template.category,
      activityTemplateId: template.id,
    }));
    setShowSuggestions(false);
    setSuggestions([]);
  };

  const handleGradeLevelToggle = (grade: number) => {
    setFormData((p) => ({
      ...p,
      gradeLevels: p.gradeLevels.includes(grade)
        ? p.gradeLevels.filter((g) => g !== grade)
        : [...p.gradeLevels, grade].sort(),
    }));
  };

  const createMutation = useMutation({
    mutationFn: (data: unknown) => apiClient.post('/profiles/me/activities', data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['profile'] });
      toast.success(t('toast.activityAdded'));
      onOpenChange(false);
      resetForm();
    },
  });

  const updateMutation = useMutation({
    mutationFn: (data: unknown) =>
      apiClient.put(`/profiles/me/activities/${editingActivity?.id}`, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['profile'] });
      toast.success(t('toast.activityUpdated'));
      onOpenChange(false);
      resetForm();
    },
  });

  const refineMutation = useMutation({
    mutationFn: (activityId: string) =>
      apiClient.post<{ refined: string; tips: string }>(
        `/profiles/me/activities/${activityId}/refine`
      ),
    onSuccess: (data) => {
      setFormData((p) => ({ ...p, description: data.refined }));
      if (data.tips) {
        toast.success(data.tips);
      } else {
        toast.success(t('toast.activityRefined'));
      }
    },
  });

  const generateCommonAppMutation = useMutation({
    mutationFn: (activityId: string) =>
      apiClient.post<{ commonAppDescription: string }>(
        `/profiles/me/activities/${activityId}/generate-common-app-description`,
        { description: formData.description }
      ),
    onSuccess: (data) => {
      setFormData((p) => ({ ...p, commonAppDescription: data.commonAppDescription }));
      toast.success(t('form.aiGenerateSuccess'));
    },
  });

  const resetForm = () => {
    setFormData({
      name: '',
      category: '',
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
    });
    setSelectedTemplate(null);
    setSuggestions([]);
    setShowSuggestions(false);
  };

  const handleSubmit = () => {
    if (!formData.name || !formData.category || !formData.role) {
      toast.error(t('validation.activityRequired'));
      return;
    }

    const data: Record<string, unknown> = {
      name: formData.name,
      category: formData.category,
      role: formData.role,
      organization: formData.organization || undefined,
      description: formData.description || undefined,
      commonAppDescription: formData.commonAppDescription || undefined,
      startDate: formData.startDate || undefined,
      endDate: formData.isOngoing ? undefined : formData.endDate || undefined,
      hoursPerWeek: formData.hoursPerWeek ? parseInt(formData.hoursPerWeek) : undefined,
      weeksPerYear: formData.weeksPerYear ? parseInt(formData.weeksPerYear) : undefined,
      isOngoing: formData.isOngoing,
      gradeLevels: formData.gradeLevels.length > 0 ? formData.gradeLevels : undefined,
      timing: formData.timing || undefined,
      activityTemplateId: formData.activityTemplateId || undefined,
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
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{isEditing ? t('form.editActivity') : t('form.addActivity')}</DialogTitle>
        </DialogHeader>

        <div className="space-y-4 py-4">
          {/* Name with template autocomplete */}
          <div className="space-y-2">
            <Label>{t('form.activityName')} *</Label>
            <div className="relative" ref={suggestionsRef}>
              <Input
                value={formData.name}
                onChange={(e) => handleNameChange(e.target.value)}
                onFocus={() => {
                  if (suggestions.length > 0) setShowSuggestions(true);
                }}
                placeholder={t('form.activityNamePlaceholder')}
                maxLength={100}
              />
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
                            <span className="ml-1 text-muted-foreground">({tmpl.nameZh})</span>
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
                <span>Linked to template</span>
              </div>
            )}
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>{t('form.activityCategory')} *</Label>
              <Select
                value={formData.category}
                onValueChange={(v) => setFormData((p) => ({ ...p, category: v }))}
              >
                <SelectTrigger>
                  <SelectValue placeholder={t('form.selectCategory')} />
                </SelectTrigger>
                <SelectContent>
                  {ACTIVITY_CATEGORY_KEYS.map((c) => (
                    <SelectItem key={c.value} value={c.value}>
                      {t(`activityCategories.${c.labelKey}`)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>{t('form.role')} *</Label>
              <Input
                value={formData.role}
                onChange={(e) => setFormData((p) => ({ ...p, role: e.target.value }))}
                placeholder={t('form.rolePlaceholder')}
                maxLength={100}
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label>{t('form.organization')}</Label>
            <Input
              value={formData.organization}
              onChange={(e) => setFormData((p) => ({ ...p, organization: e.target.value }))}
              placeholder={t('form.organizationPlaceholder')}
              maxLength={100}
            />
          </div>

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
              value={formData.description}
              onChange={(e) => setFormData((p) => ({ ...p, description: e.target.value }))}
              placeholder={t('form.activityDescPlaceholder')}
              rows={3}
              maxLength={500}
            />
            {/* Segmented indicator bar: green up to 150/500 (30%) */}
            <div className="h-0.5 w-full rounded-full bg-muted overflow-hidden">
              <div className="relative h-full">
                <div
                  className="absolute h-full bg-success rounded-full transition-all"
                  style={{ width: `${Math.min((formData.description.length / 500) * 100, 30)}%` }}
                />
                {formData.description.length > 150 && (
                  <div
                    className={`absolute h-full rounded-r-full transition-all ${formData.description.length > 400 ? 'bg-warning' : 'bg-muted-foreground/30'}`}
                    style={{
                      left: '30%',
                      width: `${Math.min(((formData.description.length - 150) / 500) * 100, 70)}%`,
                    }}
                  />
                )}
                {/* 150-char marker */}
                <div className="absolute top-0 h-full w-px bg-border" style={{ left: '30%' }} />
              </div>
            </div>
            <div className="flex items-center justify-between">
              <p className="text-xs text-muted-foreground">
                {formData.description.length === 0
                  ? t('form.activityDescHelperEmpty')
                  : formData.description.length <= 150
                    ? t('form.activityDescHelperWithin')
                    : t('form.activityDescHelperOver')}
              </p>
              <p
                className={`text-xs tabular-nums ${
                  formData.description.length === 0
                    ? 'text-muted-foreground'
                    : formData.description.length <= 150
                      ? 'text-success'
                      : formData.description.length > 400
                        ? 'text-warning'
                        : 'text-muted-foreground'
                }`}
              >
                {t('form.activityCharCount', { count: formData.description.length, max: 500 })}
              </p>
            </div>
            {isEditing && editingActivity && formData.description.length > 150 && (
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
          {isEditing && editingActivity && formData.description.length > 150 && (
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
            <p className="text-xs text-muted-foreground">{t('form.commonAppDescriptionHelper')}</p>
            <Textarea
              value={formData.commonAppDescription}
              onChange={(e) => setFormData((p) => ({ ...p, commonAppDescription: e.target.value }))}
              placeholder={t('form.commonAppDescriptionPlaceholder')}
              rows={2}
              maxLength={150}
            />
            <div className="flex items-center justify-end">
              <p
                className={`text-xs tabular-nums ${
                  formData.commonAppDescription.length === 0
                    ? 'text-muted-foreground'
                    : formData.commonAppDescription.length <= 150
                      ? 'text-success'
                      : 'text-warning'
                }`}
              >
                {t('form.activityCharCount', {
                  count: formData.commonAppDescription.length,
                  max: 150,
                })}
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
                    formData.gradeLevels.includes(gl.value)
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
              value={formData.timing}
              onValueChange={(v) => setFormData((p) => ({ ...p, timing: v }))}
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
              <Input
                type="date"
                value={formData.startDate}
                onChange={(e) => setFormData((p) => ({ ...p, startDate: e.target.value }))}
              />
            </div>

            <div className="space-y-2">
              <Label>{t('form.endDate')}</Label>
              <Input
                type="date"
                value={formData.endDate}
                onChange={(e) => setFormData((p) => ({ ...p, endDate: e.target.value }))}
                disabled={formData.isOngoing}
              />
            </div>
          </div>

          <div className="flex items-center space-x-2">
            <Checkbox
              id="isOngoing"
              checked={formData.isOngoing}
              onCheckedChange={(checked) =>
                setFormData((p) => ({ ...p, isOngoing: checked as boolean }))
              }
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
                value={formData.hoursPerWeek}
                onChange={(e) => setFormData((p) => ({ ...p, hoursPerWeek: e.target.value }))}
                placeholder="1 - 40"
                min={1}
                max={40}
              />
            </div>

            <div className="space-y-2">
              <Label>{t('form.weeksPerYear')}</Label>
              <Input
                type="number"
                value={formData.weeksPerYear}
                onChange={(e) => setFormData((p) => ({ ...p, weeksPerYear: e.target.value }))}
                placeholder="1 - 52"
                min={1}
                max={52}
              />
            </div>
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
