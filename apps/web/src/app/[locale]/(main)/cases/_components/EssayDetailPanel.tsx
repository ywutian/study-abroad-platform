'use client';

import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
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
  ChevronDown,
  ChevronUp,
  Copy,
  Check,
  Type,
  ExternalLink,
  PenTool,
  Archive,
  MessageCircle,
  GitCompare,
  ArrowRight,
  Coins,
  ThumbsDown,
  ThumbsUp,
  Languages,
  X,
  Search,
  ShieldAlert,
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
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Textarea } from '@/components/ui/textarea';
import { apiClient } from '@/lib/api/client';
import {
  POINT_ACTION,
  essayAiRoutes,
  getArchiveLabel,
  pointsRoutes,
  profileRoutes,
  type GalleryEssayAIInteractionItem,
  type GalleryEssayCompareFocus,
  type GalleryEssayCompareResponse,
  type GalleryEssayEvidence,
  type GalleryEssayOverlapRisk,
  type GalleryLearningHighlight,
  type EssayDimension,
  type GalleryEssayInteractionFeedbackRequest,
  type GalleryEssayInteractionFeedbackResponse,
  type GalleryEssayInteractionsResponse,
  type GalleryEssayQuestionResponse,
  type GalleryLearningNotesResponse,
} from '@study-abroad/shared';
import { type SchoolRanking } from '@/lib/utils/ranking';
import { cn, getSchoolName } from '@/lib/utils';
import { getResultBadgeClass, getResultLabel, VERIFIED_BADGE_CLASS } from '@/lib/utils/admission';
import { toast } from 'sonner';
import { useAuthStore } from '@/stores/auth';
import { useFeatureFlag } from '@/hooks/use-feature-flag';
import type { Essay as UserEssay } from '@/types/essay';

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
  highlights: GalleryLearningHighlight[];
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

interface PointRule {
  action: string;
  points: number;
  description: string;
  type: 'earn' | 'spend';
}

interface PointRulesResponse {
  enabled?: boolean;
  earn: PointRule[];
  spend: PointRule[];
}

/**
 * sessionStorage key for the "auto-fire writeWithPrompt CTA after login" flow.
 * Cold leads hit the prompt CTA → bounce to login → return to the essay page;
 * we drop a flag so the CTA effect re-arms once `accessToken` lands.
 */
const PENDING_CTA_KEY = 'essay-gallery:pending-cta';
const GALLERY_PERSONALIZED_TOOLS_FLAG = 'essay_gallery_personalized_tools_v1';

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

const COMPARE_FOCUS_OPTIONS: GalleryEssayCompareFocus[] = [
  'structure',
  'theme',
  'voice',
  'schoolFit',
  'revisionPlan',
];

// Static class maps (no dynamic Tailwind interpolation) — dimension-colored
// inline highlights + chips for Learning Notes, and the compare risk band.
const DIMENSION_ORDER: EssayDimension[] = [
  'hook',
  'structure',
  'voice',
  'insight',
  'fit',
  'detail',
];

const DIMENSION_STYLES: Record<EssayDimension, { mark: string; chip: string }> = {
  hook: {
    mark: 'bg-rose-200/70 dark:bg-rose-400/25',
    chip: 'bg-rose-500/10 text-rose-600 dark:text-rose-400 border-rose-500/30',
  },
  structure: {
    mark: 'bg-sky-200/70 dark:bg-sky-400/25',
    chip: 'bg-sky-500/10 text-sky-600 dark:text-sky-400 border-sky-500/30',
  },
  voice: {
    mark: 'bg-violet-200/70 dark:bg-violet-400/25',
    chip: 'bg-violet-500/10 text-violet-600 dark:text-violet-400 border-violet-500/30',
  },
  insight: {
    mark: 'bg-amber-200/70 dark:bg-amber-400/25',
    chip: 'bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/30',
  },
  fit: {
    mark: 'bg-emerald-200/70 dark:bg-emerald-400/25',
    chip: 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/30',
  },
  detail: {
    mark: 'bg-slate-200/80 dark:bg-slate-400/25',
    chip: 'bg-slate-500/10 text-slate-600 dark:text-slate-300 border-slate-500/30',
  },
};

const RISK_STYLES: Record<GalleryEssayOverlapRisk, { band: string; dot: string }> = {
  low: {
    band: 'border-emerald-500/30 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300',
    dot: 'bg-emerald-500',
  },
  medium: {
    band: 'border-amber-500/30 bg-amber-500/10 text-amber-700 dark:text-amber-300',
    dot: 'bg-amber-500',
  },
  high: {
    band: 'border-rose-500/30 bg-rose-500/10 text-rose-700 dark:text-rose-300',
    dot: 'bg-rose-500',
  },
};

/**
 * Build a tolerant regex that locates a quote inside the original essay text
 * despite whitespace / curly-quote / case differences. Mirrors the backend's
 * `sourceContainsQuote` normalization so what the verifier accepts, we can find.
 */
function buildQuoteRegex(quote: string): RegExp | null {
  const trimmed = quote.trim();
  if (trimmed.length < 2) return null;
  const escaped = trimmed
    .replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
    .replace(/["“”]/g, '["“”]')
    .replace(/['‘’]/g, "['‘’]")
    .replace(/\s+/g, '\\s+');
  try {
    return new RegExp(escaped, 'i');
  } catch {
    return null;
  }
}

/** Render `text` with the first match of `quote` wrapped in a highlighted mark. */
function renderWithQuoteHighlight(text: string, quote: string | null): ReactNode {
  if (!quote) return text;
  const m = buildQuoteRegex(quote)?.exec(text);
  if (!m) return text;
  const start = m.index;
  const end = m.index + m[0].length;
  return (
    <>
      {text.slice(0, start)}
      <mark className="rounded bg-amber-300/70 px-0.5 text-foreground dark:bg-amber-400/40">
        {text.slice(start, end)}
      </mark>
      {text.slice(end)}
    </>
  );
}

/**
 * Render `text` with each highlight phrase wrapped in a dimension-colored mark.
 * Non-overlapping, left-to-right. Defensive against the legacy `string[]` shape.
 */
function renderWithDimensionHighlights(
  text: string,
  highlights: GalleryLearningHighlight[] | undefined
): ReactNode {
  const spans: { start: number; end: number; dimension: EssayDimension }[] = [];
  for (const h of highlights ?? []) {
    const phrase = typeof h === 'string' ? h : h?.text;
    const dimension: EssayDimension = typeof h === 'string' ? 'detail' : (h?.dimension ?? 'detail');
    if (!phrase) continue;
    const m = buildQuoteRegex(phrase)?.exec(text);
    if (!m) continue;
    const start = m.index;
    const end = m.index + m[0].length;
    if (spans.some((s) => start < s.end && end > s.start)) continue; // skip overlaps
    spans.push({ start, end, dimension });
  }
  if (spans.length === 0) return text;
  spans.sort((a, b) => a.start - b.start);
  const out: ReactNode[] = [];
  let cursor = 0;
  spans.forEach((s, i) => {
    if (s.start > cursor) out.push(text.slice(cursor, s.start));
    out.push(
      <mark
        key={i}
        className={cn('rounded px-0.5 text-foreground', DIMENSION_STYLES[s.dimension].mark)}
      >
        {text.slice(s.start, s.end)}
      </mark>
    );
    cursor = s.end;
  });
  if (cursor < text.length) out.push(text.slice(cursor));
  return <>{out}</>;
}

/**
 * Compare similarity-risk band (#3, Turnitin-style): a color-banded level plus
 * an explicit "signal, not a verdict" disclaimer. Reused by the live compare
 * result and the in-panel history cards.
 */
function OverlapRiskBand({
  risk,
  reason,
  t,
}: {
  risk: GalleryEssayOverlapRisk;
  reason?: string | null;
  t: ReturnType<typeof useTranslations>;
}) {
  const style = RISK_STYLES[risk];
  return (
    <div className={cn('rounded-lg border p-3', style.band)}>
      <div className="flex flex-wrap items-center gap-2 text-sm font-medium">
        <ShieldAlert className="h-4 w-4 shrink-0" />
        <span>{t('detail.compare.overlapRisk.label')}</span>
        <span className="inline-flex items-center gap-1.5">
          <span className={cn('h-2 w-2 rounded-full', style.dot)} />
          {t(`detail.compare.overlapRisk.levels.${risk}`)}
        </span>
      </div>
      {reason && <p className="mt-1.5 text-xs leading-relaxed">{reason}</p>}
      <p className="mt-1.5 text-2xs leading-relaxed opacity-80">
        {t('detail.compare.overlapRisk.disclaimer')}
      </p>
    </div>
  );
}

function createClientRequestId(): string {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) {
    return crypto.randomUUID();
  }
  return `${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

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
  const galleryToolsFlag = useFeatureFlag(accessToken ? GALLERY_PERSONALIZED_TOOLS_FLAG : null);
  const personalizedToolsAvailable =
    !accessToken ||
    galleryToolsFlag.isLoading ||
    galleryToolsFlag.isError ||
    galleryToolsFlag.enabled;
  const router = useRouter();
  const [questionOpen, setQuestionOpen] = useState(false);
  const [questionDraft, setQuestionDraft] = useState('');
  const [questionParagraphIndex, setQuestionParagraphIndex] = useState<number | undefined>();
  const [questionSelectedText, setQuestionSelectedText] = useState<string | undefined>();
  const [questionResult, setQuestionResult] = useState<GalleryEssayQuestionResponse | null>(null);
  const [compareOpen, setCompareOpen] = useState(false);
  const [selectedUserEssayId, setSelectedUserEssayId] = useState('');
  const [compareFocus, setCompareFocus] = useState<GalleryEssayCompareFocus>('structure');
  const [compareResult, setCompareResult] = useState<GalleryEssayCompareResponse | null>(null);

  // ── Citation locate (#1: click an evidence quote → jump to + highlight it
  //    in the essay "content" tab, with ↑/↓ to cycle between quotes). ──
  const [citationQuote, setCitationQuote] = useState<string | null>(null);
  const [citationKey, setCitationKey] = useState(0);
  const [evidenceNav, setEvidenceNav] = useState<{
    items: GalleryEssayEvidence[];
    index: number;
  } | null>(null);
  const citedParaRef = useRef<HTMLDivElement | null>(null);

  const locateEvidence = (items: GalleryEssayEvidence[], index: number) => {
    const item = items[index];
    if (!item?.quote) return;
    setEvidenceNav({ items, index });
    setCitationQuote(item.quote);
    setCitationKey((k) => k + 1);
    setActiveTab('content');
    setQuestionOpen(false);
    setCompareOpen(false);
  };

  const clearCitation = () => {
    setCitationQuote(null);
    setEvidenceNav(null);
  };

  useEffect(() => {
    if (!evidenceNav || evidenceNav.items.length < 2) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'ArrowDown' && e.key !== 'ArrowUp') return;
      const tag = (e.target as HTMLElement | null)?.tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA') return;
      e.preventDefault();
      const len = evidenceNav.items.length;
      const next = (evidenceNav.index + (e.key === 'ArrowDown' ? 1 : -1) + len) % len;
      const item = evidenceNav.items[next];
      if (!item?.quote) return;
      setEvidenceNav({ items: evidenceNav.items, index: next });
      setCitationQuote(item.quote);
      setCitationKey((k) => k + 1);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [evidenceNav]);

  // 获取文书详情
  const { data: essay, isLoading } = useQuery({
    queryKey: ['essay-gallery-detail', essayId],
    queryFn: () => apiClient.get<EssayDetail>(essayAiRoutes.galleryItem(essayId)),
  });

  // Which content-tab paragraph contains the active citation quote — located by
  // text search (not paragraphIndex: the analysis split filters short paragraphs
  // so its indices don't line up with the content-tab split). Computed from
  // essay content directly so it stays above the loading/!essay early returns.
  const citationMatch = useMemo(() => {
    if (!citationQuote) return null;
    const re = buildQuoteRegex(citationQuote);
    if (!re) return null;
    const paras = essay?.content?.split(/\n\n+/).filter((p) => p.trim().length > 0) ?? [];
    for (let i = 0; i < paras.length; i++) {
      if (re.exec(paras[i])) return i;
    }
    return null;
  }, [citationQuote, essay?.content]);

  useEffect(() => {
    if (citationMatch !== null && citedParaRef.current) {
      citedParaRef.current.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }
  }, [citationMatch, citationKey]);

  const learningNotesQuery = useQuery({
    queryKey: ['essay-gallery-learning-notes', essayId, locale],
    queryFn: () =>
      apiClient.get<GalleryLearningNotesResponse>(
        `${essayAiRoutes.galleryLearningNotes(essayId)}?locale=${locale === 'en' ? 'en' : 'zh'}`
      ),
    enabled: !!essayId,
  });

  const userEssaysQuery = useQuery({
    queryKey: ['essays'],
    queryFn: () => apiClient.get<UserEssay[]>(profileRoutes.essays()),
    enabled: compareOpen && !!accessToken,
  });

  const pointsRulesQuery = useQuery({
    queryKey: ['points-rules'],
    queryFn: () => apiClient.get<PointRulesResponse>(pointsRoutes.rules()),
    enabled: !!accessToken && (questionOpen || compareOpen),
  });

  const questionHistoryQuery = useQuery({
    queryKey: ['essay-gallery-interactions', essayId, 'question'],
    queryFn: () =>
      apiClient.get<GalleryEssayInteractionsResponse>(essayAiRoutes.galleryInteractions(essayId), {
        params: { type: 'question', limit: 8 },
      }),
    enabled: questionOpen && !!accessToken,
  });

  const compareHistoryQuery = useQuery({
    queryKey: ['essay-gallery-interactions', essayId, 'compare'],
    queryFn: () =>
      apiClient.get<GalleryEssayInteractionsResponse>(essayAiRoutes.galleryInteractions(essayId), {
        params: { type: 'compare', limit: 6 },
      }),
    enabled: compareOpen && !!accessToken,
  });

  const pointCosts = useMemo(() => {
    const spend = pointsRulesQuery.data?.spend ?? [];
    const findCost = (action: string, fallback: number) => {
      const rule = spend.find((item) => item.action === action);
      return Math.abs(rule?.points ?? fallback);
    };
    return {
      enabled: pointsRulesQuery.data?.enabled ?? true,
      ask: findCost(POINT_ACTION.AI_ESSAY_GALLERY_ASK, 5),
      compare: findCost(POINT_ACTION.AI_ESSAY_COMPARE, 15),
    };
  }, [pointsRulesQuery.data]);

  const feedbackMutation = useMutation({
    // @cache-invalidation-allowed: onSuccess refetches affected gallery interaction history queries directly
    mutationFn: ({
      interactionId,
      ...payload
    }: GalleryEssayInteractionFeedbackRequest & { interactionId: string }) =>
      apiClient.post<GalleryEssayInteractionFeedbackResponse>(
        essayAiRoutes.galleryInteractionFeedback(interactionId),
        payload
      ),
    onSuccess: () => {
      questionHistoryQuery.refetch();
      compareHistoryQuery.refetch();
      toast.success(t('detail.feedback.saved'));
    },
  });

  const questionMutation = useMutation({
    // @cache-invalidation-allowed: onSuccess refetches the affected gallery Q&A history query directly
    mutationFn: (data: {
      question: string;
      paragraphIndex?: number;
      selectedText?: string;
      clientRequestId?: string;
    }) =>
      apiClient.post<GalleryEssayQuestionResponse>(essayAiRoutes.galleryQuestion(essayId), data),
    onSuccess: (data) => {
      setQuestionResult(data);
      questionHistoryQuery.refetch();
      toast.success(t('detail.qa.answerReady'));
    },
  });

  const compareMutation = useMutation({
    // @cache-invalidation-allowed: onSuccess refetches gallery compare history; essay workbench history refetches on its own mount/selection
    mutationFn: (data: {
      userEssayId: string;
      focus?: 'theme' | 'structure' | 'voice' | 'schoolFit' | 'revisionPlan';
      clientRequestId?: string;
    }) => apiClient.post<GalleryEssayCompareResponse>(essayAiRoutes.galleryCompare(essayId), data),
    onSuccess: (data) => {
      setCompareResult(data);
      compareHistoryQuery.refetch();
      toast.success(t('detail.compare.resultReady'));
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

  const loginForPersonalizedAction = () => {
    const callbackUrl = `/cases/essays/${essayId}`;
    router.push(`/login?callbackUrl=${encodeURIComponent(callbackUrl)}`);
  };

  const openQuestionDialog = (initialQuestion = '', paragraphIndex?: number) => {
    if (!accessToken) {
      loginForPersonalizedAction();
      return;
    }
    if (!personalizedToolsAvailable) {
      toast.error(t('detail.personalizedTools.unavailable'));
      return;
    }
    const selectedText =
      typeof window !== 'undefined' ? window.getSelection()?.toString().trim() : '';
    setQuestionDraft(initialQuestion);
    setQuestionParagraphIndex(paragraphIndex);
    setQuestionSelectedText(selectedText || undefined);
    setQuestionResult(null);
    setQuestionOpen(true);
  };

  const openQuestionForParagraph = (paragraphIndex: number) => {
    openQuestionDialog(
      t('detail.qa.paragraphQuestion', { num: paragraphIndex + 1 }),
      paragraphIndex
    );
  };

  const openCompareDialog = () => {
    if (!accessToken) {
      loginForPersonalizedAction();
      return;
    }
    if (!personalizedToolsAvailable) {
      toast.error(t('detail.personalizedTools.unavailable'));
      return;
    }
    setCompareResult(null);
    setCompareOpen(true);
  };

  const submitQuestion = () => {
    const question = questionDraft.trim();
    if (!question) return;
    questionMutation.mutate({
      question,
      paragraphIndex: questionParagraphIndex,
      selectedText: questionSelectedText,
      clientRequestId: createClientRequestId(),
    });
  };

  const submitCompare = () => {
    if (!selectedUserEssayId) return;
    compareMutation.mutate({
      userEssayId: selectedUserEssayId,
      focus: compareFocus,
      clientRequestId: createClientRequestId(),
    });
  };

  const submitFeedback = (
    interactionId: string,
    payload: GalleryEssayInteractionFeedbackRequest
  ) => {
    feedbackMutation.mutate({ interactionId, ...payload });
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

  useEffect(() => {
    if (!compareOpen || selectedUserEssayId) return;
    const firstEssay = userEssaysQuery.data?.[0];
    if (firstEssay) setSelectedUserEssayId(firstEssay.id);
  }, [compareOpen, selectedUserEssayId, userEssaysQuery.data]);

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

  const learningNotes = learningNotesQuery.data;
  const learningAnalysis: AnalysisResult | null =
    learningNotes?.status === 'ready' && learningNotes.payload
      ? {
          essayId,
          ...learningNotes.payload,
          tokenUsed: 0,
          cached: true,
          generatedAt: learningNotes.generatedAt,
        }
      : null;
  const quickQuestions = [
    t('detail.qa.quick.structure'),
    t('detail.qa.quick.opening'),
    t('detail.qa.quick.copyRisk'),
    t('detail.qa.quick.fit'),
  ];
  const renderPointCost = (cost: number) => (
    <div className="flex items-center gap-2 rounded-lg border bg-muted/30 px-3 py-2 text-xs text-muted-foreground">
      <Coins className="h-3.5 w-3.5 shrink-0 text-amber-500" />
      <span>
        {pointCosts.enabled
          ? t('detail.points.cost', { points: cost })
          : t('detail.points.disabled')}
      </span>
    </div>
  );

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
                  <TabsTrigger value="learning" className="gap-1.5 text-sm px-3 h-7">
                    <ClipboardCheck className="h-3.5 w-3.5" />
                    {t('detail.tabs.learningNotes')}
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
                {citationQuote && (
                  <div className="mx-auto mb-3 flex max-w-[68ch] items-center justify-between gap-2 rounded-lg border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-xs">
                    <span className="inline-flex min-w-0 items-center gap-1.5 text-amber-700 dark:text-amber-300">
                      <Search className="h-3.5 w-3.5 shrink-0" />
                      <span className="truncate">
                        {evidenceNav && evidenceNav.items.length > 1
                          ? t('detail.citation.counter', {
                              index: evidenceNav.index + 1,
                              total: evidenceNav.items.length,
                            })
                          : t('detail.citation.label')}
                        {citationMatch === null && (
                          <span className="text-muted-foreground">
                            {' · '}
                            {t('detail.citation.notFound')}
                          </span>
                        )}
                      </span>
                    </span>
                    <span className="flex shrink-0 items-center gap-1">
                      {evidenceNav && evidenceNav.items.length > 1 && (
                        <>
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            className="h-6 w-6 p-0"
                            aria-label={t('detail.citation.prev')}
                            onClick={() =>
                              locateEvidence(
                                evidenceNav.items,
                                (evidenceNav.index - 1 + evidenceNav.items.length) %
                                  evidenceNav.items.length
                              )
                            }
                          >
                            <ChevronUp className="h-4 w-4" />
                          </Button>
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            className="h-6 w-6 p-0"
                            aria-label={t('detail.citation.next')}
                            onClick={() =>
                              locateEvidence(
                                evidenceNav.items,
                                (evidenceNav.index + 1) % evidenceNav.items.length
                              )
                            }
                          >
                            <ChevronDown className="h-4 w-4" />
                          </Button>
                        </>
                      )}
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        className="h-6 w-6 p-0"
                        aria-label={t('detail.citation.clear')}
                        onClick={clearCitation}
                      >
                        <X className="h-4 w-4" />
                      </Button>
                    </span>
                  </div>
                )}
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
                      <div key={i} ref={i === citationMatch ? citedParaRef : undefined}>
                        <p className="mb-6 last:mb-0 text-base leading-[1.8]">
                          {i === citationMatch ? renderWithQuoteHighlight(p, citationQuote) : p}
                        </p>
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

              {/* ── 范文拆解 Tab ── */}
              <TabsContent value="learning" className="mt-0">
                <div className="space-y-4">
                  <div className="rounded-xl border bg-muted/30 p-4">
                    <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                      <div className="min-w-0">
                        <p className="text-sm font-medium">{t('detail.learningNotes.title')}</p>
                        <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
                          {t('detail.learningNotes.sharedHint')}
                        </p>
                        {accessToken && !personalizedToolsAvailable && (
                          <p className="mt-2 text-xs text-amber-700 dark:text-amber-300">
                            {t('detail.personalizedTools.maintenanceHint')}
                          </p>
                        )}
                        {learningNotes?.status === 'ready' && learningNotes.fallbackUsed && (
                          <p className="mt-2 inline-flex items-center gap-1.5 rounded-full bg-amber-500/10 px-2 py-1 text-xs text-amber-700 dark:text-amber-300">
                            <Languages className="h-3 w-3" />
                            {t('detail.learningNotes.fallbackHint', {
                              locale: t(
                                `detail.learningNotes.locales.${learningNotes.sourceLocale ?? 'zh'}`
                              ),
                            })}
                          </p>
                        )}
                      </div>
                      <div className="flex shrink-0 flex-wrap gap-2">
                        <Button
                          size="sm"
                          variant="secondary"
                          className="gap-1.5"
                          onClick={() => openQuestionDialog()}
                          disabled={Boolean(accessToken) && !personalizedToolsAvailable}
                        >
                          <MessageCircle className="h-3.5 w-3.5" />
                          {t('detail.learningNotes.askAction')}
                        </Button>
                        <Button
                          size="sm"
                          className="gap-1.5"
                          onClick={openCompareDialog}
                          disabled={Boolean(accessToken) && !personalizedToolsAvailable}
                        >
                          <GitCompare className="h-3.5 w-3.5" />
                          {t('detail.learningNotes.compareAction')}
                        </Button>
                      </div>
                    </div>
                  </div>

                  {learningNotesQuery.isLoading ? (
                    <div className="space-y-3">
                      <Skeleton className="h-28 rounded-xl" />
                      <Skeleton className="h-40 rounded-xl" />
                      <Skeleton className="h-40 rounded-xl" />
                    </div>
                  ) : learningAnalysis ? (
                    <AnalysisResultView
                      analysis={learningAnalysis}
                      paragraphs={paragraphs}
                      t={t}
                      onAskParagraph={openQuestionForParagraph}
                    />
                  ) : (
                    <Card className="border-dashed">
                      <CardContent className="py-8 text-center">
                        <Lightbulb className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                        <p className="font-medium mb-2">
                          {t('detail.learningNotes.unavailableTitle')}
                        </p>
                        <p className="mx-auto max-w-md text-sm text-muted-foreground">
                          {t('detail.learningNotes.unavailableDesc')}
                        </p>
                      </CardContent>
                    </Card>
                  )}
                </div>
              </TabsContent>
            </Tabs>
          </div>
        </ScrollArea>
      </div>

      <Dialog open={questionOpen} onOpenChange={setQuestionOpen}>
        <DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle>{t('detail.qa.title')}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="flex flex-wrap gap-2">
              {quickQuestions.map((question) => (
                <Button
                  key={question}
                  type="button"
                  variant="secondary"
                  size="sm"
                  onClick={() => {
                    setQuestionDraft(question);
                    setQuestionParagraphIndex(undefined);
                    setQuestionSelectedText(undefined);
                  }}
                >
                  {question}
                </Button>
              ))}
            </div>
            <Textarea
              value={questionDraft}
              onChange={(event) => setQuestionDraft(event.target.value)}
              placeholder={t('detail.qa.placeholder')}
              className="min-h-28"
            />
            {questionSelectedText && (
              <div className="rounded-lg border bg-muted/30 p-3 text-xs">
                <p className="mb-1 font-medium text-muted-foreground">
                  {t('detail.qa.selectedText')}
                </p>
                <p className="line-clamp-3 leading-relaxed">&ldquo;{questionSelectedText}&rdquo;</p>
              </div>
            )}
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              {renderPointCost(pointCosts.ask)}
              <Button
                onClick={submitQuestion}
                disabled={
                  !questionDraft.trim() || questionMutation.isPending || !personalizedToolsAvailable
                }
                className="gap-1.5"
              >
                <MessageCircle className="h-4 w-4" />
                {questionMutation.isPending ? t('detail.qa.thinking') : t('detail.qa.submit')}
              </Button>
            </div>

            {questionResult && (
              <div className="space-y-4 rounded-lg border bg-muted/30 p-4">
                <p className="text-sm leading-relaxed">{questionResult.answer}</p>
                {questionResult.evidence.length > 0 && (
                  <div>
                    <p className="mb-2 text-xs font-medium text-muted-foreground">
                      {t('detail.qa.evidence')}
                    </p>
                    <div className="space-y-2">
                      {questionResult.evidence.map((item, index) => (
                        <button
                          key={index}
                          type="button"
                          onClick={() => locateEvidence(questionResult.evidence, index)}
                          className="w-full rounded-md border bg-background p-3 text-left text-xs transition-colors hover:border-amber-500/40 hover:bg-amber-500/5"
                          title={t('detail.citation.jump')}
                        >
                          <div className="mb-2 flex items-center gap-1.5">
                            <Badge variant="outline">
                              {t(`detail.evidenceSources.${item.source}`)}
                              {item.paragraphIndex !== undefined &&
                                ` · P${item.paragraphIndex + 1}`}
                            </Badge>
                            {item.verified && (
                              <CheckCircle2
                                className="h-3.5 w-3.5 text-emerald-500"
                                aria-label={t('detail.citation.verified')}
                              />
                            )}
                            <Search className="ml-auto h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                          </div>
                          <p className="leading-relaxed text-foreground/90">
                            &ldquo;{item.quote}&rdquo;
                          </p>
                          {item.note && <p className="mt-1 text-muted-foreground">{item.note}</p>}
                        </button>
                      ))}
                    </div>
                  </div>
                )}
                <FeedbackButtons
                  interactionId={questionResult.interactionId}
                  existingSentiment={null}
                  isPending={feedbackMutation.isPending}
                  t={t}
                  onSubmit={submitFeedback}
                />
                {questionResult.followUps.length > 0 && (
                  <div className="flex flex-wrap gap-2">
                    {questionResult.followUps.map((question) => (
                      <Button
                        key={question}
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={() => {
                          setQuestionDraft(question);
                          setQuestionParagraphIndex(undefined);
                          setQuestionSelectedText(undefined);
                        }}
                      >
                        {question}
                      </Button>
                    ))}
                  </div>
                )}
              </div>
            )}

            {(questionHistoryQuery.data?.items.length ?? 0) > 0 && (
              <div className="space-y-3">
                <p className="text-sm font-medium">{t('detail.qa.history')}</p>
                {questionHistoryQuery.data?.items.map((item) => (
                  <GalleryQuestionInteractionCard
                    key={item.id}
                    item={item}
                    t={t}
                    feedbackPending={feedbackMutation.isPending}
                    onFeedback={submitFeedback}
                  />
                ))}
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={compareOpen} onOpenChange={setCompareOpen}>
        <DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-3xl">
          <DialogHeader>
            <DialogTitle>{t('detail.compare.title')}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            {userEssaysQuery.isLoading ? (
              <div className="space-y-2">
                <Skeleton className="h-14 rounded-lg" />
                <Skeleton className="h-14 rounded-lg" />
              </div>
            ) : (userEssaysQuery.data?.length ?? 0) === 0 ? (
              <div className="rounded-lg border border-dashed p-5 text-center">
                <p className="font-medium">{t('detail.compare.noDraftTitle')}</p>
                <p className="mt-1 text-sm text-muted-foreground">
                  {t('detail.compare.noDraftDesc')}
                </p>
                {essay.prompt && (
                  <Button className="mt-4 gap-1.5" onClick={handleWriteWithPrompt}>
                    <PenTool className="h-4 w-4" />
                    {t('detail.writeWithPrompt')}
                  </Button>
                )}
              </div>
            ) : (
              <>
                <div className="space-y-2">
                  <p className="text-sm font-medium">{t('detail.compare.selectEssay')}</p>
                  {userEssaysQuery.data?.map((userEssay) => (
                    <button
                      key={userEssay.id}
                      type="button"
                      onClick={() => setSelectedUserEssayId(userEssay.id)}
                      className={cn(
                        'w-full rounded-lg border p-3 text-left transition-colors',
                        selectedUserEssayId === userEssay.id
                          ? 'border-primary bg-primary/10'
                          : 'hover:bg-muted/50'
                      )}
                    >
                      <div className="flex items-center justify-between gap-3">
                        <div className="min-w-0">
                          <p className="truncate text-sm font-medium">{userEssay.title}</p>
                          <p className="mt-1 line-clamp-1 text-xs text-muted-foreground">
                            {userEssay.prompt || t('detail.compare.noPrompt')}
                          </p>
                        </div>
                        <Badge variant="secondary" className="shrink-0">
                          {userEssay.wordCount ?? userEssay.content.split(/\s+/).length}{' '}
                          {t('detail.words')}
                        </Badge>
                      </div>
                    </button>
                  ))}
                </div>
                <div className="space-y-2">
                  <p className="text-sm font-medium">{t('detail.compare.focus')}</p>
                  <div className="grid grid-cols-2 gap-2 sm:grid-cols-5">
                    {COMPARE_FOCUS_OPTIONS.map((focus) => (
                      <button
                        key={focus}
                        type="button"
                        onClick={() => setCompareFocus(focus)}
                        className={cn(
                          'rounded-lg border px-3 py-2 text-sm transition-colors',
                          compareFocus === focus
                            ? 'border-primary bg-primary/10 text-primary'
                            : 'hover:bg-muted/50'
                        )}
                      >
                        {t(`detail.compare.focusOptions.${focus}`)}
                      </button>
                    ))}
                  </div>
                </div>
                <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                  {renderPointCost(pointCosts.compare)}
                  <Button
                    onClick={submitCompare}
                    disabled={
                      !selectedUserEssayId ||
                      compareMutation.isPending ||
                      !personalizedToolsAvailable
                    }
                    className="gap-1.5"
                  >
                    <GitCompare className="h-4 w-4" />
                    {compareMutation.isPending
                      ? t('detail.compare.comparing')
                      : t('detail.compare.submit')}
                  </Button>
                </div>
              </>
            )}

            {compareResult && (
              <div className="space-y-4 rounded-lg border bg-muted/30 p-4">
                <OverlapRiskBand
                  risk={compareResult.overlapRisk ?? 'low'}
                  reason={compareResult.overlapRiskReason}
                  t={t}
                />
                {[
                  ['referenceSignals', t('detail.compare.referenceSignals')],
                  ['gapAnalysis', t('detail.compare.gapAnalysis')],
                  ['overlapWarnings', t('detail.compare.overlapWarnings')],
                  ['revisionActions', t('detail.compare.revisionActions')],
                ].map(([key, label]) => {
                  const items = compareResult[key as keyof GalleryEssayCompareResponse] as string[];
                  if (!Array.isArray(items) || items.length === 0) return null;
                  return (
                    <div key={key}>
                      <p className="mb-2 text-sm font-medium">{label}</p>
                      <ul className="space-y-1.5 text-sm text-muted-foreground">
                        {items.map((item, index) => (
                          <li key={index} className="flex items-start gap-2">
                            <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-emerald-500" />
                            <span className="leading-relaxed">{item}</span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  );
                })}

                {compareResult.evidence.length > 0 && (
                  <div>
                    <p className="mb-2 text-sm font-medium">{t('detail.compare.evidence')}</p>
                    <div className="grid gap-2 sm:grid-cols-2">
                      {compareResult.evidence.map((item, index) => (
                        <button
                          key={index}
                          type="button"
                          onClick={() => locateEvidence(compareResult.evidence, index)}
                          className="rounded-md border bg-background p-3 text-left text-xs transition-colors hover:border-amber-500/40 hover:bg-amber-500/5"
                          title={t('detail.citation.jump')}
                        >
                          <div className="mb-2 flex items-center gap-1.5">
                            <Badge variant="outline">
                              {t(`detail.evidenceSources.${item.source}`)}
                            </Badge>
                            {item.verified && (
                              <CheckCircle2
                                className="h-3.5 w-3.5 text-emerald-500"
                                aria-label={t('detail.citation.verified')}
                              />
                            )}
                            <Search className="ml-auto h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                          </div>
                          <p className="leading-relaxed">&ldquo;{item.quote}&rdquo;</p>
                          {item.note && <p className="mt-1 text-muted-foreground">{item.note}</p>}
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                  <FeedbackButtons
                    interactionId={compareResult.interactionId}
                    existingSentiment={null}
                    isPending={feedbackMutation.isPending}
                    t={t}
                    onSubmit={submitFeedback}
                  />
                  <Button asChild size="sm" className="gap-1.5">
                    <Link href="/essays">
                      {t('detail.compare.openWorkbench')}
                      <ArrowRight className="h-4 w-4" />
                    </Link>
                  </Button>
                </div>
              </div>
            )}

            {(compareHistoryQuery.data?.items.length ?? 0) > 0 && (
              <div className="space-y-3">
                <p className="text-sm font-medium">{t('detail.compare.history')}</p>
                {compareHistoryQuery.data?.items.map((item) => (
                  <GalleryCompareInteractionCard
                    key={item.id}
                    item={item}
                    t={t}
                    feedbackPending={feedbackMutation.isPending}
                    onFeedback={submitFeedback}
                  />
                ))}
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function FeedbackButtons({
  interactionId,
  existingSentiment,
  isPending,
  t,
  onSubmit,
}: {
  interactionId: string;
  existingSentiment?: 'HELPFUL' | 'NOT_HELPFUL' | null;
  isPending: boolean;
  t: ReturnType<typeof useTranslations>;
  onSubmit: (interactionId: string, payload: GalleryEssayInteractionFeedbackRequest) => void;
}) {
  const [showReasons, setShowReasons] = useState(false);
  const reasonKeys: NonNullable<GalleryEssayInteractionFeedbackRequest['category']>[] = [
    'wrong_evidence',
    'too_generic',
    'template_like',
    'cost_not_worth',
    'other',
  ];

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-xs text-muted-foreground">{t('detail.feedback.prompt')}</span>
        <Button
          type="button"
          size="sm"
          variant={existingSentiment === 'HELPFUL' ? 'default' : 'outline'}
          className="h-8 gap-1.5"
          disabled={isPending}
          onClick={() => onSubmit(interactionId, { sentiment: 'HELPFUL' })}
        >
          <ThumbsUp className="h-3.5 w-3.5" />
          {t('detail.feedback.helpful')}
        </Button>
        <Button
          type="button"
          size="sm"
          variant={existingSentiment === 'NOT_HELPFUL' ? 'default' : 'outline'}
          className="h-8 gap-1.5"
          disabled={isPending}
          onClick={() => setShowReasons((value) => !value)}
        >
          <ThumbsDown className="h-3.5 w-3.5" />
          {t('detail.feedback.notHelpful')}
        </Button>
      </div>
      {showReasons && (
        <div className="flex flex-wrap gap-2">
          {reasonKeys.map((category) => (
            <Button
              key={category}
              type="button"
              size="sm"
              variant="secondary"
              className="h-8"
              disabled={isPending}
              onClick={() => {
                onSubmit(interactionId, {
                  sentiment: 'NOT_HELPFUL',
                  category,
                });
                setShowReasons(false);
              }}
            >
              {t(`detail.feedback.reasons.${category}`)}
            </Button>
          ))}
        </div>
      )}
    </div>
  );
}

function GalleryQuestionInteractionCard({
  item,
  t,
  feedbackPending,
  onFeedback,
}: {
  item: GalleryEssayAIInteractionItem;
  t: ReturnType<typeof useTranslations>;
  feedbackPending: boolean;
  onFeedback: (interactionId: string, payload: GalleryEssayInteractionFeedbackRequest) => void;
}) {
  return (
    <div className="space-y-3 rounded-lg border bg-muted/20 p-4">
      <div className="flex flex-col gap-1 sm:flex-row sm:items-start sm:justify-between">
        <p className="text-sm font-medium">{item.question}</p>
        <span className="shrink-0 text-xs text-muted-foreground">
          {new Date(item.createdAt).toLocaleString()}
        </span>
      </div>
      {item.status === 'FAILED' ? (
        <p className="text-sm text-destructive">{item.errorMessage || t('detail.qa.failed')}</p>
      ) : (
        <>
          {item.answer && <p className="text-sm leading-relaxed">{item.answer}</p>}
          <EvidenceList items={item.evidence} t={t} />
          <FeedbackButtons
            interactionId={item.id}
            existingSentiment={item.feedback?.sentiment ?? null}
            isPending={feedbackPending}
            t={t}
            onSubmit={onFeedback}
          />
        </>
      )}
    </div>
  );
}

function GalleryCompareInteractionCard({
  item,
  t,
  feedbackPending,
  onFeedback,
}: {
  item: GalleryEssayAIInteractionItem;
  t: ReturnType<typeof useTranslations>;
  feedbackPending: boolean;
  onFeedback: (interactionId: string, payload: GalleryEssayInteractionFeedbackRequest) => void;
}) {
  const sections: Array<{ key: string; title: string; items: string[] | undefined }> = [
    {
      key: 'referenceSignals',
      title: t('detail.compare.referenceSignals'),
      items: item.referenceSignals,
    },
    {
      key: 'gapAnalysis',
      title: t('detail.compare.gapAnalysis'),
      items: item.gapAnalysis,
    },
    {
      key: 'overlapWarnings',
      title: t('detail.compare.overlapWarnings'),
      items: item.overlapWarnings,
    },
    {
      key: 'revisionActions',
      title: t('detail.compare.revisionActions'),
      items: item.revisionActions,
    },
  ];
  const focus =
    typeof item.focus === 'string' &&
    COMPARE_FOCUS_OPTIONS.includes(item.focus as GalleryEssayCompareFocus)
      ? (item.focus as GalleryEssayCompareFocus)
      : null;

  return (
    <div className="space-y-4 rounded-lg border bg-muted/20 p-4">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
        <div className="flex flex-wrap gap-2">
          <Badge variant="secondary">{t('detail.compare.historyBadge')}</Badge>
          {focus && <Badge variant="outline">{t(`detail.compare.focusOptions.${focus}`)}</Badge>}
        </div>
        <span className="text-xs text-muted-foreground">
          {new Date(item.createdAt).toLocaleString()}
        </span>
      </div>
      {item.status === 'FAILED' ? (
        <p className="text-sm text-destructive">
          {item.errorMessage || t('detail.compare.failed')}
        </p>
      ) : (
        <>
          <OverlapRiskBand risk={item.overlapRisk ?? 'low'} reason={item.overlapRiskReason} t={t} />
          {sections.map((section) =>
            section.items?.length ? (
              <div key={section.key}>
                <p className="mb-2 text-sm font-medium">{section.title}</p>
                <ul className="space-y-1.5 text-sm text-muted-foreground">
                  {section.items.map((text, index) => (
                    <li key={index} className="flex items-start gap-2">
                      <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-emerald-500" />
                      <span className="leading-relaxed">{text}</span>
                    </li>
                  ))}
                </ul>
              </div>
            ) : null
          )}
          <EvidenceList items={item.evidence} t={t} />
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <FeedbackButtons
              interactionId={item.id}
              existingSentiment={item.feedback?.sentiment ?? null}
              isPending={feedbackPending}
              t={t}
              onSubmit={onFeedback}
            />
            <Button asChild size="sm" variant="outline" className="gap-1.5">
              <Link href="/essays">
                {t('detail.compare.openWorkbench')}
                <ArrowRight className="h-4 w-4" />
              </Link>
            </Button>
          </div>
        </>
      )}
    </div>
  );
}

function EvidenceList({
  items,
  t,
}: {
  items: GalleryEssayAIInteractionItem['evidence'];
  t: ReturnType<typeof useTranslations>;
}) {
  if (!items.length) return null;
  return (
    <div>
      <p className="mb-2 text-xs font-medium text-muted-foreground">{t('detail.qa.evidence')}</p>
      <div className="grid gap-2 sm:grid-cols-2">
        {items.map((item, index) => (
          <div key={index} className="rounded-md bg-background p-3 text-xs">
            <Badge variant="outline" className="mb-2">
              {t(`detail.evidenceSources.${item.source}`)}
              {item.paragraphIndex !== undefined && ` · P${item.paragraphIndex + 1}`}
            </Badge>
            <p className="leading-relaxed text-foreground/90">&ldquo;{item.quote}&rdquo;</p>
            {item.note && <p className="mt-1 text-muted-foreground">{item.note}</p>}
          </div>
        ))}
      </div>
    </div>
  );
}

// ── AI分析结果展示组件 ──────────────────────────────────────────────────────

function AnalysisResultView({
  analysis,
  paragraphs,
  t,
  onAskParagraph,
}: {
  analysis: AnalysisResult;
  paragraphs: string[];
  t: ReturnType<typeof useTranslations>;
  onAskParagraph?: (paragraphIndex: number) => void;
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
        {/* 维度图例 — 解码原文内的彩色高亮 */}
        <div className="flex flex-wrap items-center gap-1.5">
          {DIMENSION_ORDER.map((dimension) => (
            <span
              key={dimension}
              className={cn(
                'inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-2xs',
                DIMENSION_STYLES[dimension].chip
              )}
            >
              <span className={cn('h-2 w-2 rounded-sm', DIMENSION_STYLES[dimension].mark)} />
              {t(`detail.analysis.dimensions.${dimension}`)}
            </span>
          ))}
        </div>
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
                      {/* 原文（行内维度高亮） */}
                      <div className="p-3 rounded-lg bg-muted/50 text-sm italic leading-relaxed">
                        &ldquo;
                        {renderWithDimensionHighlights(paragraphs[index] ?? '', p.highlights)}
                        &rdquo;
                      </div>

                      {/* 点评 */}
                      <p className="text-sm leading-relaxed">{p.comment}</p>

                      {/* 亮点（按维度标注） */}
                      {p.highlights.length > 0 && (
                        <div>
                          <p className="text-xs font-medium text-muted-foreground mb-1.5">
                            {t('detail.analysis.highlights')}
                          </p>
                          <div className="flex flex-wrap gap-1.5">
                            {p.highlights.map((h, i) => {
                              const text = typeof h === 'string' ? h : h?.text;
                              const dimension: EssayDimension =
                                typeof h === 'string' ? 'detail' : (h?.dimension ?? 'detail');
                              if (!text) return null;
                              return (
                                <Badge
                                  key={i}
                                  variant="outline"
                                  className={cn('gap-1 text-xs', DIMENSION_STYLES[dimension].chip)}
                                >
                                  <span className="font-medium">
                                    {t(`detail.analysis.dimensions.${dimension}`)}
                                  </span>
                                  <span className="opacity-60">·</span>
                                  {text}
                                </Badge>
                              );
                            })}
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

                      {onAskParagraph && (
                        <div className="pt-1">
                          <button
                            type="button"
                            onClick={() => onAskParagraph(index)}
                            className="text-xs font-medium text-primary hover:underline underline-offset-2"
                          >
                            {t('detail.analysis.askAboutParagraph')}
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
