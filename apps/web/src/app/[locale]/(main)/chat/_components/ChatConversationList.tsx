'use client';

import type { ElementType } from 'react';
import { useTranslations, useLocale } from 'next-intl';
import { motion, AnimatePresence } from 'framer-motion';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { ScrollArea } from '@/components/ui/scroll-area';
import { LoadingState } from '@/components/ui/loading-state';
import { CountBadge } from '@/components/ui/count-badge';
import { Badge } from '@/components/ui/badge';
import { VerificationIcon } from '@/components/features';
import { cn } from '@/lib/utils';
import { staggerContainerFast, staggerItemSlide } from '@/lib/motion';
import { Archive, BellOff, Inbox, MessageSquare, Pin, Search, Users } from 'lucide-react';
import type { Conversation, ConversationFilter } from './types';
import { getConversationTitle, getDisplayName, formatTime } from './utils';

interface ChatConversationListProps {
  conversations: Conversation[];
  selectedId: string | null;
  totalUnread: number;
  searchQuery: string;
  filter: ConversationFilter;
  onSearchChange: (query: string) => void;
  onFilterChange: (filter: ConversationFilter) => void;
  onSelect: (id: string) => void;
  isLoading: boolean;
  isUserOnline: (userId: string) => boolean;
  showConversations: boolean;
}

const FILTERS: Array<{ value: ConversationFilter; icon: ElementType }> = [
  { value: 'all', icon: Inbox },
  { value: 'unread', icon: MessageSquare },
  { value: 'pinned', icon: Pin },
  { value: 'direct', icon: Users },
  { value: 'groups', icon: Users },
  { value: 'archived', icon: Archive },
];

export function ChatConversationList({
  conversations,
  selectedId,
  totalUnread,
  searchQuery,
  filter,
  onSearchChange,
  onFilterChange,
  onSelect,
  isLoading,
  isUserOnline,
  showConversations,
}: ChatConversationListProps) {
  const t = useTranslations();
  const locale = useLocale();

  return (
    <Card
      className={cn(
        // 2026-05 chat layout fix: `min-w-0` is mandatory on grid items
        // — CSS Grid defaults to `min-width: auto` which refuses to
        // shrink below the item's intrinsic content width. Without it,
        // a long conversation title here forces the cell wider than
        // the grid template's `minmax(280px, 360px)` allocation, which
        // then cascades to clip the right panel.
        'min-w-0 overflow-hidden flex flex-col min-h-0 py-0 gap-0',
        !showConversations && 'hidden lg:flex'
      )}
    >
      <div className="border-b px-4 py-3 space-y-3 shrink-0 bg-card/95">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <MessageSquare className="h-4 w-4 text-primary" />
            <span className="text-sm font-semibold">{t('chat.conversations')}</span>
          </div>
          <Badge variant={totalUnread ? 'default' : 'outline'} className="h-6">
            {t('chat.unreadCount', { count: totalUnread })}
          </Badge>
        </div>
        <div className="relative">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder={t('chat.searchConversations')}
            value={searchQuery}
            onChange={(e) => onSearchChange(e.target.value)}
            className="pl-9 h-9"
            aria-label={t('chat.searchConversations')}
          />
        </div>
        <div className="grid grid-cols-3 gap-1">
          {FILTERS.map((item) => {
            const Icon = item.icon;
            const active = filter === item.value;
            return (
              <button
                key={item.value}
                type="button"
                onClick={() => onFilterChange(item.value)}
                className={cn(
                  'flex h-10 items-center justify-center gap-1 rounded-md border px-2 text-xs transition-colors sm:h-8',
                  active
                    ? 'border-primary/30 bg-primary/10 text-primary'
                    : 'border-transparent text-muted-foreground hover:bg-muted/70 hover:text-foreground'
                )}
              >
                <Icon className="h-3.5 w-3.5" />
                <span className="truncate">{t(`chat.filters.${item.value}`)}</span>
              </button>
            );
          })}
        </div>
      </div>
      <div className="flex-1 min-h-0">
        <ScrollArea className="h-full">
          {isLoading ? (
            <div className="space-y-2 p-4">
              <LoadingState variant="list" count={5} />
            </div>
          ) : conversations.length ? (
            <div className="divide-y" role="listbox" aria-label={t('chat.conversations')}>
              <AnimatePresence>
                <motion.div variants={staggerContainerFast} initial="hidden" animate="show">
                  {conversations.map((conv) => {
                    const isDirect = conv.kind === 'DIRECT';
                    const isOnline =
                      isDirect && conv.otherUser ? isUserOnline(conv.otherUser.id) : false;
                    const displayName = getConversationTitle(conv);
                    const isVerified = conv.otherUser?.role === 'VERIFIED';
                    const isSelected = selectedId === conv.id;
                    const groupAvatar = Array.isArray(conv.avatarSummary)
                      ? conv.avatarSummary.find(Boolean)
                      : undefined;
                    const fallbackInitial =
                      conv.kind === 'MATCH_GROUP'
                        ? 'G'
                        : getDisplayName(conv.otherUser)?.[0]?.toUpperCase() || '?';
                    const avatarSrc =
                      conv.kind === 'DIRECT'
                        ? (conv.otherUser?.profile?.avatarUrl ?? undefined)
                        : (groupAvatar ?? undefined);

                    return (
                      <motion.div
                        key={conv.id}
                        variants={staggerItemSlide}
                        role="option"
                        aria-selected={isSelected}
                        tabIndex={0}
                        className={cn(
                          'flex cursor-pointer items-center gap-3 border-l-2 border-l-transparent px-3 py-3 transition-all hover:bg-muted/50',
                          isSelected && 'bg-primary/10 border-l-primary'
                        )}
                        onClick={() => onSelect(conv.id)}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter' || e.key === ' ') {
                            e.preventDefault();
                            onSelect(conv.id);
                          }
                        }}
                      >
                        <div className="relative">
                          <Avatar className="h-11 w-11 border-2 border-background shadow">
                            <AvatarImage src={avatarSrc} />
                            <AvatarFallback className="bg-primary text-white font-medium">
                              {fallbackInitial}
                            </AvatarFallback>
                          </Avatar>
                          {isDirect ? (
                            <>
                              <span
                                className={cn(
                                  'absolute bottom-0 right-0 h-3 w-3 rounded-full border-2 border-background',
                                  isOnline ? 'bg-emerald-500' : 'bg-muted-foreground'
                                )}
                                aria-hidden="true"
                              />
                              <span className="sr-only">
                                {isOnline ? t('chat.online') : t('chat.offline')}
                              </span>
                            </>
                          ) : (
                            <span className="absolute -bottom-1 -right-1 rounded-full border border-background bg-background p-1 text-muted-foreground">
                              <Users className="h-3 w-3" />
                            </span>
                          )}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center justify-between">
                            <span className="font-medium truncate flex items-center gap-1 text-sm">
                              {conv.isPinned && (
                                <Pin className="h-3 w-3 text-muted-foreground shrink-0" />
                              )}
                              {conv.isMuted && (
                                <BellOff className="h-3 w-3 text-muted-foreground shrink-0" />
                              )}
                              {displayName}
                              {isDirect && isVerified && <VerificationIcon verified size="sm" />}
                            </span>
                            <span className="text-xs text-muted-foreground">
                              {formatTime(conv.updatedAt, locale)}
                            </span>
                          </div>
                          <p className="text-sm text-muted-foreground truncate">
                            {conv.lastMessage?.isRecalled
                              ? t('chat.messageRecalled')
                              : conv.lastMessage?.isDeleted
                                ? t('chat.messageDeleted')
                                : conv.lastMessage?.content ||
                                  (conv.kind === 'MATCH_GROUP'
                                    ? t('chat.participants', { count: conv.participantCount })
                                    : t('chat.noMessages'))}
                          </p>
                        </div>
                        <CountBadge count={conv.unreadCount} variant="primary" />
                      </motion.div>
                    );
                  })}
                </motion.div>
              </AnimatePresence>
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center py-12 px-4">
              <div className="flex h-16 w-16 items-center justify-center rounded-lg bg-primary/10 mb-4">
                <MessageSquare className="h-8 w-8 text-primary/50" />
              </div>
              <p className="font-medium text-center">{t('chat.noMessages')}</p>
              <p className="text-sm text-muted-foreground text-center mt-1">
                {t('chat.mutualFollowRequired')}
              </p>
            </div>
          )}
        </ScrollArea>
      </div>
    </Card>
  );
}
