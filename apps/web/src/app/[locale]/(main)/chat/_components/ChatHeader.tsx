'use client';

import { useTranslations } from 'next-intl';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { UserProfileCard, VerificationIcon } from '@/components/features';
import { cn } from '@/lib/utils';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Archive, ArrowLeft, BellOff, MoreVertical, Flag, Ban, Pin, Users } from 'lucide-react';
import type { Conversation } from './types';
import { getConversationTitle, getDisplayName } from './utils';

interface ChatHeaderProps {
  conversation: Conversation;
  isOnline: boolean;
  isPinned: boolean;
  isArchived?: boolean;
  isMuted?: boolean;
  onBack: () => void;
  onPin: () => void;
  onArchive: () => void;
  onMute: () => void;
  onReport: () => void;
  onBlock: () => void;
}

export function ChatHeader({
  conversation,
  isOnline,
  isPinned,
  isArchived,
  isMuted,
  onBack,
  onPin,
  onArchive,
  onMute,
  onReport,
  onBlock,
}: ChatHeaderProps) {
  const t = useTranslations();
  const selectedUser = conversation.otherUser;
  const isDirect = conversation.kind === 'DIRECT';
  const title = getConversationTitle(conversation);

  return (
    // 2026-05 chat layout fix (follow-up to #214/#215): the inner title
    // wrapper already has `min-w-0 truncate`, but the ChatHeader root
    // itself sits as a flex item inside the middle column Card. Without
    // `min-w-0` here, a long title (e.g. "Regeneron STS / Innovation
    // Track · Science Fair Innovators × 全栈开发组") forces the header
    // wider than its grid column, which cascades and pushes the right
    // ContextPanel off-viewport — even with the column's own min-w-0.
    // Rule: every grid/flex child must be `min-w-0`, including the
    // outermost wrapper of nested components.
    <div className="min-w-0 border-b px-4 py-3 shrink-0 bg-card/95">
      <div className="flex min-w-0 items-center justify-between">
        <div className="flex min-w-0 items-center gap-3">
          <Button
            variant="ghost"
            size="icon"
            className="lg:hidden"
            onClick={onBack}
            aria-label={t('common.back')}
          >
            <ArrowLeft className="h-5 w-5" />
          </Button>
          {isDirect && selectedUser ? (
            <UserProfileCard user={selectedUser}>
              <div className="relative cursor-pointer">
                <Avatar className="h-10 w-10 border-2 border-background shadow">
                  <AvatarImage src={selectedUser.profile?.avatarUrl} />
                  <AvatarFallback className="bg-gradient-to-br bg-primary text-white font-medium">
                    {getDisplayName(selectedUser)?.[0]?.toUpperCase()}
                  </AvatarFallback>
                </Avatar>
                <span
                  className={cn(
                    'absolute bottom-0 right-0 h-2.5 w-2.5 rounded-full border-2 border-background',
                    isOnline ? 'bg-emerald-500' : 'bg-muted-foreground'
                  )}
                  aria-hidden="true"
                />
                <span className="sr-only">{isOnline ? t('chat.online') : t('chat.offline')}</span>
              </div>
            </UserProfileCard>
          ) : (
            <div className="flex h-10 w-10 items-center justify-center rounded-full border bg-muted/50 text-muted-foreground">
              <Users className="h-5 w-5" />
            </div>
          )}
          <div className="min-w-0">
            <p className="font-medium flex items-center gap-1 truncate">
              {title}
              {isDirect && selectedUser?.role === 'VERIFIED' && (
                <VerificationIcon verified size="sm" />
              )}
              {isMuted && <BellOff className="h-3.5 w-3.5 text-muted-foreground" />}
            </p>
            <p className={cn('text-xs', isOnline ? 'text-emerald-500' : 'text-muted-foreground')}>
              {isDirect
                ? isOnline
                  ? t('chat.online')
                  : t('chat.offline')
                : t('chat.participants', { count: conversation.participantCount })}
            </p>
          </div>
        </div>

        <div className="hidden items-center gap-1 md:flex">
          <Button
            variant="ghost"
            size="icon-sm"
            onClick={onPin}
            aria-label={t('chat.pinConversation')}
          >
            <Pin className={cn('h-4 w-4', isPinned && 'text-primary')} />
          </Button>
          <Button
            variant="ghost"
            size="icon-sm"
            onClick={onMute}
            aria-label={t('chat.muteConversation')}
          >
            <BellOff className={cn('h-4 w-4', isMuted && 'text-primary')} />
          </Button>
          <Button
            variant="ghost"
            size="icon-sm"
            onClick={onArchive}
            aria-label={t('chat.archiveConversation')}
          >
            <Archive className={cn('h-4 w-4', isArchived && 'text-primary')} />
          </Button>
        </div>

        {/* 操作菜单 */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="icon" aria-label={t('common.more')}>
              <MoreVertical className="h-4 w-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem onClick={onPin} className="gap-2">
              <Pin className="h-4 w-4" />
              {isPinned ? t('chat.unpinConversation') : t('chat.pinConversation')}
            </DropdownMenuItem>
            <DropdownMenuItem onClick={onMute} className="gap-2">
              <BellOff className="h-4 w-4" />
              {isMuted ? t('chat.unmuteConversation') : t('chat.muteConversation')}
            </DropdownMenuItem>
            <DropdownMenuItem onClick={onArchive} className="gap-2">
              <Archive className="h-4 w-4" />
              {isArchived ? t('chat.unarchiveConversation') : t('chat.archiveConversation')}
            </DropdownMenuItem>
            {isDirect && (
              <>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={onReport} className="gap-2">
                  <Flag className="h-4 w-4" />
                  {t('chat.reportUser')}
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem
                  onClick={onBlock}
                  className="gap-2 text-destructive focus:text-destructive"
                >
                  <Ban className="h-4 w-4" />
                  {t('chat.blockUser')}
                </DropdownMenuItem>
              </>
            )}
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </div>
  );
}
