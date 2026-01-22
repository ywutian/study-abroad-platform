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
  Type,
} from 'lucide-react';

import { ScrollArea } from '@/components/ui/scroll-area';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { CompactScore } from '@/components/ui/score-item';
import { apiClient } from '@/lib/api/client';
import { cn, getSchoolName } from '@/lib/utils';
import { getResultBadgeClass, getResultLabel, VERIFIED_BADGE_CLASS } from '@/lib/utils/admission';
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

interface EssayDetailPanelProps {
  essayId: string;
  onClose: () => void;
}

export function EssayDetailPanel({ essayId, onClose: _onClose }: EssayDetailPanelProps) {
  const t = useTranslations('essayGallery');
  const tc = useTranslations('cases');
  const locale = useLocale();
  const [activeTab, setActiveTab] = useState('content');
  const [useSerif, setUseSerif] = useState(false);
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
      <div className="flex flex-col h-full">
        <div className="shrink-0 border-b px-6 pt-6 pb-4 space-y-3">
          <Skeleton className="h-7 w-3/4" />
          <Skeleton className="h-4 w-1/2" />
        </div>
        <div className="flex-1 px-6 py-6 space-y-4">
          <div className="flex gap-3">
            <Skeleton className="h-14 w-20 rounded-lg" />
            <Skeleton className="h-14 w-20 rounded-lg" />
            <Skeleton className="h-14 w-20 rounded-lg" />
          </div>
          <Skeleton className="h-20 w-full rounded-xl" />
          <Skeleton className="h-10 w-full" />
          <Skeleton className="h-64 w-full rounded-xl" />
        </div>
      </div>
    );
  }

  if (!essay) {
    return (
      <div className="flex flex-col h-full items-center justify-center py-8">
        <AlertCircle className="h-12 w-12 text-muted-foreground mb-4" />
        <p>{t('detail.notFound')}</p>
      </div>
    );
  }

  const resultBadgeClass = getResultBadgeClass(essay.result);
  const resultLabel = getResultLabel(essay.result, tc);
  const paragraphs = essay.content?.split(/\n\n+/).filter((p) => p.trim().length > 0) || [];

  return (
    <div className="flex flex-col h-full">
      {/* ── 固定头部 ── */}
      <div className="shrink-0 border-b px-6 pt-6 pb-4 space-y-1.5">
        <h2 className="text-xl font-semibold tracking-tight flex items-center gap-2.5">
          {essay.school?.usNewsRank && (
            <Badge className="bg-amber-500 text-white border-0 text-xs shrink-0">
              <Trophy className="h-3 w-3 mr-0.5" />#{essay.school.usNewsRank}
            </Badge>
          )}
          {getSchoolName(essay.school, locale) || t('unknownSchool')}
        </h2>
        <div className="flex items-center gap-2 flex-wrap">
          <Badge className={resultBadgeClass}>{resultLabel}</Badge>
          <span className="text-muted-foreground text-sm">
            {essay.year} · {essay.round || 'RD'}
          </span>
          {essay.isVerified && (
            <Badge variant="secondary" className={cn('gap-1 text-xs', VERIFIED_BADGE_CLASS)}>
              <CheckCircle2 className="h-3 w-3" />
              {t('detail.verified')}
            </Badge>
          )}
        </div>
      </div>

      {/* ── 可滚动内容区 ── */}
      <ScrollArea className="flex-1">
        <div className="px-6 py-6">
          {/* ── 申请者背景指标（上移到文书内容之前） ── */}
          <div className="flex flex-wrap gap-2.5 mb-5">
            {essay.gpaRange && <CompactScore label="GPA" value={essay.gpaRange} />}
            {essay.satRange && <CompactScore label="SAT" value={essay.satRange} />}
            <CompactScore label={t('detail.words')} value={String(essay.wordCount)} />
            <CompactScore label={t('detail.yearLabel') || 'Year'} value={String(essay.year)} />
          </div>

          {/* ── 文书题目 ── */}
          {essay.prompt && (
            <div className="flex gap-3 p-4 rounded-xl bg-muted/50 border mb-5">
              <div className="w-1 shrink-0 rounded-full bg-amber-500" />
              <div>
                <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-1">
                  {t('detail.essayPrompt')}
                </p>
                <p className="text-sm leading-relaxed">{essay.prompt}</p>
              </div>
            </div>
          )}

          {/* ── Tab 切换（紧凑样式） ── */}
          <Tabs value={activeTab} onValueChange={setActiveTab}>
            <div className="flex items-center justify-between mb-4">
              <TabsList className="inline-flex w-auto h-9 p-1">
                <TabsTrigger value="content" className="gap-1.5 text-sm px-3 h-7">
                  <FileText className="h-3.5 w-3.5" />
                  {t('detail.tabs.original')}
                </TabsTrigger>
                <TabsTrigger value="analysis" className="gap-1.5 text-sm px-3 h-7">
                  <Brain className="h-3.5 w-3.5" />
                  {t('detail.tabs.aiReview')}
                </TabsTrigger>
              </TabsList>

              {/* ── 阅读工具栏（从浮动改为固定在 Tab 旁边） ── */}
              {activeTab === 'content' && (
                <div className="flex items-center gap-1">
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-7 w-7 p-0"
                    onClick={() => setUseSerif(!useSerif)}
                    title={useSerif ? 'Sans-serif' : 'Serif'}
                  >
                    <Type className="h-3.5 w-3.5" />
                  </Button>
                  <Button variant="ghost" size="sm" className="h-7 w-7 p-0" onClick={handleCopy}>
                    {copied ? (
                      <Check className="h-3.5 w-3.5 text-emerald-500" />
                    ) : (
                      <Copy className="h-3.5 w-3.5" />
                    )}
                  </Button>
                </div>
              )}
            </div>

            {/* ── 原文 Tab ── */}
            <TabsContent value="content" className="mt-0">
              <div
                className={cn(
                  'prose dark:prose-invert max-w-[68ch] mx-auto p-6 rounded-xl bg-muted/30 border',
                  useSerif && 'font-serif'
                )}
              >
                {paragraphs.map((p, i) => (
                  <p key={i} className="mb-6 last:mb-0 text-base leading-[1.8]">
                    {p}
                  </p>
                ))}
              </div>
            </TabsContent>

            {/* ── AI 分析 Tab ── */}
            <TabsContent value="analysis" className="mt-0">
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
                    <p className="text-sm text-muted-foreground mb-4">
                      {t('detail.ai.description')}
                    </p>
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
      </ScrollArea>
    </div>
  );
}

// ── AI分析结果展示组件 ──────────────────────────────────────────────────────

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
      {/* ── 总分和结构分析 ── */}
      <div className="grid gap-4 md:grid-cols-2">
        {/* 总分卡片 — 加大评分圆环 */}
        <Card className="overflow-hidden">
          <div className="h-1 bg-primary dark:bg-primary" />
          <CardContent className="pt-5">
            <div className="flex items-center gap-5">
              <div className="relative shrink-0">
                <svg className="h-24 w-24 -rotate-90">
                  <circle
                    cx="48"
                    cy="48"
                    r="40"
                    stroke="currentColor"
                    strokeWidth="6"
                    fill="none"
                    className="text-muted/20"
                  />
                  <motion.circle
                    cx="48"
                    cy="48"
                    r="40"
                    stroke="url(#analysisGradient)"
                    strokeWidth="6"
                    fill="none"
                    strokeLinecap="round"
                    initial={{ strokeDasharray: '0 251' }}
                    animate={{
                      strokeDasharray: `${(analysis.overallScore / 100) * 251} 251`,
                    }}
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
                  <span className="text-2xl font-bold">{analysis.overallScore}</span>
                  <span className="text-[10px] text-muted-foreground">
                    {t('detail.analysis.score')}
                  </span>
                </div>
              </div>
              <div className="flex-1 min-w-0">
                <p className="font-medium mb-1.5">{t('detail.analysis.overallComment')}</p>
                <p className="text-sm text-muted-foreground leading-relaxed">{analysis.summary}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* 结构分析 — 更紧凑的 checklist */}
        <Card className="overflow-hidden">
          <div className="h-1 bg-primary" />
          <CardContent className="pt-5">
            <p className="font-medium mb-3">{t('detail.analysis.structureAnalysis')}</p>
            <div className="space-y-2.5">
              {[
                {
                  check: analysis.structure.hasStrongOpening,
                  label: t('detail.analysis.hookStrength'),
                },
                {
                  check: analysis.structure.hasClarity,
                  label: t('detail.analysis.themeClarity'),
                },
                {
                  check: analysis.structure.hasGoodConclusion,
                  label: t('detail.analysis.endingImpact'),
                },
              ].map((item, i) => (
                <div key={i} className="flex items-center gap-2">
                  {item.check ? (
                    <CheckCircle2 className="h-4 w-4 text-emerald-500 shrink-0" />
                  ) : (
                    <AlertCircle className="h-4 w-4 text-amber-500 shrink-0" />
                  )}
                  <span className="text-sm">{item.label}</span>
                </div>
              ))}
            </div>
            <p className="text-xs text-muted-foreground mt-3 leading-relaxed">
              {analysis.structure.feedback}
            </p>
          </CardContent>
        </Card>
      </div>

      {/* ── 逐段点评 ── */}
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
                    <div className="px-5 pb-5 space-y-3">
                      {/* 原文 */}
                      <div className="p-3 rounded-lg bg-muted/50 text-sm italic leading-relaxed">
                        &ldquo;{paragraphs[index]}&rdquo;
                      </div>

                      {/* 点评 */}
                      <p className="text-sm leading-relaxed">{p.comment}</p>

                      {/* 亮点 */}
                      {p.highlights.length > 0 && (
                        <div>
                          <p className="text-xs font-medium text-emerald-600 mb-1.5">
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
                          <p className="text-xs font-medium text-amber-600 mb-1.5">
                            💡 {t('detail.analysis.suggestions')}
                          </p>
                          <ul className="text-sm text-muted-foreground space-y-1">
                            {p.suggestions.map((s, i) => (
                              <li key={i} className="flex items-start gap-2">
                                <span className="text-amber-500 shrink-0">•</span>
                                <span className="leading-relaxed">{s}</span>
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
