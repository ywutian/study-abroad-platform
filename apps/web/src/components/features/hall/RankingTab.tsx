'use client';

/**
 * RankingTab — 排名对比标签页
 *
 * 功能：
 * - 目标学校排名（自动加载）
 * - 手动选校排名查询
 * - 汇总统计（平均百分位、总竞争者、最佳学校、竞争力定位）
 * - 竞争者分布可视化（p25/p50/p75 + 用户位置）
 * - 排序控制（百分位 / 得分 / 人数）
 * - AI 排名分析
 */

import { useState, useMemo } from 'react';
import { useTranslations, useLocale } from 'next-intl';
import { motion } from 'framer-motion';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { LoadingState } from '@/components/ui/loading-state';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { toast } from 'sonner';
import { cn, getSchoolName } from '@/lib/utils';
import {
  Trophy,
  Sparkles,
  Target,
  TrendingUp,
  ChevronUp,
  ChevronDown,
  Minus,
  Loader2,
  GraduationCap,
  Brain,
  CheckCircle,
  AlertTriangle,
  Shield,
  Users,
  ArrowUpDown,
  BarChart3,
} from 'lucide-react';
import { useTargetRanking, useSchoolRanking, useAiAnalysis } from '@/hooks/use-hall-api';
import {
  ProbabilityRing,
  AnimatedStat,
  AnimatedProgressBar,
} from '@/components/features/probability-ring';
import { SchoolSelector } from '@/components/features';
import type { School, AiAnalysisResult, RankingResult } from '@/types/hall';

type SortMode = 'percentile' | 'score' | 'applicants';

// 竞争力定位配置
const POSITION_CONFIG = {
  strong: {
    icon: Shield,
    className: 'bg-emerald-500/10 text-emerald-600 border-emerald-200',
  },
  moderate: {
    icon: TrendingUp,
    className: 'bg-amber-500/10 text-amber-600 border-amber-200',
  },
  challenging: {
    icon: AlertTriangle,
    className: 'bg-red-500/10 text-red-600 border-red-200',
  },
} as const;

export function RankingTab() {
  const t = useTranslations();
  const locale = useLocale();

  // 本地 UI 状态
  const [selectedSchools, setSelectedSchools] = useState<School[]>([]);
  const [schoolSelectorOpen, setSchoolSelectorOpen] = useState(false);
  const [aiAnalysis, setAiAnalysis] = useState<Record<string, AiAnalysisResult>>({});
  const [analysisLoading, setAnalysisLoading] = useState<string | null>(null);
  const [sortMode, setSortMode] = useState<SortMode>('percentile');

  // API hooks
  const { data: targetRankingResponse, isLoading: targetRankingLoading } = useTargetRanking(true);
  const {
    data: rankingResponse,
    isLoading: rankingLoading,
    refetch: fetchRanking,
  } = useSchoolRanking(selectedSchools.map((s) => s.id));
  const aiAnalysisMutation = useAiAnalysis();

  // 合并排名结果
  const allRankings = useMemo(() => {
    const merged = [
      ...(targetRankingResponse?.rankings || []),
      ...(rankingResponse?.rankings || []).filter(
        (r) => !(targetRankingResponse?.rankings || []).find((tr) => tr.schoolId === r.schoolId)
      ),
    ];
    // 排序
    return [...merged].sort((a, b) => {
      if (sortMode === 'percentile') return b.percentile - a.percentile;
      if (sortMode === 'score') return b.yourScore - a.yourScore;
      return b.totalApplicants - a.totalApplicants;
    });
  }, [targetRankingResponse, rankingResponse, sortMode]);

  const isAnyRankingLoading = targetRankingLoading || rankingLoading;

  // 汇总统计
  const summary = useMemo(() => {
    if (allRankings.length === 0) return null;
    const avgPercentile = Math.round(
      allRankings.reduce((sum, r) => sum + r.percentile, 0) / allRankings.length
    );
    const totalCompetitors = allRankings.reduce(
      (sum, r) => sum + (r.competitorStats?.totalCount ?? r.totalApplicants),
      0
    );
    const best = allRankings.reduce((a, b) => (a.percentile >= b.percentile ? a : b));
    // 综合竞争力：取最常见的 position
    const positions = allRankings.map((r) => r.competitivePosition).filter(Boolean);
    const positionCounts = { strong: 0, moderate: 0, challenging: 0 };
    for (const p of positions) {
      if (p && p in positionCounts) positionCounts[p as keyof typeof positionCounts]++;
    }
    const overallPosition = (Object.entries(positionCounts).sort((a, b) => b[1] - a[1])[0]?.[0] ||
      'moderate') as 'strong' | 'moderate' | 'challenging';

    return { avgPercentile, totalCompetitors, bestSchool: best.schoolName, overallPosition };
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

  const getRankIcon = (percentile: number) => {
    if (percentile >= 70) return <ChevronUp className="h-4 w-4 text-emerald-500" />;
    if (percentile >= 40) return <Minus className="h-4 w-4 text-amber-500" />;
    return <ChevronDown className="h-4 w-4 text-red-500" />;
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
        {/* 汇总统计 */}
        {summary && !isAnyRankingLoading && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            className="grid grid-cols-2 md:grid-cols-4 gap-3 sm:gap-4"
          >
            <div className="rounded-xl border bg-card p-3 sm:p-4 text-center">
              <ProbabilityRing
                value={summary.avgPercentile}
                size="sm"
                label={t('hall.ranking.avgPercentile')}
              />
            </div>
            <div className="rounded-xl border bg-card p-3 sm:p-4">
              <AnimatedStat
                value={summary.totalCompetitors}
                label={t('hall.ranking.totalCompetitors')}
              />
            </div>
            <div className="rounded-xl border bg-card p-3 sm:p-4 flex flex-col items-center justify-center gap-1">
              <Trophy className="h-5 w-5 text-amber-500" />
              <p className="text-xs sm:text-sm font-semibold text-center truncate max-w-full">
                {summary.bestSchool}
              </p>
              <p className="text-xs text-muted-foreground">{t('hall.ranking.bestSchool')}</p>
            </div>
            <div className="rounded-xl border bg-card p-3 sm:p-4 flex flex-col items-center justify-center gap-1">
              {(() => {
                const config = POSITION_CONFIG[summary.overallPosition];
                const Icon = config.icon;
                return (
                  <>
                    <Icon className="h-5 w-5" />
                    <Badge variant="outline" className={cn('text-xs', config.className)}>
                      {t(`hall.ranking.${summary.overallPosition}`)}
                    </Badge>
                    <p className="text-xs text-muted-foreground">
                      {t('hall.ranking.overallPosition')}
                    </p>
                  </>
                );
              })()}
            </div>
          </motion.div>
        )}

        <div className="grid gap-6 lg:grid-cols-3">
          {/* 学校选择 */}
          <Card className="overflow-hidden lg:col-span-1">
            <div className="h-1.5 bg-warning" />
            <CardHeader>
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-amber-500/10 text-amber-500">
                  <Target className="h-5 w-5" />
                </div>
                <div>
                  <CardTitle className="text-lg">{t('hall.ranking.selectSchools')}</CardTitle>
                  <CardDescription>{t('hall.ranking.selectSchoolsDesc')}</CardDescription>
                </div>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              <Button
                variant="outline"
                className="w-full h-11 gap-2"
                onClick={() => setSchoolSelectorOpen(true)}
              >
                <GraduationCap className="h-4 w-4" />
                {selectedSchools.length > 0
                  ? t('hall.ranking.selectedCount', { count: selectedSchools.length })
                  : t('hall.ranking.selectSchoolsButton')}
              </Button>

              {selectedSchools.length > 0 && (
                <div className="space-y-2">
                  {selectedSchools.slice(0, 5).map((school, index) => (
                    <motion.div
                      key={school.id}
                      initial={{ opacity: 0, scale: 0.95 }}
                      animate={{ opacity: 1, scale: 1 }}
                      transition={{ delay: index * 0.05 }}
                      className="flex items-center justify-between rounded-lg bg-warning/5 px-3 py-2 text-sm"
                    >
                      <span className="truncate">{getSchoolName(school, locale)}</span>
                      {school.usNewsRank && (
                        <Badge variant="outline" className="shrink-0">
                          #{school.usNewsRank}
                        </Badge>
                      )}
                    </motion.div>
                  ))}
                  {selectedSchools.length > 5 && (
                    <p className="text-center text-xs text-muted-foreground">
                      {t('hall.ranking.moreSchools', { count: selectedSchools.length - 5 })}
                    </p>
                  )}
                </div>
              )}

              <Button
                className="w-full h-11 gap-2 bg-warning hover:bg-warning/90"
                onClick={handleFetchRanking}
                disabled={selectedSchools.length === 0 || rankingLoading}
              >
                {rankingLoading ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <TrendingUp className="h-4 w-4" />
                )}
                {t('hall.ranking.viewRanking')}
              </Button>
            </CardContent>
          </Card>

          {/* 排名结果 */}
          <Card className="overflow-hidden lg:col-span-2">
            <div className="h-1.5 bg-success" />
            <CardHeader>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-emerald-500/10 text-emerald-500">
                    <Trophy className="h-5 w-5" />
                  </div>
                  <div>
                    <CardTitle className="text-lg">{t('hall.ranking.title')}</CardTitle>
                    <CardDescription>{t('hall.ranking.resultsDesc')}</CardDescription>
                  </div>
                </div>
                {/* 排序控制 */}
                {allRankings.length > 1 && (
                  <Select value={sortMode} onValueChange={(v) => setSortMode(v as SortMode)}>
                    <SelectTrigger className="w-32 h-9 text-xs">
                      <ArrowUpDown className="h-3.5 w-3.5 mr-1" />
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="percentile">
                        {t('hall.ranking.sortByPercentile')}
                      </SelectItem>
                      <SelectItem value="score">{t('hall.ranking.sortByScore')}</SelectItem>
                      <SelectItem value="applicants">
                        {t('hall.ranking.sortByApplicants')}
                      </SelectItem>
                    </SelectContent>
                  </Select>
                )}
              </div>
            </CardHeader>
            <CardContent>
              {isAnyRankingLoading ? (
                <LoadingState variant="card" count={3} />
              ) : allRankings.length > 0 ? (
                <div className="space-y-4">
                  {allRankings.map((result, index) => (
                    <RankingCard
                      key={result.schoolId}
                      result={result}
                      index={index}
                      t={t}
                      aiAnalysis={aiAnalysis[result.schoolId]}
                      analysisLoading={analysisLoading === result.schoolId}
                      onRequestAnalysis={() => handleAiAnalysis(result.schoolId)}
                      getRankIcon={getRankIcon}
                    />
                  ))}
                </div>
              ) : (
                <div className="py-12 text-center">
                  <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-lg bg-emerald-500/10">
                    <Trophy className="h-8 w-8 text-emerald-500/50" />
                  </div>
                  <p className="font-medium">{t('hall.ranking.emptyTitle')}</p>
                  <p className="mt-1 text-sm text-muted-foreground">
                    {t('hall.ranking.emptyDesc')}
                  </p>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </motion.div>

      {/* 学校选择弹窗 */}
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

// ============================================
// 单个排名卡片（提取为子组件，减少主组件复杂度）
// ============================================

interface RankingCardProps {
  result: RankingResult;
  index: number;
  t: ReturnType<typeof useTranslations>;
  aiAnalysis?: AiAnalysisResult;
  analysisLoading: boolean;
  onRequestAnalysis: () => void;
  getRankIcon: (percentile: number) => React.ReactNode;
}

function RankingCard({
  result,
  index,
  t,
  aiAnalysis: analysis,
  analysisLoading,
  onRequestAnalysis,
  getRankIcon,
}: RankingCardProps) {
  const positionConfig = result.competitivePosition
    ? POSITION_CONFIG[result.competitivePosition]
    : null;
  const PositionIcon = positionConfig?.icon;

  // 维度数据
  const dimensions = [
    {
      key: 'academic' as const,
      label: t('hall.ranking.factorAcademic'),
      score: result.breakdown.academic,
      percentile: result.percentiles?.academic,
      median: result.scoreDistribution?.academic?.p50,
      color: 'bg-blue-500',
    },
    {
      key: 'activity' as const,
      label: t('hall.ranking.factorActivities'),
      score: result.breakdown.activity,
      percentile: result.percentiles?.activity,
      median: result.scoreDistribution?.activity?.p50,
      color: 'bg-emerald-500',
    },
    {
      key: 'award' as const,
      label: t('hall.ranking.factorAwards'),
      score: result.breakdown.award,
      percentile: result.percentiles?.award,
      median: result.scoreDistribution?.award?.p50,
      color: 'bg-amber-500',
    },
  ];

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.1 }}
      className="rounded-xl border p-3 sm:p-4 hover:shadow-md transition-all"
    >
      {/* 头部：学校名 + 排名 + 竞争力标签 */}
      <div className="mb-4 flex items-start justify-between gap-2">
        <div className="min-w-0">
          <h4 className="font-semibold text-sm sm:text-base truncate">{result.schoolName}</h4>
          <div className="flex items-center gap-2 mt-1 flex-wrap">
            <p className="text-xs sm:text-sm text-muted-foreground">
              {t('hall.ranking.competitorsCount', {
                count: result.competitorStats?.totalCount ?? result.totalApplicants,
              })}
            </p>
            {result.yourScore !== undefined && (
              <Badge variant="outline" className="text-xs">
                {result.yourScore.toFixed(1)}
              </Badge>
            )}
            {positionConfig && PositionIcon && (
              <Badge variant="outline" className={cn('text-xs gap-1', positionConfig.className)}>
                <PositionIcon className="h-3 w-3" />
                {t(`hall.ranking.${result.competitivePosition}`)}
              </Badge>
            )}
          </div>
        </div>
        <div className="flex items-center gap-2 sm:gap-3 shrink-0">
          {getRankIcon(result.percentile)}
          <div className="text-right">
            <p className="text-xl sm:text-2xl font-bold text-primary">#{result.yourRank}</p>
            <Badge variant="secondary" className="text-xs">
              {t('hall.ranking.topPercentile', { percent: result.percentile })}
            </Badge>
          </div>
        </div>
      </div>

      {/* 维度分解 - 带分布对比 */}
      <TooltipProvider>
        <div className="space-y-3">
          {dimensions.map((dim) => {
            const diff = dim.median != null ? Math.round((dim.score - dim.median) * 10) / 10 : null;
            const dist = result.scoreDistribution?.[dim.key];

            return (
              <div key={dim.key}>
                <div className="flex items-center justify-between mb-1">
                  <span className="text-xs text-muted-foreground">{dim.label}</span>
                  <div className="flex items-center gap-2">
                    {diff != null && (
                      <span
                        className={cn('text-xs', diff >= 0 ? 'text-emerald-600' : 'text-red-500')}
                      >
                        {diff >= 0 ? '+' : ''}
                        {diff.toFixed(1)} vs {t('hall.ranking.median')}
                      </span>
                    )}
                    <span className="text-xs font-semibold tabular-nums w-12 text-right">
                      {dim.percentile != null ? `${dim.percentile}%` : `${Math.round(dim.score)}`}
                    </span>
                  </div>
                </div>

                {/* 分布条 */}
                <Tooltip>
                  <TooltipTrigger asChild>
                    <div className="relative h-2 w-full rounded-full bg-muted overflow-hidden">
                      {/* p25-p75 区间 */}
                      {dist && (
                        <div
                          className="absolute h-full bg-muted-foreground/15 rounded-full"
                          style={{
                            left: `${Math.max(0, dist.p25)}%`,
                            width: `${Math.max(1, dist.p75 - dist.p25)}%`,
                          }}
                        />
                      )}
                      {/* 用户得分 */}
                      <motion.div
                        className={cn('h-full rounded-full', dim.color)}
                        initial={{ width: 0 }}
                        animate={{
                          width: `${Math.min(100, dim.percentile ?? Math.round(dim.score))}%`,
                        }}
                        transition={{
                          type: 'spring',
                          stiffness: 50,
                          damping: 20,
                          delay: index * 0.1 + 0.1,
                        }}
                      />
                    </div>
                  </TooltipTrigger>
                  {dist && (
                    <TooltipContent side="top" className="text-xs">
                      <p>
                        {t('hall.ranking.middle50', {
                          low: dist.p25.toFixed(1),
                          high: dist.p75.toFixed(1),
                        })}
                      </p>
                      <p>
                        {t('hall.ranking.median')}: {dist.p50.toFixed(1)}
                      </p>
                    </TooltipContent>
                  )}
                </Tooltip>
              </div>
            );
          })}
        </div>
      </TooltipProvider>

      {/* 竞争者统计摘要 */}
      {result.competitorStats && (
        <div className="mt-3 flex items-center gap-3 text-xs text-muted-foreground">
          <BarChart3 className="h-3.5 w-3.5 shrink-0" />
          <span>
            {t('hall.ranking.average')}: {result.competitorStats.avgScore.toFixed(1)}
          </span>
          <span className="text-border">|</span>
          <span>
            {t('hall.ranking.median')}: {result.competitorStats.medianScore.toFixed(1)}
          </span>
          <span className="text-border">|</span>
          <span>
            <Users className="h-3 w-3 inline mr-0.5" />
            {result.competitorStats.totalCount}
          </span>
        </div>
      )}

      {/* AI 分析 */}
      {analysis ? (
        <motion.div
          initial={{ opacity: 0, height: 0 }}
          animate={{ opacity: 1, height: 'auto' }}
          className="mt-4 rounded-lg border border-primary/20 bg-primary/5 p-3 sm:p-4 space-y-3"
        >
          <div className="flex items-center gap-2 text-sm font-medium text-primary">
            <Brain className="h-4 w-4" />
            {t('hall.ranking.aiAnalysis')}
          </div>
          <p className="text-sm">{analysis.analysis}</p>
          {analysis.strengths.length > 0 && (
            <div className="space-y-1">
              {analysis.strengths.map((s, i) => (
                <div key={i} className="flex items-start gap-2 text-sm text-emerald-600">
                  <CheckCircle className="h-3.5 w-3.5 mt-0.5 shrink-0" />
                  <span>{s}</span>
                </div>
              ))}
            </div>
          )}
          {analysis.improvements.length > 0 && (
            <div className="space-y-1">
              {analysis.improvements.map((s, i) => (
                <div key={i} className="flex items-start gap-2 text-sm text-amber-600">
                  <AlertTriangle className="h-3.5 w-3.5 mt-0.5 shrink-0" />
                  <span>{s}</span>
                </div>
              ))}
            </div>
          )}
        </motion.div>
      ) : (
        <Button
          variant="ghost"
          size="sm"
          className="mt-3 w-full gap-2 text-primary"
          onClick={onRequestAnalysis}
          disabled={analysisLoading}
        >
          {analysisLoading ? (
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
          ) : (
            <Sparkles className="h-3.5 w-3.5" />
          )}
          {t('hall.ranking.getAiAnalysis')}
        </Button>
      )}
    </motion.div>
  );
}
