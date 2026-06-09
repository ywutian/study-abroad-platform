'use client';

/**
 * Phase 2 V1 PR2 — frontend dialog for the essay-debate feature.
 *
 * One file, three sub-components inside (per PR2 plan):
 *   <MessageList>   — chronological user/AI bubbles
 *   <InputBox>      — textarea + submit + remaining-turns indicator
 *   <EvidenceChip>  — verbatim quote chip with click-to-scroll-to-paragraph
 *
 * Red-team / Khan-Quill rules honoured here:
 *   - NO sticky banner, NO scroll-triggered overlay. Modal opens only on
 *     explicit click of the per-paragraph "不同意？" button.
 *   - NO `concedes` field is rendered or accepted; the API/server strip it.
 *   - Evidence quotes come server-verified — we render them as plain text
 *     and let the user click a chip to scroll to the source paragraph.
 *
 * The session is scoped per essay. Users can pivot to a different paragraph
 * mid-conversation and the dialog stays open; the paragraphIndex prop just
 * pre-fills which paragraph the *next* user turn argues against, and the
 * AI's response will receive that paragraph's prior commentary as Class 6.
 */

import { useEffect, useRef, useState } from 'react';
import { useTranslations } from 'next-intl';
import { useMutation, useQuery } from '@tanstack/react-query';
import { Send, Loader2, MessageSquare, Quote, X } from 'lucide-react';

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import { ScrollArea } from '@/components/ui/scroll-area';
import { cn } from '@/lib/utils';
import { apiClient } from '@/lib/api/client';
import { essayDebateRoutes } from '@study-abroad/shared';
import { toast } from 'sonner';

// ── Types matching the backend DTOs ───────────────────────────────────────

type EvidenceSource = 'essay' | 'prior_commentary' | 'profile' | 'school';

interface DebateEvidence {
  quote: string;
  source: EvidenceSource;
  paragraphIndex?: number;
}

interface DebateTurn {
  id: string;
  role: 'user' | 'ai';
  text: string;
  evidence?: DebateEvidence[];
  openQuestion?: string;
  tokensUsed?: number;
  createdAt: string;
}

interface DebateTurnResponse {
  sessionId: string;
  userTurn: DebateTurn;
  aiTurn: DebateTurn;
  remainingTurnsToday: number;
}

interface DebateSession {
  id: string;
  status: 'ACTIVE' | 'CLOSED';
  totalTurns: number;
  totalTokens: number;
  admissionCaseId?: string;
  essayId?: string;
  paragraphIndex?: number;
  turns: DebateTurn[];
  createdAt: string;
  updatedAt: string;
}

interface CreateDebateTurnDto {
  sessionId?: string;
  admissionCaseId?: string;
  essayId?: string;
  paragraphIndex?: number;
  userText: string;
}

const DAILY_USER_TURN_CAP = 30;

export interface EssayDebateDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /**
   * Already-open session to continue. `null` means start fresh against
   * `admissionCaseId` / `essayId`.
   */
  sessionId: string | null;
  /** Use one of admissionCaseId or essayId, not both. */
  admissionCaseId?: string;
  essayId?: string;
  /** Paragraph the next user-turn argues against. */
  paragraphIndex?: number;
  /**
   * When the dialog needs to scroll the parent essay viewer to a quoted
   * paragraph, we call this — null disables the affordance.
   */
  onScrollToParagraph?: (index: number) => void;
  /** Surface the new sessionId back to the parent so it can persist it. */
  onSessionCreated?: (sessionId: string) => void;
}

export function EssayDebateDialog({
  open,
  onOpenChange,
  sessionId,
  admissionCaseId,
  essayId,
  paragraphIndex,
  onScrollToParagraph,
  onSessionCreated,
}: EssayDebateDialogProps) {
  const t = useTranslations('essayDebate');
  const [draft, setDraft] = useState('');
  const [localTurns, setLocalTurns] = useState<DebateTurn[]>([]);
  const [localSessionId, setLocalSessionId] = useState<string | null>(sessionId);
  const [remaining, setRemaining] = useState<number>(DAILY_USER_TURN_CAP);

  // Sync external sessionId changes into local state when the dialog opens.
  useEffect(() => {
    if (open) {
      setLocalSessionId(sessionId);
      setLocalTurns([]);
    }
  }, [open, sessionId]);

  // Hydrate the conversation when we have an existing session.
  const sessionQuery = useQuery<DebateSession>({
    queryKey: ['essay-debate-session', localSessionId],
    queryFn: () => apiClient.get<DebateSession>(essayDebateRoutes.latest(localSessionId as string)),
    enabled: open && !!localSessionId,
    staleTime: 30_000,
  });

  useEffect(() => {
    if (sessionQuery.data) {
      setLocalTurns(sessionQuery.data.turns);
    }
  }, [sessionQuery.data]);

  const turnMutation = useMutation<DebateTurnResponse, Error, CreateDebateTurnDto>({
    // @cache-invalidation-allowed: appends the returned user+AI turn pair to local state (setLocalTurns); the displayed conversation is local-state-driven (sessionQuery only hydrates on open)
    mutationFn: (dto) => apiClient.post<DebateTurnResponse>(essayDebateRoutes.turn(), dto),
    onSuccess: (data) => {
      setLocalTurns((prev) => [...prev, data.userTurn, data.aiTurn]);
      setLocalSessionId(data.sessionId);
      setRemaining(data.remainingTurnsToday);
      onSessionCreated?.(data.sessionId);
      setDraft('');
    },
    onError: (err) => {
      // The global MutationCache will show the generic toast; we add
      // category-specific copy here for the three known failure modes.
      const status =
        (err as Error & { status?: number; response?: { status?: number } }).status ??
        (err as Error & { response?: { status?: number } }).response?.status;
      if (status === 429) toast.error(t('errors.userCap'));
      else if (status === 503) toast.error(t('errors.systemCap'));
      else if (status === 502) toast.error(t('errors.llmError'));
      // Other statuses → MutationCache handles it; opt-out via meta if needed.
    },
    meta: { skipGlobalErrorToast: true },
  });

  const handleSubmit = () => {
    const text = draft.trim();
    if (!text || turnMutation.isPending) return;
    const dto: CreateDebateTurnDto = {
      sessionId: localSessionId ?? undefined,
      userText: text,
      paragraphIndex,
    };
    if (admissionCaseId) dto.admissionCaseId = admissionCaseId;
    if (essayId) dto.essayId = essayId;
    turnMutation.mutate(dto);
  };

  const handleEvidenceClick = (ev: DebateEvidence) => {
    if (ev.source === 'essay' && typeof ev.paragraphIndex === 'number') {
      onScrollToParagraph?.(ev.paragraphIndex);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <MessageSquare className="h-5 w-5 text-primary" />
            {t('dialog.title')}
          </DialogTitle>
          <DialogDescription>{t('dialog.description')}</DialogDescription>
        </DialogHeader>

        <ScrollArea className="max-h-[55vh] pr-3">
          <MessageList
            turns={localTurns}
            currentParagraphIndex={paragraphIndex}
            onEvidenceClick={handleEvidenceClick}
            t={t}
          />
        </ScrollArea>

        <DialogFooter className="flex-col sm:flex-col sm:items-stretch gap-2">
          <div className="text-xs text-muted-foreground flex items-center justify-between">
            <span>{t('remaining', { count: remaining, max: DAILY_USER_TURN_CAP })}</span>
            {turnMutation.isPending && (
              <span className="inline-flex items-center gap-1">
                <Loader2 className="h-3 w-3 animate-spin" />
                {t('thinking')}
              </span>
            )}
          </div>
          <InputBox
            value={draft}
            onChange={setDraft}
            onSubmit={handleSubmit}
            disabled={turnMutation.isPending}
            t={t}
          />
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ── <MessageList> ─────────────────────────────────────────────────────────

function MessageList({
  turns,
  currentParagraphIndex,
  onEvidenceClick,
  t,
}: {
  turns: DebateTurn[];
  currentParagraphIndex?: number;
  onEvidenceClick: (ev: DebateEvidence) => void;
  t: ReturnType<typeof useTranslations>;
}) {
  const endRef = useRef<HTMLDivElement | null>(null);
  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' });
  }, [turns.length]);

  if (turns.length === 0) {
    return <div className="py-10 text-center text-sm text-muted-foreground">{t('emptyState')}</div>;
  }

  return (
    <div className="space-y-3 pb-2">
      {turns.map((turn) => {
        const isUser = turn.role === 'user';
        return (
          <div
            key={turn.id}
            className={cn('flex w-full min-w-0', isUser ? 'justify-end' : 'justify-start')}
          >
            <div
              className={cn(
                'min-w-0 max-w-[80%] rounded-2xl px-4 py-3 text-sm leading-relaxed',
                isUser ? 'bg-primary text-primary-foreground' : 'bg-muted text-foreground'
              )}
            >
              {isUser && typeof currentParagraphIndex === 'number' && (
                <div className="mb-1 text-xs opacity-80">
                  {t('userTurnTag', { index: currentParagraphIndex })}
                </div>
              )}
              <div className="whitespace-pre-wrap break-words">{turn.text}</div>
              {!isUser && turn.evidence && turn.evidence.length > 0 && (
                <div className="mt-3 flex flex-wrap gap-1.5">
                  {turn.evidence.map((ev, i) => (
                    <EvidenceChip
                      key={`${turn.id}-ev-${i}`}
                      evidence={ev}
                      onClick={onEvidenceClick}
                      t={t}
                    />
                  ))}
                </div>
              )}
              {!isUser && turn.openQuestion && (
                <p className="mt-3 italic text-sm text-muted-foreground border-l-2 border-primary/50 pl-3">
                  {turn.openQuestion}
                </p>
              )}
            </div>
          </div>
        );
      })}
      <div ref={endRef} />
    </div>
  );
}

// ── <EvidenceChip> ───────────────────────────────────────────────────────

function EvidenceChip({
  evidence,
  onClick,
  t,
}: {
  evidence: DebateEvidence;
  onClick: (ev: DebateEvidence) => void;
  t: ReturnType<typeof useTranslations>;
}) {
  const sourceLabel = t(`evidence.source.${camelSource(evidence.source)}` as const);
  const isClickable = evidence.source === 'essay' && typeof evidence.paragraphIndex === 'number';
  return (
    <Badge
      variant="outline"
      className={cn(
        'gap-1 max-w-full whitespace-normal text-xs font-normal items-start py-1 px-2',
        isClickable && 'cursor-pointer hover:bg-accent'
      )}
      onClick={() => isClickable && onClick(evidence)}
      title={isClickable ? t('evidence.clickToScroll') : undefined}
    >
      <Quote className="h-3 w-3 shrink-0 mt-0.5" />
      <span className="min-w-0">
        <span className="font-medium">{sourceLabel}</span>
        {evidence.source === 'essay' && typeof evidence.paragraphIndex === 'number' && (
          <span className="opacity-70"> · ¶{evidence.paragraphIndex}</span>
        )}
        : <span className="italic">{evidence.quote}</span>
      </span>
    </Badge>
  );
}

/** Map snake_case source values to camelCase for i18n key lookup. */
function camelSource(s: EvidenceSource): 'essay' | 'priorCommentary' | 'profile' | 'school' {
  switch (s) {
    case 'prior_commentary':
      return 'priorCommentary';
    case 'profile':
      return 'profile';
    case 'school':
      return 'school';
    case 'essay':
    default:
      return 'essay';
  }
}

// ── <InputBox> ────────────────────────────────────────────────────────────

function InputBox({
  value,
  onChange,
  onSubmit,
  disabled,
  t,
}: {
  value: string;
  onChange: (next: string) => void;
  onSubmit: () => void;
  disabled: boolean;
  t: ReturnType<typeof useTranslations>;
}) {
  return (
    <div className="flex items-end gap-2 w-full min-w-0">
      <Textarea
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={t('inputPlaceholder')}
        rows={2}
        maxLength={2000}
        disabled={disabled}
        className="resize-none"
        onKeyDown={(e) => {
          if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
            e.preventDefault();
            onSubmit();
          }
        }}
      />
      <Button
        type="button"
        onClick={onSubmit}
        disabled={disabled || value.trim().length === 0}
        size="sm"
        className="shrink-0"
        aria-label={t('submit')}
      >
        {disabled ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
      </Button>
    </div>
  );
}

// Silence a no-unused-import warning when consumers don't pass props.
export const __DialogDismissIcon = X;
