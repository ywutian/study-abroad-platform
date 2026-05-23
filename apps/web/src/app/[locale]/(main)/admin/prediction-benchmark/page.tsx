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
          <div className="mt-3 space-y-2">
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
