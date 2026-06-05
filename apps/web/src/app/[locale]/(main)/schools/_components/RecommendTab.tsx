'use client';

import { useState } from 'react';
import { useTranslations } from 'next-intl';
import { useQuery } from '@tanstack/react-query';
import { AnimatePresence } from 'framer-motion';
import { toast } from 'sonner';
import { apiClient } from '@/lib/api';
import { qk } from '@/lib/query';
import { useRecommendationPreflight, useGenerateRecommendation } from '@/hooks/use-recommendation';
import type { GenerateRecommendationDto } from '@/hooks/use-recommendation';
import type { RecommendationResult } from '@study-abroad/shared';
import { ProfileStatusBanner } from './ProfileStatusBanner';
import { RecommendationForm } from './RecommendationForm';
import { GenerationProgress } from './GenerationProgress';
import { ResultsView } from './ResultsView';

type GenerationState = 'idle' | 'loading' | 'done';

export function RecommendTab() {
  const t = useTranslations('recommendation');
  const [result, setResult] = useState<RecommendationResult | null>(null);
  const [generationState, setGenerationState] = useState<GenerationState>('idle');

  const preflight = useRecommendationPreflight();
  const generateMutation = useGenerateRecommendation();
  const { data: schoolList } = useQuery({
    queryKey: qk.schoolList.all,
    queryFn: () => apiClient.get<Array<{ schoolId: string }>>('/school-lists'),
  });

  const handleGenerate = async (dto: GenerateRecommendationDto) => {
    setGenerationState('loading');
    try {
      const data = await generateMutation.mutateAsync(dto);
      setResult(data);
      setGenerationState('done');
      toast.success(t('success'));
    } catch {
      setGenerationState('idle');
    }
  };

  const handleReset = () => {
    setResult(null);
    setGenerationState('idle');
  };

  return (
    <div className="space-y-6">
      <ProfileStatusBanner preflight={preflight.data} isLoading={preflight.isLoading} />
      <AnimatePresence mode="wait">
        {generationState === 'idle' && (
          <RecommendationForm onGenerate={handleGenerate} preflight={preflight.data} />
        )}
        {generationState === 'loading' && <GenerationProgress />}
        {generationState === 'done' && result && (
          <ResultsView result={result} schoolList={schoolList} onReset={handleReset} />
        )}
      </AnimatePresence>
    </div>
  );
}
