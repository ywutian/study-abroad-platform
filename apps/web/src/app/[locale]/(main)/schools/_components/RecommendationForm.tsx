'use client';

import { useState } from 'react';
import { useTranslations } from 'next-intl';
import { motion } from 'framer-motion';
import { toast } from 'sonner';
import { Shield, Smile, Lightbulb, Utensils } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import type { GenerateRecommendationDto } from '@/hooks/use-recommendation';
import {
  MAX_PREFERRED_REGIONS,
  MAX_PREFERRED_MAJORS,
  type RecommendationPreflight,
} from '@study-abroad/shared';

interface RecommendationFormProps {
  onGenerate: (dto: GenerateRecommendationDto) => void;
  preflight?: RecommendationPreflight;
}

export function RecommendationForm({ onGenerate, preflight }: RecommendationFormProps) {
  const t = useTranslations('recommendation');
  const [regions, setRegions] = useState('');
  const [majors, setMajors] = useState('');
  const [budget, setBudget] = useState('');
  const [schoolCount, setSchoolCount] = useState(10);
  const [additionalPreferences, setAdditionalPreferences] = useState('');
  const [campusPreferences, setCampusPreferences] = useState<Array<'safety' | 'life' | 'food'>>([]);

  const canSubmit = preflight?.canGenerate ?? false;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const regionList = regions
      ? regions
          .split(',')
          .map((s) => s.trim())
          .filter(Boolean)
      : undefined;
    const majorList = majors
      ? majors
          .split(',')
          .map((s) => s.trim())
          .filter(Boolean)
      : undefined;
    // Pre-validate against the shared cap so an over-limit list shows a toast
    // instead of 400'ing silently at the backend ValidationPipe (#396 bug class).
    if (regionList && regionList.length > MAX_PREFERRED_REGIONS) {
      toast.error(t('tooManyRegions', { max: MAX_PREFERRED_REGIONS }));
      return;
    }
    if (majorList && majorList.length > MAX_PREFERRED_MAJORS) {
      toast.error(t('tooManyMajors', { max: MAX_PREFERRED_MAJORS }));
      return;
    }
    onGenerate({
      preferredRegions: regionList,
      preferredMajors: majorList,
      budget: budget || undefined,
      schoolCount,
      additionalPreferences: additionalPreferences || undefined,
      campusPreferences: campusPreferences.length ? campusPreferences : undefined,
    });
  };

  const toggleCampusPreference = (value: 'safety' | 'life' | 'food') => {
    setCampusPreferences((current) =>
      current.includes(value) ? current.filter((item) => item !== value) : [...current, value]
    );
  };

  return (
    <motion.div
      key="form"
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -10 }}
    >
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Lightbulb className="h-5 w-5 text-primary" />
            {t('formTitle')}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>{t('regions')}</Label>
                <Input
                  placeholder={t('regionsPlaceholder')}
                  value={regions}
                  onChange={(e) => setRegions(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label>{t('majors')}</Label>
                <Input
                  placeholder={t('majorsPlaceholder')}
                  value={majors}
                  onChange={(e) => setMajors(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label>{t('budget')}</Label>
                <Input
                  placeholder={t('budgetPlaceholder')}
                  value={budget}
                  onChange={(e) => setBudget(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label>{t('schoolCountLabel')}</Label>
                <Input
                  type="number"
                  min={3}
                  max={20}
                  value={schoolCount}
                  onChange={(e) => setSchoolCount(Number(e.target.value))}
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label>{t('campusPreferences')}</Label>
              <div className="flex flex-wrap gap-2">
                {[
                  { value: 'safety' as const, icon: Shield, label: t('campusSafety') },
                  { value: 'life' as const, icon: Smile, label: t('campusLife') },
                  { value: 'food' as const, icon: Utensils, label: t('campusFood') },
                ].map(({ value, icon: Icon, label }) => {
                  const active = campusPreferences.includes(value);
                  return (
                    <Button
                      key={value}
                      type="button"
                      variant={active ? 'default' : 'outline'}
                      size="sm"
                      className="gap-2"
                      onClick={() => toggleCampusPreference(value)}
                    >
                      <Icon className="h-4 w-4" />
                      {label}
                    </Button>
                  );
                })}
              </div>
            </div>
            <div className="space-y-2">
              <Label>{t('additionalPreferences')}</Label>
              <Textarea
                placeholder={t('additionalPreferencesPlaceholder')}
                value={additionalPreferences}
                onChange={(e) => setAdditionalPreferences(e.target.value)}
                rows={3}
              />
            </div>
            <Button type="submit" disabled={!canSubmit} className="w-full">
              <Lightbulb className="mr-2 h-4 w-4" />
              {t('generate')}
            </Button>
            {!canSubmit && preflight && (
              <p className="text-sm text-muted-foreground text-center">
                {!preflight.profileComplete ? t('completeProfileFirst') : t('insufficientPoints')}
              </p>
            )}
          </form>
        </CardContent>
      </Card>
    </motion.div>
  );
}
