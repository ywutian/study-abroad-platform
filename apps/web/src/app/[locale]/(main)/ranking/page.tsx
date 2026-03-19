'use client';

import { useState } from 'react';
import { useTranslations } from 'next-intl';
import { useQuery, useMutation } from '@tanstack/react-query';
import { toast } from 'sonner';
import { apiClient } from '@/lib/api';
import { PageContainer } from '@/components/layout';
import { cn } from '@/lib/utils';
import { BarChart3 } from 'lucide-react';

import { WeightConfigPanel } from './_components/weight-config-panel';
import { RankingResults } from './_components/ranking-results';

interface RankingWeights {
  usNewsRank: number;
  acceptanceRate: number;
  tuition: number;
  avgSalary: number;
}

export default function RankingPage() {
  const t = useTranslations();

  const [weights, setWeights] = useState<RankingWeights>({
    usNewsRank: 30,
    acceptanceRate: 20,
    tuition: 25,
    avgSalary: 25,
  });
  const [rankingName, setRankingName] = useState('');

  const {
    data: ranking,
    isLoading,
    refetch,
  } = useQuery({
    queryKey: ['ranking', weights],
    queryFn: () =>
      apiClient.post<
        Array<{
          id: string;
          name: string;
          nameZh: string;
          usNewsRank: number;
          acceptanceRate: number;
          tuition: number;
          avgSalary: number;
          score: number;
          rank: number;
        }>
      >('/rankings/calculate', weights),
    enabled: false,
  });

  const saveMutation = useMutation({
    mutationFn: (data: { name: string; isPublic: boolean } & RankingWeights) =>
      apiClient.post('/rankings', data),
    onSuccess: () => {
      toast.success(t('ranking.toast.saved'));
      setRankingName('');
    },
  });

  const handleCalculate = () => refetch();

  const handleSave = () => {
    if (!rankingName.trim()) {
      toast.error(t('ranking.toast.enterName'));
      return;
    }
    saveMutation.mutate({ name: rankingName, isPublic: false, ...weights });
  };

  const totalWeight = Object.values(weights).reduce((sum, w) => sum + w, 0);

  return (
    <PageContainer maxWidth="fluid">
      {/* Header */}
      <div className="relative mb-6 lg:mb-8 overflow-hidden rounded-lg bg-warning/5 p-4 sm:p-6 lg:p-8">
        <div className="absolute -right-20 -top-20 h-64 w-64 rounded-full bg-warning/15 blur-3xl" />
        <div className="absolute -bottom-20 -left-20 h-64 w-64 rounded-full bg-warning/15 blur-3xl" />
        <div className="relative z-10">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
            <div className="space-y-2">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 sm:h-12 sm:w-12 items-center justify-center rounded-xl bg-warning">
                  <BarChart3 className="h-5 w-5 sm:h-6 sm:w-6 text-white" />
                </div>
                <div>
                  <h1 className="text-title">{t('ranking.title')}</h1>
                  <p className="text-sm sm:text-base text-muted-foreground">
                    {t('ranking.description')}
                  </p>
                </div>
              </div>
            </div>
            <div className="flex gap-3 sm:gap-4">
              <div className="rounded-xl border bg-card/50 backdrop-blur-sm px-3 sm:px-4 py-2 sm:py-3">
                <p className="text-xs text-muted-foreground">{t('ranking.totalWeight')}</p>
                <p
                  className={cn(
                    'text-xl sm:text-2xl font-bold',
                    totalWeight === 100 ? 'text-emerald-500' : 'text-amber-500'
                  )}
                >
                  {totalWeight}%
                </p>
              </div>
              {ranking && ranking.length > 0 && (
                <div className="rounded-xl border bg-card/50 backdrop-blur-sm px-3 sm:px-4 py-2 sm:py-3">
                  <p className="text-xs text-muted-foreground">{t('ranking.schoolsCount')}</p>
                  <p className="text-xl sm:text-2xl font-bold text-blue-500">{ranking.length}</p>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      <div className="grid gap-4 sm:gap-6 lg:grid-cols-[380px_1fr] xl:grid-cols-[420px_1fr] 2xl:grid-cols-[480px_1fr]">
        <WeightConfigPanel
          weights={weights}
          onWeightChange={(key, value) => setWeights((prev) => ({ ...prev, [key]: value }))}
          rankingName={rankingName}
          onRankingNameChange={setRankingName}
          onCalculate={handleCalculate}
          onSave={handleSave}
          isCalculating={isLoading}
          isSaving={saveMutation.isPending}
          hasResults={!!ranking?.length}
        />
        <RankingResults ranking={ranking} isLoading={isLoading} onCalculate={handleCalculate} />
      </div>
    </PageContainer>
  );
}
