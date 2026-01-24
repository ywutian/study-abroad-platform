'use client';

import { useTranslations, useLocale } from 'next-intl';
import { motion, AnimatePresence } from 'framer-motion';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { ScrollArea } from '@/components/ui/scroll-area';
import { LoadingState } from '@/components/ui/loading-state';
import { CountBadge } from '@/components/ui/count-badge';
import { VerificationIcon } from '@/components/features';
import { cn } from '@/lib/utils';
import { staggerContainerFast, staggerItemSlide } from '@/lib/motion';
import { Users, Search, MessageSquare, Pin } from 'lucide-react';
import type { Conversation } from './types';
import { getDisplayName, formatTime } from './utils';

interface ChatConversationListProps {
  conversations: Conversation[];
  selectedId: string | null;
  totalUnread: number;
  searchQuery: string;
  onSearchChange: (query: string) => void;
  onSelect: (id: string) => void;
  isLoading: boolean;
  isUserOnline: (userId: string) => boolean;
  showConversations: boolean;
}

export function ChatConversationList({
  conversations,
  selectedId,
  totalUnread,
  searchQuery,
  onSearchChange,
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
        'md:col-span-1 overflow-hidden flex flex-col min-h-0 py-0 gap-0',
        !showConversations && 'hidden md:flex'
      )}
    >
      <div className="h-1 bg-primary shrink-0" />
      <div className="border-b px-4 py-3 space-y-3 shrink-0">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Users className="h-5 w-5 text-blue-500" />
            <span className="text-lg font-semibold">{t('chat.conversations')}</span>
          </div>
          <CountBadge count={totalUnread} variant="primary" size="sm" />
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
                    const isOnline = isUserOnline(conv.otherUser?.id || '');
                    const displayName = getDisplayName(conv.otherUser);
                    const isVerified = conv.otherUser?.role === 'VERIFIED';
                    const isSelected = selectedId === conv.id;

                    return (
                      <motion.div
                        key={conv.id}
                        variants={staggerItemSlide}
                        role="option"
                        aria-selected={isSelected}
                        tabIndex={0}
                        className={cn(
                          'flex cursor-pointer items-center gap-3 p-4 transition-all hover:bg-muted/50',
                          isSelected && 'bg-primary/10 border-l-2 border-l-blue-500'
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
                            <AvatarImage src={conv.otherUser?.profile?.avatarUrl} />
                            <AvatarFallback className="bg-primary text-white font-medium">
                              {displayName?.[0]?.toUpperCase() || '?'}
                            </AvatarFallback>
                          </Avatar>
                          <span
                            className={cn(
                              'absolute bottom-0 right-0 h-3 w-3 rounded-full border-2 border-background',
                              isOnline ? 'bg-emerald-500' : 'bg-gray-400'
                            )}
                            aria-hidden="true"
                          />
                          <span className="sr-only">
                            {isOnline ? t('chat.online') : t('chat.offline')}
                          </span>
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center justify-between">
                            <span className="font-medium truncate flex items-center gap-1">
                              {conv.isPinned && (
                                <Pin className="h-3 w-3 text-muted-foreground shrink-0" />
                              )}
                              {displayName}
                              {isVerified && <VerificationIcon verified size="sm" />}
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
                                : conv.lastMessage?.content || t('chat.noMessages')}
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
              <div className="flex h-16 w-16 items-center justify-center rounded-lg bg-blue-500/10 mb-4">
                <MessageSquare className="h-8 w-8 text-blue-500/50" />
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
