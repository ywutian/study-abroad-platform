'use client';

import { useState } from 'react';
import { useTranslations } from 'next-intl';
import { motion } from 'framer-motion';
import { Sparkles } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import type { GenerateRecommendationDto } from '@/hooks/use-recommendation';
import type { RecommendationPreflight } from '@study-abroad/shared';

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

  const canSubmit = preflight?.canGenerate ?? false;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onGenerate({
      preferredRegions: regions ? regions.split(',').map((s) => s.trim()) : undefined,
      preferredMajors: majors ? majors.split(',').map((s) => s.trim()) : undefined,
      budget: budget || undefined,
      schoolCount,
      additionalPreferences: additionalPreferences || undefined,
    });
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
            <Sparkles className="h-5 w-5 text-primary" />
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
              <Label>{t('additionalPreferences')}</Label>
              <Textarea
                placeholder={t('additionalPreferencesPlaceholder')}
                value={additionalPreferences}
                onChange={(e) => setAdditionalPreferences(e.target.value)}
                rows={3}
              />
            </div>
            <Button type="submit" disabled={!canSubmit} className="w-full">
              <Sparkles className="mr-2 h-4 w-4" />
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
