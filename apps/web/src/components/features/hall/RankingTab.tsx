'use client';

/**
 * RankingTab — 排名对比标签页 (thin orchestrator).
 *
 * Owns data + UI state; delegates rendering to ranking/ sub-components:
 *   - SummaryStats          — aggregate row
 *   - SchoolPicker          — left column school selection
 *   - ResultsGrid           — right column results list (RankingCard +
 *                             CompetitorDistribution + AiPanel)
 *
 * Split out of the former 608-line single file per the page-split rule.
 */

import { useState, useMemo } from 'react';
import { useTranslations } from 'next-intl';
import { motion } from 'framer-motion';
import { toast } from 'sonner';
import { useTargetRanking, useSchoolRanking, useAiAnalysis } from '@/hooks/use-hall-api';
import { SchoolSelector } from '@/components/features';
import type { School, AiAnalysisResult } from '@/types/hall';
import type { SortMode } from './ranking/ranking-shared';
import { SummaryStats, type RankingSummary } from './ranking/SummaryStats';
import { SchoolPicker } from './ranking/SchoolPicker';
import { ResultsGrid } from './ranking/ResultsGrid';

export function RankingTab() {
  const t = useTranslations();

  const [selectedSchools, setSelectedSchools] = useState<School[]>([]);
  const [schoolSelectorOpen, setSchoolSelectorOpen] = useState(false);
  const [aiAnalysis, setAiAnalysis] = useState<Record<string, AiAnalysisResult>>({});
  const [analysisLoading, setAnalysisLoading] = useState<string | null>(null);
  const [sortMode, setSortMode] = useState<SortMode>('percentile');

  const { data: targetRankingResponse, isLoading: targetRankingLoading } = useTargetRanking(true);
  const {
    data: rankingResponse,
    isLoading: rankingLoading,
    refetch: fetchRanking,
  } = useSchoolRanking(selectedSchools.map((s) => s.id));
  const aiAnalysisMutation = useAiAnalysis();

  const allRankings = useMemo(() => {
    const merged = [
      ...(targetRankingResponse?.rankings || []),
      ...(rankingResponse?.rankings || []).filter(
        (r) => !(targetRankingResponse?.rankings || []).find((tr) => tr.schoolId === r.schoolId)
      ),
    ];
    return [...merged].sort((a, b) => {
      if (sortMode === 'percentile') return b.percentile - a.percentile;
      if (sortMode === 'score') return b.yourScore - a.yourScore;
      return b.totalApplicants - a.totalApplicants;
    });
  }, [targetRankingResponse, rankingResponse, sortMode]);

  const isAnyRankingLoading = targetRankingLoading || rankingLoading;

  const summary = useMemo<RankingSummary | null>(() => {
    if (allRankings.length === 0) return null;
    const avgPercentile = Math.round(
      allRankings.reduce((sum, r) => sum + r.percentile, 0) / allRankings.length
    );
    const totalCompetitors = allRankings.reduce(
      (sum, r) => sum + (r.competitorStats?.totalCount ?? r.totalApplicants),
      0
    );
    const best = allRankings.reduce((a, b) => (a.percentile >= b.percentile ? a : b));
    // 2026-05 Hall Plan C (C1): the strong/moderate/challenging tally was
    // removed — `competitivePosition` no longer exists.
    return { avgPercentile, totalCompetitors, bestSchool: best.schoolName };
  }, [allRankings]);

  const handleFetchRanking = () => {
    if (selectedSchools.length === 0) {
      toast.error(t('hall.ranking.selectSchoolFirst'));
      return;
    }
    fetchRanking();
  };

  const handleAiAnalysis = async (schoolId: string) => {
    if (aiAnalysis[schoolId]) return;
    setAnalysisLoading(schoolId);
    try {
      const result = await aiAnalysisMutation.mutateAsync(schoolId);
      if (result) {
        setAiAnalysis((prev) => ({ ...prev, [schoolId]: result }));
      }
    } catch {
      toast.error(t('common.error'));
    } finally {
      setAnalysisLoading(null);
    }
  };

  return (
    <>
      <motion.div
        key="ranking"
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: -10 }}
        className="space-y-6"
      >
        {summary && !isAnyRankingLoading && <SummaryStats summary={summary} />}

        <div className="grid gap-6 lg:grid-cols-3">
          <SchoolPicker
            selectedSchools={selectedSchools}
            isFetching={rankingLoading}
            onOpenSelector={() => setSchoolSelectorOpen(true)}
            onFetchRanking={handleFetchRanking}
          />
          <ResultsGrid
            rankings={allRankings}
            isLoading={isAnyRankingLoading}
            sortMode={sortMode}
            onSortModeChange={setSortMode}
            aiAnalysis={aiAnalysis}
            analysisLoading={analysisLoading}
            onRequestAnalysis={handleAiAnalysis}
          />
        </div>
      </motion.div>

      <SchoolSelector
        open={schoolSelectorOpen}
        onOpenChange={setSchoolSelectorOpen}
        selectedSchools={selectedSchools}
        onSelect={setSelectedSchools}
        maxSelection={10}
        title={t('hall.ranking.selectSchools')}
      />
    </>
  );
}
