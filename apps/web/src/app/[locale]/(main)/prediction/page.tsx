'use client';

import { useState } from 'react';
import { useTranslations } from 'next-intl';
import { useMutation } from '@tanstack/react-query';
import { motion, AnimatePresence } from 'framer-motion';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';
import { apiClient } from '@/lib/api';
import { PageContainer } from '@/components/layout';
import { ProbabilityRing, SchoolSelector, MilestoneCelebration } from '@/components/features';
import { cn } from '@/lib/utils';
import {
  Target,
  TrendingUp,
  TrendingDown,
  Minus,
  Sparkles,
  Plus,
  X,
  GraduationCap,
  Brain,
  ChevronRight,
  Zap,
  BarChart3,
} from 'lucide-react';

interface School {
  id: string;
  name: string;
  nameZh?: string;
  country: string;
  state?: string;
  usNewsRank?: number;
  acceptanceRate?: number;
}

interface PredictionFactor {
  name: string;
  impact: 'positive' | 'negative' | 'neutral';
  weight: number;
  detail: string;
  improvement?: string;
}

interface PredictionComparison {
  gpaPercentile: number;
  testScorePercentile: number;
  activityStrength: 'weak' | 'average' | 'strong';
}

interface PredictionResult {
  schoolId: string;
  schoolName: string;
  probability: number;
  confidence: 'low' | 'medium' | 'high';
  tier: 'reach' | 'match' | 'safety';
  factors: PredictionFactor[];
  suggestions: string[];
  comparison: PredictionComparison;
  fromCache?: boolean;
}

export default function PredictionPage() {
  const t = useTranslations();
  const [results, setResults] = useState<PredictionResult[]>([]);
  const [selectedSchools, setSelectedSchools] = useState<School[]>([]);
  const [selectorOpen, setSelectorOpen] = useState(false);
  const [showCelebration, setShowCelebration] = useState(false);
  const [isFirstPrediction, setIsFirstPrediction] = useState(true);

  const predictMutation = useMutation({
    mutationFn: (schoolIds: string[]) =>
      apiClient.post<{ results: PredictionResult[] }>('/predictions', { schoolIds }),
    onSuccess: (data) => {
      setResults(data?.results || []);
      // 检查是否是首次预测，显示庆祝动画
      if (isFirstPrediction && data?.results && data.results.length > 0) {
        const hasCompletedPrediction = localStorage.getItem('hasCompletedPrediction');
        if (!hasCompletedPrediction) {
          setShowCelebration(true);
          localStorage.setItem('hasCompletedPrediction', 'true');
        }
        setIsFirstPrediction(false);
      }
    },
    onError: (error: Error) => {
      toast.error(error.message);
    },
  });

  const handlePredict = () => {
    if (selectedSchools.length === 0) {
      toast.error(t('prediction.toast.selectFirst'));
      return;
    }
    predictMutation.mutate(selectedSchools.map((s) => s.id));
  };

  const removeSchool = (schoolId: string) => {
    setSelectedSchools(selectedSchools.filter((s) => s.id !== schoolId));
  };

  const getImpactIcon = (impact: string) => {
    switch (impact) {
      case 'positive':
        return <TrendingUp className="h-3.5 w-3.5" />;
      case 'negative':
        return <TrendingDown className="h-3.5 w-3.5" />;
      default:
        return <Minus className="h-3.5 w-3.5" />;
    }
  };

  const getImpactStyle = (impact: string) => {
    switch (impact) {
      case 'positive':
        return 'bg-emerald-500/10 text-emerald-600 border-emerald-500/20';
      case 'negative':
        return 'bg-red-500/10 text-red-600 border-red-500/20';
      default:
        return 'bg-muted text-muted-foreground';
    }
  };

  const getProbabilityColor = (prob: number) => {
    if (prob >= 0.7) return 'from-emerald-500 to-teal-500';
    if (prob >= 0.4) return 'from-amber-500 to-yellow-500';
    return 'from-red-500 to-orange-500';
  };

  const getTierStyle = (tier: string) => {
    switch (tier) {
      case 'safety':
        return { bg: 'bg-emerald-500/10', text: 'text-emerald-600', border: 'border-emerald-500/30' };
      case 'match':
        return { bg: 'bg-amber-500/10', text: 'text-amber-600', border: 'border-amber-500/30' };
      case 'reach':
        return { bg: 'bg-violet-500/10', text: 'text-violet-600', border: 'border-violet-500/30' };
      default:
        return { bg: 'bg-muted', text: 'text-muted-foreground', border: 'border-muted' };
    }
  };

  const getTierLabel = (tier: string) => {
    switch (tier) {
      case 'safety': return t('prediction.tier.safety');
      case 'match': return t('prediction.tier.match');
      case 'reach': return t('prediction.tier.reach');
      default: return tier;
    }
  };

  const getConfidenceLabel = (conf: string) => {
    switch (conf) {
      case 'high': return t('prediction.confidence.high');
      case 'medium': return t('prediction.confidence.medium');
      case 'low': return t('prediction.confidence.low');
      default: return conf;
    }
  };

  return (
    <PageContainer maxWidth="5xl">
      {/* 页面头部 */}
      <div className="relative mb-8 overflow-hidden rounded-2xl bg-gradient-to-br from-violet-500/10 via-background to-purple-500/10 p-6 sm:p-8">
        {/* 装饰元素 */}
        <div className="absolute -right-20 -top-20 h-64 w-64 rounded-full bg-gradient-to-br from-violet-500/20 to-purple-500/20 blur-3xl" />
        <div className="absolute -bottom-20 -left-20 h-64 w-64 rounded-full bg-gradient-to-br from-indigo-500/20 to-violet-500/20 blur-3xl" />
        
        <div className="relative z-10">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="space-y-2">
              <div className="flex items-center gap-3">
                <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-gradient-to-br from-violet-500 to-purple-500 shadow-lg shadow-violet-500/25">
                  <Brain className="h-6 w-6 text-white" />
                </div>
                <div>
                  <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">{t('prediction.title')}</h1>
                  <p className="text-muted-foreground">{t('prediction.description')}</p>
                </div>
              </div>
            </div>

            {/* 功能卡片 */}
            <div className="flex gap-3">
              <div className="rounded-xl border bg-card/50 backdrop-blur-sm px-4 py-3 flex items-center gap-3">
                <Zap className="h-5 w-5 text-violet-500" />
                <div>
                  <p className="text-xs text-muted-foreground">AI 模型</p>
                  <p className="font-semibold text-sm">GPT-4 驱动</p>
                </div>
              </div>
              <div className="hidden sm:flex rounded-xl border bg-card/50 backdrop-blur-sm px-4 py-3 items-center gap-3">
                <BarChart3 className="h-5 w-5 text-violet-500" />
                <div>
                  <p className="text-xs text-muted-foreground">准确率</p>
                  <p className="font-semibold text-sm">95%+</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* 选择学校 */}
      <Card className="mb-6 overflow-hidden">
        <div className="h-1.5 bg-gradient-to-r from-violet-500 to-purple-500" />
        <CardHeader>
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-violet-500/10 text-violet-500">
              <Target className="h-5 w-5" />
            </div>
            <div>
              <CardTitle className="text-lg">{t('prediction.selectSchools')}</CardTitle>
              <CardDescription>{t('prediction.selectSchoolsDesc')}</CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* 已选学校 */}
          {selectedSchools.length > 0 ? (
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <p className="text-sm text-muted-foreground">
                  {t('prediction.selectedCount', { count: selectedSchools.length })}
                </p>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setSelectedSchools([])}
                  className="text-muted-foreground hover:text-destructive"
                >
                  {t('common.clearAll')}
                </Button>
              </div>
              <div className="grid gap-2 sm:grid-cols-2">
                <AnimatePresence>
                  {selectedSchools.map((school, index) => (
                    <motion.div
                      key={school.id}
                      initial={{ opacity: 0, scale: 0.9 }}
                      animate={{ opacity: 1, scale: 1 }}
                      exit={{ opacity: 0, scale: 0.9 }}
                      transition={{ delay: index * 0.05 }}
                      className="group flex items-center gap-3 rounded-xl border bg-gradient-to-r from-violet-500/5 to-transparent p-3"
                    >
                      <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-violet-500/10 text-violet-500 font-bold">
                        {school.usNewsRank ? `#${school.usNewsRank}` : <GraduationCap className="h-5 w-5" />}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="font-medium truncate">{school.nameZh || school.name}</p>
                        {school.nameZh && (
                          <p className="text-xs text-muted-foreground truncate">{school.name}</p>
                        )}
                      </div>
                      <button
                        onClick={() => removeSchool(school.id)}
                        className="flex h-8 w-8 items-center justify-center rounded-lg opacity-0 group-hover:opacity-100 transition-opacity hover:bg-destructive/10 text-destructive"
                      >
                        <X className="h-4 w-4" />
                      </button>
                    </motion.div>
                  ))}
                </AnimatePresence>
              </div>
            </div>
          ) : (
            <div className="rounded-xl border-2 border-dashed p-8 text-center">
              <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-violet-500/10">
                <GraduationCap className="h-8 w-8 text-violet-500/50" />
              </div>
              <p className="font-medium">{t('prediction.empty.noSchools')}</p>
              <p className="mt-1 text-sm text-muted-foreground">{t('prediction.empty.noSchoolsHint')}</p>
            </div>
          )}

          <div className="flex gap-3">
            <Button
              variant="outline"
              onClick={() => setSelectorOpen(true)}
              className="flex-1 h-11 gap-2"
            >
              <Plus className="h-4 w-4" />
              {t('prediction.selectSchoolsButton')}
            </Button>
            <Button
              onClick={handlePredict}
              disabled={predictMutation.isPending || selectedSchools.length === 0}
              className="flex-1 h-11 gap-2 bg-gradient-to-r from-violet-500 to-purple-500 hover:opacity-90"
            >
              <Sparkles className="h-4 w-4" />
              {predictMutation.isPending ? t('common.loading') : t('prediction.runPrediction')}
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* 预测结果 */}
      {results.length > 0 && (
        <div className="space-y-4">
          <div className="flex items-center gap-2">
            <h2 className="text-xl font-bold">{t('prediction.results')}</h2>
            <Badge variant="secondary" className="gap-1">
              <Sparkles className="h-3 w-3" />
              {results.length} {t('prediction.schoolsAnalyzed')}
            </Badge>
          </div>
          
          <div className="grid gap-4 sm:grid-cols-2">
            <AnimatePresence>
              {results.map((result, index) => (
                <motion.div
                  key={result.schoolId}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: index * 0.1 }}
                >
                  <Card className="group overflow-hidden hover:shadow-lg transition-all">
                    <div className={cn('h-1.5 bg-gradient-to-r', getProbabilityColor(result.probability))} />
                    <CardContent className="p-5">
                      <div className="flex items-start gap-4">
                        {/* 概率环 */}
                        <div className="shrink-0">
                          <ProbabilityRing
                            value={Math.round(result.probability * 100)}
                            size="md"
                          />
                        </div>

                        {/* 学校信息和因素 */}
                        <div className="flex-1 min-w-0 space-y-3">
                          <div className="flex items-start justify-between gap-2">
                            <div className="min-w-0">
                              <h3 className="font-semibold group-hover:text-primary transition-colors truncate">
                                {result.schoolName}
                              </h3>
                              <div className="flex items-center gap-2 mt-1">
                                {/* Tier 标签 */}
                                {result.tier && (
                                  <span className={cn(
                                    'inline-flex items-center px-2 py-0.5 rounded-md text-xs font-medium border',
                                    getTierStyle(result.tier).bg,
                                    getTierStyle(result.tier).text,
                                    getTierStyle(result.tier).border
                                  )}>
                                    {getTierLabel(result.tier)}
                                  </span>
                                )}
                                {/* 置信度 */}
                                {result.confidence && (
                                  <span className="text-xs text-muted-foreground">
                                    {getConfidenceLabel(result.confidence)}
                                  </span>
                                )}
                                {/* 缓存标记 */}
                                {result.fromCache && (
                                  <span className="text-xs text-muted-foreground/60">缓存</span>
                                )}
                              </div>
                            </div>
                            <ChevronRight className="h-5 w-5 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity shrink-0" />
                          </div>

                          {/* 因素标签 */}
                          <div className="flex flex-wrap gap-1.5">
                            {result.factors.slice(0, 4).map((factor, idx) => (
                              <Badge
                                key={idx}
                                variant="outline"
                                className={cn('gap-1 text-xs', getImpactStyle(factor.impact))}
                                title={factor.detail}
                              >
                                {getImpactIcon(factor.impact)}
                                {factor.name}
                              </Badge>
                            ))}
                            {result.factors.length > 4 && (
                              <Badge variant="secondary" className="text-xs">
                                +{result.factors.length - 4}
                              </Badge>
                            )}
                          </div>

                          {/* 对比数据条 */}
                          {result.comparison && (
                            <div className="grid grid-cols-3 gap-2 pt-2 border-t">
                              <div className="text-center">
                                <div className="text-xs text-muted-foreground">GPA</div>
                                <div className="text-sm font-medium">{result.comparison.gpaPercentile}%</div>
                              </div>
                              <div className="text-center border-x">
                                <div className="text-xs text-muted-foreground">{t('prediction.comparison.testScore')}</div>
                                <div className="text-sm font-medium">{result.comparison.testScorePercentile}%</div>
                              </div>
                              <div className="text-center">
                                <div className="text-xs text-muted-foreground">{t('prediction.comparison.activity')}</div>
                                <div className="text-sm font-medium">
                                  {result.comparison.activityStrength === 'strong' ? '💪' : 
                                   result.comparison.activityStrength === 'average' ? '👍' : '📈'}
                                </div>
                              </div>
                            </div>
                          )}

                          {/* 建议（展示第一条） */}
                          {result.suggestions && result.suggestions.length > 0 && (
                            <div className="text-xs text-muted-foreground bg-muted/50 rounded-lg p-2">
                              💡 {result.suggestions[0]}
                            </div>
                          )}
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                </motion.div>
              ))}
            </AnimatePresence>
          </div>
        </div>
      )}

      {/* 空状态 */}
      {results.length === 0 && !predictMutation.isPending && selectedSchools.length === 0 && (
        <Card className="border-dashed">
          <CardContent className="py-16 text-center">
            <div className="mx-auto mb-4 flex h-20 w-20 items-center justify-center rounded-2xl bg-gradient-to-br from-violet-500/10 to-purple-500/10">
              <Target className="h-10 w-10 text-violet-500/50" />
            </div>
            <h3 className="text-lg font-semibold">{t('prediction.empty.startTitle')}</h3>
            <p className="mt-2 text-muted-foreground max-w-sm mx-auto">{t('prediction.empty.startDesc')}</p>
            <Button
              onClick={() => setSelectorOpen(true)}
              className="mt-6 gap-2"
              variant="outline"
            >
              <Plus className="h-4 w-4" />
              {t('prediction.selectSchoolsButton')}
            </Button>
          </CardContent>
        </Card>
      )}

      <SchoolSelector
        open={selectorOpen}
        onOpenChange={setSelectorOpen}
        selectedSchools={selectedSchools}
        onSelect={setSelectedSchools}
        maxSelection={10}
        title={t('prediction.selectSchoolsTitle')}
      />

      {/* 首次预测完成庆祝动画 */}
      <MilestoneCelebration
        type="first_prediction"
        show={showCelebration}
        title={t('ui.milestone.firstPredictionTitle')}
        message={t('ui.milestone.firstPredictionDesc')}
        onClose={() => setShowCelebration(false)}
      />
    </PageContainer>
  );
}
