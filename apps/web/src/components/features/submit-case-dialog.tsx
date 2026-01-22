'use client';

import { useState } from 'react';
import { useTranslations, useLocale } from 'next-intl';
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
import { apiClient } from '@/lib/api';
import { toast } from 'sonner';
import { Switch } from '@/components/ui/switch';
import { Loader2, Send, GraduationCap, PenTool } from 'lucide-react';
import { getSchoolName } from '@/lib/utils';
import { SchoolSelector } from './school-selector';

const ESSAY_TYPES = [
  { value: 'COMMON_APP', label: 'Common App' },
  { value: 'UC', label: 'UC' },
  { value: 'SUPPLEMENTAL', label: 'Supplemental' },
  { value: 'WHY_SCHOOL', label: 'Why School' },
  { value: 'SHORT_ANSWER', label: 'Short Answer' },
  { value: 'ACTIVITY', label: 'Activity' },
  { value: 'OPTIONAL', label: 'Optional' },
  { value: 'OTHER', label: 'Other' },
];

const VISIBILITY_OPTIONS = [
  { value: 'ANONYMOUS', labelKey: 'anonymous' },
  { value: 'PUBLIC', labelKey: 'public' },
  { value: 'VERIFIED_ONLY', labelKey: 'verifiedOnly' },
];

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
  const [formData, setFormData] = useState({
    year: new Date().getFullYear().toString(),
    round: '',
    result: '',
    major: '',
    gpaRange: '',
    satRange: '',
    toeflRange: '',
    tags: '',
    reflection: '',
    // Essay fields
    essayType: '',
    essayPrompt: '',
    essayContent: '',
    visibility: 'ANONYMOUS',
  });

  const submitMutation = useMutation({
    mutationFn: (data: any) => apiClient.post('/cases', data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['cases'] });
      onOpenChange(false);
      resetForm();
      toast.success(t('toast.success'));
      onSuccess?.();
    },
    onError: (error: Error) => {
      toast.error(error.message);
    },
  });

  const resetForm = () => {
    setFormData({
      year: new Date().getFullYear().toString(),
      round: '',
      result: '',
      major: '',
      gpaRange: '',
      satRange: '',
      toeflRange: '',
      tags: '',
      reflection: '',
      essayType: '',
      essayPrompt: '',
      essayContent: '',
      visibility: 'ANONYMOUS',
    });
    setSelectedSchool(null);
    setIncludeEssay(defaultIncludeEssay);
  };

  const handleSubmit = () => {
    if (!selectedSchool || !formData.result) {
      toast.error(t('toast.requiredFields'));
      return;
    }

    const data: Record<string, any> = {
      schoolId: selectedSchool.id,
      year: parseInt(formData.year),
      round: formData.round || undefined,
      result: formData.result,
      major: formData.major || undefined,
      gpaRange: formData.gpaRange || undefined,
      satRange: formData.satRange || undefined,
      toeflRange: formData.toeflRange || undefined,
      tags: formData.tags
        ? formData.tags
            .split(',')
            .map((t) => t.trim())
            .filter(Boolean)
        : undefined,
      reflection: formData.reflection || undefined,
      visibility: formData.visibility || 'ANONYMOUS',
    };

    // Add essay fields if included
    if (includeEssay) {
      if (formData.essayType) data.essayType = formData.essayType;
      if (formData.essayPrompt) data.essayPrompt = formData.essayPrompt;
      if (formData.essayContent) data.essayContent = formData.essayContent;
    }

    submitMutation.mutate(data);
  };

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <GraduationCap className="h-5 w-5" />
              {t('title')}
            </DialogTitle>
            <DialogDescription>{t('description')}</DialogDescription>
          </DialogHeader>

          <div className="grid gap-4 max-h-[60vh] overflow-y-auto pr-2">
            {/* School Selection */}
            <div className="space-y-2">
              <Label>{tCommon('search')} *</Label>
              <Button
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
              <div className="space-y-2">
                <Label>{t('yearLabel')} *</Label>
                <Select
                  value={formData.year}
                  onValueChange={(value) => setFormData({ ...formData, year: value })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {[2026, 2025, 2024, 2023, 2022].map((year) => (
                      <SelectItem key={year} value={year.toString()}>
                        {year}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label>{t('roundLabel')}</Label>
                <Select
                  value={formData.round}
                  onValueChange={(value) => setFormData({ ...formData, round: value })}
                >
                  <SelectTrigger>
                    <SelectValue placeholder={t('roundPlaceholder')} />
                  </SelectTrigger>
                  <SelectContent>
                    {ROUND_KEYS.map((round) => (
                      <SelectItem key={round.value} value={round.value}>
                        {t(`rounds.${round.labelKey}`)}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label>{t('resultLabel')} *</Label>
                <Select
                  value={formData.result}
                  onValueChange={(value) => setFormData({ ...formData, result: value })}
                >
                  <SelectTrigger>
                    <SelectValue placeholder={t('resultPlaceholder')} />
                  </SelectTrigger>
                  <SelectContent>
                    {RESULT_KEYS.map((r) => (
                      <SelectItem key={r.value} value={r.value}>
                        {t(`results.${r.labelKey}`)}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label>{t('majorLabel')}</Label>
                <Input
                  placeholder={t('majorPlaceholder')}
                  value={formData.major}
                  onChange={(e) => setFormData({ ...formData, major: e.target.value })}
                />
              </div>
            </div>

            <div className="grid gap-4 sm:grid-cols-3">
              <div className="space-y-2">
                <Label>{t('gpaLabel')}</Label>
                <Input
                  placeholder={t('gpaPlaceholder')}
                  value={formData.gpaRange}
                  onChange={(e) => setFormData({ ...formData, gpaRange: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label>{t('satLabel')}</Label>
                <Input
                  placeholder={t('satPlaceholder')}
                  value={formData.satRange}
                  onChange={(e) => setFormData({ ...formData, satRange: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label>{t('toeflLabel')}</Label>
                <Input
                  placeholder={t('toeflPlaceholder')}
                  value={formData.toeflRange}
                  onChange={(e) => setFormData({ ...formData, toeflRange: e.target.value })}
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label>{t('tagsLabel')}</Label>
              <Input
                placeholder={t('tagsPlaceholder')}
                value={formData.tags}
                onChange={(e) => setFormData({ ...formData, tags: e.target.value })}
              />
            </div>

            <div className="space-y-2">
              <Label>{t('reflectionLabel')}</Label>
              <Textarea
                placeholder={t('reflectionPlaceholder')}
                value={formData.reflection}
                onChange={(e) => setFormData({ ...formData, reflection: e.target.value })}
                rows={4}
              />
            </div>

            {/* Essay Section */}
            <div className="border-t pt-4 space-y-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <PenTool className="h-4 w-4 text-primary" />
                  <Label className="font-medium">{t('includeEssay')}</Label>
                </div>
                <Switch checked={includeEssay} onCheckedChange={setIncludeEssay} />
              </div>

              {includeEssay && (
                <div className="space-y-4 pl-1">
                  <div className="grid gap-4 sm:grid-cols-2">
                    <div className="space-y-2">
                      <Label>{t('essayTypeLabel')}</Label>
                      <Select
                        value={formData.essayType}
                        onValueChange={(value) => setFormData({ ...formData, essayType: value })}
                      >
                        <SelectTrigger>
                          <SelectValue placeholder={t('essayTypePlaceholder')} />
                        </SelectTrigger>
                        <SelectContent>
                          {ESSAY_TYPES.map((type) => (
                            <SelectItem key={type.value} value={type.value}>
                              {type.label}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-2">
                      <Label>{t('visibilityLabel')}</Label>
                      <Select
                        value={formData.visibility}
                        onValueChange={(value) => setFormData({ ...formData, visibility: value })}
                      >
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {VISIBILITY_OPTIONS.map((v) => (
                            <SelectItem key={v.value} value={v.value}>
                              {t(`visibility.${v.labelKey}`)}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label>{t('essayPromptLabel')}</Label>
                    <Textarea
                      placeholder={t('essayPromptPlaceholder')}
                      value={formData.essayPrompt}
                      onChange={(e) => setFormData({ ...formData, essayPrompt: e.target.value })}
                      rows={2}
                    />
                  </div>

                  <div className="space-y-2">
                    <Label>{t('essayContentLabel')}</Label>
                    <Textarea
                      placeholder={t('essayContentPlaceholder')}
                      value={formData.essayContent}
                      onChange={(e) => setFormData({ ...formData, essayContent: e.target.value })}
                      rows={8}
                    />
                    {formData.essayContent && (
                      <p className="text-xs text-muted-foreground">
                        {formData.essayContent.split(/\s+/).filter(Boolean).length} words
                      </p>
                    )}
                  </div>
                </div>
              )}
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => onOpenChange(false)}>
              {tCommon('cancel')}
            </Button>
            <Button
              onClick={handleSubmit}
              disabled={!selectedSchool || !formData.result || submitMutation.isPending}
            >
              {submitMutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              <Send className="mr-2 h-4 w-4" />
              {t('submitButton')}
            </Button>
          </DialogFooter>
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
