'use client';

/**
 * Phase 2 V1 PR3 — Day-6 blind-eval admin page.
 *
 * Internal ops tool for the 5 external counsellors to rate AI debate
 * turns. Hardcoded English strings (no i18n) because:
 *   - Audience is internal admins, not end users.
 *   - The 4 rating labels are a domain-specific contract used by the
 *     `EssayDebateRating` enum; localising them would obscure the gate
 *     math reading the same labels.
 *
 * Layout: 3 columns (12-col grid).
 *   col 1 (4): Essay text — collapsed by default behind a "Show essay"
 *              button so the evaluator isn't biased by reading the whole
 *              prose before judging the turn.
 *   col 2 (5): The AI rebuttal turn — rebuttal text + evidence chips +
 *              openQuestion. Does NOT label whether this is lumni or
 *              ChatGPT control (the rating UI is blinded server-side).
 *   col 3 (3): Rating form — 4 rating radios + evidence integrity Y/N +
 *              notes + Next button.
 *
 * Identity: evaluator handle is a URL query param (`?evaluator=...`),
 * not auth. The admin role gate upstream ensures only operators reach
 * this page; the evaluatorId is just a label so the gate script can
 * group by counsellor.
 */

import { useEffect, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { AlertTriangle, CheckCircle2, ChevronDown, ChevronUp, Loader2, Quote } from 'lucide-react';
import { adminDebateEvalRoutes } from '@study-abroad/shared';
import { apiClient } from '@/lib/api';
import { PageContainer, PageHeader } from '@/components/layout';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Textarea } from '@/components/ui/textarea';
import { toast } from 'sonner';

type EssayDebateRating = 'SHARP' | 'USEFUL' | 'GENERIC' | 'SYCOPHANTIC';

interface DebateEvidence {
  quote: string;
  source: 'essay' | 'prior_commentary' | 'profile' | 'school';
  paragraphIndex?: number;
}

interface DebateTurn {
  id: string;
  role: 'user' | 'ai';
  text: string;
  evidence?: DebateEvidence[];
  openQuestion?: string;
  createdAt: string;
}

interface QueueItem {
  sessionId: string;
  turnIndex: number;
  isChatGptControl: boolean; // server-side; UI does NOT render
  aiTurn: DebateTurn;
  userTurn?: DebateTurn;
  essayText: string;
  paragraphIndex?: number;
  schoolName?: string;
}

interface QueueResponse {
  done: boolean;
  totalInPool: number;
  rated: number;
  next?: QueueItem;
}

const RATING_OPTIONS: Array<{
  value: EssayDebateRating;
  label: string;
  description: string;
}> = [
  {
    value: 'SHARP',
    label: 'SHARP',
    description: 'Substantive, specific, would change my mind',
  },
  {
    value: 'USEFUL',
    label: 'USEFUL',
    description: 'Reasonable but unremarkable',
  },
  {
    value: 'GENERIC',
    label: 'GENERIC',
    description: 'Could apply to any essay; AI-slop',
  },
  {
    value: 'SYCOPHANTIC',
    label: 'SYCOPHANTIC',
    description: 'Empty agreement / mirror',
  },
];

export default function AdminDebateEvalPage() {
  const searchParams = useSearchParams();
  const evaluatorParam = searchParams.get('evaluator')?.trim() ?? '';
  const [evaluatorId, setEvaluatorId] = useState(evaluatorParam);
  const [evaluatorInput, setEvaluatorInput] = useState(evaluatorParam);
  const [showEssay, setShowEssay] = useState(false);
  const [rating, setRating] = useState<EssayDebateRating | ''>('');
  const [evidenceIntegrity, setEvidenceIntegrity] = useState<'yes' | 'no' | 'na'>('na');
  const [notes, setNotes] = useState('');
  const queryClient = useQueryClient();

  const queueEnabled = evaluatorId.length > 0;

  const queueQuery = useQuery<QueueResponse>({
    queryKey: ['admin-debate-eval-queue', evaluatorId],
    queryFn: () =>
      apiClient.get<QueueResponse>(adminDebateEvalRoutes.queue(), {
        params: { evaluatorId },
      }),
    enabled: queueEnabled,
    refetchOnWindowFocus: false,
  });

  const rateMutation = useMutation({
    mutationFn: async () => {
      if (!queueQuery.data?.next || !rating) return null;
      const item = queueQuery.data.next;
      const body = {
        sessionId: item.sessionId,
        turnIndex: item.turnIndex,
        evaluatorId,
        rating,
        isChatGptControl: item.isChatGptControl,
        evidenceIntegrity: evidenceIntegrity === 'na' ? undefined : evidenceIntegrity === 'yes',
        notes: notes.trim() || undefined,
      };
      return apiClient.post(adminDebateEvalRoutes.rate(), body);
    },
    onSuccess: () => {
      toast.success('Rating saved');
      setRating('');
      setEvidenceIntegrity('na');
      setNotes('');
      setShowEssay(false);
      queryClient.invalidateQueries({
        queryKey: ['admin-debate-eval-queue', evaluatorId],
      });
    },
    onError: () => toast.error('Failed to save rating'),
  });

  // When evaluator query-param changes externally, sync input
  useEffect(() => {
    if (evaluatorParam && evaluatorParam !== evaluatorId) {
      setEvaluatorId(evaluatorParam);
      setEvaluatorInput(evaluatorParam);
    }
  }, [evaluatorParam, evaluatorId]);

  const handleSetEvaluator = () => {
    const trimmed = evaluatorInput.trim();
    if (!trimmed) return;
    setEvaluatorId(trimmed);
    const url = new URL(window.location.href);
    url.searchParams.set('evaluator', trimmed);
    window.history.replaceState({}, '', url.toString());
  };

  const item = queueQuery.data?.next;
  const isPlaceholder = item?.aiTurn.text.startsWith('PR3 PLACEHOLDER') ?? false;

  return (
    <PageContainer variant="admin">
      <PageHeader
        title="Debate Blind-Eval"
        description="Day-6 counsellor rating tool. Read the AI debate turn, optionally expand the essay, then rate. Sessions and turn order are blinded — you will see lumni rebuttals and ChatGPT controls interleaved."
        icon={Quote}
        color="violet"
      />

      {!queueEnabled && (
        <Card className="mb-6 border-dashed">
          <CardContent className="py-6 space-y-3">
            <p className="text-sm font-medium">Set your evaluator handle to start</p>
            <p className="text-xs text-muted-foreground">
              Use the form below or append <code>?evaluator=your-handle</code> to the URL. Use a
              stable id per counsellor (e.g.
              <code> counselor-sarah-001</code>) so the queue picks up where you left off.
            </p>
            <div className="flex gap-2">
              <Input
                value={evaluatorInput}
                onChange={(e) => setEvaluatorInput(e.target.value)}
                placeholder="counselor-sarah-001"
                className="max-w-md"
                onKeyDown={(e) => {
                  if (e.key === 'Enter') handleSetEvaluator();
                }}
              />
              <Button onClick={handleSetEvaluator}>Start</Button>
            </div>
          </CardContent>
        </Card>
      )}

      {queueEnabled && queueQuery.isLoading && (
        <div className="flex items-center gap-2 text-sm text-muted-foreground py-12 justify-center">
          <Loader2 className="h-4 w-4 animate-spin" />
          Loading next item for <code>{evaluatorId}</code>…
        </div>
      )}

      {queueEnabled && queueQuery.data && (
        <>
          <div className="mb-4 flex items-center justify-between text-sm text-muted-foreground">
            <div>
              Evaluator <code className="font-mono">{evaluatorId}</code> · {queueQuery.data.rated}/
              {queueQuery.data.totalInPool} rated
            </div>
            <Button variant="ghost" size="sm" onClick={() => setEvaluatorId('')}>
              Change evaluator
            </Button>
          </div>

          {queueQuery.data.done && (
            <Card className="border-emerald-500/30 bg-emerald-50 dark:bg-emerald-950/30">
              <CardContent className="py-8 text-center space-y-2">
                <CheckCircle2 className="h-10 w-10 text-emerald-600 mx-auto" />
                <p className="font-medium">All {queueQuery.data.totalInPool} turns rated.</p>
                <p className="text-sm text-muted-foreground">
                  Thank you. Ops will run <code>debate-eval-gate.ts</code> once every evaluator
                  finishes.
                </p>
              </CardContent>
            </Card>
          )}

          {item && (
            <div className="grid grid-cols-12 gap-4 min-w-0">
              {/* col 1 — essay (collapsed) */}
              <Card className="col-span-12 lg:col-span-4 min-w-0">
                <CardHeader className="pb-3">
                  <CardTitle className="text-body flex items-center justify-between gap-2">
                    Essay
                    {item.schoolName && (
                      <Badge variant="secondary" className="font-normal">
                        {item.schoolName}
                      </Badge>
                    )}
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setShowEssay((s) => !s)}
                    className="w-full"
                  >
                    {showEssay ? (
                      <>
                        <ChevronUp className="mr-1.5 h-4 w-4" />
                        Hide essay
                      </>
                    ) : (
                      <>
                        <ChevronDown className="mr-1.5 h-4 w-4" />
                        Show full essay ({item.essayText.length} chars)
                      </>
                    )}
                  </Button>
                  {!showEssay && (
                    <p className="text-xs text-muted-foreground">
                      Collapsed by default so you can rate the turn on its own merits before reading
                      the source. Expand only if you need to verify a specific evidence quote.
                    </p>
                  )}
                  {showEssay && (
                    <div className="text-sm leading-relaxed whitespace-pre-wrap max-h-[60vh] overflow-y-auto">
                      {item.essayText}
                    </div>
                  )}
                  {item.paragraphIndex !== undefined && (
                    <p className="text-xs text-muted-foreground">
                      Debate scoped to paragraph #{item.paragraphIndex + 1}
                    </p>
                  )}
                </CardContent>
              </Card>

              {/* col 2 — AI turn (blinded) */}
              <Card className="col-span-12 lg:col-span-5 min-w-0">
                <CardHeader className="pb-3">
                  <CardTitle className="text-body">AI rebuttal</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  {item.userTurn && (
                    <div className="rounded-md bg-muted/40 p-3">
                      <p className="text-xs font-medium text-muted-foreground mb-1">
                        Counsellor / user said:
                      </p>
                      <p className="text-sm">{item.userTurn.text}</p>
                    </div>
                  )}

                  {isPlaceholder && (
                    <div className="rounded-md border border-amber-500/30 bg-amber-50 dark:bg-amber-950/30 p-3 flex gap-2">
                      <AlertTriangle className="h-4 w-4 text-amber-600 mt-0.5 shrink-0" />
                      <div className="text-xs space-y-1">
                        <p className="font-medium text-amber-700 dark:text-amber-300">
                          Control placeholder not yet filled
                        </p>
                        <p className="text-amber-700/80 dark:text-amber-300/80">
                          This control turn still has the PR3 placeholder string. Ops must replace
                          it with a real ChatGPT rebuttal before counsellor eval can produce
                          meaningful A/B numbers.
                        </p>
                      </div>
                    </div>
                  )}

                  <div className="text-sm leading-relaxed whitespace-pre-wrap">
                    {item.aiTurn.text}
                  </div>

                  {(item.aiTurn.evidence?.length ?? 0) > 0 && (
                    <div className="space-y-2">
                      <p className="text-xs font-medium text-muted-foreground">
                        Evidence ({item.aiTurn.evidence!.length})
                      </p>
                      {item.aiTurn.evidence!.map((ev, idx) => (
                        <div
                          key={idx}
                          className="rounded-md border border-border bg-card p-2 text-xs space-y-1"
                        >
                          <div className="flex items-center gap-1.5">
                            <Badge variant="secondary" className="text-xs">
                              {ev.source}
                            </Badge>
                            {ev.paragraphIndex !== undefined && (
                              <span className="text-muted-foreground">
                                ¶{ev.paragraphIndex + 1}
                              </span>
                            )}
                          </div>
                          <p className="italic">&ldquo;{ev.quote}&rdquo;</p>
                        </div>
                      ))}
                    </div>
                  )}

                  {item.aiTurn.openQuestion && (
                    <div className="rounded-md bg-primary/5 p-3">
                      <p className="text-xs font-medium text-primary mb-1">AI asks back:</p>
                      <p className="text-sm italic">{item.aiTurn.openQuestion}</p>
                    </div>
                  )}
                </CardContent>
              </Card>

              {/* col 3 — rating form */}
              <Card className="col-span-12 lg:col-span-3 min-w-0">
                <CardHeader className="pb-3">
                  <CardTitle className="text-body">Rate this turn</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <RadioGroup
                    value={rating}
                    onValueChange={(v) => setRating(v as EssayDebateRating)}
                    className="space-y-2"
                  >
                    {RATING_OPTIONS.map((opt) => (
                      <div
                        key={opt.value}
                        className="flex items-start gap-2 rounded-md border border-border p-2 hover:bg-muted/40"
                      >
                        <RadioGroupItem value={opt.value} id={opt.value} className="mt-0.5" />
                        <Label htmlFor={opt.value} className="cursor-pointer">
                          <div className="font-medium text-sm">{opt.label}</div>
                          <div className="text-xs text-muted-foreground">{opt.description}</div>
                        </Label>
                      </div>
                    ))}
                  </RadioGroup>

                  <div className="space-y-2">
                    <Label className="text-xs">Evidence quotes verifiable in source?</Label>
                    <RadioGroup
                      value={evidenceIntegrity}
                      onValueChange={(v) => setEvidenceIntegrity(v as 'yes' | 'no' | 'na')}
                      className="flex gap-3"
                    >
                      <div className="flex items-center gap-1">
                        <RadioGroupItem value="yes" id="ev-yes" />
                        <Label htmlFor="ev-yes" className="text-xs cursor-pointer">
                          Yes
                        </Label>
                      </div>
                      <div className="flex items-center gap-1">
                        <RadioGroupItem value="no" id="ev-no" />
                        <Label htmlFor="ev-no" className="text-xs cursor-pointer">
                          No
                        </Label>
                      </div>
                      <div className="flex items-center gap-1">
                        <RadioGroupItem value="na" id="ev-na" />
                        <Label htmlFor="ev-na" className="text-xs cursor-pointer">
                          N/A
                        </Label>
                      </div>
                    </RadioGroup>
                  </div>

                  <div className="space-y-1">
                    <Label htmlFor="notes" className="text-xs">
                      Notes (optional)
                    </Label>
                    <Textarea
                      id="notes"
                      value={notes}
                      onChange={(e) => setNotes(e.target.value)}
                      placeholder="What stood out, or didn't."
                      maxLength={2000}
                      rows={4}
                      className="text-sm"
                    />
                  </div>

                  <Button
                    onClick={() => rateMutation.mutate()}
                    disabled={!rating || rateMutation.isPending}
                    className="w-full"
                  >
                    {rateMutation.isPending ? (
                      <>
                        <Loader2 className="mr-1.5 h-4 w-4 animate-spin" />
                        Saving…
                      </>
                    ) : (
                      'Save and next'
                    )}
                  </Button>
                </CardContent>
              </Card>
            </div>
          )}
        </>
      )}
    </PageContainer>
  );
}
