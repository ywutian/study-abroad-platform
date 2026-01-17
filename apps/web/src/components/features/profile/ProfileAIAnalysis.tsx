'use client';

import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { motion, AnimatePresence } from 'framer-motion';
import { useTranslations } from 'next-intl';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { cn } from '@/lib/utils';
import { apiClient } from '@/lib/api';
import {
  Brain,
  Sparkles,
  RefreshCw,
  ChevronDown,
  ChevronUp,
  GraduationCap,
  BarChart,
  BookOpen,
  Trophy,
  Target,
  Lightbulb,
  TrendingUp,
  AlertCircle,
  CheckCircle2,
  Clock,
  Zap,
} from 'lucide-react';

type SectionStatus = 'green' | 'yellow' | 'red';

interface SectionAnalysis {
  status: SectionStatus;
  score: number;
  feedback: string;
  highlights?: string[];
  improvements?: string[];
}

interface AIAnalysisResult {
  sections: {
    academic: SectionAnalysis;
    testScores: SectionAnalysis;
    activities: SectionAnalysis;
    awards: SectionAnalysis;
  };
  overallScore: number;
  tier: 'top10' | 'top30' | 'top50' | 'top100' | 'other';
  suggestions: {
    majors: string[];
    competitions: string[];
    activities: string[];
    summerPrograms: string[];
    timeline: string[];
  };
  summary: string;
}

const STATUS_STYLES = {
  green: {
    color: 'text-emerald-600 dark:text-emerald-400',
    bg: 'bg-emerald-500/10',
    border: 'border-emerald-500/30',
    gradient: 'bg-success',
    icon: CheckCircle2,
  },
  yellow: {
    color: 'text-amber-600 dark:text-amber-400',
    bg: 'bg-amber-500/10',
    border: 'border-amber-500/30',
    gradient: 'bg-warning',
    icon: Clock,
  },
  red: {
    color: 'text-rose-600 dark:text-rose-400',
    bg: 'bg-rose-500/10',
    border: 'border-rose-500/30',
    gradient: 'from-rose-500 to-red-500',
    icon: AlertCircle,
  },
};

const SECTION_STYLES = {
  academic: { icon: GraduationCap, color: 'bg-success' },
  testScores: { icon: BarChart, color: 'bg-primary' },
  activities: { icon: BookOpen, color: 'bg-warning' },
  awards: { icon: Trophy, color: 'from-yellow-500 to-orange-500' },
};

const TIER_STYLES = {
  top10: { color: 'bg-primary text-white' },
  top30: { color: 'bg-primary text-white' },
  top50: { color: 'bg-success text-white' },
  top100: { color: 'bg-gradient-to-r bg-warning text-white' },
  other: { color: 'bg-muted text-muted-foreground' },
};

interface ProfileAIAnalysisProps {
  className?: string;
  compact?: boolean;
}

export function ProfileAIAnalysis({ className, compact = false }: ProfileAIAnalysisProps) {
  const t = useTranslations('profile');
  const [expanded, setExpanded] = useState(!compact);

  const getStatusLabel = (status: string) => {
    const labels: Record<string, string> = {
      green: t('aiAnalysis.status.excellent'),
      yellow: t('aiAnalysis.status.needsWork'),
      red: t('aiAnalysis.status.needsImprovement'),
    };
    return labels[status] || status;
  };

  const getSectionLabel = (section: string) => {
    const labels: Record<string, string> = {
      academic: t('aiAnalysis.sections.academic'),
      testScores: t('aiAnalysis.sections.testScores'),
      activities: t('aiAnalysis.sections.activities'),
      awards: t('aiAnalysis.sections.awards'),
    };
    return labels[section] || section;
  };

  const getTierLabel = (tier: string) => {
    if (tier === 'other') return t('aiAnalysis.status.needsWork');
    return tier.replace('top', 'Top ');
  };
  const [showSuggestions, setShowSuggestions] = useState(false);

  const { data, isLoading, refetch, isFetching } = useQuery({
    queryKey: ['profile-ai-analysis'],
    queryFn: () => apiClient.get<AIAnalysisResult>('/profiles/me/ai-analysis'),
    staleTime: 5 * 60 * 1000, // 5分钟缓存
    gcTime: 10 * 60 * 1000,
  });

  if (isLoading) {
    return (
      <Card className={cn('overflow-hidden', className)}>
        <div className="h-1.5 bg-primary animate-pulse" />
        <CardContent className="py-12">
          <div className="flex flex-col items-center gap-4">
            <div className="relative">
              <div className="h-16 w-16 rounded-lg bg-primary/20 animate-pulse" />
              <Brain className="absolute inset-0 m-auto h-8 w-8 text-primary/50" />
            </div>
            <div className="text-center">
              <p className="font-medium">{t('aiAnalysis.analyzing')}</p>
              <p className="text-sm text-muted-foreground mt-1">{t('aiAnalysis.analyzingHint')}</p>
            </div>
          </div>
        </CardContent>
      </Card>
    );
  }

  const analysis = data;
  if (!analysis) return null;

  const tierStyle = TIER_STYLES[analysis.tier];
  const tierLabel = getTierLabel(analysis.tier);

  return (
    <Card className={cn('overflow-hidden', className)}>
      {/* 顶部渐变条 */}
      <div className="h-1.5 bg-primary" />

      <CardHeader className="pb-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary dark:bg-primary text-white shadow-lg">
              <Brain className="h-5 w-5" />
            </div>
            <div>
              <CardTitle className="flex items-center gap-2 text-lg">
                {t('aiAnalysis.title')}
                <Sparkles className="h-4 w-4 text-primary" />
              </CardTitle>
              <CardDescription>{t('aiAnalysis.subtitle')}</CardDescription>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Badge className={cn('font-semibold', tierStyle.color)}>
              {t('aiAnalysis.suitableFor')} {tierLabel}
            </Badge>
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8"
              onClick={() => refetch()}
              disabled={isFetching}
            >
              <RefreshCw className={cn('h-4 w-4', isFetching && 'animate-spin')} />
            </Button>
          </div>
        </div>
      </CardHeader>

      <CardContent className="space-y-6">
        {/* 总分圆环 */}
        <div className="flex items-center gap-6">
          <div className="relative">
            <svg className="h-24 w-24 -rotate-90">
              <circle
                cx="48"
                cy="48"
                r="40"
                stroke="currentColor"
                strokeWidth="8"
                fill="none"
                className="text-muted/20"
              />
              <motion.circle
                cx="48"
                cy="48"
                r="40"
                stroke="url(#scoreGradient)"
                strokeWidth="8"
                fill="none"
                strokeLinecap="round"
                initial={{ strokeDasharray: '0 251.2' }}
                animate={{ strokeDasharray: `${(analysis.overallScore / 100) * 251.2} 251.2` }}
                transition={{ duration: 1, ease: 'easeOut' }}
              />
              <defs>
                <linearGradient id="scoreGradient" x1="0%" y1="0%" x2="100%" y2="100%">
                  <stop offset="0%" stopColor="#8b5cf6" />
                  <stop offset="100%" stopColor="#ec4899" />
                </linearGradient>
              </defs>
            </svg>
            <div className="absolute inset-0 flex flex-col items-center justify-center">
              <span className="text-2xl font-bold">{analysis.overallScore}</span>
              <span className="text-xs text-muted-foreground">{t('aiAnalysis.overallScore')}</span>
            </div>
          </div>

          <div className="flex-1">
            <p className="text-sm text-muted-foreground mb-2">{analysis.summary}</p>
            <Button
              variant="link"
              size="sm"
              className="h-auto p-0 text-primary"
              onClick={() => setExpanded(!expanded)}
            >
              {expanded ? t('aiAnalysis.collapse') : t('aiAnalysis.expand')}
              {expanded ? (
                <ChevronUp className="ml-1 h-4 w-4" />
              ) : (
                <ChevronDown className="ml-1 h-4 w-4" />
              )}
            </Button>
          </div>
        </div>

        {/* 各维度评分 */}
        <AnimatePresence>
          {expanded && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
              transition={{ duration: 0.2 }}
              className="space-y-4"
            >
              {/* 四维度卡片 */}
              <div className="grid gap-3 sm:grid-cols-2">
                {(
                  Object.entries(analysis.sections) as [
                    keyof typeof SECTION_STYLES,
                    SectionAnalysis,
                  ][]
                ).map(([key, section]) => {
                  const sectionStyle = SECTION_STYLES[key];
                  const statusStyle = STATUS_STYLES[section.status];
                  const StatusIcon = statusStyle.icon;
                  const sectionLabel = getSectionLabel(key);
                  const statusLabel = getStatusLabel(section.status);

                  return (
                    <motion.div
                      key={key}
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      className={cn(
                        'rounded-xl border p-4 transition-all',
                        statusStyle.border,
                        statusStyle.bg
                      )}
                    >
                      <div className="flex items-start justify-between mb-3">
                        <div className="flex items-center gap-2">
                          <div
                            className={cn(
                              'flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-to-br text-white',
                              sectionStyle.color
                            )}
                          >
                            <sectionStyle.icon className="h-4 w-4" />
                          </div>
                          <span className="font-medium">{sectionLabel}</span>
                        </div>
                        <Badge
                          variant="outline"
                          className={cn('gap-1', statusStyle.color, statusStyle.border)}
                        >
                          <StatusIcon className="h-3 w-3" />
                          {statusLabel}
                        </Badge>
                      </div>

                      {/* 分数条 */}
                      <div className="mb-2">
                        <div className="flex items-center justify-between text-sm mb-1">
                          <span className="text-muted-foreground">{t('aiAnalysis.score')}</span>
                          <span className="font-semibold">{section.score}/10</span>
                        </div>
                        <Progress value={section.score * 10} className="h-2" />
                      </div>

                      <p className="text-sm text-muted-foreground">{section.feedback}</p>

                      {/* 亮点和改进点 */}
                      {(section.highlights?.length ?? 0) > 0 && (
                        <div className="mt-2 flex flex-wrap gap-1">
                          {section.highlights?.map((h, i) => (
                            <Badge
                              key={i}
                              variant="secondary"
                              className="text-xs bg-emerald-500/10 text-emerald-600"
                            >
                              ✓ {h}
                            </Badge>
                          ))}
                        </div>
                      )}
                      {(section.improvements?.length ?? 0) > 0 && (
                        <div className="mt-2 flex flex-wrap gap-1">
                          {section.improvements?.map((imp, i) => (
                            <Badge
                              key={i}
                              variant="secondary"
                              className="text-xs bg-amber-500/10 text-amber-600"
                            >
                              → {imp}
                            </Badge>
                          ))}
                        </div>
                      )}
                    </motion.div>
                  );
                })}
              </div>

              {/* 智能建议 */}
              <div className="rounded-xl border bg-primary/5 p-4">
                <Button
                  variant="ghost"
                  className="w-full justify-between h-auto py-2"
                  onClick={() => setShowSuggestions(!showSuggestions)}
                >
                  <div className="flex items-center gap-2">
                    <Lightbulb className="h-5 w-5 text-primary" />
                    <span className="font-medium">{t('aiAnalysis.suggestions')}</span>
                  </div>
                  {showSuggestions ? (
                    <ChevronUp className="h-4 w-4" />
                  ) : (
                    <ChevronDown className="h-4 w-4" />
                  )}
                </Button>

                <AnimatePresence>
                  {showSuggestions && (
                    <motion.div
                      initial={{ opacity: 0, height: 0 }}
                      animate={{ opacity: 1, height: 'auto' }}
                      exit={{ opacity: 0, height: 0 }}
                      className="mt-4 space-y-4"
                    >
                      {/* 推荐专业 */}
                      {analysis.suggestions.majors.length > 0 && (
                        <div>
                          <div className="flex items-center gap-2 mb-2">
                            <Target className="h-4 w-4 text-pink-500" />
                            <span className="text-sm font-medium">
                              {t('aiAnalysis.recommendedMajors')}
                            </span>
                          </div>
                          <div className="flex flex-wrap gap-2">
                            {analysis.suggestions.majors.map((major, i) => (
                              <Badge key={i} variant="secondary">
                                {major}
                              </Badge>
                            ))}
                          </div>
                        </div>
                      )}

                      {/* 推荐竞赛 */}
                      {analysis.suggestions.competitions.length > 0 && (
                        <div>
                          <div className="flex items-center gap-2 mb-2">
                            <Trophy className="h-4 w-4 text-yellow-500" />
                            <span className="text-sm font-medium">
                              {t('aiAnalysis.recommendedCompetitions')}
                            </span>
                          </div>
                          <ul className="text-sm text-muted-foreground space-y-1">
                            {analysis.suggestions.competitions.map((comp, i) => (
                              <li key={i} className="flex items-start gap-2">
                                <Zap className="h-3 w-3 mt-1 text-yellow-500" />
                                {comp}
                              </li>
                            ))}
                          </ul>
                        </div>
                      )}

                      {/* 推荐活动 */}
                      {analysis.suggestions.activities.length > 0 && (
                        <div>
                          <div className="flex items-center gap-2 mb-2">
                            <BookOpen className="h-4 w-4 text-orange-500" />
                            <span className="text-sm font-medium">
                              {t('aiAnalysis.recommendedActivities')}
                            </span>
                          </div>
                          <ul className="text-sm text-muted-foreground space-y-1">
                            {analysis.suggestions.activities.map((act, i) => (
                              <li key={i} className="flex items-start gap-2">
                                <TrendingUp className="h-3 w-3 mt-1 text-orange-500" />
                                {act}
                              </li>
                            ))}
                          </ul>
                        </div>
                      )}

                      {/* 时间线规划 */}
                      {analysis.suggestions.timeline.length > 0 && (
                        <div>
                          <div className="flex items-center gap-2 mb-2">
                            <Clock className="h-4 w-4 text-blue-500" />
                            <span className="text-sm font-medium">
                              {t('aiAnalysis.planSuggestions')}
                            </span>
                          </div>
                          <ul className="text-sm text-muted-foreground space-y-1">
                            {analysis.suggestions.timeline.map((item, i) => (
                              <li key={i} className="flex items-start gap-2">
                                <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-blue-500/10 text-xs font-medium text-blue-600">
                                  {i + 1}
                                </span>
                                {item}
                              </li>
                            ))}
                          </ul>
                        </div>
                      )}
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </CardContent>
    </Card>
  );
}
