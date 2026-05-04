'use client';

import { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { useTranslations } from 'next-intl';
import { useSearchParams } from 'next/navigation';
import {
  useQuery,
  useInfiniteQuery,
  useQueryClient,
  useMutation,
  type InfiniteData,
} from '@tanstack/react-query';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { apiClient } from '@/lib/api';
import { PageContainer } from '@/components/layout';
import { MessageInput } from '@/components/features';
import { useChatSocket } from '@/hooks/use-chat-socket';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';
import { chatRoutes } from '@study-abroad/shared';
import { MessageSquare, Wifi, WifiOff } from 'lucide-react';
import { useAuthStore } from '@/stores';

import type { Message, Conversation, ReportTarget } from './_components/types';
import { ChatConversationList } from './_components/ChatConversationList';
import { ChatHeader } from './_components/ChatHeader';
import { ChatMessageArea } from './_components/ChatMessageArea';
import { ReportDialog } from './_components/ReportDialog';
import { BlockDialog } from './_components/BlockDialog';
import { useChatScroll } from './_components/use-chat-scroll';
import { getConversationTitle } from './_components/utils';

export default function ChatPage() {
  const t = useTranslations();
  const queryClient = useQueryClient();
  const searchParams = useSearchParams();
  const currentUserId = useAuthStore((state) => state.user?.id ?? null);

  // ── UI State ──────────────────────────────────────────────
  const [selectedConversation, setSelectedConversation] = useState<string | null>(null);
  const [showConversations, setShowConversations] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [otherReadAt, setOtherReadAt] = useState<string | null>(null);

  // ── Dialog State ──────────────────────────────────────────
  const [reportDialogOpen, setReportDialogOpen] = useState(false);
  const [reportTarget, setReportTarget] = useState<ReportTarget | null>(null);
  const [blockDialogOpen, setBlockDialogOpen] = useState(false);

  // ── WebSocket ─────────────────────────────────────────────
  const {
    isConnected,
    sendMessage,
    joinConversation,
    markRead,
    sendTyping,
    getTypingUsers,
    isUserOnline,
  } = useChatSocket({
    onNewMessage: (message) => {
      if (message.conversationId === selectedConversation) {
        if (isAtBottomRef.current) {
          setTimeout(() => scrollToBottom(), 100);
          queryClient.setQueryData<Conversation[]>(['conversations'], (old) =>
            old?.map((c) => (c.id === selectedConversation ? { ...c, unreadCount: 0 } : c))
          );
          markRead(selectedConversation).then(() => {
            queryClient.invalidateQueries({ queryKey: ['conversations'] });
          });
        } else {
          setHasNewMessage(true);
        }
      }
      queryClient.invalidateQueries({ queryKey: ['unread-count'] });
    },
    onMessagesRead: (data) => {
      if (data.conversationId === selectedConversation) {
        setOtherReadAt(data.readAt);
      }
    },
    onMessageRecalled: (data) => {
      if (data.conversationId === selectedConversation) {
        queryClient.invalidateQueries({ queryKey: ['messages', selectedConversation] });
      }
    },
  });

  // ── Queries ───────────────────────────────────────────────
  const { data: conversationsData, isLoading } = useQuery({
    queryKey: ['conversations'],
    queryFn: () => apiClient.get<Conversation[]>(chatRoutes.conversations()),
  });
  const conversations = useMemo(
    () => (Array.isArray(conversationsData) ? conversationsData : []),
    [conversationsData]
  );

  // Auto-select conversation from URL param (e.g. /chat?conversation=xxx)
  const autoSelectedRef = useRef(false);
  const refetchedOnceRef = useRef(false);
  useEffect(() => {
    const conversationId = searchParams.get('conversation');
    if (!conversationId || autoSelectedRef.current || isLoading) return;

    const exists = conversations.some((c) => c.id === conversationId);
    if (exists) {
      setSelectedConversation(conversationId);
      setShowConversations(false);
      autoSelectedRef.current = true;
    } else if (!refetchedOnceRef.current) {
      // Conversation was just created, refetch list once
      refetchedOnceRef.current = true;
      queryClient.invalidateQueries({ queryKey: ['conversations'] });
    }
  }, [searchParams, conversations, isLoading, queryClient]);

  const totalUnread = useMemo(
    () => conversations.reduce((sum, c) => sum + (c.unreadCount || 0), 0),
    [conversations]
  );

  const {
    data: messagesPages,
    isLoading: messagesLoading,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
  } = useInfiniteQuery({
    queryKey: ['messages', selectedConversation],
    queryFn: ({ pageParam }: { pageParam: string | undefined }) =>
      apiClient.get<Message[]>(
        `/chats/conversations/${selectedConversation}/messages${pageParam ? `?before=${pageParam}` : ''}`
      ),
    initialPageParam: undefined as string | undefined,
    getNextPageParam: (lastPage: Message[]) =>
      lastPage.length >= 50 ? lastPage[lastPage.length - 1]?.id : undefined,
    enabled: !!selectedConversation,
  });

  // Fix: single useMemo for sorted messages (prevents reference instability)
  const sortedMessages = useMemo(() => {
    if (!messagesPages?.pages) return [];
    return messagesPages.pages.flatMap((page) => (Array.isArray(page) ? page : [])).reverse();
  }, [messagesPages?.pages]);

  // ── Mutations ─────────────────────────────────────────────
  const blockMutation = useMutation({
    mutationFn: (userId: string) => apiClient.post(chatRoutes.block(userId)),
    onSuccess: () => {
      toast.success(t('chat.blockSuccess'));
      setBlockDialogOpen(false);
      setSelectedConversation(null);
      setShowConversations(true);
      queryClient.invalidateQueries({ queryKey: ['conversations'] });
    },
  });

  const reportMutation = useMutation({
    mutationFn: (data: { targetType: string; targetId: string; reason: string; detail?: string }) =>
      apiClient.post(chatRoutes.report(), data),
    onSuccess: () => {
      toast.success(t('chat.reportSuccess'));
      setReportDialogOpen(false);
      setReportTarget(null);
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (messageId: string) => apiClient.delete(chatRoutes.message(messageId)),
    onSuccess: (_data, messageId) => {
      queryClient.setQueryData<InfiniteData<Message[], string | undefined>>(
        ['messages', selectedConversation],
        (old) => {
          if (!old?.pages) return old;
          return {
            ...old,
            pages: old.pages.map((page) =>
              page.map((m) => (m.id === messageId ? { ...m, isDeleted: true } : m))
            ),
          };
        }
      );
    },
  });

  const recallMutation = useMutation({
    mutationFn: (messageId: string) => apiClient.patch(`${chatRoutes.message(messageId)}/recall`),
    onSuccess: (_data, messageId) => {
      queryClient.setQueryData<InfiniteData<Message[], string | undefined>>(
        ['messages', selectedConversation],
        (old) => {
          if (!old?.pages) return old;
          return {
            ...old,
            pages: old.pages.map((page) =>
              page.map((m) => (m.id === messageId ? { ...m, isRecalled: true, content: '' } : m))
            ),
          };
        }
      );
      toast.success(t('chat.recallSuccess'));
    },
    onError: () => {
      toast.error(t('chat.recallTimeExpired'));
    },
  });

  const pinMutation = useMutation({
    mutationFn: (conversationId: string) =>
      apiClient.post<{ isPinned: boolean }>(chatRoutes.conversationPin(conversationId)),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['conversations'] });
    },
  });

  // ── Scroll Logic (extracted hook) ─────────────────────────
  const {
    messagesEndRef,
    scrollContainerRef,
    isAtBottom,
    isAtBottomRef,
    hasNewMessage,
    setHasNewMessage,
    scrollToBottom,
    handleScroll,
  } = useChatScroll({
    selectedConversation,
    messagesLoading,
    sortedMessagesLength: sortedMessages.length,
    hasNextPage: hasNextPage ?? false,
    isFetchingNextPage,
    fetchNextPage,
  });

  // Join conversation + mark as read
  useEffect(() => {
    if (selectedConversation) {
      joinConversation(selectedConversation);
      setOtherReadAt(null);
      queryClient.setQueryData<Conversation[]>(['conversations'], (old) =>
        old?.map((c) => (c.id === selectedConversation ? { ...c, unreadCount: 0 } : c))
      );
      queryClient.invalidateQueries({ queryKey: ['unread-count'] });
      markRead(selectedConversation).then(() => {
        queryClient.invalidateQueries({ queryKey: ['conversations'] });
      });
    }
  }, [selectedConversation, joinConversation, markRead, queryClient]);

  // ── Derived (needed by handlers) ─────────────────────────────
  const selectedConversationData =
    conversations.find((conversation) => conversation.id === selectedConversation) ?? null;
  const selectedUser = selectedConversationData?.otherUser ?? null;

  // ── Stable Handlers ─────────────────────────────────────────
  const handleSelectConversation = useCallback((id: string) => {
    setSelectedConversation(id);
    setShowConversations(false);
    setHasNewMessage(false);
  }, []);

  const handleBack = useCallback(() => {
    setShowConversations(true);
    setSelectedConversation(null);
  }, []);

  const handleSendMessage = useCallback(
    async (content: string) => {
      if (!selectedConversation) return;
      await sendMessage(selectedConversation, content);
      scrollToBottom();
    },
    [selectedConversation, sendMessage, scrollToBottom]
  );

  const handleFileUpload = useCallback(
    async (file: File) => {
      if (!selectedConversation) return;
      const formData = new FormData();
      formData.append('file', file);
      await apiClient.upload(chatRoutes.conversationUpload(selectedConversation), formData);
      scrollToBottom();
    },
    [selectedConversation, scrollToBottom]
  );

  // Throttled typing: at most once per second
  const lastTypingSent = useRef(0);
  const handleTyping = useCallback(
    (isTyping: boolean) => {
      if (!selectedConversation) return;
      const now = Date.now();
      if (isTyping && now - lastTypingSent.current < 1000) return;
      lastTypingSent.current = now;
      sendTyping(selectedConversation, isTyping);
    },
    [selectedConversation, sendTyping]
  );

  const handleCopy = useCallback(
    (content: string) => {
      navigator.clipboard.writeText(content);
      toast.success(t('chat.copySuccess'));
    },
    [t]
  );

  const handleDeleteMessage = useCallback(
    (id: string) => deleteMutation.mutate(id),
    [deleteMutation]
  );
  const handleRecallMessage = useCallback(
    (id: string) => recallMutation.mutate(id),
    [recallMutation]
  );

  const handleReportMessage = useCallback((messageId: string) => {
    setReportTarget({ targetType: 'MESSAGE', targetId: messageId });
    setReportDialogOpen(true);
  }, []);

  const handleReportUser = useCallback(() => {
    if (selectedUser) {
      setReportTarget({ targetType: 'USER', targetId: selectedUser.id });
      setReportDialogOpen(true);
    }
  }, [selectedUser]);

  const handlePin = useCallback(() => {
    if (selectedConversation) pinMutation.mutate(selectedConversation);
  }, [selectedConversation, pinMutation]);

  // ── Derived State ─────────────────────────────────────────
  // Fix: single useMemo with time-based sorting
  const sortedConversations = useMemo(() => {
    const filtered = conversations.filter((conv) => {
      const name = getConversationTitle(conv).toLowerCase();
      return name.includes(searchQuery.toLowerCase());
    });
    return filtered.sort((a, b) => {
      if (a.isPinned && !b.isPinned) return -1;
      if (!a.isPinned && b.isPinned) return 1;
      return new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime();
    });
  }, [conversations, searchQuery]);

  const typingUserIds = selectedConversation ? getTypingUsers(selectedConversation) : [];
  const isOtherUserTyping =
    selectedConversationData?.kind === 'DIRECT'
      ? typingUserIds.some((id) => id === selectedUser?.id)
      : typingUserIds.length > 0;
  const currentConvIsPinned =
    conversations.find((c) => c.id === selectedConversation)?.isPinned ?? false;

  // ── Render ────────────────────────────────────────────────
  return (
    <PageContainer maxWidth="6xl" className="lg:flex lg:flex-col lg:h-[calc(100dvh-7.5rem)]">
      {/* 页面头部 */}
      <div className="shrink-0 relative mb-6 overflow-hidden rounded-lg bg-primary/5 p-6">
        <div className="absolute -right-20 -top-20 h-48 w-48 rounded-full bg-primary/15 blur-3xl" />
        <div className="relative z-10 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-primary">
              <MessageSquare className="h-6 w-6 text-white" />
            </div>
            <div>
              <h1 className="text-title">{t('chat.title')}</h1>
              <p className="text-muted-foreground">{t('chat.description')}</p>
            </div>
          </div>
          <Badge
            variant={isConnected ? 'default' : 'secondary'}
            className={cn(
              'gap-1.5',
              isConnected
                ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20'
                : 'bg-red-500/10 text-red-600 dark:text-red-400 border-red-500/20'
            )}
          >
            {isConnected ? (
              <>
                <Wifi className="h-3 w-3" />
                {t('chat.connected')}
              </>
            ) : (
              <>
                <WifiOff className="h-3 w-3" />
                {t('chat.connecting')}
              </>
            )}
          </Badge>
        </div>
      </div>

      <div className="grid min-h-[500px] gap-4 lg:grid-cols-3 lg:flex-1 lg:min-h-0 lg:overflow-hidden">
        {/* 会话列表 */}
        <ChatConversationList
          conversations={sortedConversations}
          selectedId={selectedConversation}
          totalUnread={totalUnread}
          searchQuery={searchQuery}
          onSearchChange={setSearchQuery}
          onSelect={handleSelectConversation}
          isLoading={isLoading}
          isUserOnline={isUserOnline}
          showConversations={showConversations}
        />

        {/* 消息区域 */}
        <Card
          className={cn(
            'flex flex-col lg:col-span-2 overflow-hidden min-h-0 py-0 gap-0',
            showConversations && 'hidden lg:flex'
          )}
        >
          <div className="h-1 bg-gradient-to-r bg-primary shrink-0" />
          {selectedConversation && selectedConversationData ? (
            <>
              <ChatHeader
                conversation={selectedConversationData}
                isOnline={
                  selectedConversationData?.kind === 'DIRECT'
                    ? isUserOnline(selectedUser?.id || '')
                    : false
                }
                isPinned={currentConvIsPinned}
                onBack={handleBack}
                onPin={handlePin}
                onReport={handleReportUser}
                onBlock={() => setBlockDialogOpen(true)}
              />

              <ChatMessageArea
                messages={sortedMessages}
                isLoading={messagesLoading}
                conversation={selectedConversationData}
                currentUserId={currentUserId}
                otherReadAt={otherReadAt}
                isOtherUserTyping={isOtherUserTyping}
                hasNewMessage={hasNewMessage}
                isAtBottom={isAtBottom}
                isFetchingNextPage={isFetchingNextPage}
                scrollContainerRef={scrollContainerRef}
                messagesEndRef={messagesEndRef}
                onScrollToBottom={scrollToBottom}
                onScroll={handleScroll}
                onDeleteMessage={handleDeleteMessage}
                onRecallMessage={handleRecallMessage}
                onCopyMessage={handleCopy}
                onReportMessage={handleReportMessage}
              />

              {/* 输入框 */}
              <div className="border-t p-4 bg-muted/30 shrink-0">
                <MessageInput
                  onSend={handleSendMessage}
                  onFileUpload={handleFileUpload}
                  onTyping={handleTyping}
                  disabled={!isConnected}
                  placeholder={t('chat.typeMessage')}
                />
              </div>
            </>
          ) : (
            <div className="flex flex-1 items-center justify-center p-8">
              <div className="text-center">
                <div className="mx-auto mb-4 flex h-20 w-20 items-center justify-center rounded-lg bg-primary/10">
                  <MessageSquare className="h-10 w-10 text-primary/50" />
                </div>
                <h3 className="text-lg font-semibold">{t('chat.selectConversation')}</h3>
                <p className="mt-2 text-muted-foreground max-w-sm">
                  {t('chat.selectConversationHint')}
                </p>
              </div>
            </div>
          )}
        </Card>
      </div>

      {/* Dialogs */}
      <BlockDialog
        open={blockDialogOpen}
        onOpenChange={setBlockDialogOpen}
        isPending={blockMutation.isPending}
        onConfirm={() =>
          selectedConversationData?.kind === 'DIRECT' &&
          selectedUser &&
          blockMutation.mutate(selectedUser.id)
        }
      />

      <ReportDialog
        open={reportDialogOpen}
        onOpenChange={setReportDialogOpen}
        target={reportTarget}
        isPending={reportMutation.isPending}
        onSubmit={(data) => reportMutation.mutate(data)}
      />
    </PageContainer>
  );
}
