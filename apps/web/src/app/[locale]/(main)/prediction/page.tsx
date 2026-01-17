'use client';

import { useState, useMemo, useEffect } from 'react';
import { useTranslations, useLocale } from 'next-intl';
import { useMutation, useQuery } from '@tanstack/react-query';
import { motion, AnimatePresence } from 'framer-motion';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { toast } from 'sonner';
import { apiClient } from '@/lib/api';
import { AiAssistantPanel, type ContextAction } from '@/components/features/agent-chat';
import {
  Bot,
  Search,
  X,
  CheckCircle,
  School,
  TrendingUp,
  Target,
  Lightbulb,
  GraduationCap,
  BarChart3,
  Loader2,
  ChevronDown,
  ChevronUp,
  Info,
  Shield,
  Zap,
  Database,
  Brain,
  History,
} from 'lucide-react';
import { cn, getSchoolName } from '@/lib/utils';

// ============================================
// Types
// ============================================

interface PredictionFactor {
  name: string;
  impact: 'positive' | 'negative' | 'neutral';
  weight: number;
  detail: string;
  improvement?: string;
}

interface EngineScores {
  stats: number;
  ai?: number;
  historical?: number;
  memoryAdjustment?: number;
  weights: Record<string, number>;
  fusionMethod: string;
}

interface PredictionResult {
  schoolId: string;
  schoolName: string;
  probability: number;
  probabilityLow?: number;
  probabilityHigh?: number;
  confidence?: 'low' | 'medium' | 'high';
  tier?: 'reach' | 'match' | 'safety';
  factors: PredictionFactor[];
  suggestions?: string[];
  engineScores?: EngineScores;
  modelVersion?: string;
}

interface SchoolItem {
  id: string;
  name: string;
  nameZh?: string;
  usNewsRank?: number;
  acceptanceRate?: number | string;
}

// ============================================
// Component
// ============================================

export default function PredictionPage() {
  const t = useTranslations();
  const locale = useLocale();
  const [results, setResults] = useState<PredictionResult[]>([]);
  const [selectedSchools, setSelectedSchools] = useState<SchoolItem[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [debouncedQuery, setDebouncedQuery] = useState('');
  const [showAiPanel, setShowAiPanel] = useState(false);
  const [expandedCards, setExpandedCards] = useState<Set<string>>(new Set());

  // 防抖处理搜索查询 (300ms)
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedQuery(searchQuery.trim());
    }, 300);
    return () => clearTimeout(timer);
  }, [searchQuery]);

  // 搜索学校
  const { data: searchResults, isLoading: searchLoading } = useQuery<{ items: SchoolItem[] }>({
    queryKey: ['schools-search', debouncedQuery],
    queryFn: () =>
      apiClient.get(`/schools`, {
        params: { search: debouncedQuery, pageSize: '10' },
      }),
    enabled: debouncedQuery.length >= 1,
  });

  const predictMutation = useMutation({
    mutationFn: (schoolIds: string[]) =>
      apiClient.post<{ results: PredictionResult[]; processingTime?: number }>('/predictions', {
        schoolIds,
        forceRefresh: true,
      }),
    onSuccess: (data) => {
      const predictionResults = data.results || [];
      setResults(predictionResults);
      if (predictionResults.length > 0) {
        toast.success(t('prediction.successMessage', { count: predictionResults.length }));
      } else {
        toast.info(t('prediction.noResult'));
      }
    },
    onError: (error: Error) => {
      console.error('Prediction error:', error);
      toast.error(error.message);
    },
  });

  const handleAddSchool = (school: SchoolItem) => {
    if (!selectedSchools.find((s) => s.id === school.id)) {
      setSelectedSchools([...selectedSchools, school]);
    }
    setSearchQuery('');
  };

  const handleRemoveSchool = (schoolId: string) => {
    setSelectedSchools(selectedSchools.filter((s) => s.id !== schoolId));
  };

  const handlePredict = () => {
    if (selectedSchools.length === 0) {
      toast.error(t('prediction.selectSchoolsFirst'));
      return;
    }
    predictMutation.mutate(selectedSchools.map((s) => s.id));
  };

  const toggleCardExpansion = (schoolId: string) => {
    setExpandedCards((prev) => {
      const next = new Set(prev);
      if (next.has(schoolId)) next.delete(schoolId);
      else next.add(schoolId);
      return next;
    });
  };

  // ============================================
  // Style Helpers
  // ============================================

  const getImpactColor = (impact: string) => {
    switch (impact) {
      case 'positive':
        return 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400';
      case 'negative':
        return 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400';
      default:
        return 'bg-slate-100 text-slate-800 dark:bg-slate-800 dark:text-slate-300';
    }
  };

  const getProbabilityColor = (prob: number) => {
    if (prob >= 0.6) return 'text-green-600 dark:text-green-400';
    if (prob >= 0.3) return 'text-amber-600 dark:text-amber-400';
    return 'text-red-600 dark:text-red-400';
  };

  const getTierBadge = (tier?: string) => {
    switch (tier) {
      case 'safety':
        return (
          <Badge className="bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400 border-green-200">
            {t('prediction.tier.safety')}
          </Badge>
        );
      case 'match':
        return (
          <Badge className="bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400 border-amber-200">
            {t('prediction.tier.match')}
          </Badge>
        );
      case 'reach':
        return (
          <Badge className="bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400 border-red-200">
            {t('prediction.tier.reach')}
          </Badge>
        );
      default:
        return null;
    }
  };

  const getConfidenceBadge = (confidence?: string) => {
    switch (confidence) {
      case 'high':
        return (
          <Badge variant="outline" className="border-green-300 text-green-600">
            <Shield className="h-3 w-3 mr-1" />
            {t('prediction.confidence.high')}
          </Badge>
        );
      case 'medium':
        return (
          <Badge variant="outline" className="border-amber-300 text-amber-600">
            <Shield className="h-3 w-3 mr-1" />
            {t('prediction.confidence.medium')}
          </Badge>
        );
      case 'low':
        return (
          <Badge variant="outline" className="border-red-300 text-red-600">
            <Shield className="h-3 w-3 mr-1" />
            {t('prediction.confidence.low')}
          </Badge>
        );
      default:
        return null;
    }
  };

  const getEngineIcon = (engine: string) => {
    switch (engine) {
      case 'stats':
        return <Zap className="h-3.5 w-3.5" />;
      case 'ai':
        return <Brain className="h-3.5 w-3.5" />;
      case 'historical':
        return <History className="h-3.5 w-3.5" />;
      default:
        return <Database className="h-3.5 w-3.5" />;
    }
  };

  const getEngineLabel = (engine: string) => {
    const key = `prediction.engine.${engine}`;
    try {
      return t(key);
    } catch {
      return engine;
    }
  };

  // ============================================
  // AI Context Actions
  // ============================================

  const aiContextActions = useMemo((): ContextAction[] => {
    const actions: ContextAction[] = [];

    if (results.length > 0) {
      const resultsText = results
        .map((r) => {
          const range =
            r.probabilityLow && r.probabilityHigh
              ? ` (${(r.probabilityLow * 100).toFixed(0)}-${(r.probabilityHigh * 100).toFixed(0)}%)`
              : '';
          return `- ${r.schoolName}: ${(r.probability * 100).toFixed(0)}%${range} [${r.tier || t('prediction.tier.unknown')}] (${r.factors.map((f) => `${f.name}: ${f.detail}`).join(', ')})`;
        })
        .join('\n');
      const resultsTextShort = results
        .map((r) => `- ${r.schoolName}: ${(r.probability * 100).toFixed(0)}%`)
        .join('\n');
      actions.push(
        {
          id: 'analyze-results',
          label: t('prediction.aiActions.analyzeResults'),
          prompt: t('prediction.aiActions.analyzeResultsPrompt', { results: resultsText }),
          icon: <BarChart3 className="h-4 w-4" />,
        },
        {
          id: 'improve-chances',
          label: t('prediction.aiActions.improveChances'),
          prompt: t('prediction.aiActions.improveChancesPrompt', { results: resultsTextShort }),
          icon: <TrendingUp className="h-4 w-4" />,
        }
      );
    }

    if (selectedSchools.length > 0) {
      const schoolsText = selectedSchools
        .map(
          (s) =>
            `- ${getSchoolName(s, locale)}${s.usNewsRank ? ` (#${s.usNewsRank})` : ''}${s.acceptanceRate ? ` (${t('prediction.acceptanceRateLabel', { rate: s.acceptanceRate })})` : ''}`
        )
        .join('\n');
      actions.push({
        id: 'school-analysis',
        label: t('prediction.aiActions.analyzeSelectedSchools'),
        prompt: t('prediction.aiActions.analyzeSelectedSchoolsPrompt', { schools: schoolsText }),
        icon: <School className="h-4 w-4" />,
      });
    }

    actions.push(
      {
        id: 'recommend-schools',
        label: t('prediction.aiActions.recommendSchools'),
        prompt: t('prediction.aiActions.recommendSchoolsPrompt'),
        icon: <Target className="h-4 w-4" />,
      },
      {
        id: 'application-strategy',
        label: t('prediction.aiActions.applicationStrategy'),
        prompt: t('prediction.aiActions.applicationStrategyPrompt'),
        icon: <Lightbulb className="h-4 w-4" />,
      },
      {
        id: 'explain-prediction',
        label: t('prediction.aiActions.explainModel'),
        prompt: t('prediction.aiActions.explainModelPrompt'),
        icon: <GraduationCap className="h-4 w-4" />,
      }
    );

    return actions;
  }, [results, selectedSchools, locale, t]);

  // ============================================
  // Render
  // ============================================

  return (
    <div className="container mx-auto py-8 px-4 max-w-4xl">
      {/* Header */}
      <div className="relative mb-8 overflow-hidden rounded-lg bg-primary/5 p-6 sm:p-8">
        <div className="absolute -right-20 -top-20 h-64 w-64 rounded-full bg-primary/20 blur-3xl" />
        <div className="relative z-10">
          <div className="flex items-center gap-4">
            <div className="flex h-14 w-14 items-center justify-center rounded-lg bg-primary">
              <Target className="h-7 w-7 text-white" />
            </div>
            <div>
              <h1 className="text-title">{t('prediction.title')}</h1>
              <p className="text-muted-foreground">{t('prediction.selectSchoolsDesc')}</p>
            </div>
          </div>
          {/* Model Version Badge */}
          <div className="mt-3 flex items-center gap-2">
            <Badge variant="secondary" className="text-xs">
              <Zap className="h-3 w-3 mr-1" />
              {t('prediction.badge.ensemble')}
            </Badge>
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger>
                  <Info className="h-3.5 w-3.5 text-muted-foreground" />
                </TooltipTrigger>
                <TooltipContent className="max-w-xs">
                  <p className="text-xs">{t('prediction.tooltip.ensemble')}</p>
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
          </div>
        </div>
      </div>

      {/* 学校选择器 */}
      <Card className="mb-6">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <School className="h-5 w-5" />
            {t('prediction.selectSchools')}
          </CardTitle>
          <CardDescription>{t('prediction.searchSchoolsDesc')}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* 搜索框 */}
          <div className="relative">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder={t('prediction.searchPlaceholder')}
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-10"
            />

            {/* 搜索结果下拉 */}
            {searchQuery.trim().length >= 1 && (
              <Card className="absolute top-full left-0 right-0 mt-1 z-50 shadow-lg">
                <ScrollArea className="max-h-60">
                  {searchLoading ? (
                    <div className="flex items-center justify-center py-4">
                      <Loader2 className="h-5 w-5 animate-spin text-primary" />
                    </div>
                  ) : searchResults?.items && searchResults.items.length > 0 ? (
                    <div className="p-1">
                      {searchResults.items.map((school) => (
                        <button
                          key={school.id}
                          onClick={() => handleAddSchool(school)}
                          disabled={selectedSchools.some((s) => s.id === school.id)}
                          className={cn(
                            'w-full flex items-center justify-between p-2 rounded-md text-left',
                            'hover:bg-muted transition-colors',
                            selectedSchools.some((s) => s.id === school.id) &&
                              'opacity-50 cursor-not-allowed'
                          )}
                        >
                          <div>
                            <p className="font-medium">{getSchoolName(school, locale)}</p>
                            <p className="text-xs text-muted-foreground">
                              {school.usNewsRank && `#${school.usNewsRank}`}
                              {school.acceptanceRate &&
                                ` · ${t('prediction.acceptanceRateLabel', { rate: Number(school.acceptanceRate).toFixed(1) })}`}
                            </p>
                          </div>
                          {selectedSchools.some((s) => s.id === school.id) && (
                            <CheckCircle className="h-4 w-4 text-primary" />
                          )}
                        </button>
                      ))}
                    </div>
                  ) : (
                    <p className="text-center py-4 text-muted-foreground">
                      {t('prediction.noSchoolsFound')}
                    </p>
                  )}
                </ScrollArea>
              </Card>
            )}
          </div>

          {/* 已选学校列表 */}
          {selectedSchools.length > 0 && (
            <div className="space-y-2">
              <p className="text-sm text-muted-foreground">
                {t('prediction.selectedCount', { count: selectedSchools.length })}
              </p>
              <div className="flex flex-wrap gap-2">
                {selectedSchools.map((school) => (
                  <Badge
                    key={school.id}
                    variant="secondary"
                    className="flex items-center gap-1 py-1.5 px-3"
                  >
                    {getSchoolName(school, locale)}
                    {school.usNewsRank && (
                      <span className="text-xs opacity-70">#{school.usNewsRank}</span>
                    )}
                    <button
                      onClick={() => handleRemoveSchool(school.id)}
                      className="ml-1 hover:text-destructive"
                    >
                      <X className="h-3 w-3" />
                    </button>
                  </Badge>
                ))}
              </div>
            </div>
          )}

          <Button
            onClick={handlePredict}
            disabled={predictMutation.isPending || selectedSchools.length === 0}
            className="w-full"
          >
            {predictMutation.isPending ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                {t('prediction.loading.analyzing')}
              </>
            ) : (
              <>
                <Target className="mr-2 h-4 w-4" />
                {t('prediction.runPrediction')}
              </>
            )}
          </Button>
        </CardContent>
      </Card>

      {/* 预测结果 */}
      <AnimatePresence>
        {results.length > 0 && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="space-y-4"
          >
            <h2 className="text-subtitle flex items-center gap-2">
              <BarChart3 className="h-5 w-5 text-primary" />
              {t('prediction.results')}
            </h2>

            {results.map((result, index) => {
              const isExpanded = expandedCards.has(result.schoolId);

              return (
                <motion.div
                  key={result.schoolId}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: index * 0.1 }}
                >
                  <Card className="overflow-hidden">
                    <CardHeader className="pb-3">
                      <div className="flex items-start justify-between">
                        <div className="space-y-1.5">
                          <CardTitle className="flex items-center gap-2">
                            {result.schoolName}
                            {getTierBadge(result.tier)}
                          </CardTitle>
                          <div className="flex items-center gap-2">
                            {getConfidenceBadge(result.confidence)}
                            {result.modelVersion && (
                              <span className="text-xs text-muted-foreground">
                                {result.modelVersion}
                              </span>
                            )}
                          </div>
                        </div>
                        <div className="text-right">
                          <div
                            className={`text-3xl font-bold ${getProbabilityColor(result.probability)}`}
                          >
                            {(result.probability * 100).toFixed(0)}%
                          </div>
                          {result.probabilityLow !== undefined &&
                            result.probabilityHigh !== undefined && (
                              <p className="text-xs text-muted-foreground mt-0.5">
                                {t('prediction.range')}: {(result.probabilityLow * 100).toFixed(0)}-
                                {(result.probabilityHigh * 100).toFixed(0)}%
                              </p>
                            )}
                        </div>
                      </div>
                    </CardHeader>
                    <CardContent className="space-y-4">
                      {/* 概率条 (带置信区间) */}
                      <div>
                        <div className="flex justify-between text-sm mb-1">
                          <span>{t('prediction.probability')}</span>
                          <span className="font-medium">
                            {(result.probability * 100).toFixed(1)}%
                          </span>
                        </div>
                        <div className="relative">
                          <Progress value={result.probability * 100} className="h-2.5" />
                          {/* 置信区间标记 */}
                          {result.probabilityLow !== undefined &&
                            result.probabilityHigh !== undefined && (
                              <div
                                className="absolute top-0 h-2.5 bg-primary/20 rounded-full"
                                style={{
                                  left: `${result.probabilityLow * 100}%`,
                                  width: `${(result.probabilityHigh - result.probabilityLow) * 100}%`,
                                }}
                              />
                            )}
                        </div>
                      </div>

                      {/* 因素分析 */}
                      <div className="space-y-2">
                        <h4 className="font-medium text-sm">{t('prediction.factors')}</h4>
                        <div className="flex flex-wrap gap-2">
                          {result.factors.map((factor, idx) => (
                            <TooltipProvider key={idx}>
                              <Tooltip>
                                <TooltipTrigger>
                                  <div
                                    className={`px-3 py-1.5 rounded-full text-sm ${getImpactColor(factor.impact)}`}
                                  >
                                    <span className="font-medium">{factor.name}:</span>{' '}
                                    {factor.detail}
                                  </div>
                                </TooltipTrigger>
                                {factor.improvement && (
                                  <TooltipContent className="max-w-xs">
                                    <p className="text-xs">{factor.improvement}</p>
                                  </TooltipContent>
                                )}
                              </Tooltip>
                            </TooltipProvider>
                          ))}
                        </div>
                      </div>

                      {/* 展开/收起按钮 */}
                      <button
                        onClick={() => toggleCardExpansion(result.schoolId)}
                        className="w-full flex items-center justify-center gap-1 text-sm text-muted-foreground hover:text-foreground transition-colors py-1"
                      >
                        {isExpanded ? (
                          <>
                            <ChevronUp className="h-4 w-4" />
                            {t('prediction.showLess')}
                          </>
                        ) : (
                          <>
                            <ChevronDown className="h-4 w-4" />
                            {t('prediction.showMore')}
                          </>
                        )}
                      </button>

                      {/* 展开的详细信息 */}
                      <AnimatePresence>
                        {isExpanded && (
                          <motion.div
                            initial={{ height: 0, opacity: 0 }}
                            animate={{ height: 'auto', opacity: 1 }}
                            exit={{ height: 0, opacity: 0 }}
                            className="space-y-4 overflow-hidden"
                          >
                            {/* 建议 */}
                            {result.suggestions && result.suggestions.length > 0 && (
                              <div className="space-y-2">
                                <h4 className="font-medium text-sm flex items-center gap-1.5">
                                  <Lightbulb className="h-4 w-4 text-amber-500" />
                                  {t('prediction.suggestions')}
                                </h4>
                                <ul className="space-y-1">
                                  {result.suggestions.map((s, idx) => (
                                    <li
                                      key={idx}
                                      className="text-sm text-muted-foreground flex items-start gap-2"
                                    >
                                      <span className="text-primary mt-0.5">-</span>
                                      {s}
                                    </li>
                                  ))}
                                </ul>
                              </div>
                            )}

                            {/* 引擎明细 */}
                            {result.engineScores && (
                              <div className="space-y-2">
                                <h4 className="font-medium text-sm flex items-center gap-1.5">
                                  <Database className="h-4 w-4 text-blue-500" />
                                  {t('prediction.engineBreakdown')}
                                </h4>
                                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                                  {(['stats', 'ai', 'historical'] as const).map((engine) => {
                                    const score =
                                      engine === 'stats'
                                        ? result.engineScores!.stats
                                        : engine === 'ai'
                                          ? result.engineScores!.ai
                                          : result.engineScores!.historical;
                                    const weight = result.engineScores!.weights[engine];

                                    if (score === undefined) return null;

                                    return (
                                      <div
                                        key={engine}
                                        className="flex items-center gap-2 rounded-lg border p-2.5"
                                      >
                                        <div className="flex h-8 w-8 items-center justify-center rounded-md bg-muted">
                                          {getEngineIcon(engine)}
                                        </div>
                                        <div className="flex-1 min-w-0">
                                          <p className="text-xs text-muted-foreground">
                                            {getEngineLabel(engine)}
                                          </p>
                                          <p className="font-semibold text-sm">
                                            {(score * 100).toFixed(0)}%
                                            {weight !== undefined && (
                                              <span className="text-xs font-normal text-muted-foreground ml-1">
                                                ({t('prediction.weight')}:{' '}
                                                {(weight * 100).toFixed(0)}%)
                                              </span>
                                            )}
                                          </p>
                                        </div>
                                      </div>
                                    );
                                  })}
                                </div>
                                {result.engineScores.memoryAdjustment !== undefined &&
                                  result.engineScores.memoryAdjustment !== 0 && (
                                    <p className="text-xs text-muted-foreground">
                                      <Brain className="h-3 w-3 inline mr-1" />
                                      {t('prediction.memoryAdjustment')}:{' '}
                                      {result.engineScores.memoryAdjustment > 0 ? '+' : ''}
                                      {(result.engineScores.memoryAdjustment * 100).toFixed(1)}%
                                    </p>
                                  )}
                              </div>
                            )}
                          </motion.div>
                        )}
                      </AnimatePresence>
                    </CardContent>
                  </Card>
                </motion.div>
              );
            })}
          </motion.div>
        )}
      </AnimatePresence>

      {results.length === 0 && selectedSchools.length === 0 && !predictMutation.isPending && (
        <div className="text-center py-12 text-muted-foreground">
          <GraduationCap className="h-16 w-16 mx-auto mb-4 opacity-50" />
          <p className="text-lg font-medium">{t('prediction.startPrediction')}</p>
          <p className="text-sm">{t('prediction.emptyHint')}</p>
        </div>
      )}

      {/* AI 助手触发按钮 */}
      <motion.button
        initial={{ scale: 0 }}
        animate={{ scale: 1 }}
        whileHover={{ scale: 1.1 }}
        whileTap={{ scale: 0.9 }}
        onClick={() => setShowAiPanel(true)}
        className={cn(
          'fixed bottom-6 right-6 z-40 flex h-14 w-14 items-center justify-center',
          'rounded-full bg-primary text-white shadow-lg',
          'hover:bg-primary/90 transition-colors',
          showAiPanel && 'hidden'
        )}
      >
        <Bot className="h-6 w-6" />
      </motion.button>

      {/* AI 助手面板 */}
      <AiAssistantPanel
        isOpen={showAiPanel}
        onClose={() => setShowAiPanel(false)}
        title={t('prediction.aiAssistantTitle')}
        description={
          results.length > 0
            ? t('prediction.aiAssistantDescWithResults')
            : t('prediction.aiAssistantDescNoResults')
        }
        contextActions={aiContextActions}
        initialMessage={
          results.length > 0
            ? t('prediction.aiInitialWithResults', { count: results.length })
            : t('prediction.aiInitialNoResults')
        }
      />
    </div>
  );
}
