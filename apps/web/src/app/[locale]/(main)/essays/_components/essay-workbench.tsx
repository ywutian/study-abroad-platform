'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import type { ReactNode } from 'react';
import { useFormatter, useLocale, useTranslations } from 'next-intl';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  AlertCircle,
  BookOpen,
  Check,
  Clock3,
  FileText,
  History,
  Loader2,
  Plus,
  RotateCcw,
  Save,
  Lightbulb,
  Target,
  Trash2,
  PencilLine,
  X,
} from 'lucide-react';
import { apiClient } from '@/lib/api';
import { getLocalizedName } from '@/lib/i18n/locale-utils';
import { useDebounce } from '@/hooks';
import { useEssayReview, useEssaySuggestEdits } from '@/hooks/use-essay-ai';
import { profileRoutes } from '@study-abroad/shared';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Progress } from '@/components/ui/progress';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Skeleton } from '@/components/ui/skeleton';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Textarea } from '@/components/ui/textarea';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';
import type {
  Essay,
  EssayReview,
  EssayRevision,
  EssaySuggestion,
  EssaySuggestEditsResult,
} from '@/types/essay';

interface EssayWorkbenchProps {
  essays: Essay[] | undefined;
  isLoading: boolean;
  selectedEssay: Essay | null;
  onSelect: (essay: Essay) => void;
  onCreate: () => void;
  onCreateFromPrompt: () => void;
  onDelete: (id: string) => void;
  onSave: (
    id: string,
    data: { title: string; prompt?: string; content: string; essayPromptId?: string },
    silent?: boolean
  ) => void;
  isSaving: boolean;
  getWordCount: (text: string) => number;
}

type SaveState = 'saved' | 'dirty' | 'saving' | 'error';

function toValidDate(value: unknown) {
  if (!value) return null;
  const date = new Date(value as string | number | Date);
  return Number.isNaN(date.getTime()) ? null : date;
}

function getSaveLabel(t: ReturnType<typeof useTranslations>, state: SaveState) {
  if (state === 'dirty') return t('essays.workbench.save.dirty');
  if (state === 'saving') return t('essays.workbench.save.saving');
  if (state === 'error') return t('essays.workbench.save.error');
  return t('essays.workbench.save.saved');
}

export function EssayWorkbench({
  essays,
  isLoading,
  selectedEssay,
  onSelect,
  onCreate,
  onCreateFromPrompt,
  onDelete,
  onSave,
  isSaving,
  getWordCount,
}: EssayWorkbenchProps) {
  const t = useTranslations();
  const locale = useLocale();
  const fmt = useFormatter();
  const queryClient = useQueryClient();
  const loadedEssayIdRef = useRef<string | null>(null);

  const [query, setQuery] = useState('');
  const [draft, setDraft] = useState({ title: '', prompt: '', content: '' });
  const [saveState, setSaveState] = useState<SaveState>('saved');
  const [reviewResult, setReviewResult] = useState<EssayReview | null>(null);
  const debouncedDraft = useDebounce(draft, 1200);

  const filteredEssays = useMemo(() => {
    const items = essays ?? [];
    const normalized = query.trim().toLowerCase();
    if (!normalized) return items;
    return items.filter((essay) =>
      [essay.title, essay.prompt, essay.content].some((value) =>
        (value ?? '').toLowerCase().includes(normalized)
      )
    );
  }, [essays, query]);

  const draftContent = draft.content ?? '';
  const wordCount = getWordCount(draftContent);
  const wordLimit = selectedEssay?.linkedPrompt?.wordLimit;
  const wordRatio = wordLimit ? Math.min(100, Math.round((wordCount / wordLimit) * 100)) : 0;
  const isOverLimit = Boolean(wordLimit && wordCount > wordLimit);
  const isDirty =
    !!selectedEssay &&
    ((draft.title ?? '') !== (selectedEssay.title ?? '') ||
      draft.prompt !== (selectedEssay.prompt ?? '') ||
      draftContent !== (selectedEssay.content ?? ''));

  const suggestionsQuery = useQuery({
    queryKey: ['essay-suggestions', selectedEssay?.id],
    queryFn: () =>
      apiClient.get<EssaySuggestion[]>(profileRoutes.essaySuggestions(selectedEssay!.id)),
    enabled: !!selectedEssay,
  });

  const revisionsQuery = useQuery({
    queryKey: ['essay-revisions', selectedEssay?.id],
    queryFn: () => apiClient.get<EssayRevision[]>(profileRoutes.essayRevisions(selectedEssay!.id)),
    enabled: !!selectedEssay,
  });

  const reviewMutation = useEssayReview((data) => {
    setReviewResult(data);
    toast.success(t('essays.workbench.toast.reviewReady'));
  });

  const suggestMutation = useEssaySuggestEdits((data: EssaySuggestEditsResult) => {
    suggestionsQuery.refetch();
    revisionsQuery.refetch();
    toast.success(t('essays.workbench.toast.suggestionsReady', { count: data.suggestions.length }));
  });

  const snapshotMutation = useMutation({
    mutationFn: () =>
      apiClient.post<EssayRevision>(profileRoutes.essayRevisions(selectedEssay!.id), {
        source: 'manual',
        reason: t('essays.workbench.versions.manualReason'),
      }),
    onSuccess: () => {
      revisionsQuery.refetch();
      toast.success(t('essays.workbench.toast.snapshotSaved'));
    },
  });

  const restoreMutation = useMutation({
    mutationFn: (revisionId: string) =>
      apiClient.post<Essay>(profileRoutes.essayRevisionRestore(selectedEssay!.id, revisionId), {}),
    onSuccess: () => {
      loadedEssayIdRef.current = null;
      setSaveState('saved');
      queryClient.invalidateQueries({ queryKey: ['essays'] });
      revisionsQuery.refetch();
      toast.success(t('essays.workbench.toast.revisionRestored'));
    },
  });

  const applySuggestionMutation = useMutation({
    mutationFn: (suggestionId: string) =>
      apiClient.post<{ essay: Essay; suggestion: EssaySuggestion }>(
        profileRoutes.essaySuggestionApply(selectedEssay!.id, suggestionId),
        {}
      ),
    onSuccess: () => {
      loadedEssayIdRef.current = null;
      setSaveState('saved');
      queryClient.invalidateQueries({ queryKey: ['essays'] });
      suggestionsQuery.refetch();
      revisionsQuery.refetch();
      toast.success(t('essays.workbench.toast.suggestionApplied'));
    },
  });

  const rejectSuggestionMutation = useMutation({
    mutationFn: (suggestionId: string) =>
      apiClient.patch<EssaySuggestion>(
        profileRoutes.essaySuggestion(selectedEssay!.id, suggestionId),
        {
          status: 'REJECTED',
        }
      ),
    onSuccess: () => {
      suggestionsQuery.refetch();
      toast.success(t('essays.workbench.toast.suggestionRejected'));
    },
  });

  useEffect(() => {
    if (!selectedEssay) {
      loadedEssayIdRef.current = null;
      setDraft({ title: '', prompt: '', content: '' });
      setSaveState('saved');
      return;
    }

    const nextDraft = {
      title: selectedEssay.title ?? '',
      prompt: selectedEssay.prompt ?? '',
      content: selectedEssay.content ?? '',
    };

    if (loadedEssayIdRef.current !== selectedEssay.id || (!isDirty && saveState === 'saved')) {
      loadedEssayIdRef.current = selectedEssay.id;
      setDraft(nextDraft);
      setSaveState('saved');
    }
  }, [isDirty, selectedEssay, saveState]);

  useEffect(() => {
    if (!selectedEssay || !isDirty) return;
    if (!debouncedDraft.title.trim() || !(debouncedDraft.content ?? '').trim()) return;
    setSaveState('saving');
    onSave(
      selectedEssay.id,
      {
        title: debouncedDraft.title,
        prompt: debouncedDraft.prompt || undefined,
        content: debouncedDraft.content ?? '',
        essayPromptId: selectedEssay.essayPromptId,
      },
      true
    );
  }, [debouncedDraft, isDirty, onSave, selectedEssay]);

  useEffect(() => {
    if (isSaving && saveState === 'dirty') {
      setSaveState('saving');
      return;
    }
    if (!isSaving && saveState === 'saving') {
      setSaveState('saved');
    }
  }, [isSaving, saveState]);

  const updateDraft = (field: keyof typeof draft, value: string) => {
    setDraft((current) => ({ ...current, [field]: value }));
    setSaveState('dirty');
  };

  const canRunAi = Boolean(selectedEssay && saveState === 'saved' && draftContent.trim());
  const selectedUpdatedAt = toValidDate(selectedEssay?.updatedAt);
  const schoolName = selectedEssay?.linkedPrompt?.school
    ? getLocalizedName(
        selectedEssay.linkedPrompt.school.nameZh,
        selectedEssay.linkedPrompt.school.name,
        locale
      )
    : null;

  const queue = (
    <EssayQueue
      essays={filteredEssays}
      isLoading={isLoading}
      selectedEssayId={selectedEssay?.id ?? null}
      query={query}
      onQueryChange={setQuery}
      onSelect={onSelect}
      onCreate={onCreate}
      getWordCount={getWordCount}
    />
  );

  const editor = selectedEssay ? (
    <section className="min-w-0 rounded-lg border bg-card">
      <div className="flex flex-col gap-3 border-b p-4 xl:flex-row xl:items-start xl:justify-between">
        <div className="min-w-0 flex-1 space-y-2">
          <Input
            value={draft.title ?? ''}
            onChange={(event) => updateDraft('title', event.target.value)}
            className="h-auto border-0 bg-transparent px-0 text-xl font-semibold shadow-none focus-visible:ring-0"
            aria-label={t('essays.label.title')}
          />
          <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
            {schoolName && (
              <Badge variant="outline" className="gap-1">
                <Target className="h-3 w-3" />
                {schoolName}
              </Badge>
            )}
            {selectedEssay.linkedPrompt?.type && (
              <Badge variant="secondary">
                {selectedEssay.linkedPrompt.type.replace(/_/g, ' ')}
              </Badge>
            )}
            <span className="flex items-center gap-1">
              <Clock3 className="h-3.5 w-3.5" />
              {selectedUpdatedAt
                ? fmt.dateTime(selectedUpdatedAt, 'medium')
                : t('common.notAvailable')}
            </span>
            <span
              className={cn(
                'flex items-center gap-1',
                saveState === 'error' && 'text-destructive',
                saveState === 'dirty' && 'text-warning',
                saveState === 'saved' && 'text-emerald-600'
              )}
            >
              {saveState === 'saving' ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : (
                <Save className="h-3.5 w-3.5" />
              )}
              {getSaveLabel(t, saveState)}
            </span>
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => snapshotMutation.mutate()}
            disabled={!selectedEssay || saveState !== 'saved' || snapshotMutation.isPending}
          >
            {snapshotMutation.isPending ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <History className="mr-2 h-4 w-4" />
            )}
            {t('essays.workbench.actions.snapshot')}
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => suggestMutation.mutate({ essayId: selectedEssay.id, style: 'concise' })}
            disabled={!canRunAi || suggestMutation.isPending}
          >
            {suggestMutation.isPending ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <PencilLine className="mr-2 h-4 w-4" />
            )}
            {t('essays.workbench.actions.suggest')}
          </Button>
          <Button
            variant="soft-destructive"
            size="icon"
            onClick={() => onDelete(selectedEssay.id)}
            aria-label={t('common.delete')}
          >
            <Trash2 className="h-4 w-4" />
          </Button>
        </div>
      </div>

      <div className="space-y-4 p-4">
        <div className="rounded-md border bg-muted/20 p-3">
          <div className="mb-2 flex items-center justify-between gap-3">
            <span className="text-xs font-medium text-muted-foreground">
              {t('essays.workbench.prompt')}
            </span>
            {wordLimit && (
              <span
                className={cn(
                  'text-xs',
                  isOverLimit ? 'text-destructive' : 'text-muted-foreground'
                )}
              >
                {wordCount} / {wordLimit} {t('common.words')}
              </span>
            )}
          </div>
          <Textarea
            value={draft.prompt ?? ''}
            onChange={(event) => updateDraft('prompt', event.target.value)}
            rows={3}
            className="resize-none border-0 bg-transparent p-0 text-sm shadow-none focus-visible:ring-0"
            placeholder={t('essays.placeholder.prompt')}
          />
          {wordLimit && (
            <Progress
              value={wordRatio}
              className={cn('mt-3 h-1.5', isOverLimit && '[&>div]:bg-destructive')}
            />
          )}
        </div>

        <Textarea
          value={draftContent}
          onChange={(event) => updateDraft('content', event.target.value)}
          className="min-h-[520px] resize-y rounded-md border bg-background p-5 text-base leading-8 shadow-none focus-visible:ring-1"
          placeholder={t('essays.placeholder.content')}
        />
      </div>
    </section>
  ) : (
    <EmptyEditor onCreate={onCreate} onCreateFromPrompt={onCreateFromPrompt} t={t} />
  );

  const insights = (
    <InsightPanel
      selectedEssay={selectedEssay}
      suggestions={suggestionsQuery.data ?? []}
      suggestionsLoading={suggestionsQuery.isLoading}
      revisions={revisionsQuery.data ?? []}
      revisionsLoading={revisionsQuery.isLoading}
      reviewResult={reviewResult}
      canRunAi={canRunAi}
      reviewPending={reviewMutation.isPending}
      suggestPending={suggestMutation.isPending}
      applyPending={applySuggestionMutation.isPending}
      rejectPending={rejectSuggestionMutation.isPending}
      restorePending={restoreMutation.isPending}
      onReview={() => selectedEssay && reviewMutation.mutate({ essayId: selectedEssay.id })}
      onSuggest={() =>
        selectedEssay && suggestMutation.mutate({ essayId: selectedEssay.id, style: 'concise' })
      }
      onApply={(id) => applySuggestionMutation.mutate(id)}
      onReject={(id) => rejectSuggestionMutation.mutate(id)}
      onRestore={(id) => restoreMutation.mutate(id)}
      t={t}
      fmt={fmt}
    />
  );

  return (
    <>
      <div className="hidden gap-4 lg:grid lg:grid-cols-[300px_minmax(0,1fr)_380px]">
        {queue}
        {editor}
        {insights}
      </div>
      <div className="lg:hidden">
        <Tabs defaultValue={selectedEssay ? 'editor' : 'queue'} className="space-y-4">
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="queue">{t('essays.workbench.tabs.queue')}</TabsTrigger>
            <TabsTrigger value="editor">{t('essays.workbench.tabs.editor')}</TabsTrigger>
            <TabsTrigger value="ai">{t('essays.workbench.tabs.ai')}</TabsTrigger>
          </TabsList>
          <TabsContent value="queue">{queue}</TabsContent>
          <TabsContent value="editor">{editor}</TabsContent>
          <TabsContent value="ai">{insights}</TabsContent>
        </Tabs>
      </div>
    </>
  );
}

function EssayQueue({
  essays,
  isLoading,
  selectedEssayId,
  query,
  onQueryChange,
  onSelect,
  onCreate,
  getWordCount,
}: {
  essays: Essay[];
  isLoading: boolean;
  selectedEssayId: string | null;
  query: string;
  onQueryChange: (value: string) => void;
  onSelect: (essay: Essay) => void;
  onCreate: () => void;
  getWordCount: (text: string) => number;
}) {
  const t = useTranslations();
  const fmt = useFormatter();

  return (
    <aside className="rounded-lg border bg-card">
      <div className="space-y-3 border-b p-4">
        <div className="flex items-center justify-between gap-2">
          <div>
            <h2 className="text-sm font-semibold">{t('essays.workbench.queue.title')}</h2>
            <p className="text-xs text-muted-foreground">
              {t('essays.workbench.queue.count', { count: essays.length })}
            </p>
          </div>
          <Button size="icon" onClick={onCreate} aria-label={t('essays.new')}>
            <Plus className="h-4 w-4" />
          </Button>
        </div>
        <Input
          value={query}
          onChange={(event) => onQueryChange(event.target.value)}
          placeholder={t('essays.workbench.queue.search')}
        />
      </div>
      <ScrollArea className="h-[680px]">
        <div className="space-y-2 p-3">
          {isLoading &&
            [0, 1, 2].map((item) => <Skeleton key={item} className="h-28 rounded-md" />)}
          {!isLoading && essays.length === 0 && (
            <div className="py-10 text-center">
              <FileText className="mx-auto mb-3 h-8 w-8 text-muted-foreground" />
              <p className="text-sm font-medium">{t('essays.empty.title')}</p>
              <p className="mx-auto mt-1 max-w-48 text-xs text-muted-foreground">
                {t('essays.empty.description')}
              </p>
            </div>
          )}
          {essays.map((essay) => {
            const updatedAt = toValidDate(essay.updatedAt);
            const wordCount = essay.wordCount ?? getWordCount(essay.content);
            return (
              <button
                key={essay.id}
                type="button"
                className={cn(
                  'w-full rounded-md border p-3 text-left transition-colors hover:border-primary/50 hover:bg-primary/5',
                  selectedEssayId === essay.id && 'border-primary bg-primary/5'
                )}
                onClick={() => onSelect(essay)}
              >
                <div className="mb-2 flex items-start justify-between gap-3">
                  <h3 className="line-clamp-1 text-sm font-semibold">{essay.title}</h3>
                  <Badge variant="outline" className="shrink-0">
                    {wordCount}
                  </Badge>
                </div>
                <p className="line-clamp-2 text-xs text-muted-foreground">
                  {essay.prompt || essay.content || t('essays.workbench.queue.noPrompt')}
                </p>
                <div className="mt-3 flex items-center gap-1 text-xs text-muted-foreground">
                  <Clock3 className="h-3 w-3" />
                  {updatedAt ? fmt.dateTime(updatedAt, 'short') : t('common.notAvailable')}
                </div>
              </button>
            );
          })}
        </div>
      </ScrollArea>
    </aside>
  );
}

function EmptyEditor({
  onCreate,
  onCreateFromPrompt,
  t,
}: {
  onCreate: () => void;
  onCreateFromPrompt: () => void;
  t: ReturnType<typeof useTranslations>;
}) {
  return (
    <section className="flex min-h-[560px] items-center justify-center rounded-lg border bg-card p-8 text-center">
      <div className="max-w-md">
        <BookOpen className="mx-auto mb-4 h-10 w-10 text-primary" />
        <h2 className="text-xl font-semibold">{t('essays.selectToView')}</h2>
        <p className="mt-2 text-sm text-muted-foreground">{t('essays.clickNewToCreate')}</p>
        <div className="mt-6 flex flex-col justify-center gap-2 sm:flex-row">
          <Button onClick={onCreateFromPrompt}>
            <Target className="mr-2 h-4 w-4" />
            {t('essays.onboarding.fromPromptTitle')}
          </Button>
          <Button variant="outline" onClick={onCreate}>
            <Plus className="mr-2 h-4 w-4" />
            {t('essays.onboarding.freeWriteTitle')}
          </Button>
        </div>
      </div>
    </section>
  );
}

function InsightPanel({
  selectedEssay,
  suggestions,
  suggestionsLoading,
  revisions,
  revisionsLoading,
  reviewResult,
  canRunAi,
  reviewPending,
  suggestPending,
  applyPending,
  rejectPending,
  restorePending,
  onReview,
  onSuggest,
  onApply,
  onReject,
  onRestore,
  t,
  fmt,
}: {
  selectedEssay: Essay | null;
  suggestions: EssaySuggestion[];
  suggestionsLoading: boolean;
  revisions: EssayRevision[];
  revisionsLoading: boolean;
  reviewResult: EssayReview | null;
  canRunAi: boolean;
  reviewPending: boolean;
  suggestPending: boolean;
  applyPending: boolean;
  rejectPending: boolean;
  restorePending: boolean;
  onReview: () => void;
  onSuggest: () => void;
  onApply: (id: string) => void;
  onReject: (id: string) => void;
  onRestore: (id: string) => void;
  t: ReturnType<typeof useTranslations>;
  fmt: ReturnType<typeof useFormatter>;
}) {
  const pendingSuggestions = suggestions.filter((suggestion) => suggestion.status === 'PENDING');
  const formatKind = (kind: string) => {
    const labels: Record<string, string> = {
      rewrite: t('essays.workbench.suggestions.kind.rewrite'),
      shorten: t('essays.workbench.suggestions.kind.shorten'),
      clarity: t('essays.workbench.suggestions.kind.clarity'),
      opening: t('essays.workbench.suggestions.kind.opening'),
      continuation: t('essays.workbench.suggestions.kind.continuation'),
    };
    return labels[kind] ?? kind;
  };

  return (
    <aside className="rounded-lg border bg-card">
      <div className="border-b p-4">
        <div className="flex items-center justify-between gap-3">
          <div>
            <h2 className="text-sm font-semibold">{t('essays.workbench.ai.title')}</h2>
            <p className="text-xs text-muted-foreground">{t('essays.workbench.ai.description')}</p>
          </div>
          <Badge variant={pendingSuggestions.length ? 'default' : 'outline'}>
            {pendingSuggestions.length}
          </Badge>
        </div>
        <div className="mt-3 grid grid-cols-2 gap-2">
          <Button
            size="sm"
            variant="outline"
            onClick={onReview}
            disabled={!canRunAi || reviewPending}
          >
            {reviewPending ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <Lightbulb className="mr-2 h-4 w-4" />
            )}
            {t('essays.aiActions.review')}
          </Button>
          <Button size="sm" onClick={onSuggest} disabled={!canRunAi || suggestPending}>
            {suggestPending ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <PencilLine className="mr-2 h-4 w-4" />
            )}
            {t('essays.workbench.actions.suggest')}
          </Button>
        </div>
        {!canRunAi && selectedEssay && (
          <div className="mt-3 flex gap-2 rounded-md border border-amber-500/30 bg-amber-500/10 p-2 text-xs text-amber-700 dark:text-amber-300">
            <AlertCircle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
            {t('essays.workbench.ai.saveBeforeAi')}
          </div>
        )}
      </div>

      <Tabs defaultValue="suggestions">
        <TabsList className="m-4 mb-0 grid grid-cols-3">
          <TabsTrigger value="suggestions">{t('essays.workbench.tabs.suggestions')}</TabsTrigger>
          <TabsTrigger value="review">{t('essays.workbench.tabs.review')}</TabsTrigger>
          <TabsTrigger value="versions">{t('essays.workbench.tabs.versions')}</TabsTrigger>
        </TabsList>
        <TabsContent value="suggestions" className="m-0">
          <ScrollArea className="h-[600px] p-4">
            {suggestionsLoading && <Skeleton className="h-32 rounded-md" />}
            {!suggestionsLoading && pendingSuggestions.length === 0 && (
              <PanelEmpty
                icon={<PencilLine className="h-8 w-8" />}
                title={t('essays.workbench.suggestions.emptyTitle')}
                description={t('essays.workbench.suggestions.emptyDesc')}
              />
            )}
            <div className="space-y-3">
              {pendingSuggestions.map((suggestion) => (
                <div key={suggestion.id} className="rounded-md border p-3">
                  <Badge variant="secondary" className="mb-3">
                    {formatKind(suggestion.kind)}
                  </Badge>
                  {suggestion.originalText && (
                    <div className="mb-2 rounded bg-destructive/10 p-2 text-xs">
                      <p className="mb-1 font-medium text-destructive">
                        {t('essays.labels.original')}
                      </p>
                      <p className="line-through text-muted-foreground">
                        {suggestion.originalText}
                      </p>
                    </div>
                  )}
                  <div className="rounded bg-emerald-500/10 p-2 text-xs">
                    <p className="mb-1 font-medium text-emerald-700 dark:text-emerald-300">
                      {t('essays.labels.revised')}
                    </p>
                    <p>{suggestion.replacementText}</p>
                  </div>
                  <p className="mt-3 text-xs text-muted-foreground">{suggestion.reason}</p>
                  {suggestion.impact && (
                    <p className="mt-1 text-xs text-muted-foreground">{suggestion.impact}</p>
                  )}
                  <div className="mt-3 flex gap-2">
                    <Button
                      size="sm"
                      className="flex-1"
                      onClick={() => onApply(suggestion.id)}
                      disabled={applyPending || rejectPending}
                    >
                      {applyPending ? (
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      ) : (
                        <Check className="mr-2 h-4 w-4" />
                      )}
                      {t('essays.workbench.suggestions.apply')}
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => onReject(suggestion.id)}
                      disabled={applyPending || rejectPending}
                    >
                      <X className="mr-2 h-4 w-4" />
                      {t('essays.workbench.suggestions.reject')}
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          </ScrollArea>
        </TabsContent>
        <TabsContent value="review" className="m-0">
          <ScrollArea className="h-[600px] p-4">
            {!reviewResult ? (
              <PanelEmpty
                icon={<Lightbulb className="h-8 w-8" />}
                title={t('essays.workbench.review.emptyTitle')}
                description={t('essays.workbench.review.emptyDesc')}
              />
            ) : (
              <div className="space-y-4">
                <div className="rounded-md border p-4">
                  <p className="text-xs text-muted-foreground">
                    {t('essays.workbench.review.overall')}
                  </p>
                  <p className="mt-1 text-3xl font-semibold">{reviewResult.overallScore}/10</p>
                  <p className="mt-2 text-sm text-muted-foreground">{reviewResult.verdict}</p>
                </div>
                <ReviewList title={t('essays.review.strengths')} items={reviewResult.strengths} />
                <ReviewList title={t('essays.review.weaknesses')} items={reviewResult.weaknesses} />
                <ReviewList
                  title={t('essayAi.review.suggestions')}
                  items={reviewResult.suggestions}
                />
              </div>
            )}
          </ScrollArea>
        </TabsContent>
        <TabsContent value="versions" className="m-0">
          <ScrollArea className="h-[600px] p-4">
            {revisionsLoading && <Skeleton className="h-32 rounded-md" />}
            {!revisionsLoading && revisions.length === 0 && (
              <PanelEmpty
                icon={<History className="h-8 w-8" />}
                title={t('essays.workbench.versions.emptyTitle')}
                description={t('essays.workbench.versions.emptyDesc')}
              />
            )}
            <div className="space-y-2">
              {revisions.map((revision) => (
                <div key={revision.id} className="rounded-md border p-3">
                  <div className="mb-2 flex items-start justify-between gap-3">
                    <div>
                      <p className="text-sm font-medium">{revision.reason || revision.source}</p>
                      <p className="text-xs text-muted-foreground">
                        {fmt.dateTime(new Date(revision.createdAt), 'medium')} ·{' '}
                        {revision.wordCount} {t('common.words')}
                      </p>
                    </div>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => onRestore(revision.id)}
                      disabled={restorePending}
                    >
                      {restorePending ? (
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      ) : (
                        <RotateCcw className="mr-2 h-4 w-4" />
                      )}
                      {t('essays.workbench.versions.restore')}
                    </Button>
                  </div>
                  <p className="line-clamp-2 text-xs text-muted-foreground">{revision.content}</p>
                </div>
              ))}
            </div>
          </ScrollArea>
        </TabsContent>
      </Tabs>
    </aside>
  );
}

function PanelEmpty({
  icon,
  title,
  description,
}: {
  icon: ReactNode;
  title: string;
  description: string;
}) {
  return (
    <div className="flex min-h-48 flex-col items-center justify-center text-center text-muted-foreground">
      {icon}
      <p className="mt-3 text-sm font-medium text-foreground">{title}</p>
      <p className="mt-1 max-w-56 text-xs">{description}</p>
    </div>
  );
}

function ReviewList({ title, items }: { title: string; items: string[] }) {
  if (!items?.length) return null;
  return (
    <div>
      <p className="mb-2 text-xs font-semibold uppercase text-muted-foreground">{title}</p>
      <div className="space-y-2">
        {items.map((item, index) => (
          <div key={`${title}-${index}`} className="rounded-md border p-2 text-sm">
            {item}
          </div>
        ))}
      </div>
    </div>
  );
}
