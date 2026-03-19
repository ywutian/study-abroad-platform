'use client';

import { useState, useRef, useCallback, useEffect, useLayoutEffect } from 'react';

interface UseChatScrollOptions {
  selectedConversation: string | null;
  messagesLoading: boolean;
  sortedMessagesLength: number;
  hasNextPage: boolean;
  isFetchingNextPage: boolean;
  fetchNextPage: () => void;
}

export function useChatScroll({
  selectedConversation,
  messagesLoading,
  sortedMessagesLength,
  hasNextPage,
  isFetchingNextPage,
  fetchNextPage,
}: UseChatScrollOptions) {
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const [isAtBottom, setIsAtBottom] = useState(true);
  const isAtBottomRef = useRef(true);
  const [hasNewMessage, setHasNewMessage] = useState(false);
  const pendingScrollRestore = useRef<number | null>(null);
  const rafId = useRef(0);
  const prevConvRef = useRef<string | null>(null);

  const scrollToBottom = useCallback((behavior: ScrollBehavior = 'smooth') => {
    const el = scrollContainerRef.current;
    if (el) el.scrollTo({ top: el.scrollHeight, behavior });
    setHasNewMessage(false);
  }, []);

  const handleScroll = useCallback(() => {
    cancelAnimationFrame(rafId.current);
    rafId.current = requestAnimationFrame(() => {
      const el = scrollContainerRef.current;
      if (!el) return;
      const atBottom = el.scrollHeight - el.scrollTop - el.clientHeight < 100;
      if (atBottom !== isAtBottomRef.current) {
        isAtBottomRef.current = atBottom;
        setIsAtBottom(atBottom);
      }
      if (atBottom) setHasNewMessage(false);
      if (el.scrollTop < 50 && hasNextPage && !isFetchingNextPage) {
        pendingScrollRestore.current = el.scrollHeight - el.scrollTop;
        fetchNextPage();
      }
    });
  }, [hasNextPage, isFetchingNextPage, fetchNextPage]);

  // Restore scroll position after older messages load
  useLayoutEffect(() => {
    if (pendingScrollRestore.current === null) return;
    const el = scrollContainerRef.current;
    if (el) el.scrollTop = el.scrollHeight - pendingScrollRestore.current;
    pendingScrollRestore.current = null;
  }, [sortedMessagesLength]);

  // Instant scroll when messages first load for a new conversation
  useEffect(() => {
    if (
      selectedConversation &&
      selectedConversation !== prevConvRef.current &&
      !messagesLoading &&
      sortedMessagesLength > 0
    ) {
      prevConvRef.current = selectedConversation;
      scrollToBottom('instant' as ScrollBehavior);
    }
  }, [selectedConversation, messagesLoading, sortedMessagesLength, scrollToBottom]);

  return {
    messagesEndRef,
    scrollContainerRef,
    isAtBottom,
    isAtBottomRef,
    hasNewMessage,
    setHasNewMessage,
    scrollToBottom,
    handleScroll,
  };
}
