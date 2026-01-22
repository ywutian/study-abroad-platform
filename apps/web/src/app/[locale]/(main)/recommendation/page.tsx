'use client';

import { useState } from 'react';
import { useTranslations } from 'next-intl';
import { useQuery } from '@tanstack/react-query';
import { AnimatePresence } from 'framer-motion';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { PageHeader } from '@/components/layout/page-header';
import { GraduationCap, Sparkles, History } from 'lucide-react';
import { toast } from 'sonner';
import { apiClient } from '@/lib/api';
import { useRecommendationPreflight, useGenerateRecommendation } from '@/hooks/use-recommendation';
import type { GenerateRecommendationDto } from '@/hooks/use-recommendation';
import type { RecommendationResult } from '@study-abroad/shared';

import { ProfileStatusBanner } from './_components/ProfileStatusBanner';
import { RecommendationForm } from './_components/RecommendationForm';
import { GenerationProgress } from './_components/GenerationProgress';
import { ResultsView } from './_components/ResultsView';
import { HistoryList } from './_components/HistoryList';

type GenerationState = 'idle' | 'loading' | 'done';

export default function RecommendationPage() {
  const t = useTranslations('recommendation');

  const [activeTab, setActiveTab] = useState('generate');
  const [result, setResult] = useState<RecommendationResult | null>(null);
  const [generationState, setGenerationState] = useState<GenerationState>('idle');

  // Hooks
  const preflight = useRecommendationPreflight();
  const generateMutation = useGenerateRecommendation();

  // Pre-fetch user's school list for dedup checks in SchoolCard
  const { data: schoolList } = useQuery({
    queryKey: ['school-list'],
    queryFn: () => apiClient.get<Array<{ schoolId: string }>>('/school-lists'),
  });

  const handleGenerate = async (dto: GenerateRecommendationDto) => {
    setGenerationState('loading');
    try {
      const data = await generateMutation.mutateAsync(dto);
      setResult(data);
      setGenerationState('done');
      toast.success(t('success'));
    } catch (error: any) {
      setGenerationState('idle');
      toast.error(error.message || t('failed'));
    }
  };

  const handleReset = () => {
    setResult(null);
    setGenerationState('idle');
  };

  const handleViewHistoryResult = (item: RecommendationResult) => {
    setResult(item);
    setGenerationState('done');
    setActiveTab('generate');
  };

  return (
    <div className="container mx-auto py-6 sm:py-8 px-4 max-w-6xl">
      <PageHeader
        title={t('title')}
        description={t('description')}
        icon={GraduationCap}
        color="blue"
      />

      {/* Profile Status Banner */}
      <ProfileStatusBanner preflight={preflight.data} isLoading={preflight.isLoading} />

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="mb-6">
          <TabsTrigger value="generate" className="gap-2">
            <Sparkles className="h-4 w-4" />
            {t('generate')}
          </TabsTrigger>
          <TabsTrigger value="history" className="gap-2">
            <History className="h-4 w-4" />
            {t('history')}
          </TabsTrigger>
        </TabsList>

        <TabsContent value="generate" className="space-y-6">
          <AnimatePresence mode="wait">
            {generationState === 'idle' && (
              <RecommendationForm onGenerate={handleGenerate} preflight={preflight.data} />
            )}
            {generationState === 'loading' && <GenerationProgress />}
            {generationState === 'done' && result && (
              <ResultsView result={result} schoolList={schoolList} onReset={handleReset} />
            )}
          </AnimatePresence>
        </TabsContent>

        <TabsContent value="history">
          <HistoryList
            enabled={activeTab === 'history'}
            onViewResult={handleViewHistoryResult}
            onSwitchToGenerate={() => setActiveTab('generate')}
          />
        </TabsContent>
      </Tabs>
    </div>
  );
}
