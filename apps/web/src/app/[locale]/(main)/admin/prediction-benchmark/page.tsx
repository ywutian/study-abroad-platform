'use client';

import { useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useTranslations } from 'next-intl';
import {
  ChevronDown,
  ChevronUp,
  Clock,
  Eye,
  Gauge,
  GitCommit,
  MessageSquarePlus,
  Send,
  Trash2,
} from 'lucide-react';
import {
  predictionBenchmarkRoutes,
  type BenchmarkComment,
  type BenchmarkListResponse,
  type BenchmarkRunDetail,
  type BenchmarkTestResult,
  type BenchmarkCaseReplay,
  type BenchmarkSchoolAnchorSnapshot,
  type BenchmarkProfileSnapshot,
} from '@study-abroad/shared';

import { PageContainer, PageHeader } from '@/components/layout';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Skeleton } from '@/components/ui/skeleton';
import { EmptyState } from '@/components/ui/empty-state';
import { apiClient } from '@/lib/api';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';

const RUN_LIST_QK = ['admin', 'prediction-benchmark', 'list'] as const;
const runQK = (id: string) => ['admin', 'prediction-benchmark', 'run', id] as const;

function pct(n: number): string {
  return `${(n * 100).toFixed(1)}%`;
}

/**
 * Visual indicator for data-quality tier. The whole point of this surface
 * is so admins can spot MEDIUM-tier (Claude-inferred) values at a glance
 * and question them. Hence the strong color contrast.
 */
function TierBadge({ tier }: { tier: 'HIGH' | 'MEDIUM' | 'LOW' | null }) {
  const t = useTranslations('PredictionBenchmark');
  if (!tier) {
    return (
      <Badge variant="outline" className="text-2xs">
        {t('tier.unflagged')}
      </Badge>
    );
  }
  const styles: Record<string, string> = {
    HIGH: 'bg-emerald-100 text-emerald-800 border-emerald-300 dark:bg-emerald-950 dark:text-emerald-200 dark:border-emerald-800',
    MEDIUM:
      'bg-amber-100 text-amber-800 border-amber-300 dark:bg-amber-950 dark:text-amber-200 dark:border-amber-800',
    LOW: 'bg-slate-100 text-slate-700 border-slate-300 dark:bg-slate-900 dark:text-slate-300 dark:border-slate-700',
  };
  return (
    <Badge variant="outline" className={cn('text-2xs', styles[tier])}>
      {t(`tier.${tier}`)}
    </Badge>
  );
}

/**
 * Renders the applicant profile that was fed into the M3 engine for this
 * case. Co-reviewers use this to question "is this profile realistic for
 * Stanford REA?" etc.
 */
function ProfileSnapshotView({ snap }: { snap: BenchmarkProfileSnapshot }) {
  const t = useTranslations('PredictionBenchmark');
  const fmtNum = (v: number | null, suffix = '') => (v === null ? '—' : `${v}${suffix}`);
  return (
    <div className="space-y-2 rounded-md border bg-muted/20 p-3 text-xs">
      <div className="flex items-center justify-between">
        <p className="font-semibold">{t('inputs.profile')}</p>
        <Badge variant={snap.source === 'real-user' ? 'outline' : 'secondary'} className="text-2xs">
          {t(`inputs.profileSource.${snap.source}`)}
        </Badge>
      </div>
      <dl className="grid grid-cols-1 gap-x-3 gap-y-1 sm:grid-cols-3">
        <div className="flex justify-between gap-2">
          <dt className="text-muted-foreground">{t('inputs.gpa')}</dt>
          <dd className="font-mono">
            {fmtNum(snap.gpa)} / {fmtNum(snap.gpaScale)}
          </dd>
        </div>
        <div className="flex justify-between gap-2">
          <dt className="text-muted-foreground">{t('inputs.sat')}</dt>
          <dd className="font-mono">{fmtNum(snap.satTotal)}</dd>
        </div>
        <div className="flex justify-between gap-2">
          <dt className="text-muted-foreground">{t('inputs.act')}</dt>
          <dd className="font-mono">{fmtNum(snap.actComposite)}</dd>
        </div>
        <div className="flex justify-between gap-2">
          <dt className="text-muted-foreground">{t('inputs.round')}</dt>
          <dd className="font-mono">{snap.applicationRound ?? '—'}</dd>
        </div>
        <div className="flex justify-between gap-2">
          <dt className="text-muted-foreground">{t('inputs.major')}</dt>
          <dd className="font-mono">{snap.targetMajor ?? '—'}</dd>
        </div>
        <div className="flex justify-between gap-2">
          <dt className="text-muted-foreground">{t('inputs.gpaTrend')}</dt>
          <dd className="font-mono">{snap.gpaTrend ?? '—'}</dd>
        </div>
        <div className="flex justify-between gap-2">
          <dt className="text-muted-foreground">{t('inputs.activities')}</dt>
          <dd className="font-mono">{snap.activityCount}</dd>
        </div>
        <div className="flex justify-between gap-2">
          <dt className="text-muted-foreground">{t('inputs.awards')}</dt>
          <dd className="font-mono">
            {snap.awardCount}
            {snap.topAwardLevel ? ` · ${snap.topAwardLevel}` : ''}
          </dd>
        </div>
        <div className="flex justify-between gap-2">
          <dt className="text-muted-foreground">{t('inputs.apCount')}</dt>
          <dd className="font-mono">{fmtNum(snap.apCount)}</dd>
        </div>
      </dl>
      <div className="flex flex-wrap gap-1.5 pt-1">
        {snap.isInternational && (
          <Badge variant="outline" className="text-2xs">
            {t('inputs.flag.international')}
          </Badge>
        )}
        {snap.isFirstGeneration && (
          <Badge variant="outline" className="text-2xs">
            {t('inputs.flag.firstGen')}
          </Badge>
        )}
        {snap.isRecruitedAthlete && (
          <Badge variant="outline" className="text-2xs">
            {t('inputs.flag.athlete')}
          </Badge>
        )}
        {snap.legacyAtSchools.length > 0 && (
          <Badge variant="outline" className="text-2xs">
            {t('inputs.flag.legacy', { count: snap.legacyAtSchools.length })}
          </Badge>
        )}
        {snap.testOptional && (
          <Badge variant="outline" className="text-2xs">
            {t('inputs.flag.testOptional')}
          </Badge>
        )}
      </div>
    </div>
  );
}

/**
 * Renders the school anchor data the M3 engine actually read. The tier
 * badge is the headline — MEDIUM = Claude-inferred, scrutinize. Each
 * field also shows whether it was present (number) or missing (—).
 */
function SchoolAnchorSnapshotView({ snap }: { snap: BenchmarkSchoolAnchorSnapshot }) {
  const t = useTranslations('PredictionBenchmark');
  const fmtPct = (v: number | null) => (v === null ? '—' : pct(v));
  const fmtNum = (v: number | null) => (v === null ? '—' : String(v));
  const fmtMult = (v: number | null) => (v === null ? '—' : `×${v}`);
  return (
    <div className="space-y-2 rounded-md border bg-muted/20 p-3 text-xs">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="font-semibold">{t('inputs.schoolAnchor')}</p>
        <TierBadge tier={snap.admitProfileConfidenceTier} />
      </div>
      <dl className="grid grid-cols-1 gap-x-3 gap-y-1 sm:grid-cols-2">
        <div className="flex justify-between gap-2">
          <dt className="text-muted-foreground">{t('anchor.acceptanceRate')}</dt>
          <dd className="font-mono">
            {fmtPct(snap.acceptanceRate ? snap.acceptanceRate / 100 : null)}
          </dd>
        </div>
        <div className="flex justify-between gap-2">
          <dt className="text-muted-foreground">{t('anchor.edRate')}</dt>
          <dd className="font-mono">
            {fmtPct(snap.edAcceptanceRate ? snap.edAcceptanceRate / 100 : null)}
          </dd>
        </div>
        <div className="flex justify-between gap-2">
          <dt className="text-muted-foreground">{t('anchor.eaRate')}</dt>
          <dd className="font-mono">
            {fmtPct(snap.eaAcceptanceRate ? snap.eaAcceptanceRate / 100 : null)}
          </dd>
        </div>
        <div className="flex justify-between gap-2">
          <dt className="text-muted-foreground">{t('anchor.intlRate')}</dt>
          <dd className="font-mono">
            {fmtPct(snap.intlAcceptanceRate ? snap.intlAcceptanceRate / 100 : null)}
          </dd>
        </div>
        <div className="flex justify-between gap-2">
          <dt className="text-muted-foreground">{t('anchor.sat')}</dt>
          <dd className="font-mono">
            {fmtNum(snap.sat25)}–{fmtNum(snap.sat75)}
          </dd>
        </div>
        <div className="flex justify-between gap-2">
          <dt className="text-muted-foreground">{t('anchor.act')}</dt>
          <dd className="font-mono">
            {fmtNum(snap.act25)}–{fmtNum(snap.act75)}
          </dd>
        </div>
        <div className="flex justify-between gap-2">
          <dt className="text-muted-foreground">{t('anchor.gpaDistribution')}</dt>
          <dd className="font-mono">{snap.hasGpaDistribution ? '✓' : '—'}</dd>
        </div>
        <div className="flex justify-between gap-2">
          <dt className="text-muted-foreground">{t('anchor.cdsBands')}</dt>
          <dd className="font-mono">{snap.cdsBandCount}</dd>
        </div>
        <div className="flex justify-between gap-2">
          <dt className="text-muted-foreground">{t('anchor.legacyClassPct')}</dt>
          <dd className="font-mono">{fmtPct(snap.legacyClassPct)}</dd>
        </div>
        <div className="flex justify-between gap-2">
          <dt className="text-muted-foreground">{t('anchor.legacyMult')}</dt>
          <dd className="font-mono">{fmtMult(snap.legacyAdmitMultiplier)}</dd>
        </div>
        <div className="flex justify-between gap-2">
          <dt className="text-muted-foreground">{t('anchor.athleteClassPct')}</dt>
          <dd className="font-mono">{fmtPct(snap.athleteClassPct)}</dd>
        </div>
        <div className="flex justify-between gap-2">
          <dt className="text-muted-foreground">{t('anchor.athleteMult')}</dt>
          <dd className="font-mono">{fmtMult(snap.athleteAdmitMultiplier)}</dd>
        </div>
        <div className="flex justify-between gap-2">
          <dt className="text-muted-foreground">{t('anchor.firstGenClassPct')}</dt>
          <dd className="font-mono">{fmtPct(snap.firstGenClassPct)}</dd>
        </div>
        <div className="flex justify-between gap-2">
          <dt className="text-muted-foreground">{t('anchor.cycleYear')}</dt>
          <dd className="font-mono">{fmtNum(snap.admitProfileCycleYear)}</dd>
        </div>
      </dl>
      {snap.admitProfileSource && (
        <div className="border-t pt-1.5">
          <p className="text-2xs uppercase tracking-wide text-muted-foreground">
            {t('anchor.source')}
          </p>
          <p className="mt-0.5 whitespace-pre-wrap text-2xs">{snap.admitProfileSource}</p>
        </div>
      )}
    </div>
  );
}

function formatDateTime(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleString();
}

function displayName(comment: BenchmarkComment): string {
  return (
    comment.author.profile?.nickname?.trim() || comment.author.email.split('@')[0] || 'Reviewer'
  );
}

interface TestCardProps {
  test: BenchmarkTestResult;
  comments: BenchmarkComment[];
  anchor: string;
  onComment: (anchor: string) => void;
}

function TestCard({ test, comments, anchor, onComment }: TestCardProps) {
  const t = useTranslations('PredictionBenchmark');
  const [expanded, setExpanded] = useState(test.passed === false);
  const anchorComments = comments.filter((c) => c.anchor === anchor);

  return (
    <Card>
      <CardContent className="p-4">
        <button
          type="button"
          onClick={() => setExpanded((e) => !e)}
          className="flex w-full items-start justify-between gap-3 text-left"
        >
          <div className="flex min-w-0 items-start gap-2">
            <span
              className={cn(
                'inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-xs font-bold',
                test.passed
                  ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-400'
                  : 'bg-rose-100 text-rose-700 dark:bg-rose-950 dark:text-rose-400'
              )}
              aria-label={test.passed ? 'pass' : 'fail'}
            >
              {test.passed ? '✓' : '✗'}
            </span>
            <div className="min-w-0">
              <p className="font-medium text-sm">{test.name}</p>
              <p className="mt-1 text-xs text-muted-foreground">{test.details}</p>
            </div>
          </div>
          <div className="flex shrink-0 items-center gap-2">
            {anchorComments.length > 0 && (
              <Badge variant="secondary" className="gap-1">
                <MessageSquarePlus className="h-3 w-3" />
                {anchorComments.length}
              </Badge>
            )}
            {expanded ? (
              <ChevronUp className="h-4 w-4 text-muted-foreground" />
            ) : (
              <ChevronDown className="h-4 w-4 text-muted-foreground" />
            )}
          </div>
        </button>

        {expanded && (
          <div className="mt-3 space-y-2">
            <dl className="grid grid-cols-1 gap-1 rounded-md bg-muted/40 p-3 text-xs sm:grid-cols-2">
              {Object.entries(test.metrics).map(([k, v]) => (
                <div key={k} className="flex justify-between gap-2">
                  <dt className="text-muted-foreground">{k}</dt>
                  <dd className="font-mono">{String(v)}</dd>
                </div>
              ))}
            </dl>
            {test.failures && test.failures.length > 0 && (
              <div className="rounded-md border border-rose-200 bg-rose-50 p-3 text-xs dark:border-rose-900 dark:bg-rose-950/30">
                <p className="font-medium text-rose-700 dark:text-rose-400">{t('failures')}</p>
                <ul className="mt-1 list-disc pl-5">
                  {test.failures.map((f, i) => (
                    <li key={i}>{f}</li>
                  ))}
                </ul>
              </div>
            )}

            <div className="flex items-center justify-between pt-1">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => onComment(anchor)}
                className="gap-1 text-xs"
              >
                <MessageSquarePlus className="h-3 w-3" />
                {t('comment.actionAnchor')}
              </Button>
            </div>

            {anchorComments.length > 0 && (
              <div className="space-y-2 border-l-2 border-muted pl-3">
                {anchorComments.map((c) => (
                  <div key={c.id} className="text-xs">
                    <p className="font-medium">
                      {displayName(c)} <span className="text-muted-foreground">·</span>{' '}
                      <span className="text-muted-foreground">{formatDateTime(c.createdAt)}</span>
                    </p>
                    <p className="mt-0.5 whitespace-pre-wrap">{c.body}</p>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

interface CaseCardProps {
  caseItem: BenchmarkCaseReplay;
  comments: BenchmarkComment[];
  anchor: string;
  onComment: (anchor: string) => void;
}

function CaseCard({ caseItem, comments, anchor, onComment }: CaseCardProps) {
  const t = useTranslations('PredictionBenchmark');
  const [expanded, setExpanded] = useState(false);
  const anchorComments = comments.filter((c) => c.anchor === anchor);

  const correctSign =
    caseItem.expectedOutcome === 'ADMITTED'
      ? caseItem.predictedProbability >= 0.15
      : caseItem.predictedProbability < 0.5;

  return (
    <Card>
      <CardContent className="p-4">
        <button
          type="button"
          onClick={() => setExpanded((e) => !e)}
          className="flex w-full items-start justify-between gap-3 text-left"
        >
          <div className="flex min-w-0 flex-col gap-1">
            <div className="flex items-center gap-2 flex-wrap">
              <p className="font-medium text-sm">{caseItem.schoolName}</p>
              <Badge variant="outline">{caseItem.round}</Badge>
              <Badge
                variant={caseItem.expectedOutcome === 'ADMITTED' ? 'default' : 'secondary'}
                className={cn(
                  caseItem.expectedOutcome === 'ADMITTED' && 'bg-emerald-600 dark:bg-emerald-700'
                )}
              >
                {t(`outcome.${caseItem.expectedOutcome}`)}
              </Badge>
            </div>
            <div className="flex items-center gap-3 text-xs text-muted-foreground">
              <span>
                {t('case.predicted')}:{' '}
                <span className="font-mono text-foreground">
                  {pct(caseItem.predictedProbability)}
                </span>
              </span>
              <span>·</span>
              <span>
                {t('case.tier')}:{' '}
                <span className="font-medium text-foreground">{caseItem.tier}</span>
              </span>
              <span
                className={cn(
                  'inline-flex h-2 w-2 rounded-full',
                  correctSign ? 'bg-emerald-500' : 'bg-amber-500'
                )}
                aria-label={correctSign ? 'plausible' : 'questionable'}
              />
            </div>
          </div>
          <div className="flex shrink-0 items-center gap-2">
            {anchorComments.length > 0 && (
              <Badge variant="secondary" className="gap-1">
                <MessageSquarePlus className="h-3 w-3" />
                {anchorComments.length}
              </Badge>
            )}
            {expanded ? (
              <ChevronUp className="h-4 w-4 text-muted-foreground" />
            ) : (
              <ChevronDown className="h-4 w-4 text-muted-foreground" />
            )}
          </div>
        </button>

        {expanded && (
          <div className="mt-3 space-y-3">
            {/* Test inputs — surfaced for co-review. The profile may be
                synthetic (Claude-generated) and the school anchor may be
                MEDIUM tier (also Claude-inferred). Reviewers question both. */}
            {caseItem.profileSnapshot && <ProfileSnapshotView snap={caseItem.profileSnapshot} />}
            {caseItem.schoolAnchorSnapshot && (
              <SchoolAnchorSnapshotView snap={caseItem.schoolAnchorSnapshot} />
            )}

            <p className="text-xs font-medium text-muted-foreground">{t('case.contributions')}</p>
            <div className="space-y-1 rounded-md bg-muted/40 p-3 text-xs">
              {caseItem.contributions.length === 0 ? (
                <p className="text-muted-foreground">{t('case.noContributions')}</p>
              ) : (
                caseItem.contributions.map((c, i) => (
                  <div
                    key={i}
                    className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1"
                  >
                    <span className="font-mono text-foreground">
                      <Badge variant="outline" className="mr-1 px-1 py-0 text-2xs">
                        {c.tier}
                      </Badge>
                      {c.dimension}
                    </span>
                    <span className="text-muted-foreground">
                      LR={c.likelihoodRatio.toFixed(2)} · w={c.weight} · Δ
                      {c.deltaPp >= 0 ? '+' : ''}
                      {c.deltaPp.toFixed(1)}pp
                    </span>
                  </div>
                ))
              )}
            </div>

            <div className="flex items-center justify-between pt-1">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => onComment(anchor)}
                className="gap-1 text-xs"
              >
                <MessageSquarePlus className="h-3 w-3" />
                {t('comment.actionAnchor')}
              </Button>
            </div>

            {anchorComments.length > 0 && (
              <div className="space-y-2 border-l-2 border-muted pl-3">
                {anchorComments.map((c) => (
                  <div key={c.id} className="text-xs">
                    <p className="font-medium">
                      {displayName(c)} <span className="text-muted-foreground">·</span>{' '}
                      <span className="text-muted-foreground">{formatDateTime(c.createdAt)}</span>
                    </p>
                    <p className="mt-0.5 whitespace-pre-wrap">{c.body}</p>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

/**
 * /admin/prediction-benchmark — M3 benchmark co-review surface.
 *
 * Lists the latest PredictionBenchmarkRun row by default, with a dropdown
 * to switch to historical runs. Each test + case is collapsible and has
 * its own comment thread (anchored by test/case id). Top-level comments
 * apply to the whole run.
 */
export default function PredictionBenchmarkPage() {
  const t = useTranslations('PredictionBenchmark');
  const queryClient = useQueryClient();
  const [selectedRunId, setSelectedRunId] = useState<string | null>(null);
  const [commentDraft, setCommentDraft] = useState('');
  const [commentAnchor, setCommentAnchor] = useState<string | null>(null);

  const listQuery = useQuery({
    queryKey: RUN_LIST_QK,
    queryFn: () =>
      apiClient.get<BenchmarkListResponse>(predictionBenchmarkRoutes.listRuns() + '?pageSize=20'),
  });

  const activeRunId = useMemo(() => {
    if (selectedRunId) return selectedRunId;
    return listQuery.data?.runs?.[0]?.id ?? null;
  }, [selectedRunId, listQuery.data]);

  const runQuery = useQuery({
    queryKey: activeRunId ? runQK(activeRunId) : ['admin', 'prediction-benchmark', 'run', 'none'],
    queryFn: () =>
      apiClient.get<BenchmarkRunDetail>(predictionBenchmarkRoutes.run(activeRunId as string)),
    enabled: !!activeRunId,
  });

  const addComment = useMutation({
    mutationFn: async ({
      runId,
      body,
      anchor,
    }: {
      runId: string;
      body: string;
      anchor: string | null;
    }) =>
      apiClient.post(predictionBenchmarkRoutes.addComment(runId), {
        body,
        anchor: anchor ?? undefined,
      }),
    onSuccess: (_d, vars) => {
      toast.success(t('comment.posted'));
      setCommentDraft('');
      setCommentAnchor(null);
      queryClient.invalidateQueries({ queryKey: runQK(vars.runId) });
    },
    onError: () => toast.error(t('comment.failed')),
  });

  const deleteComment = useMutation({
    mutationFn: async (commentId: string) =>
      apiClient.delete(predictionBenchmarkRoutes.deleteComment(commentId)),
    onSuccess: () => {
      toast.success(t('comment.deleted'));
      if (activeRunId) {
        queryClient.invalidateQueries({ queryKey: runQK(activeRunId) });
      }
    },
    onError: () => toast.error(t('comment.failed')),
  });

  const handleCommentClick = (anchor: string | null) => {
    setCommentAnchor(anchor);
    setTimeout(() => {
      document
        .getElementById('benchmark-comment-form')
        ?.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }, 50);
  };

  const handleSubmitComment = () => {
    if (!activeRunId || !commentDraft.trim()) return;
    addComment.mutate({
      runId: activeRunId,
      body: commentDraft.trim(),
      anchor: commentAnchor,
    });
  };

  if (listQuery.isLoading) {
    return (
      <PageContainer maxWidth="fluid">
        <PageHeader
          title={t('pageTitle')}
          description={t('pageDescription')}
          color="indigo"
          icon={Gauge}
        />
        <div className="space-y-3">
          {Array.from({ length: 5 }).map((_, i) => (
            <Skeleton key={i} className="h-24" />
          ))}
        </div>
      </PageContainer>
    );
  }

  if (!activeRunId || !listQuery.data || listQuery.data.runs.length === 0) {
    return (
      <PageContainer maxWidth="fluid">
        <PageHeader
          title={t('pageTitle')}
          description={t('pageDescription')}
          color="indigo"
          icon={Gauge}
        />
        <EmptyState
          icon={<Gauge className="h-12 w-12 text-muted-foreground" />}
          title={t('empty.title')}
          description={t('empty.description')}
        />
      </PageContainer>
    );
  }

  const run = runQuery.data;
  const topLevelComments = run?.comments?.filter((c) => !c.anchor) ?? [];
  const allComments = run?.comments ?? [];

  return (
    <PageContainer maxWidth="fluid">
      <PageHeader
        title={t('pageTitle')}
        description={t('pageDescription')}
        color="indigo"
        icon={Gauge}
      />

      {/* Run picker */}
      <Card className="mb-4">
        <CardContent className="flex flex-wrap items-center gap-3 p-4">
          <span className="text-sm font-medium">{t('switchRun')}:</span>
          <select
            value={activeRunId}
            onChange={(e) => setSelectedRunId(e.target.value)}
            className="rounded-md border bg-background px-3 py-1.5 text-sm"
          >
            {listQuery.data.runs.map((r) => (
              <option key={r.id} value={r.id}>
                {formatDateTime(r.ranAt)} · {r.testsPassed}/{r.testsTotal}
                {r.label ? ` · ${r.label}` : ''}
              </option>
            ))}
          </select>
          <div className="ml-auto text-xs text-muted-foreground">
            {t('runsTotal', { count: listQuery.data.pagination.total })}
          </div>
        </CardContent>
      </Card>

      {runQuery.isLoading || !run ? (
        <div className="space-y-3">
          {Array.from({ length: 7 }).map((_, i) => (
            <Skeleton key={i} className="h-24" />
          ))}
        </div>
      ) : (
        <>
          {/* Summary cards */}
          <div className="mb-4 grid grid-cols-1 gap-3 md:grid-cols-3">
            <Card>
              <CardContent className="p-4">
                <p className="text-xs text-muted-foreground">{t('summary.structuralTests')}</p>
                <p className="mt-1 text-2xl font-semibold">
                  {run.testsPassed}/{run.testsTotal}
                  <span className="ml-2 align-middle text-base font-normal text-muted-foreground">
                    {run.testsPassed === run.testsTotal ? '✅' : '⚠️'}
                  </span>
                </p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-4">
                <p className="text-xs text-muted-foreground">{t('summary.casesMean')}</p>
                <p className="mt-1 text-2xl font-semibold font-mono">
                  {pct(run.summary.casesAdmittedMeanProb)}
                </p>
                <p className="mt-1 text-xs text-muted-foreground">
                  {t('summary.casesRange', {
                    min: pct(run.summary.casesAdmittedMinProb),
                    max: pct(run.summary.casesAdmittedMaxProb),
                  })}
                </p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-4">
                <p className="text-xs text-muted-foreground">{t('summary.runInfo')}</p>
                <p className="mt-1 flex items-center gap-1.5 text-sm">
                  <Clock className="h-3.5 w-3.5 text-muted-foreground" />
                  <span className="font-medium">{formatDateTime(run.ranAt)}</span>
                </p>
                {run.engineVersion && (
                  <p className="mt-1 flex items-center gap-1.5 text-xs text-muted-foreground">
                    <GitCommit className="h-3 w-3" />
                    <span className="font-mono">{run.engineVersion}</span>
                  </p>
                )}
              </CardContent>
            </Card>
          </div>

          {/* Data Sources breakdown — surfaces what fraction of school
              anchors used real (HIGH) vs Claude-inferred (MEDIUM) vs
              global fallback (LOW) data. This is the most important
              signal for the team: "should I trust this run?". */}
          {run.summary.dataSources && (
            <Card className="mb-4 border-l-4 border-l-indigo-400">
              <CardContent className="p-4">
                <div className="flex flex-wrap items-baseline justify-between gap-2">
                  <p className="text-sm font-semibold">{t('dataSources.title')}</p>
                  <p className="text-xs text-muted-foreground">
                    {t('dataSources.subtitle', {
                      schoolsUsed: run.summary.dataSources.schoolsUsed,
                    })}
                  </p>
                </div>
                <div className="mt-2 grid grid-cols-2 gap-2 md:grid-cols-4">
                  <div className="rounded-md bg-emerald-50 p-2 dark:bg-emerald-950/30">
                    <p className="text-xs text-emerald-700 dark:text-emerald-400">
                      {t('tier.HIGH')}
                    </p>
                    <p className="text-2xl font-semibold text-emerald-800 dark:text-emerald-300">
                      {run.summary.dataSources.byTier.HIGH}
                    </p>
                    <p className="text-2xs text-muted-foreground">{t('dataSources.highHint')}</p>
                  </div>
                  <div className="rounded-md bg-amber-50 p-2 dark:bg-amber-950/30">
                    <p className="text-xs text-amber-700 dark:text-amber-400">{t('tier.MEDIUM')}</p>
                    <p className="text-2xl font-semibold text-amber-800 dark:text-amber-300">
                      {run.summary.dataSources.byTier.MEDIUM}
                    </p>
                    <p className="text-2xs text-muted-foreground">{t('dataSources.mediumHint')}</p>
                  </div>
                  <div className="rounded-md bg-slate-100 p-2 dark:bg-slate-900">
                    <p className="text-xs text-muted-foreground">{t('tier.LOW')}</p>
                    <p className="text-2xl font-semibold">{run.summary.dataSources.byTier.LOW}</p>
                    <p className="text-2xs text-muted-foreground">{t('dataSources.lowHint')}</p>
                  </div>
                  <div className="rounded-md bg-muted/40 p-2">
                    <p className="text-xs text-muted-foreground">{t('dataSources.cdsBands')}</p>
                    <p className="text-2xl font-semibold">
                      {run.summary.dataSources.cdsBandsAvailable}
                    </p>
                    <p className="text-2xs text-muted-foreground">
                      {t('dataSources.globalBaselines', {
                        count: run.summary.dataSources.globalBaselinesUsed,
                      })}
                    </p>
                  </div>
                </div>
                <p className="mt-3 text-xs text-muted-foreground">{t('dataSources.warning')}</p>
              </CardContent>
            </Card>
          )}

          {run.notes && (
            <Card className="mb-4 border-l-4 border-l-amber-400">
              <CardContent className="p-4">
                <p className="text-xs uppercase tracking-wide text-muted-foreground">
                  {t('runNotes')}
                </p>
                <p className="mt-1 text-sm whitespace-pre-wrap">{run.notes}</p>
              </CardContent>
            </Card>
          )}

          {/* Structural tests */}
          <h2 className="mb-3 mt-6 text-lg font-semibold">{t('sections.structural')}</h2>
          <div className="space-y-2">
            {run.tests.map((test, i) => {
              const anchor = `test:${i}`;
              return (
                <TestCard
                  key={anchor}
                  test={test}
                  anchor={anchor}
                  comments={allComments}
                  onComment={handleCommentClick}
                />
              );
            })}
          </div>

          {/* v3 cases */}
          <h2 className="mb-3 mt-6 text-lg font-semibold">{t('sections.cases')}</h2>
          <div className="space-y-2">
            {run.cases.map((c) => {
              const anchor = `case:${c.caseId}`;
              return (
                <CaseCard
                  key={c.caseId}
                  caseItem={c}
                  anchor={anchor}
                  comments={allComments}
                  onComment={handleCommentClick}
                />
              );
            })}
          </div>

          {/* Top-level comments */}
          <h2 className="mb-3 mt-6 text-lg font-semibold">
            {t('sections.comments')}{' '}
            <span className="text-sm font-normal text-muted-foreground">
              ({topLevelComments.length})
            </span>
          </h2>
          <div className="space-y-2">
            {topLevelComments.length === 0 && (
              <Card>
                <CardContent className="p-6 text-center text-sm text-muted-foreground">
                  {t('comment.empty')}
                </CardContent>
              </Card>
            )}
            {topLevelComments.map((c) => (
              <Card key={c.id}>
                <CardContent className="p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-medium">
                        {displayName(c)}{' '}
                        <span className="ml-2 text-xs text-muted-foreground">
                          {formatDateTime(c.createdAt)}
                        </span>
                      </p>
                      <p className="mt-1 whitespace-pre-wrap text-sm">{c.body}</p>
                    </div>
                    <Button
                      variant="ghost"
                      size="icon"
                      aria-label={t('comment.delete')}
                      onClick={() => deleteComment.mutate(c.id)}
                      className="h-7 w-7 shrink-0"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>

          {/* Comment composer */}
          <Card id="benchmark-comment-form" className="mt-4">
            <CardContent className="space-y-2 p-4">
              {commentAnchor && (
                <div className="flex items-center justify-between rounded-md bg-muted/50 px-3 py-1.5 text-xs">
                  <span className="font-mono text-muted-foreground">
                    <Eye className="mr-1 inline h-3 w-3" />
                    {t('comment.anchorLabel')}: {commentAnchor}
                  </span>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setCommentAnchor(null)}
                    className="h-6 px-2 text-xs"
                  >
                    {t('comment.anchorClear')}
                  </Button>
                </div>
              )}
              <Textarea
                value={commentDraft}
                onChange={(e) => setCommentDraft(e.target.value)}
                placeholder={t('comment.placeholder')}
                rows={3}
                maxLength={4000}
              />
              <div className="flex items-center justify-between">
                <span className="text-xs text-muted-foreground">{commentDraft.length}/4000</span>
                <Button
                  onClick={handleSubmitComment}
                  disabled={!commentDraft.trim() || addComment.isPending}
                  className="gap-1.5"
                >
                  <Send className="h-3.5 w-3.5" />
                  {addComment.isPending ? t('comment.posting') : t('comment.post')}
                </Button>
              </div>
            </CardContent>
          </Card>
        </>
      )}
    </PageContainer>
  );
}
