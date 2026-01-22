'use client';

import { useState } from 'react';
import { useTranslations } from 'next-intl';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { ConfirmDialog } from '@/components/ui/confirm-dialog';
import { ComboboxTagInput } from '@/components/ui/combobox-tag-input';
import { PageTransition } from '@/components/ui/motion';
import { MapPin, BookOpen, DollarSign, Sparkles, Target, GraduationCap } from 'lucide-react';
import { US_REGIONS, US_MAJORS } from '@study-abroad/shared';
import type { RecommendationPreflight } from '@study-abroad/shared';
import type { GenerateRecommendationDto } from '@/hooks/use-recommendation';

const BUDGET_OPTIONS = ['low', 'medium', 'high', 'unlimited'] as const;
const SCHOOL_COUNT_OPTIONS = [10, 15, 20] as const;

interface RecommendationFormProps {
  onGenerate: (dto: GenerateRecommendationDto) => void;
  preflight?: RecommendationPreflight;
}

export function RecommendationForm({ onGenerate, preflight }: RecommendationFormProps) {
  const t = useTranslations('recommendation');

  const [regions, setRegions] = useState<string[]>([]);
  const [majors, setMajors] = useState<string[]>([]);
  const [budget, setBudget] = useState<string>('');
  const [schoolCount, setSchoolCount] = useState<number>(15);
  const [additionalPreferences, setAdditionalPreferences] = useState('');
  const [showConfirm, setShowConfirm] = useState(false);

  const canGenerate = preflight?.profileComplete ?? false;

  const handleSubmit = () => {
    if (!canGenerate) return;
    setShowConfirm(true);
  };

  const handleConfirm = () => {
    onGenerate({
      preferredRegions: regions.length > 0 ? regions : undefined,
      preferredMajors: majors.length > 0 ? majors : undefined,
      budget: budget || undefined,
      schoolCount,
      additionalPreferences: additionalPreferences || undefined,
    });
  };

  return (
    <PageTransition className="grid gap-6 lg:grid-cols-2">
      {/* Form */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">{t('preferences')}</CardTitle>
          <CardDescription>{t('preferencesDesc')}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Regions */}
          <div className="space-y-2">
            <Label className="flex items-center gap-2">
              <MapPin className="h-4 w-4" />
              {t('regions')}
            </Label>
            <ComboboxTagInput
              suggestions={US_REGIONS}
              selected={regions}
              onSelectedChange={setRegions}
              placeholder={t('regionsPlaceholder')}
              noMatchText={t('noMatchingRegions')}
            />
          </div>

          {/* Majors */}
          <div className="space-y-2">
            <Label className="flex items-center gap-2">
              <BookOpen className="h-4 w-4" />
              {t('majors')}
            </Label>
            <ComboboxTagInput
              suggestions={US_MAJORS}
              selected={majors}
              onSelectedChange={setMajors}
              placeholder={t('majorsPlaceholder')}
              noMatchText={t('noMatchingMajors')}
            />
          </div>

          {/* Budget + School Count row */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label className="flex items-center gap-2">
                <DollarSign className="h-4 w-4" />
                {t('budget')}
              </Label>
              <Select value={budget} onValueChange={setBudget}>
                <SelectTrigger>
                  <SelectValue placeholder={t('budgetPlaceholder')} />
                </SelectTrigger>
                <SelectContent>
                  {BUDGET_OPTIONS.map((opt) => (
                    <SelectItem key={opt} value={opt}>
                      {t(`budgetOptions.${opt}`)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label className="flex items-center gap-2">
                <GraduationCap className="h-4 w-4" />
                {t('schoolCountLabel')}
              </Label>
              <Select value={String(schoolCount)} onValueChange={(v) => setSchoolCount(Number(v))}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {SCHOOL_COUNT_OPTIONS.map((n) => (
                    <SelectItem key={n} value={String(n)}>
                      {t(`schoolCountOptions.${n}`)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Additional */}
          <div className="space-y-2">
            <Label>{t('additional')}</Label>
            <Textarea
              placeholder={t('additionalPlaceholder')}
              value={additionalPreferences}
              onChange={(e) => setAdditionalPreferences(e.target.value)}
              rows={3}
              maxLength={500}
            />
            {additionalPreferences.length > 0 && (
              <p className="text-xs text-muted-foreground text-right">
                {t('maxChars', {
                  count: additionalPreferences.length,
                  max: 500,
                })}
              </p>
            )}
          </div>

          {/* Generate Button */}
          <div className="pt-4">
            <Button onClick={handleSubmit} disabled={!canGenerate} className="w-full" size="lg">
              <Sparkles className="mr-2 h-5 w-5" />
              {t('generateBtn')}
            </Button>
            {!canGenerate && (
              <p className="text-xs text-destructive text-center mt-2">{t('profileIncomplete')}</p>
            )}
          </div>
        </CardContent>
      </Card>

      {/* How It Works Info Card */}
      <Card className="bg-primary/5 border-primary/10">
        <CardHeader>
          <CardTitle className="text-lg">{t('howItWorks')}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {[
            { icon: Target, titleKey: 'step1Title', descKey: 'step1Desc' },
            { icon: Sparkles, titleKey: 'step2Title', descKey: 'step2Desc' },
            {
              icon: GraduationCap,
              titleKey: 'step3Title',
              descKey: 'step3Desc',
            },
          ].map(({ icon: Icon, titleKey, descKey }) => (
            <div key={titleKey} className="flex gap-3">
              <div className="p-2 rounded-lg bg-primary/10 h-fit">
                <Icon className="h-5 w-5 text-primary" />
              </div>
              <div>
                <p className="font-medium">{t(titleKey)}</p>
                <p className="text-sm text-muted-foreground">{t(descKey)}</p>
              </div>
            </div>
          ))}
        </CardContent>
      </Card>

      {/* Confirm Dialog */}
      <ConfirmDialog
        open={showConfirm}
        onOpenChange={setShowConfirm}
        type="info"
        title={t('confirmTitle')}
        description={t('confirmDescSimple')}
        confirmLabel={t('confirmGenerate')}
        cancelLabel={t('cancel')}
        onConfirm={handleConfirm}
      />
    </PageTransition>
  );
}
