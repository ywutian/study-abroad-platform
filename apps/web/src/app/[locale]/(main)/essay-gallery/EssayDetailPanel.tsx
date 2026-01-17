'use client';

import { useState } from 'react';
import { useTranslations, useLocale } from 'next-intl';
import { useQuery, useMutation } from '@tanstack/react-query';
import { motion, AnimatePresence } from 'framer-motion';
import {
  FileText,
  Trophy,
  CheckCircle2,
  AlertCircle,
  Clock,
  Brain,
  Sparkles,
  RefreshCw,
  ChevronDown,
  ChevronUp,
  Lightbulb,
  Copy,
  Check,
} from 'lucide-react';

import { DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { apiClient } from '@/lib/api/client';
import { cn, getSchoolName } from '@/lib/utils';
import { toast } from 'sonner';
import { useAuthStore } from '@/stores/auth';

interface EssayDetail {
  id: string;
  year: number;
  round: string;
  result: string;
  prompt: string | null;
  content: string | null;
  wordCount: number;
  gpaRange: string | null;
  satRange: string | null;
  school: {
    id: string;
    name: string;
    nameZh?: string;
    usNewsRank?: number;
  } | null;
  tags: string[];
  isVerified: boolean;
  isAnonymous: boolean;
}

interface ParagraphComment {
  paragraphIndex: number;
  paragraphText: string;
  score: number;
  status: 'excellent' | 'good' | 'needs_work';
  comment: string;
  highlights: string[];
  suggestions: string[];
}

interface AnalysisResult {
  essayId: string;
  paragraphs: ParagraphComment[];
  overallScore: number;
  structure: {
    hasStrongOpening: boolean;
    hasClarity: boolean;
    hasGoodConclusion: boolean;
    feedback: string;
  };
  summary: string;
  tokenUsed: number;
}

const STATUS_STYLES = {
  excellent: {
    icon: CheckCircle2,
    color: 'text-emerald-600 dark:text-emerald-400',
    bg: 'bg-emerald-500/10',
    border: 'border-emerald-500/30',
  },
  good: {
    icon: Clock,
    color: 'text-amber-600 dark:text-amber-400',
    bg: 'bg-amber-500/10',
    border: 'border-amber-500/30',
  },
  needs_work: {
    icon: AlertCircle,
    color: 'text-rose-600 dark:text-rose-400',
    bg: 'bg-rose-500/10',
    border: 'border-rose-500/30',
  },
};

const RESULT_STYLES: Record<string, string> = {
  ACCEPTED: 'bg-emerald-500/10 text-emerald-600',
  WAITLISTED: 'bg-amber-500/10 text-amber-600',
  REJECTED: 'bg-rose-500/10 text-rose-600',
  DEFERRED: 'bg-blue-500/10 text-blue-600',
};

interface EssayDetailPanelProps {
  essayId: string;
  onClose: () => void;
}

export function EssayDetailPanel({ essayId, onClose: _onClose }: EssayDetailPanelProps) {
  const t = useTranslations('essayGallery');
  const tc = useTranslations('cases');
  const locale = useLocale();
  const [activeTab, setActiveTab] = useState('content');

  const getResultLabel = (result: string) => {
    const labels: Record<string, string> = {
      ACCEPTED: tc('result.admitted'),
      REJECTED: tc('result.rejected'),
      WAITLISTED: tc('result.waitlisted'),
      DEFERRED: tc('result.deferred'),
    };
    return labels[result] || result;
  };
  const [copied, setCopied] = useState(false);
  const { accessToken } = useAuthStore();

  // 获取文书详情
  const { data: essay, isLoading } = useQuery({
    queryKey: ['essay-gallery-detail', essayId],
    queryFn: () => apiClient.get<EssayDetail>(`/essay-ai/gallery/${essayId}`),
  });

  // AI分析mutation
  const analyzeMutation = useMutation({
    mutationFn: () =>
      apiClient.post<AnalysisResult>(`/essay-ai/gallery/${essayId}/analyze`, {
        schoolName: essay?.school?.name,
      }),
    onSuccess: () => {
      toast.success(t('analysisComplete'));
    },
    onError: (error: Error) => {
      toast.error(error.message || t('detail.ai.analysisError'));
    },
  });

  const handleCopy = async () => {
    if (essay?.content) {
      await navigator.clipboard.writeText(essay.content);
      setCopied(true);
      toast.success(t('copiedToClipboard'));
      setTimeout(() => setCopied(false), 2000);
    }
  };

  if (isLoading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-8 w-3/4" />
        <Skeleton className="h-4 w-1/2" />
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }

  if (!essay) {
    return (
      <div className="text-center py-8">
        <AlertCircle className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
        <p>{t('detail.notFound')}</p>
      </div>
    );
  }

  const resultStyle = RESULT_STYLES[essay.result] || RESULT_STYLES.ACCEPTED;
  const resultLabel = getResultLabel(essay.result);
  const paragraphs = essay.content?.split(/\n\n+/).filter((p) => p.trim().length > 0) || [];

  return (
    <div>
      <DialogHeader>
        <div className="flex items-start justify-between">
          <div>
            <DialogTitle className="flex items-center gap-2">
              {essay.school?.usNewsRank && (
                <Badge className="bg-warning text-white border-0">
                  <Trophy className="h-3 w-3 mr-1" />#{essay.school.usNewsRank}
                </Badge>
              )}
              {getSchoolName(essay.school, locale) || t('unknownSchool')}
              <Badge className={resultStyle}>{resultLabel}</Badge>
            </DialogTitle>
            <DialogDescription className="mt-1">
              {essay.year} · {essay.round || 'RD'} · {essay.wordCount} {t('detail.words')}
              {essay.isVerified && (
                <Badge
                  variant="secondary"
                  className="ml-2 gap-1 text-xs bg-emerald-500/10 text-emerald-600"
                >
                  <CheckCircle2 className="h-3 w-3" />
                  {t('detail.verified')}
                </Badge>
              )}
            </DialogDescription>
          </div>
        </div>
      </DialogHeader>

      {/* 题目 */}
      {essay.prompt && (
        <div className="mt-4 p-4 rounded-xl bg-muted/50 border">
          <p className="text-sm font-medium text-muted-foreground mb-1">
            {t('detail.essayPrompt')}
          </p>
          <p className="text-sm">{essay.prompt}</p>
        </div>
      )}

      {/* Tab切换 */}
      <Tabs value={activeTab} onValueChange={setActiveTab} className="mt-6">
        <TabsList className="grid w-full grid-cols-2">
          <TabsTrigger value="content" className="gap-2">
            <FileText className="h-4 w-4" />
            {t('detail.tabs.original')}
          </TabsTrigger>
          <TabsTrigger value="analysis" className="gap-2">
            <Brain className="h-4 w-4" />
            {t('detail.tabs.aiReview')}
          </TabsTrigger>
        </TabsList>

        {/* 原文Tab */}
        <TabsContent value="content" className="mt-4">
          <div className="relative">
            <Button
              variant="ghost"
              size="sm"
              className="absolute top-2 right-2 h-8"
              onClick={handleCopy}
            >
              {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
            </Button>
            <div className="prose prose-sm dark:prose-invert max-w-none p-4 rounded-xl bg-muted/30 border max-h-[50vh] overflow-y-auto">
              {paragraphs.map((p, i) => (
                <p key={i} className="mb-4 last:mb-0">
                  {p}
                </p>
              ))}
            </div>
          </div>

          {/* 背景信息 */}
          {(essay.gpaRange || essay.satRange) && (
            <div className="mt-4 flex flex-wrap gap-2">
              {essay.gpaRange && <Badge variant="outline">GPA: {essay.gpaRange}</Badge>}
              {essay.satRange && <Badge variant="outline">SAT: {essay.satRange}</Badge>}
            </div>
          )}
        </TabsContent>

        {/* AI分析Tab */}
        <TabsContent value="analysis" className="mt-4">
          {!accessToken ? (
            <Card className="border-dashed">
              <CardContent className="py-8 text-center">
                <Brain className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                <p className="font-medium mb-2">{t('detail.ai.loginRequired')}</p>
                <p className="text-sm text-muted-foreground mb-4">{t('detail.ai.costHint')}</p>
                <Button onClick={() => (window.location.href = '/login')}>
                  {t('detail.ai.loginButton')}
                </Button>
              </CardContent>
            </Card>
          ) : analyzeMutation.data ? (
            <AnalysisResultView analysis={analyzeMutation.data} paragraphs={paragraphs} t={t} />
          ) : (
            <Card className="border-dashed">
              <CardContent className="py-8 text-center">
                <div className="flex h-16 w-16 mx-auto items-center justify-center rounded-lg bg-primary/20 mb-4">
                  <Sparkles className="h-8 w-8 text-primary" />
                </div>
                <p className="font-medium mb-2">{t('detail.ai.title')}</p>
                <p className="text-sm text-muted-foreground mb-4">{t('detail.ai.description')}</p>
                <Button
                  onClick={() => analyzeMutation.mutate()}
                  disabled={analyzeMutation.isPending}
                  className="gap-2 bg-primary dark:bg-primary hover:opacity-90"
                >
                  {analyzeMutation.isPending ? (
                    <>
                      <RefreshCw className="h-4 w-4 animate-spin" />
                      {t('detail.ai.analyzing')}
                    </>
                  ) : (
                    <>
                      <Brain className="h-4 w-4" />
                      {t('detail.ai.startAnalysis')}
                    </>
                  )}
                </Button>
              </CardContent>
            </Card>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}

// AI分析结果展示组件
function AnalysisResultView({
  analysis,
  paragraphs,
  t,
}: {
  analysis: AnalysisResult;
  paragraphs: string[];
  t: ReturnType<typeof useTranslations>;
}) {
  const [expandedIndex, setExpandedIndex] = useState<number | null>(0);

  const getStatusLabel = (status: string) => {
    const labels: Record<string, string> = {
      excellent: t('quality.excellent'),
      good: t('quality.good'),
      needs_work: t('quality.needsWork'),
    };
    return labels[status] || status;
  };

  return (
    <div className="space-y-6">
      {/* 总分和结构分析 */}
      <div className="grid gap-4 md:grid-cols-2">
        {/* 总分卡片 */}
        <Card className="overflow-hidden">
          <div className="h-1 bg-primary dark:bg-primary" />
          <CardContent className="pt-4">
            <div className="flex items-center gap-4">
              <div className="relative">
                <svg className="h-20 w-20 -rotate-90">
                  <circle
                    cx="40"
                    cy="40"
                    r="32"
                    stroke="currentColor"
                    strokeWidth="6"
                    fill="none"
                    className="text-muted/20"
                  />
                  <motion.circle
                    cx="40"
                    cy="40"
                    r="32"
                    stroke="url(#analysisGradient)"
                    strokeWidth="6"
                    fill="none"
                    strokeLinecap="round"
                    initial={{ strokeDasharray: '0 201' }}
                    animate={{ strokeDasharray: `${(analysis.overallScore / 100) * 201} 201` }}
                    transition={{ duration: 1, ease: 'easeOut' }}
                  />
                  <defs>
                    <linearGradient id="analysisGradient" x1="0%" y1="0%" x2="100%" y2="100%">
                      <stop offset="0%" stopColor="#8b5cf6" />
                      <stop offset="100%" stopColor="#ec4899" />
                    </linearGradient>
                  </defs>
                </svg>
                <div className="absolute inset-0 flex flex-col items-center justify-center">
                  <span className="text-xl font-bold">{analysis.overallScore}</span>
                  <span className="text-xs text-muted-foreground">
                    {t('detail.analysis.score')}
                  </span>
                </div>
              </div>
              <div className="flex-1">
                <p className="font-medium mb-2">{t('detail.analysis.overallComment')}</p>
                <p className="text-sm text-muted-foreground">{analysis.summary}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* 结构分析 */}
        <Card className="overflow-hidden">
          <div className="h-1 bg-primary" />
          <CardContent className="pt-4">
            <p className="font-medium mb-3">{t('detail.analysis.structureAnalysis')}</p>
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                {analysis.structure.hasStrongOpening ? (
                  <CheckCircle2 className="h-4 w-4 text-emerald-500" />
                ) : (
                  <AlertCircle className="h-4 w-4 text-amber-500" />
                )}
                <span className="text-sm">{t('detail.analysis.hookStrength')}</span>
              </div>
              <div className="flex items-center gap-2">
                {analysis.structure.hasClarity ? (
                  <CheckCircle2 className="h-4 w-4 text-emerald-500" />
                ) : (
                  <AlertCircle className="h-4 w-4 text-amber-500" />
                )}
                <span className="text-sm">{t('detail.analysis.themeClarity')}</span>
              </div>
              <div className="flex items-center gap-2">
                {analysis.structure.hasGoodConclusion ? (
                  <CheckCircle2 className="h-4 w-4 text-emerald-500" />
                ) : (
                  <AlertCircle className="h-4 w-4 text-amber-500" />
                )}
                <span className="text-sm">{t('detail.analysis.endingImpact')}</span>
              </div>
            </div>
            <p className="text-xs text-muted-foreground mt-3">{analysis.structure.feedback}</p>
          </CardContent>
        </Card>
      </div>

      {/* 逐段点评 */}
      <div className="space-y-3">
        <h3 className="font-semibold flex items-center gap-2">
          <Lightbulb className="h-5 w-5 text-amber-500" />
          {t('detail.analysis.paragraphReview')}
        </h3>
        {analysis.paragraphs.map((p, index) => {
          const statusStyle = STATUS_STYLES[p.status as keyof typeof STATUS_STYLES];
          const StatusIcon = statusStyle.icon;
          const statusLabel = getStatusLabel(p.status);
          const isExpanded = expandedIndex === index;

          return (
            <motion.div
              key={index}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: index * 0.05 }}
              className={cn(
                'rounded-xl border transition-all',
                statusStyle.border,
                isExpanded && statusStyle.bg
              )}
            >
              <button
                className="w-full p-4 flex items-start gap-3 text-left"
                onClick={() => setExpandedIndex(isExpanded ? null : index)}
              >
                <div
                  className={cn(
                    'flex h-8 w-8 shrink-0 items-center justify-center rounded-lg',
                    statusStyle.bg
                  )}
                >
                  <span className="text-sm font-bold">{index + 1}</span>
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <Badge
                      variant="outline"
                      className={cn('gap-1', statusStyle.color, statusStyle.border)}
                    >
                      <StatusIcon className="h-3 w-3" />
                      {statusLabel}
                    </Badge>
                    <span className="text-sm font-medium">
                      {p.score}/10 {t('detail.analysis.score')}
                    </span>
                  </div>
                  <p className="text-sm text-muted-foreground line-clamp-1">
                    {paragraphs[index]?.slice(0, 60)}...
                  </p>
                </div>
                {isExpanded ? (
                  <ChevronUp className="h-5 w-5 text-muted-foreground shrink-0" />
                ) : (
                  <ChevronDown className="h-5 w-5 text-muted-foreground shrink-0" />
                )}
              </button>

              <AnimatePresence>
                {isExpanded && (
                  <motion.div
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: 'auto' }}
                    exit={{ opacity: 0, height: 0 }}
                    className="overflow-hidden"
                  >
                    <div className="px-4 pb-4 space-y-3">
                      {/* 原文 */}
                      <div className="p-3 rounded-lg bg-muted/50 text-sm italic">
                        "{paragraphs[index]}"
                      </div>

                      {/* 点评 */}
                      <p className="text-sm">{p.comment}</p>

                      {/* 亮点 */}
                      {p.highlights.length > 0 && (
                        <div>
                          <p className="text-xs font-medium text-emerald-600 mb-1">
                            ✨ {t('detail.analysis.highlights')}
                          </p>
                          <div className="flex flex-wrap gap-1">
                            {p.highlights.map((h, i) => (
                              <Badge
                                key={i}
                                variant="secondary"
                                className="text-xs bg-emerald-500/10 text-emerald-600"
                              >
                                {h}
                              </Badge>
                            ))}
                          </div>
                        </div>
                      )}

                      {/* 建议 */}
                      {p.suggestions.length > 0 && (
                        <div>
                          <p className="text-xs font-medium text-amber-600 mb-1">
                            💡 {t('detail.analysis.suggestions')}
                          </p>
                          <ul className="text-sm text-muted-foreground space-y-1">
                            {p.suggestions.map((s, i) => (
                              <li key={i} className="flex items-start gap-2">
                                <span className="text-amber-500">•</span>
                                {s}
                              </li>
                            ))}
                          </ul>
                        </div>
                      )}
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </motion.div>
          );
        })}
      </div>
    </div>
  );
}
