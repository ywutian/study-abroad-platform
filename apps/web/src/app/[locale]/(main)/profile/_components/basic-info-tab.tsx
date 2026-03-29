'use client';

import { useTranslations } from 'next-intl';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { User } from 'lucide-react';
import { GRADES, BUDGET_TIERS } from './constants';
import type { ProfileFormData } from './types';

interface BasicInfoTabProps {
  formData: ProfileFormData;
  onFormDataChange: (updater: (prev: ProfileFormData) => ProfileFormData) => void;
  errors?: Record<string, string>;
}

export function BasicInfoTab({ formData, onFormDataChange, errors }: BasicInfoTabProps) {
  const t = useTranslations();

  return (
    <Card className="overflow-hidden">
      <div className="h-1.5 bg-primary" />
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <User className="h-5 w-5 text-primary" />
          {t('profile.basicInfo')}
        </CardTitle>
        <CardDescription>{t('profile.basicInfoDesc')}</CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="grid gap-6 sm:grid-cols-2">
          <div className="space-y-2">
            <Label className="text-sm font-medium">{t('profile.fields.grade')}</Label>
            <Select
              value={formData.grade}
              onValueChange={(v) => onFormDataChange((p) => ({ ...p, grade: v }))}
            >
              <SelectTrigger className="h-11">
                <SelectValue placeholder={t('profile.placeholders.selectGrade')} />
              </SelectTrigger>
              <SelectContent>
                {GRADES.map((g) => (
                  <SelectItem key={g.value} value={g.value}>
                    {t(g.labelKey)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label className="text-sm font-medium">{t('profile.fields.currentSchool')}</Label>
            <Input
              value={formData.currentSchool}
              onChange={(e) => onFormDataChange((p) => ({ ...p, currentSchool: e.target.value }))}
              placeholder={t('profile.fields.currentSchoolPlaceholder')}
              className="h-11"
            />
          </div>
        </div>
        <div className="space-y-2">
          <Label className="text-sm font-medium">{t('profile.fields.targetMajor')}</Label>
          <Input
            value={formData.targetMajor}
            onChange={(e) => onFormDataChange((p) => ({ ...p, targetMajor: e.target.value }))}
            placeholder={t('profile.fields.targetMajorPlaceholder')}
            className="h-11"
          />
        </div>
        <div className="space-y-2">
          <Label className="text-sm font-medium">{t('profile.fields.budget')}</Label>
          <Select
            value={formData.budgetTier}
            onValueChange={(v) => onFormDataChange((p) => ({ ...p, budgetTier: v }))}
          >
            <SelectTrigger className="h-11">
              <SelectValue placeholder={t('profile.placeholders.selectBudget')} />
            </SelectTrigger>
            <SelectContent>
              {BUDGET_TIERS.map((b) => (
                <SelectItem key={b.value} value={b.value}>
                  {t(b.labelKey)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </CardContent>
    </Card>
  );
}
