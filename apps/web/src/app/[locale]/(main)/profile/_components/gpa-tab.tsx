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
import { GraduationCap } from 'lucide-react';
import type { ProfileFormData } from './types';

interface GpaTabProps {
  formData: ProfileFormData;
  onFormDataChange: (updater: (prev: ProfileFormData) => ProfileFormData) => void;
}

export function GpaTab({ formData, onFormDataChange }: GpaTabProps) {
  const t = useTranslations();

  return (
    <Card className="overflow-hidden">
      <div className="h-1.5 bg-success" />
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <GraduationCap className="h-5 w-5 text-success" />
          {t('profile.gpa')}
        </CardTitle>
        <CardDescription>{t('profile.gpaDesc')}</CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="grid gap-6 sm:grid-cols-2">
          <div className="space-y-2">
            <Label className="text-sm font-medium">GPA</Label>
            <Input
              type="number"
              step="0.01"
              min="0"
              max="5"
              value={formData.gpa}
              onChange={(e) => onFormDataChange((p) => ({ ...p, gpa: e.target.value }))}
              placeholder={t('profile.placeholders.gpaExample')}
              className="h-11 text-lg font-semibold"
            />
          </div>
          <div className="space-y-2">
            <Label className="text-sm font-medium">{t('profile.gpaScale')}</Label>
            <Select
              value={formData.gpaScale}
              onValueChange={(v) => onFormDataChange((p) => ({ ...p, gpaScale: v }))}
            >
              <SelectTrigger className="h-11">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="4.0">{t('profile.gpaScales.scale4')}</SelectItem>
                <SelectItem value="5.0">{t('profile.gpaScales.scale5')}</SelectItem>
                <SelectItem value="100">{t('profile.gpaScales.scale100')}</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
        {formData.gpa && (
          <div className="rounded-xl bg-success/10 p-4">
            <div className="flex items-center gap-3">
              <div className="flex h-14 w-14 items-center justify-center rounded-xl bg-success text-white shadow-lg">
                <span className="text-xl font-bold">{formData.gpa}</span>
              </div>
              <div>
                <p className="text-sm text-muted-foreground">{t('profile.yourGpa')}</p>
                <p className="font-medium">
                  {t(
                    'profile.gpaScales.scale' +
                      (formData.gpaScale === '100'
                        ? '100'
                        : formData.gpaScale === '5.0'
                          ? '5'
                          : '4')
                  )}
                </p>
              </div>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
