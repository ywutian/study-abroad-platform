'use client';

import { useState } from 'react';
import { useTranslations } from 'next-intl';
import { useQuery, useMutation } from '@tanstack/react-query';
import { toast } from 'sonner';
import { apiClient } from '@/lib/api';
import { qk } from '@/lib/query';
import { toStableParams } from '@/hooks/use-list-query';
import { rankingRoutes } from '@study-abroad/shared';
import { PageContainer, PageHeader } from '@/components/layout';
import { Trophy } from 'lucide-react';

import { WeightConfigPanel } from './_components/weight-config-panel';
import { RankingResults } from './_components/ranking-results';

interface RankingWeights {
  usNewsRank: number;
  acceptanceRate: number;
  tuition: number;
  avgSalary: number;
  nicheOverall: number;
  safetyGrade: number;
  studentLifeGrade: number;
  campusFoodGrade: number;
}

export default function RankingPage() {
  const t = useTranslations();

  const [weights, setWeights] = useState<RankingWeights>({
    usNewsRank: 30,
    acceptanceRate: 20,
    tuition: 20,
    avgSalary: 20,
    // Niche fit dimensions default off so users opt in
    nicheOverall: 10,
    safetyGrade: 0,
    studentLifeGrade: 0,
    campusFoodGrade: 0,
  });
  const [rankingName, setRankingName] = useState('');

  const {
    data: ranking,
    isLoading,
    refetch,
  } = useQuery({
    queryKey: qk.ranking.calculate(toStableParams(weights)),
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
      >(`${rankingRoutes.list()}/calculate`, weights),
    enabled: false,
  });

  const saveMutation = useMutation({
    mutationFn: (data: { name: string; isPublic: boolean } & RankingWeights) =>
      apiClient.post(rankingRoutes.list(), data),
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
      <PageHeader
        title={t('ranking.title')}
        description={t('ranking.description')}
        icon={Trophy}
        color="amber"
        stats={[
          {
            label: t('ranking.totalWeight'),
            value: `${totalWeight}%`,
            color: totalWeight === 100 ? 'text-emerald-500' : 'text-amber-500',
          },
          ...(ranking && ranking.length > 0
            ? [{ label: t('ranking.schoolsCount'), value: ranking.length, color: 'text-blue-500' }]
            : []),
        ]}
      />

      <div className="grid min-w-0 gap-4 sm:gap-6 lg:grid-cols-[380px_1fr] xl:grid-cols-[420px_1fr] 2xl:grid-cols-[480px_1fr]">
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
