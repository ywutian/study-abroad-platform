'use client';

import { useEffect, useRef, useState } from 'react';
import { useTranslations, useLocale } from 'next-intl';
import { useQuery, useMutation } from '@tanstack/react-query';
import { motion, AnimatePresence } from 'framer-motion';
import {
  FileText,
  CheckCircle2,
  AlertCircle,
  Clock,
  ClipboardCheck,
  Lightbulb,
  RefreshCw,
  ChevronDown,
  ChevronUp,
  Copy,
  Check,
  Type,
  ExternalLink,
  PenTool,
  Archive,
  HelpCircle,
} from 'lucide-react';
import Link from 'next/link';
import { useRouter } from '@/lib/i18n/navigation';

import { ScrollArea } from '@/components/ui/scroll-area';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { RankingBadge } from '@/components/ui/ranking-badge';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { CompactScore } from '@/components/ui/score-item';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { apiClient } from '@/lib/api/client';
import { essayAiRoutes, getArchiveLabel } from '@study-abroad/shared';
import { type SchoolRanking } from '@/lib/utils/ranking';
import { cn, getSchoolName } from '@/lib/utils';
import { getResultBadgeClass, getResultLabel, VERIFIED_BADGE_CLASS } from '@/lib/utils/admission';
import { toast } from 'sonner';
import { useAuthStore } from '@/stores/auth';
import { EssayDebateDialog } from '@/components/features/essay-debate';
import { useFeatureFlag } from '@/hooks/use-feature-flag';

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
    rankings?: SchoolRanking[];
  } | null;
  tags: string[];
  isVerified: boolean;
  isAnonymous: boolean;
  // Provenance — Mom-persona trust signal (PR 2). Null when the essay is
  // a self-upload that has no public source archive to link out to.
  sourceArchive?: string | null;
  sourceUrl?: string | null;
  sourceAuthor?: string | null;
  // Self-reflection — only meaningful for rejected/waitlisted self-uploads
  // in the "文书避雷" tab. Null on every harvested essay.
  selfReflection?: string | null;
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
  /**
   * Backend signal: result served from `aiAnalysisCache[locale]` precompute
   * rather than a fresh LLM round-trip. We surface this so users understand
   * why the response was instant; the 20-point cost still applies per spec.
   */
  cached?: boolean;
  generatedAt?: string;
}

/**
 * sessionStorage key for the "auto-fire writeWithPrompt CTA after login" flow.
 * Cold leads hit the prompt CTA → bounce to login → return to the essay page;
 * we drop a flag so the CTA effect re-arms once `accessToken` lands.
 */
const PENDING_CTA_KEY = 'essay-gallery:pending-cta';

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
  const localeForArchive: 'zh' | 'en' = locale === 'zh' ? 'zh' : 'en';
  const [activeTab, setActiveTab] = useState('content');
  const [useSerif, setUseSerif] = useState(false);
  const [copied, setCopied] = useState(false);
  /**
   * Scroll-gated CTA visibility — debate hard rule: NO sticky banner,
   * NO scroll-triggered overlay. The "用此 prompt 写一篇" button is
   * inline at the bottom of the prose and fades in only after the user
   * has read ≥80% of the content. An IntersectionObserver on a sentinel
   * placed at the 80% mark flips this once and never resets per render.
   * Switching tabs / scrolling back up keeps the CTA visible — once
   * they've read it, the affordance stays available.
   */
  const [ctaVisible, setCtaVisible] = useState(false);
  const ctaSentinelRef = useRef<HTMLDivElement | null>(null);
  const { accessToken } = useAuthStore();
  const router = useRouter();

  // ── Essay Debate (Phase 2 V1 PR2) ────────────────────────────────────
  // One session per essay; pivoting paragraphs reuses the same session.
  // PR3 — gated by the `essay_debate_enabled` feature flag. Default off
  // (`{ percentage: 0 }`) until the Day-7 decision-gate script passes;
  // then admin flips to 10% canary via /admin/feature-flags.
  const { enabled: debateEnabled } = useFeatureFlag('essay_debate_enabled');
  const [debateOpen, setDebateOpen] = useState(false);
  const [debateParagraphIdx, setDebateParagraphIdx] = useState<number | undefined>();
  const [debateSessionId, setDebateSessionId] = useState<string | null>(null);
  const paragraphRefs = useRef<Array<HTMLDivElement | null>>([]);
  const openDebateForParagraph = (idx: number) => {
    setDebateParagraphIdx(idx);
    setDebateOpen(true);
  };
  const scrollToParagraph = (idx: number) => {
    paragraphRefs.current[idx]?.scrollIntoView({ behavior: 'smooth', block: 'center' });
  };

  // 获取文书详情
  const { data: essay, isLoading } = useQuery({
    queryKey: ['essay-gallery-detail', essayId],
    queryFn: () => apiClient.get<EssayDetail>(essayAiRoutes.galleryItem(essayId)),
  });

  // AI分析mutation
  const analyzeMutation = useMutation({
    // @cache-invalidation-allowed: AI analyze action (toast only); result is not persisted to a cache shown here, and the in-file essay-gallery-detail query is unaffected
    mutationFn: () =>
      apiClient.post<AnalysisResult>(essayAiRoutes.galleryAnalyze(essayId), {
        schoolName: essay?.school?.name,
      }),
    onSuccess: () => {
      toast.success(t('analysisComplete'));
    },
    // Error toast handled by global MutationCache
  });

  const handleCopy = async () => {
    if (essay?.content) {
      await navigator.clipboard.writeText(essay.content);
      setCopied(true);
      toast.success(t('copiedToClipboard'));
      setTimeout(() => setCopied(false), 2000);
    }
  };

  /**
   * Cold-lead conversion: route through register/login then return.
   * - Authed → straight to /essays with the prompt prefilled.
   * - Unauthed → /login?callbackUrl=<current path>, after which the effect
   *   below picks up the sessionStorage flag and auto-fires the CTA.
   */
  const handleWriteWithPrompt = () => {
    if (!essay?.prompt) return;

    if (accessToken) {
      const params = new URLSearchParams();
      params.set('create', 'true');
      params.set('prompt', essay.prompt);
      if (essay.school?.id) params.set('schoolId', essay.school.id);
      // Gallery → Workbench attribution: pass the source AdmissionCase id
      // so the workbench can stamp `Essay.inspirationCaseId` on create.
      params.set('inspirationId', essayId);
      router.push(`/essays?${params.toString()}`);
      return;
    }

    // Cold-lead path: stash the intent + bounce to login.
    try {
      sessionStorage.setItem(
        PENDING_CTA_KEY,
        JSON.stringify({
          essayId,
          prompt: essay.prompt,
          schoolId: essay.school?.id ?? null,
          inspirationId: essayId,
        })
      );
    } catch {
      // Ignore SSR / privacy-mode failures — login → manual click is fine.
    }
    const callbackUrl = `/cases/essays/${essayId}?cta=true`;
    router.push(`/login?callbackUrl=${encodeURIComponent(callbackUrl)}`);
  };

  // Once the user finishes login and lands back here with `accessToken` set,
  // re-fire the CTA they originally clicked. Guarded by the sessionStorage
  // flag so a clean direct visit never auto-redirects.
  useEffect(() => {
    if (!accessToken || !essay?.prompt) return;
    let stashed: {
      essayId?: string;
      prompt?: string;
      schoolId?: string | null;
      inspirationId?: string | null;
    } | null = null;
    try {
      const raw = sessionStorage.getItem(PENDING_CTA_KEY);
      if (raw) stashed = JSON.parse(raw);
    } catch {
      // ignore
    }
    if (!stashed || stashed.essayId !== essayId) return;
    try {
      sessionStorage.removeItem(PENDING_CTA_KEY);
    } catch {
      // ignore
    }
    const params = new URLSearchParams();
    params.set('create', 'true');
    params.set('prompt', stashed.prompt || essay.prompt);
    if (stashed.schoolId) params.set('schoolId', stashed.schoolId);
    // Preserve attribution across the login round-trip.
    params.set('inspirationId', essayId);
    router.push(`/essays?${params.toString()}`);
    // We intentionally only depend on `accessToken` + `essayId` + the prompt
    // text; including `router` triggers re-fires on route ref churn.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [accessToken, essayId, essay?.prompt]);

  /**
   * Reveal the bottom-of-prose CTA once the reader has gotten through
   * ≥80% of the essay. The sentinel is rendered at the 80% mark inside
   * the prose block; the observer flips state once and disconnects so
   * jumping back up doesn't re-hide the button.
   *
   * The 0.5 threshold (rather than 1.0) plus a top rootMargin keeps the
   * trigger from missing very short essays where the sentinel can be on
   * screen before the user scrolls at all — that's intentional. The
   * point is to avoid a hard-sell at the top, not to gate the CTA
   * behind a perfect scroll arc.
   */
  useEffect(() => {
    const node = ctaSentinelRef.current;
    if (!node || ctaVisible) return;
    if (typeof IntersectionObserver === 'undefined') {
      // Fallback for environments without the API — just reveal.
      setCtaVisible(true);
      return;
    }
    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) {
            setCtaVisible(true);
            observer.disconnect();
            break;
          }
        }
      },
      { threshold: 0.5 }
    );
    observer.observe(node);
    return () => observer.disconnect();
  }, [ctaVisible, essay?.content]);

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
    <div className="flex flex-col h-full overflow-hidden">
      {/* ── 固定头部 ── */}
      <div className="shrink-0 border-b px-6 pt-6 pb-4 space-y-1.5">
        <h2 className="text-xl font-semibold tracking-tight flex items-center gap-2.5">
          <RankingBadge
            rankings={essay.school?.rankings}
            usNewsRank={essay.school?.usNewsRank}
            variant="amber"
          />
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
        <Link
          href={`/cases/${essayId}`}
          className="inline-flex items-center gap-1 text-xs text-primary hover:underline mt-1"
        >
          <ExternalLink className="h-3 w-3" />
          {t('detail.viewFullCase')}
        </Link>

        {/*
         * ── 文书出处（Mom-persona 信任信号 / PR 2）──
         * Surfaces ONLY when we have a verifiable source archive. Self-
         * uploaded essays have null `sourceArchive` and this block is
         * suppressed entirely — empty space is more honest than a
         * fake-confident "verified" pill. Link opens in a new tab with
         * `rel="noreferrer"` so the originating archive can't track us.
         */}
        {essay.sourceArchive && essay.sourceUrl && (
          <div className="flex items-center gap-1.5 text-xs text-muted-foreground pt-1">
            <Archive className="h-3 w-3 text-indigo-500 shrink-0" />
            <span className="truncate">
              {t('detail.sourcePrefix')}
              <span className="font-medium text-foreground">
                {getArchiveLabel(essay.sourceArchive, localeForArchive)}
              </span>
              {essay.sourceAuthor && ` · ${essay.sourceAuthor}`}
            </span>
            <a
              href={essay.sourceUrl}
              target="_blank"
              rel="noreferrer"
              className="inline-flex shrink-0 items-center gap-0.5 text-primary hover:underline"
            >
              {t('detail.viewOriginal')}
              <ExternalLink className="h-3 w-3" />
            </a>
          </div>
        )}
      </div>

      {/* ── 可滚动内容区（min-h-0 + overflow-hidden 让 flex 子元素可收缩从而出现滚动） ── */}
      <div className="flex-1 min-h-0 overflow-hidden">
        <ScrollArea className="h-full">
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
                <div className="flex-1">
                  <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-1">
                    {t('detail.essayPrompt')}
                  </p>
                  <p className="text-sm leading-relaxed">{essay.prompt}</p>
                  {/*
                   * The "用此 prompt 写一篇" CTA moved to the bottom of the
                   * prose body (PR 2 · §F) and is gated on ≥80% scroll. This
                   * keeps the prompt block a quiet reference rather than a
                   * sales surface — Khan/Quill/Modern Love red-team rule.
                   */}
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
                    <ClipboardCheck className="h-3.5 w-3.5" />
                    {t('detail.tabs.aiReview')}
                  </TabsTrigger>
                </TabsList>

                {/* ── 阅读工具栏（从浮动改为固定在 Tab 旁边） ── */}
                {activeTab === 'content' && (
                  <div className="flex items-center gap-1">
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-10 w-10 p-0 sm:h-8 sm:w-8"
                      onClick={() => setUseSerif(!useSerif)}
                      title={useSerif ? 'Sans-serif' : 'Serif'}
                      aria-label={useSerif ? 'Use sans-serif font' : 'Use serif font'}
                    >
                      <Type className="h-3.5 w-3.5" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-10 w-10 p-0 sm:h-8 sm:w-8"
                      onClick={handleCopy}
                      aria-label={t('detail.copyEssay')}
                    >
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
                    // @design-system-ignore-next-line: reading-surface
                    useSerif && 'font-serif'
                  )}
                >
                  {(() => {
                    /*
                     * Position the IntersectionObserver sentinel after
                     * the 80%-mark paragraph. Math.floor handles short
                     * essays gracefully (e.g. 5 paragraphs → sentinel
                     * after paragraph 4). For single-paragraph essays
                     * the sentinel sits under the lone paragraph; the
                     * observer's `threshold: 0.5` still keeps it from
                     * firing on the initial render.
                     */
                    const sentinelAfter =
                      paragraphs.length === 0
                        ? -1
                        : Math.max(0, Math.floor(paragraphs.length * 0.8) - 1);
                    return paragraphs.map((p, i) => (
                      <div key={i}>
                        <p className="mb-6 last:mb-0 text-base leading-[1.8]">{p}</p>
                        {i === sentinelAfter && (
                          <div
                            ref={ctaSentinelRef}
                            aria-hidden
                            className="h-px w-full"
                            data-testid="essay-cta-sentinel"
                          />
                        )}
                      </div>
                    ));
                  })()}
                </div>

                {/* ── 写作 CTA — 80% 滚动后渐显（PR 2 · §F） ── */}
                {essay.prompt && (
                  <div
                    className={cn(
                      'mx-auto mt-6 max-w-[68ch] transition-opacity duration-500',
                      ctaVisible ? 'opacity-100' : 'pointer-events-none opacity-0'
                    )}
                  >
                    <div className="rounded-xl border border-dashed bg-muted/30 p-5 text-center">
                      <p className="text-sm text-muted-foreground mb-3">
                        {t('detail.readThenWritePrompt')}
                      </p>
                      <Button
                        variant="default"
                        size="sm"
                        className="gap-1.5"
                        onClick={handleWriteWithPrompt}
                      >
                        <PenTool className="h-3.5 w-3.5" />
                        {t('detail.writeWithPrompt')}
                      </Button>
                    </div>
                  </div>
                )}

                {/* ── 拒信案例：作者自我反思（仅当存在时显示）── */}
                {essay.selfReflection && (
                  <div className="mx-auto mt-6 max-w-[68ch] rounded-xl border border-rose-200 bg-rose-50/50 p-5 dark:border-rose-900 dark:bg-rose-950/30">
                    <p className="text-xs font-medium uppercase tracking-wider text-rose-700 dark:text-rose-300 mb-2">
                      {t('detail.selfReflectionTitle')}
                    </p>
                    <p className="text-sm leading-relaxed text-foreground/90 whitespace-pre-line">
                      {essay.selfReflection}
                    </p>
                  </div>
                )}
              </TabsContent>

              {/* ── AI 分析 Tab ── */}
              <TabsContent value="analysis" className="mt-0">
                {!accessToken ? (
                  <Card className="border-dashed">
                    <CardContent className="py-8 text-center">
                      <ClipboardCheck className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                      <p className="font-medium mb-2">{t('detail.ai.loginRequired')}</p>
                      <p className="text-sm text-muted-foreground mb-4">
                        {t('detail.ai.costHint')}
                      </p>
                      {/* @release-navigation-allowed: unauthenticated AI CTA escapes a nested dialog state. */}
                      <Button onClick={() => (window.location.href = '/login')}>
                        {t('detail.ai.loginButton')}
                      </Button>
                    </CardContent>
                  </Card>
                ) : analyzeMutation.data ? (
                  <>
                    {analyzeMutation.data.cached && (
                      <div className="mb-3 flex items-center gap-1.5 text-xs text-emerald-600 dark:text-emerald-400">
                        <CheckCircle2 className="h-3.5 w-3.5" />
                        <span>{t('detail.ai.cachedHint')}</span>
                      </div>
                    )}
                    <AnalysisResultView
                      analysis={analyzeMutation.data}
                      paragraphs={paragraphs}
                      t={t}
                      // PR3 — only wire the disagree button when the
                      // feature flag is on. AnalysisResultView gates the
                      // button render on the truthiness of this prop.
                      onDebateParagraph={debateEnabled ? openDebateForParagraph : undefined}
                      paragraphRefs={paragraphRefs}
                    />
                  </>
                ) : (
                  <Card className="border-dashed">
                    <CardContent className="py-8 text-center">
                      <div className="flex h-16 w-16 mx-auto items-center justify-center rounded-lg bg-primary/20 mb-4">
                        <Lightbulb className="h-8 w-8 text-primary" />
                      </div>
                      <p className="font-medium mb-2">{t('detail.ai.title')}</p>
                      <p className="text-sm text-muted-foreground mb-4">
                        {t('detail.ai.description')}
                      </p>
                      <div className="flex items-center justify-center gap-2">
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
                              <ClipboardCheck className="h-4 w-4" />
                              {t('detail.ai.startAnalysis')}
                            </>
                          )}
                        </Button>
                        {/*
                         * Privacy "?" — Khan/Quill red-team requirement. We
                         * don't pretend to "delete" what we never stored;
                         * this just states the data-handling principle.
                         * Phase 2 will surface a real delete endpoint once
                         * conversation-memory writes land.
                         */}
                        <Popover>
                          <PopoverTrigger asChild>
                            <Button
                              variant="ghost"
                              size="sm"
                              className="h-9 w-9 p-0"
                              aria-label={t('detail.ai.privacyHelpLabel')}
                            >
                              <HelpCircle className="h-4 w-4 text-muted-foreground" />
                            </Button>
                          </PopoverTrigger>
                          <PopoverContent side="top" className="max-w-xs text-xs leading-relaxed">
                            <p className="font-medium mb-1">{t('detail.ai.privacyTitle')}</p>
                            <p className="text-muted-foreground">{t('detail.ai.privacyBody')}</p>
                          </PopoverContent>
                        </Popover>
                      </div>
                    </CardContent>
                  </Card>
                )}
              </TabsContent>
            </Tabs>
          </div>
        </ScrollArea>
      </div>

      {/*
       * Phase 2 V1 PR2 — debate dialog. Sibling, not a child of the
       * paragraph cards, so the modal portals to <body> and the user
       * can pivot to a different paragraph mid-conversation without
       * the dialog unmounting.
       *
       * PR3 — gated behind `essay_debate_enabled`. Unmounting entirely
       * (rather than just hiding the trigger) keeps the network panel
       * clean during the pre-canary window: no /essay-debate/turn calls
       * fire from any user except those in the feature-flag bucket.
       */}
      {debateEnabled && (
        <EssayDebateDialog
          open={debateOpen}
          onOpenChange={setDebateOpen}
          sessionId={debateSessionId}
          admissionCaseId={essayId}
          paragraphIndex={debateParagraphIdx}
          onSessionCreated={setDebateSessionId}
          onScrollToParagraph={scrollToParagraph}
        />
      )}
    </div>
  );
}

// ── AI分析结果展示组件 ──────────────────────────────────────────────────────

function AnalysisResultView({
  analysis,
  paragraphs,
  t,
  onDebateParagraph,
  paragraphRefs,
}: {
  analysis: AnalysisResult;
  paragraphs: string[];
  t: ReturnType<typeof useTranslations>;
  /**
   * PR2 — opens the EssayDebateDialog scoped to one paragraph. The parent
   * owns the dialog state so the same session continues across paragraphs.
   */
  onDebateParagraph?: (paragraphIndex: number) => void;
  /**
   * Refs into the paragraph cards so the debate dialog's evidence chips
   * can scroll the user back to a quoted paragraph.
   */
  paragraphRefs?: React.MutableRefObject<Array<HTMLDivElement | null>>;
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
                      <stop offset="0%" stopColor="#6574ff" />
                      <stop offset="100%" stopColor="#ec4899" />
                    </linearGradient>
                  </defs>
                </svg>
                <div className="absolute inset-0 flex flex-col items-center justify-center">
                  <span className="text-2xl font-bold">{analysis.overallScore}</span>
                  <span className="text-2xs text-muted-foreground">
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
              ref={(el) => {
                // PR2 — paragraphRefs lets the debate dialog's evidence
                // chips scroll the user back to the quoted paragraph.
                if (paragraphRefs) paragraphRefs.current[index] = el;
              }}
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
                            {t('detail.analysis.highlights')}
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
                            {t('detail.analysis.suggestions')}
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

                      {/*
                       * Phase 2 V1 PR2 — per-paragraph "不同意" entry point.
                       * The button opens EssayDebateDialog scoped to this
                       * paragraph index. Hidden when the parent didn't
                       * wire onDebateParagraph (e.g. mobile reuse later).
                       */}
                      {onDebateParagraph && (
                        <div className="pt-1">
                          <button
                            type="button"
                            onClick={() => onDebateParagraph(index)}
                            className="text-xs font-medium text-primary hover:underline underline-offset-2"
                          >
                            {t('detail.analysis.disagreeButton')}
                          </button>
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
