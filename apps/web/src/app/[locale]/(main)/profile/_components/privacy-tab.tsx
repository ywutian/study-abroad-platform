'use client';

import { useTranslations } from 'next-intl';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { cn } from '@/lib/utils';
import { Shield, Check } from 'lucide-react';
import { VISIBILITY_OPTIONS } from './constants';
import type { ProfileFormData } from './types';

interface PrivacyTabProps {
  formData: ProfileFormData;
  onFormDataChange: (updater: (prev: ProfileFormData) => ProfileFormData) => void;
}

export function PrivacyTab({ formData, onFormDataChange }: PrivacyTabProps) {
  const t = useTranslations();

  return (
    <Card className="overflow-hidden">
      <div className="h-1.5 bg-muted-foreground" />
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Shield className="h-5 w-5 text-muted-foreground" />
          {t('profile.visibility')}
        </CardTitle>
        <CardDescription>{t('profile.visibilityDesc.title')}</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <RadioGroup
          value={formData.visibility}
          onValueChange={(v) => onFormDataChange((p) => ({ ...p, visibility: v }))}
          className="space-y-3"
        >
          {VISIBILITY_OPTIONS.map((opt) => {
            const isSelected = formData.visibility === opt.value;
            return (
              <div
                key={opt.value}
                className={cn(
                  'relative rounded-xl border p-4 transition-all cursor-pointer',
                  isSelected ? 'border-primary bg-primary/5 shadow-sm' : 'hover:bg-muted/50'
                )}
                onClick={() => onFormDataChange((p) => ({ ...p, visibility: opt.value }))}
              >
                <div className="flex items-start gap-4">
                  <div
                    className={cn(
                      'flex h-10 w-10 items-center justify-center rounded-lg transition-all',
                      isSelected
                        ? 'bg-primary text-primary-foreground'
                        : 'bg-muted text-muted-foreground'
                    )}
                  >
                    <opt.icon className="h-5 w-5" />
                  </div>
                  <div className="flex-1 space-y-1">
                    <div className="flex items-center gap-2">
                      <RadioGroupItem value={opt.value} id={opt.value} className="sr-only" />
                      <Label htmlFor={opt.value} className="cursor-pointer font-semibold">
                        {t(opt.labelKey)}
                      </Label>
                    </div>
                    <p className="text-sm text-muted-foreground">{t(opt.descKey)}</p>
                  </div>
                  {isSelected && (
                    <div className="flex h-6 w-6 items-center justify-center rounded-full bg-primary text-white">
                      <Check className="h-4 w-4" />
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </RadioGroup>
      </CardContent>
    </Card>
  );
}
