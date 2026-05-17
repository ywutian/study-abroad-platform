'use client';

import type { ElementType } from 'react';
import { useTranslations } from 'next-intl';
import { Archive, BellOff, FileText, Flag, Pin, ShieldCheck, Users } from 'lucide-react';

import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import { Skeleton } from '@/components/ui/skeleton';
import { Switch } from '@/components/ui/switch';
import { VerificationIcon } from '@/components/features';
import { cn } from '@/lib/utils';
import { isSafeUrl } from '@/lib/utils/url';

import type { ChatContext, ChatUser, Conversation } from './types';
import { getConversationTitle, getDisplayName, parseMatchTitle } from './utils';

interface ChatContextPanelProps {
  conversation: Conversation | null;
  context?: ChatContext;
  isLoading: boolean;
  isPinned: boolean;
  isArchived: boolean;
  isMuted: boolean;
  onPin: () => void;
  onArchive: () => void;
  onMute: () => void;
  onReport: () => void;
  onBlock: () => void;
  className?: string;
}

export function ChatContextPanel({
  conversation,
  context,
  isLoading,
  isPinned,
  isArchived,
  isMuted,
  onPin,
  onArchive,
  onMute,
  onReport,
  onBlock,
  className,
}: ChatContextPanelProps) {
  const t = useTranslations();

  if (!conversation) {
    return (
      <aside
        className={cn(
          'hidden min-h-0 min-w-0 overflow-hidden border-l bg-card/80 lg:flex lg:flex-col',
          className
        )}
      >
        <div className="border-b px-4 py-3">
          <p className="text-sm font-semibold">{t('chat.contextTitle')}</p>
        </div>
        <div className="flex flex-1 items-center justify-center px-6 text-center text-sm text-muted-foreground">
          {t('chat.selectConversationHint')}
        </div>
      </aside>
    );
  }

  const title = getConversationTitle(conversation);
  const participants = context?.participants?.length
    ? context.participants
    : conversation.participantPreview;
  const files = context?.files ?? [];
  const isDirect = conversation.kind === 'DIRECT';

  return (
    <aside
      className={cn(
        'hidden min-h-0 min-w-0 overflow-hidden border-l bg-card/80 lg:flex lg:flex-col',
        className
      )}
    >
      {/* 2026-05 design rework: previously this header rendered both
          "会话资料" AND a truncated copy of `title` underneath. The
          title was *also* rendered immediately below (avatar + title
          card), so users saw the same string truncated to "...Sc"
          twice within 80px of each other — pure information
          redundancy. The panel now shows only the section name; the
          full conversation identity lives in the structured header
          card below (which has enough room to actually be readable). */}
      <div className="border-b px-4 py-3">
        <p className="text-sm font-semibold">{t('chat.contextTitle')}</p>
      </div>

      <ScrollArea className="min-w-0 min-h-0 flex-1">
        <div className="space-y-5 p-4">
          {/* 2026-05 design rework: split header into a 1-on-1
              variant and a structured MATCH_GROUP variant. The old
              code was a single flex row that worked OK for short
              peer names but mangled compound match titles like
              "Regeneron STS / Innovation Track · Science Fair
              Innovators × 全栈开发组" — 30+ chars in a 320px rail
              can't be displayed linearly. The match variant parses
              the title into (context, teamA, teamB) and stacks them
              vertically so each team name gets its own readable line
              with the × visually centered between them. */}
          {isDirect ? (
            <DirectHeader
              title={title}
              isMuted={isMuted}
              isArchived={isArchived}
              createdBySystem={conversation.createdBySystem}
              hasTeamMatch={Boolean(conversation.teamMatchId)}
              t={t}
            />
          ) : (
            <MatchGroupHeader
              title={title}
              participantCount={conversation.participantCount}
              isMuted={isMuted}
              isArchived={isArchived}
              createdBySystem={conversation.createdBySystem}
              hasTeamMatch={Boolean(conversation.teamMatchId)}
              t={t}
            />
          )}

          <Separator />

          <section className="space-y-3">
            <PreferenceRow
              icon={Pin}
              label={t('chat.pinConversation')}
              checked={isPinned}
              onCheckedChange={onPin}
            />
            <PreferenceRow
              icon={BellOff}
              label={t('chat.muteConversation')}
              checked={isMuted}
              onCheckedChange={onMute}
            />
            <PreferenceRow
              icon={Archive}
              label={t('chat.archiveConversation')}
              checked={isArchived}
              onCheckedChange={onArchive}
            />
          </section>

          <Separator />

          <section className="space-y-3">
            <div className="flex items-center justify-between">
              <h2 className="text-sm font-semibold">{t('chat.members')}</h2>
              <Badge variant="outline">{participants.length}</Badge>
            </div>
            {isLoading ? (
              <div className="space-y-2">
                <Skeleton className="h-10 w-full" />
                <Skeleton className="h-10 w-full" />
              </div>
            ) : (
              <div className="space-y-2">
                {participants.map((participant) => {
                  const displayName = getDisplayName(participant);
                  return (
                    <div
                      key={participant.id}
                      className="flex items-center gap-3 rounded-md border bg-background/50 p-2"
                    >
                      <Avatar className="h-8 w-8 border">
                        <AvatarImage src={participant.profile?.avatarUrl} />
                        <AvatarFallback>{displayName[0]?.toUpperCase() || '?'}</AvatarFallback>
                      </Avatar>
                      <div className="min-w-0 flex-1">
                        <p className="flex items-center gap-1 truncate text-sm font-medium">
                          {displayName}
                          {participant.role === 'VERIFIED' && (
                            <VerificationIcon verified size="sm" />
                          )}
                        </p>
                        {/* 2026-05 design rework: previous fallback chain
                            was `targetMajor || currentSchool || "成员"` —
                            but `targetMajor` is the LEAST contextually
                            clear of the three (a user with major="Business"
                            renders as just "Business" next to peers
                            showing "成员", producing the inconsistent
                            triplet "成员 / Business / 成员" that confused
                            users about what the subtitle meant).
                            Cleaner ranking:
                              1. School name — reads naturally as a school
                                 (e.g. "Stanford University").
                              2. Role-aware label — admins/business/verified
                                 get their own clear label; everyone else
                                 falls back to generic "成员".
                            Major is intentionally dropped from this
                            subtitle; users who want to see a peer's major
                            can click through to the profile. */}
                        <p className="truncate text-xs text-muted-foreground">
                          {participant.profile?.currentSchool || roleLabel(participant.role, t)}
                        </p>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </section>

          <Separator />

          <section className="space-y-3">
            <div className="flex items-center justify-between">
              <h2 className="text-sm font-semibold">{t('chat.sharedFiles')}</h2>
              <Badge variant="outline">{files.length}</Badge>
            </div>
            {files.length ? (
              <div className="space-y-2">
                {files.slice(0, 8).map((file) => {
                  const safeUrl = isSafeUrl(file.url);
                  const content = (
                    <>
                      <FileText className="h-4 w-4 shrink-0 text-muted-foreground" />
                      <span className="truncate">{file.name}</span>
                    </>
                  );

                  return safeUrl ? (
                    <a
                      key={file.id}
                      href={file.url}
                      target="_blank"
                      rel="noreferrer"
                      className="flex items-center gap-2 rounded-md border bg-background/50 px-3 py-2 text-sm hover:bg-muted/60"
                    >
                      {content}
                    </a>
                  ) : (
                    <div
                      key={file.id}
                      className="flex items-center gap-2 rounded-md border bg-background/50 px-3 py-2 text-sm text-muted-foreground"
                    >
                      {content}
                    </div>
                  );
                })}
              </div>
            ) : (
              <p className="rounded-md border bg-background/50 px-3 py-4 text-center text-sm text-muted-foreground">
                {t('chat.noSharedFiles')}
              </p>
            )}
          </section>

          {isDirect && (
            <>
              <Separator />
              <section className="space-y-2">
                <Button
                  variant="outline"
                  size="sm"
                  className="w-full justify-start"
                  onClick={onReport}
                >
                  <Flag className="h-4 w-4" />
                  {t('chat.reportUser')}
                </Button>
                <Button
                  variant="soft-destructive"
                  size="sm"
                  className="w-full justify-start"
                  onClick={onBlock}
                >
                  {t('chat.blockUser')}
                </Button>
              </section>
            </>
          )}
        </div>
      </ScrollArea>
    </aside>
  );
}

type T = ReturnType<typeof useTranslations>;

/**
 * Role → human-readable label. Returns localized strings via the
 * passed-in translator. Falls back to generic "chat.member" so the
 * member list never shows a raw enum value to the user.
 */
function roleLabel(role: ChatUser['role'], t: T): string {
  switch (role) {
    case 'ADMIN':
      return t('chat.roleAdmin');
    case 'VERIFIED':
      return t('chat.roleVerified');
    default:
      return t('chat.member');
  }
}

/**
 * Status badges shared by both header variants — kept together so
 * the two headers display the same set in the same order.
 */
function StatusBadges({
  createdBySystem,
  hasTeamMatch,
  isMuted,
  isArchived,
  t,
}: {
  createdBySystem?: boolean;
  hasTeamMatch: boolean;
  isMuted: boolean;
  isArchived: boolean;
  t: T;
}) {
  if (!createdBySystem && !hasTeamMatch && !isMuted && !isArchived) return null;
  return (
    <div className="flex flex-wrap gap-2">
      {createdBySystem && <Badge variant="info">{t('chat.systemMatched')}</Badge>}
      {hasTeamMatch && <Badge variant="secondary">{t('chat.teamMatch')}</Badge>}
      {isMuted && <Badge variant="outline">{t('chat.muted')}</Badge>}
      {isArchived && <Badge variant="outline">{t('chat.archived')}</Badge>}
    </div>
  );
}

/**
 * 1-on-1 conversation header. Single row with avatar + peer name,
 * because there's no compound structure to display.
 */
function DirectHeader({
  title,
  createdBySystem,
  hasTeamMatch,
  isMuted,
  isArchived,
  t,
}: {
  title: string;
  createdBySystem?: boolean;
  hasTeamMatch: boolean;
  isMuted: boolean;
  isArchived: boolean;
  t: T;
}) {
  return (
    <section className="space-y-3">
      <div className="flex min-w-0 items-center gap-3">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-md border bg-muted/40">
          <ShieldCheck className="h-5 w-5 text-primary" />
        </div>
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-medium">{title}</p>
          <p className="text-xs text-muted-foreground">{t('chat.directConversation')}</p>
        </div>
      </div>
      <StatusBadges
        createdBySystem={createdBySystem}
        hasTeamMatch={hasTeamMatch}
        isMuted={isMuted}
        isArchived={isArchived}
        t={t}
      />
    </section>
  );
}

/**
 * MATCH_GROUP conversation header. Parses the compound title into
 * (context, teamA, teamB) and renders each piece in its own readable
 * slot:
 *
 *   ┌──────────────────────────────┐
 *   │ [icon] context badge         │   ← e.g. "Regeneron STS / Innovation Track"
 *   │                              │
 *   │ ┌─────────────────────────┐  │
 *   │ │  Science Fair Innovators │  │  ← team A on its own line, free to wrap
 *   │ └─────────────────────────┘  │
 *   │            × vs              │
 *   │ ┌─────────────────────────┐  │
 *   │ │  全栈开发组               │  │  ← team B on its own line
 *   │ └─────────────────────────┘  │
 *   │                              │
 *   │ [系统匹配] [团队匹配]         │
 *   └──────────────────────────────┘
 *
 * Falls back to the linear single-line layout when the title doesn't
 * follow the canonical "ctx · A × B" shape (e.g. legacy free-form
 * group names) — see parseMatchTitle for the parsing rules.
 */
function MatchGroupHeader({
  title,
  participantCount,
  createdBySystem,
  hasTeamMatch,
  isMuted,
  isArchived,
  t,
}: {
  title: string;
  participantCount: number;
  createdBySystem?: boolean;
  hasTeamMatch: boolean;
  isMuted: boolean;
  isArchived: boolean;
  t: T;
}) {
  const parsed = parseMatchTitle(title);
  const structured = parsed.teamA && parsed.teamB;

  return (
    <section className="space-y-3">
      <div className="flex min-w-0 items-start gap-3">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-md border bg-muted/40">
          <Users className="h-5 w-5 text-primary" />
        </div>
        <div className="min-w-0 flex-1 space-y-1">
          {parsed.context && (
            <p
              className="break-words text-xs font-medium uppercase tracking-wide text-muted-foreground"
              title={parsed.context}
            >
              {parsed.context}
            </p>
          )}
          <p className="text-xs text-muted-foreground">
            {t('chat.participants', { count: participantCount })}
          </p>
        </div>
      </div>

      {structured ? (
        <div className="space-y-1.5">
          <div
            className="rounded-md border bg-background/70 px-3 py-2 text-sm font-medium leading-snug break-words"
            title={parsed.teamA ?? undefined}
          >
            {parsed.teamA}
          </div>
          <div
            className="flex items-center gap-2 px-1 text-overline text-muted-foreground"
            aria-hidden="true"
          >
            <span className="h-px flex-1 bg-border" />
            {t('chat.matchVs')}
            <span className="h-px flex-1 bg-border" />
          </div>
          <div
            className="rounded-md border bg-background/70 px-3 py-2 text-sm font-medium leading-snug break-words"
            title={parsed.teamB ?? undefined}
          >
            {parsed.teamB}
          </div>
        </div>
      ) : (
        // Legacy / free-form group title — render whole thing in a
        // wrap-capable block instead of truncating into oblivion.
        <p className="break-words text-sm font-medium leading-snug" title={parsed.title}>
          {parsed.title}
        </p>
      )}

      <StatusBadges
        createdBySystem={createdBySystem}
        hasTeamMatch={hasTeamMatch}
        isMuted={isMuted}
        isArchived={isArchived}
        t={t}
      />
    </section>
  );
}

function PreferenceRow({
  icon: Icon,
  label,
  checked,
  onCheckedChange,
}: {
  icon: ElementType;
  label: string;
  checked: boolean;
  onCheckedChange: () => void;
}) {
  return (
    <div className="flex items-center justify-between rounded-md border bg-background/50 px-3 py-2">
      <div className="flex min-w-0 items-center gap-2">
        <Icon className="h-4 w-4 shrink-0 text-muted-foreground" />
        <span className="truncate text-sm">{label}</span>
      </div>
      <Switch checked={checked} onCheckedChange={onCheckedChange} aria-label={label} />
    </div>
  );
}
