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

import type { ChatContext, Conversation } from './types';
import { getConversationTitle, getDisplayName } from './utils';

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
      <div className="border-b px-4 py-3">
        <p className="text-sm font-semibold">{t('chat.contextTitle')}</p>
        <p className="mt-0.5 truncate text-xs text-muted-foreground">{title}</p>
      </div>

      <ScrollArea className="min-w-0 min-h-0 flex-1">
        <div className="space-y-5 p-4">
          <section className="space-y-3">
            {/* 2026-05 hotfix (follow-up to #217-#219): the avatar+title
                row needs BOTH defenses to actually truncate:
                  (a) parent flex container: `min-w-0` (so itself can
                      shrink below content's intrinsic width)
                  (b) the text wrapper: `min-w-0 flex-1`
                  (c) the fixed-size avatar: `shrink-0`
                The previous code had only `min-w-0` on the text
                wrapper. `min-w-0` alone PERMITS shrinking but doesn't
                FORCE the element to constrain — without `flex-1` it
                grew to fit the long title (e.g. "Regeneron STS /
                Innovation Track · Science Fair Innovators × 全栈开发组")
                and pushed the whole row past the viewport. The
                truncate ellipsis never appeared on this row because
                the element was wider than the panel; the visual cut
                at the viewport edge was just <main>'s production
                overflow-x-clip hiding the overflow.

                The members section below (line ~167) had the correct
                `min-w-0 flex-1` combo all along — proof this is the
                canonical pattern for flex-row + truncate. */}
            <div className="flex min-w-0 items-center gap-3">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-md border bg-muted/40">
                {isDirect ? (
                  <ShieldCheck className="h-5 w-5 text-primary" />
                ) : (
                  <Users className="h-5 w-5 text-primary" />
                )}
              </div>
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium">{title}</p>
                <p className="text-xs text-muted-foreground">
                  {isDirect
                    ? t('chat.directConversation')
                    : t('chat.participants', { count: conversation.participantCount })}
                </p>
              </div>
            </div>
            <div className="flex flex-wrap gap-2">
              {conversation.createdBySystem && (
                <Badge variant="info">{t('chat.systemMatched')}</Badge>
              )}
              {conversation.teamMatchId && <Badge variant="secondary">{t('chat.teamMatch')}</Badge>}
              {isMuted && <Badge variant="outline">{t('chat.muted')}</Badge>}
              {isArchived && <Badge variant="outline">{t('chat.archived')}</Badge>}
            </div>
          </section>

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
                        {/* 2026-05 PII fix: subtitle prefers profile signals
                            (major / school / role). Email is intentionally
                            NOT in this fallback chain — even the backend's
                            masked form ("o***@d***.com") reads as noise here.
                            For peers without any profile, fall back to a
                            generic "成员" / "Member" label. */}
                        <p className="truncate text-xs text-muted-foreground">
                          {participant.profile?.targetMajor ||
                            participant.profile?.currentSchool ||
                            t('chat.member')}
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
