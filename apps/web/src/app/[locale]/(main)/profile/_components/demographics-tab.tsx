'use client';

import { useTranslations } from 'next-intl';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Globe } from 'lucide-react';
import { COMMON_COUNTRIES, EDUCATION_SYSTEMS } from './constants';
import type { ProfileFormData } from './types';

interface DemographicsTabProps {
  formData: ProfileFormData;
  onFormDataChange: (updater: (prev: ProfileFormData) => ProfileFormData) => void;
}

export function DemographicsTab({ formData, onFormDataChange }: DemographicsTabProps) {
  const t = useTranslations();

  return (
    <Card className="overflow-hidden">
      <div className="h-1.5 bg-gradient-to-r from-teal-500 to-cyan-500" />
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Globe className="h-5 w-5 text-teal-500 dark:text-teal-400" />
          {t('profile.demographics.title')}
        </CardTitle>
        <CardDescription>{t('profile.demographics.desc')}</CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="grid gap-6 sm:grid-cols-2">
          <div className="space-y-2">
            <Label className="text-sm font-medium">{t('profile.demographics.nationality')}</Label>
            <Select
              value={formData.nationality}
              onValueChange={(v) => onFormDataChange((p) => ({ ...p, nationality: v }))}
            >
              <SelectTrigger className="h-11">
                <SelectValue placeholder={t('profile.demographics.selectCountry')} />
              </SelectTrigger>
              <SelectContent>
                {COMMON_COUNTRIES.map((c) => (
                  <SelectItem key={`nat-${c.value}`} value={c.value}>
                    {t(c.labelKey)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label className="text-sm font-medium">
              {t('profile.demographics.countryOfResidence')}
            </Label>
            <Select
              value={formData.countryOfResidence}
              onValueChange={(v) => onFormDataChange((p) => ({ ...p, countryOfResidence: v }))}
            >
              <SelectTrigger className="h-11">
                <SelectValue placeholder={t('profile.demographics.selectCountry')} />
              </SelectTrigger>
              <SelectContent>
                {COMMON_COUNTRIES.map((c) => (
                  <SelectItem key={`res-${c.value}`} value={c.value}>
                    {t(c.labelKey)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
        <div className="grid gap-6 sm:grid-cols-2">
          <div className="space-y-2">
            <Label className="text-sm font-medium">{t('profile.demographics.citizenship')}</Label>
            <Select
              value={formData.citizenship}
              onValueChange={(v) => onFormDataChange((p) => ({ ...p, citizenship: v }))}
            >
              <SelectTrigger className="h-11">
                <SelectValue placeholder={t('profile.demographics.selectCountry')} />
              </SelectTrigger>
              <SelectContent>
                {COMMON_COUNTRIES.map((c) => (
                  <SelectItem key={`cit-${c.value}`} value={c.value}>
                    {t(c.labelKey)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label className="text-sm font-medium">
              {t('profile.demographics.educationSystem')}
            </Label>
            <Select
              value={formData.educationSystem}
              onValueChange={(v) => onFormDataChange((p) => ({ ...p, educationSystem: v }))}
            >
              <SelectTrigger className="h-11">
                <SelectValue placeholder={t('profile.demographics.selectEducationSystem')} />
              </SelectTrigger>
              <SelectContent>
                {EDUCATION_SYSTEMS.map((es) => (
                  <SelectItem key={es.value} value={es.value}>
                    {t(es.labelKey)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
        <div className="space-y-4 pt-2">
          <div className="flex items-center space-x-3">
            <Checkbox
              id="needsFinancialAid"
              checked={formData.needsFinancialAid}
              onCheckedChange={(checked) =>
                onFormDataChange((p) => ({ ...p, needsFinancialAid: !!checked }))
              }
            />
            <Label htmlFor="needsFinancialAid" className="text-sm cursor-pointer">
              {t('profile.demographics.needsFinancialAid')}
            </Label>
          </div>
          <div className="flex items-center space-x-3">
            <Checkbox
              id="firstGeneration"
              checked={formData.firstGeneration}
              onCheckedChange={(checked) =>
                onFormDataChange((p) => ({ ...p, firstGeneration: !!checked }))
              }
            />
            <Label htmlFor="firstGeneration" className="text-sm cursor-pointer">
              {t('profile.demographics.firstGeneration')}
            </Label>
          </div>
        </div>

        {/* Legacy */}
        <div className="space-y-2 pt-4 border-t">
          <Label className="text-sm font-medium">{t('profile.demographics.legacy')}</Label>
          <Input
            placeholder={t('profile.demographics.legacyPlaceholder')}
            value={formData.legacy.join(', ')}
            onChange={(e) => {
              const val = e.target.value;
              const arr = val
                ? val
                    .split(',')
                    .map((s) => s.trim())
                    .filter(Boolean)
                : [];
              onFormDataChange((p) => ({ ...p, legacy: arr }));
            }}
          />
          <p className="text-xs text-muted-foreground">{t('profile.demographics.legacyHint')}</p>
        </div>

        {/* Intended Major & Second Major */}
        <div className="grid gap-6 sm:grid-cols-2 pt-4 border-t">
          <div className="space-y-2">
            <Label className="text-sm font-medium">{t('profile.fields.intendedMajor')}</Label>
            <Input
              placeholder={t('profile.placeholders.intendedMajor')}
              value={formData.intendedMajor}
              onChange={(e) => onFormDataChange((p) => ({ ...p, intendedMajor: e.target.value }))}
            />
          </div>
          <div className="space-y-2">
            <Label className="text-sm font-medium">{t('profile.fields.secondMajor')}</Label>
            <Input
              placeholder={t('profile.placeholders.secondMajor')}
              value={formData.secondMajor}
              onChange={(e) => onFormDataChange((p) => ({ ...p, secondMajor: e.target.value }))}
            />
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
