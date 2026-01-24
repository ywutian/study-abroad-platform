'use client';

import { useRef, useEffect } from 'react';
import { useTranslations, useLocale } from 'next-intl';
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { LoadingState } from '@/components/ui/loading-state';
import { TypingIndicator } from '@/components/features';
import { cn } from '@/lib/utils';
import { fadeInUp } from '@/lib/motion';
import { ChevronDown, MessageSquare, Loader2 } from 'lucide-react';
import type { Message, Conversation } from './types';
import { ChatMessageBubble } from './ChatMessageBubble';
import { shouldShowDateSeparator, getDateLabel } from './utils';

interface ChatMessageAreaProps {
  messages: Message[];
  isLoading: boolean;
  selectedUser: Conversation['otherUser'];
  otherReadAt: string | null;
  isOtherUserTyping: boolean;
  hasNewMessage: boolean;
  isAtBottom: boolean;
  isFetchingNextPage: boolean;
  scrollContainerRef: React.RefObject<HTMLDivElement | null>;
  messagesEndRef: React.RefObject<HTMLDivElement | null>;
  onScrollToBottom: () => void;
  onScroll: () => void;
  onDeleteMessage: (id: string) => void;
  onRecallMessage: (id: string) => void;
  onCopyMessage: (content: string) => void;
  onReportMessage: (id: string) => void;
}

export function ChatMessageArea({
  messages,
  isLoading,
  selectedUser,
  otherReadAt,
  isOtherUserTyping,
  hasNewMessage,
  isAtBottom,
  isFetchingNextPage,
  scrollContainerRef,
  messagesEndRef,
  onScrollToBottom,
  onScroll,
  onDeleteMessage,
  onRecallMessage,
  onCopyMessage,
  onReportMessage,
}: ChatMessageAreaProps) {
  const t = useTranslations();
  const locale = useLocale();
  const prefersReducedMotion = useReducedMotion();

  // Track which messages existed on initial load (skip animation for them)
  const initialIdsRef = useRef<Set<string>>(new Set());
  useEffect(() => {
    if (!isLoading && messages.length > 0 && initialIdsRef.current.size === 0) {
      initialIdsRef.current = new Set(messages.map((m) => m.id));
    }
  }, [isLoading, messages]);

  // Reset initial IDs when conversation changes (messages become empty then repopulate)
  useEffect(() => {
    if (messages.length === 0) {
      initialIdsRef.current = new Set();
    }
  }, [messages.length]);

  if (isLoading) {
    return (
      <div className="flex-1 min-h-0 overflow-y-auto p-4">
        <LoadingState variant="list" count={5} />
      </div>
    );
  }

  if (!messages.length) {
    return (
      <div className="flex-1 min-h-0 overflow-y-auto p-4">
        <div className="flex h-full items-center justify-center">
          <div className="text-center">
            <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-muted">
              <MessageSquare className="h-6 w-6 text-muted-foreground" />
            </div>
            <p className="text-muted-foreground">{t('chat.startConversation')}</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div
      ref={scrollContainerRef}
      onScroll={onScroll}
      role="log"
      aria-label={t('chat.title')}
      className="flex-1 min-h-0 overflow-y-auto p-4 relative"
    >
      <div className="space-y-3">
        {/* 加载更多 spinner */}
        {isFetchingNextPage && (
          <div className="flex justify-center py-2">
            <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
          </div>
        )}

        {messages.map((msg, index) => {
          const isOwn = msg.senderId !== selectedUser?.id;
          const showDateSep = shouldShowDateSeparator(messages, index);
          const isNew = !initialIdsRef.current.has(msg.id);

          return (
            <div key={msg.id} role="article">
              {/* 日期分隔线 */}
              {showDateSep && (
                <div className="flex items-center gap-3 my-4">
                  <div className="flex-1 h-px bg-border" />
                  <span className="text-2xs text-muted-foreground font-medium px-2">
                    {getDateLabel(msg.createdAt, locale, t)}
                  </span>
                  <div className="flex-1 h-px bg-border" />
                </div>
              )}

              <ChatMessageBubble
                message={msg}
                isOwn={isOwn}
                isNew={isNew && !prefersReducedMotion}
                selectedUser={selectedUser}
                otherReadAt={otherReadAt}
                onDelete={onDeleteMessage}
                onRecall={onRecallMessage}
                onCopy={onCopyMessage}
                onReportMessage={onReportMessage}
              />
            </div>
          );
        })}

        {/* 正在输入提示 */}
        <AnimatePresence>
          {isOtherUserTyping && (
            <motion.div
              initial={prefersReducedMotion ? false : { opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={prefersReducedMotion ? undefined : { opacity: 0, y: -10 }}
              className="flex gap-3"
              aria-live="polite"
            >
              <Avatar className="h-8 w-8 shrink-0 border">
                <AvatarFallback className="bg-muted text-sm">
                  {selectedUser?.email?.[0]?.toUpperCase()}
                </AvatarFallback>
              </Avatar>
              <div className="bg-muted rounded-lg rounded-bl-md px-4 py-3">
                <TypingIndicator />
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        <div ref={messagesEndRef} />
      </div>

      {/* 滚动到底部按钮 — 不在底部时常驻显示 */}
      <AnimatePresence>
        {!isAtBottom && (
          <motion.div
            variants={fadeInUp}
            initial="hidden"
            animate="visible"
            exit="hidden"
            className="sticky bottom-2 flex justify-center pointer-events-none"
          >
            <Button
              size="sm"
              variant={hasNewMessage ? 'default' : 'secondary'}
              onClick={onScrollToBottom}
              className="gap-1.5 rounded-full shadow-lg pointer-events-auto"
              aria-label={t('chat.newMessages')}
            >
              <ChevronDown className="h-4 w-4" />
              {hasNewMessage ? t('chat.newMessages') : null}
            </Button>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
