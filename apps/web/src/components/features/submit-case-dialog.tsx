/* eslint-disable @typescript-eslint/no-explicit-any */
'use client';

import { useState, useCallback } from 'react';
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
import { caseRoutes } from '@study-abroad/shared';
import { toast } from 'sonner';
import { Loader2, Send, GraduationCap } from 'lucide-react';
import { getSchoolName } from '@/lib/utils';
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

  const handleFieldChange = useCallback((field: string, value: string) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
  }, []);
  const [formData, setFormData] = useState({
    year: new Date().getFullYear().toString(),
    round: '',
    result: '',
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
    // Essay fields
    essayType: '',
    essayPrompt: '',
    essayContent: '',
    visibility: 'ANONYMOUS',
  });

  const submitMutation = useMutation({
    mutationFn: (data: any) => apiClient.post(caseRoutes.list(), data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['cases'] });
      onOpenChange(false);
      resetForm();
      toast.success(t('toast.success'));
      setTimeout(() => {
        toast(t('toast.inviteSchoolmates'), { duration: 5000 });
      }, 1500);
      onSuccess?.();
    },
  });

  const resetForm = () => {
    setFormData({
      year: new Date().getFullYear().toString(),
      round: '',
      result: '',
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
    });
    setDemographicTags([]);
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
      gpa9: formData.gpa9 ? parseFloat(formData.gpa9) : undefined,
      gpa10: formData.gpa10 ? parseFloat(formData.gpa10) : undefined,
      gpa11: formData.gpa11 ? parseFloat(formData.gpa11) : undefined,
      gpa12: formData.gpa12 ? parseFloat(formData.gpa12) : undefined,
      ucCappedGpa: formData.ucCappedGpa ? parseFloat(formData.ucCappedGpa) : undefined,
      ucUncappedGpa: formData.ucUncappedGpa ? parseFloat(formData.ucUncappedGpa) : undefined,
      gpaScale: formData.gpaScale ? parseFloat(formData.gpaScale) : undefined,
      satRange: formData.satRange || undefined,
      actRange: formData.actRange || undefined,
      toeflRange: formData.toeflRange || undefined,
      nationality: formData.nationality || undefined,
      apCount: formData.apCount ? parseInt(formData.apCount) : undefined,
      apSubjects: formData.apSubjects
        ? formData.apSubjects
            .split(',')
            .map((s) => s.trim())
            .filter(Boolean)
        : undefined,
      ibScore: formData.ibScore ? parseInt(formData.ibScore) : undefined,
      narrative: formData.narrative?.trim() || undefined,
      demographicTags: demographicTags.length > 0 ? demographicTags : undefined,
      tags: formData.tags
        ? formData.tags
            .split(',')
            .map((t) => t.trim())
            .filter(Boolean)
        : undefined,
      activityList: formData.activityList?.trim() || undefined,
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
                <Label>{t('gpa9Label')}</Label>
                <Input
                  type="number"
                  step="0.01"
                  min="0"
                  max="5"
                  placeholder="9"
                  value={formData.gpa9}
                  onChange={(e) => setFormData({ ...formData, gpa9: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label>{t('gpa10Label')}</Label>
                <Input
                  type="number"
                  step="0.01"
                  min="0"
                  max="5"
                  placeholder="10"
                  value={formData.gpa10}
                  onChange={(e) => setFormData({ ...formData, gpa10: e.target.value })}
                />
              </div>
            </div>
            <div className="grid gap-4 sm:grid-cols-3">
              <div className="space-y-2">
                <Label>{t('gpa11Label')}</Label>
                <Input
                  type="number"
                  step="0.01"
                  min="0"
                  max="5"
                  placeholder="11"
                  value={formData.gpa11}
                  onChange={(e) => setFormData({ ...formData, gpa11: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label>{t('gpa12Label')}</Label>
                <Input
                  type="number"
                  step="0.01"
                  min="0"
                  max="5"
                  placeholder="12"
                  value={formData.gpa12}
                  onChange={(e) => setFormData({ ...formData, gpa12: e.target.value })}
                />
              </div>
              {formData.round === 'UC' && (
                <>
                  <div className="space-y-2">
                    <Label>{t('ucCappedGpaLabel')}</Label>
                    <Input
                      type="number"
                      step="0.01"
                      min="0"
                      max="5"
                      placeholder="UC Capped GPA"
                      value={formData.ucCappedGpa}
                      onChange={(e) => setFormData({ ...formData, ucCappedGpa: e.target.value })}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>{t('ucUncappedGpaLabel')}</Label>
                    <Input
                      type="number"
                      step="0.01"
                      min="0"
                      max="5"
                      placeholder="UC Uncapped GPA"
                      value={formData.ucUncappedGpa}
                      onChange={(e) => setFormData({ ...formData, ucUncappedGpa: e.target.value })}
                    />
                  </div>
                </>
              )}
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
              <Label>{t('activityListLabel')}</Label>
              <Textarea
                placeholder={t('activityListPlaceholder')}
                value={formData.activityList}
                onChange={(e) => setFormData({ ...formData, activityList: e.target.value })}
                rows={4}
                className="resize-y"
              />
            </div>

            <DetailsSection
              nationality={formData.nationality}
              actRange={formData.actRange}
              apCount={formData.apCount}
              apSubjects={formData.apSubjects}
              ibScore={formData.ibScore}
              narrative={formData.narrative}
              demographicTags={demographicTags}
              onFieldChange={handleFieldChange}
              onDemographicTagsChange={setDemographicTags}
            />

            <EssaySection
              includeEssay={includeEssay}
              setIncludeEssay={setIncludeEssay}
              essayType={formData.essayType}
              essayPrompt={formData.essayPrompt}
              essayContent={formData.essayContent}
              visibility={formData.visibility}
              onFieldChange={handleFieldChange}
            />
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
