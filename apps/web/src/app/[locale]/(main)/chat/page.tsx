'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useTranslations } from 'next-intl';
import { useSearchParams } from 'next/navigation';
import {
  useInfiniteQuery,
  useMutation,
  useQuery,
  useQueryClient,
  type InfiniteData,
} from '@tanstack/react-query';
import { toast } from 'sonner';
import { chatRoutes } from '@study-abroad/shared';
import { AlertCircle, MessageSquare, RefreshCw, ShieldCheck, Wifi, WifiOff } from 'lucide-react';

import { PageContainer } from '@/components/layout';
import { MessageInput } from '@/components/features';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { apiClient } from '@/lib/api';
import { cn } from '@/lib/utils';
import { useChatSocket } from '@/hooks/use-chat-socket';
import { useAuthStore } from '@/stores';

import type {
  ChatContext,
  Conversation,
  ConversationFilter,
  Message,
  ReportTarget,
} from './_components/types';
import { BlockDialog } from './_components/BlockDialog';
import { ChatContextPanel } from './_components/ChatContextPanel';
import { ChatConversationList } from './_components/ChatConversationList';
import { ChatHeader } from './_components/ChatHeader';
import { ChatMessageArea } from './_components/ChatMessageArea';
import { ReportDialog } from './_components/ReportDialog';
import { useChatScroll } from './_components/use-chat-scroll';

const CONVERSATION_LIMIT = 80;

type AuthUserWithProfile = {
  profile?: {
    nickname?: string | null;
    avatarUrl?: string | null;
    realName?: string | null;
  } | null;
};

function createClientMessageId() {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) {
    return crypto.randomUUID();
  }
  return `msg-${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

function isMuted(conversation?: Conversation | null) {
  if (!conversation?.mutedUntil) return false;
  return new Date(conversation.mutedUntil).getTime() > Date.now();
}

export default function ChatPage() {
  const t = useTranslations();
  const queryClient = useQueryClient();
  const searchParams = useSearchParams();
  const currentUser = useAuthStore((state) => state.user);
  const accessToken = useAuthStore((state) => state.accessToken);
  const isAuthReady = useAuthStore((state) => state.isInitialized);
  const currentUserId = currentUser?.id ?? null;
  // Gate every protected useQuery on this page until AuthInitializer has
  // restored the session via the httpOnly refresh cookie and populated the
  // in-memory accessToken. Without this, queries fire synchronously on first
  // paint with no Authorization header → 401 in the console (the apiClient's
  // refresh-and-retry mask hides the symptom but leaves the noise). Matches
  // the pattern used in /profile, /schools, /prediction.
  const isAuthed = isAuthReady && !!accessToken;

  const [selectedConversation, setSelectedConversation] = useState<string | null>(null);
  const [showConversations, setShowConversations] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [filter, setFilter] = useState<ConversationFilter>('all');
  const [otherReadAt, setOtherReadAt] = useState<string | null>(null);

  const [reportDialogOpen, setReportDialogOpen] = useState(false);
  const [reportTarget, setReportTarget] = useState<ReportTarget | null>(null);
  const [blockDialogOpen, setBlockDialogOpen] = useState(false);

  const updateMessageCache = useCallback(
    (
      conversationId: string,
      updater: (
        old: InfiniteData<Message[], string | undefined> | undefined
      ) => InfiniteData<Message[], string | undefined> | undefined
    ) => {
      queryClient.setQueryData<InfiniteData<Message[], string | undefined>>(
        ['messages', conversationId],
        updater
      );
    },
    [queryClient]
  );

  const upsertLocalMessage = useCallback(
    (conversationId: string, message: Message) => {
      updateMessageCache(conversationId, (old) => {
        if (!old?.pages) {
          return { pages: [[message]], pageParams: [undefined] };
        }
        const firstPage = old.pages[0] ?? [];
        const exists = firstPage.some(
          (item) =>
            item.id === message.id ||
            (message.clientMessageId && item.clientMessageId === message.clientMessageId)
        );
        if (exists) {
          return {
            ...old,
            pages: [
              firstPage.map((item) =>
                item.id === message.id ||
                (message.clientMessageId && item.clientMessageId === message.clientMessageId)
                  ? message
                  : item
              ),
              ...old.pages.slice(1),
            ],
          };
        }
        return { ...old, pages: [[message, ...firstPage], ...old.pages.slice(1)] };
      });
    },
    [updateMessageCache]
  );

  const markMessageFailed = useCallback(
    (conversationId: string, clientMessageId: string, error: string) => {
      updateMessageCache(conversationId, (old) => {
        if (!old?.pages) return old;
        return {
          ...old,
          pages: old.pages.map((page) =>
            page.map((message) =>
              message.clientMessageId === clientMessageId
                ? { ...message, status: 'failed', error }
                : message
            )
          ),
        };
      });
    },
    [updateMessageCache]
  );

  const {
    isConnected,
    sendMessage: socketSendMessage,
    joinConversation,
    markRead,
    sendTyping,
    getTypingUsers,
    isUserOnline,
  } = useChatSocket({
    onNewMessage: (message) => {
      if (message.conversationId === selectedConversation) {
        if (isAtBottomRef.current) {
          setTimeout(() => scrollToBottom(), 80);
          queryClient.setQueryData<Conversation[]>(['conversations', filter, searchQuery], (old) =>
            old?.map((conversation) =>
              conversation.id === selectedConversation
                ? { ...conversation, unreadCount: 0, lastMessage: message as Message }
                : conversation
            )
          );
          void markRead(selectedConversation).then(() => {
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

  const { data: conversationsData, isLoading } = useQuery({
    queryKey: ['conversations', filter, searchQuery],
    queryFn: () =>
      apiClient.get<Conversation[]>(chatRoutes.conversations(), {
        params: {
          filter,
          q: searchQuery.trim() || undefined,
          limit: CONVERSATION_LIMIT,
        },
      }),
    enabled: isAuthed,
  });
  // React Query v5: `isLoading = isPending && isFetching`. With `enabled: false`
  // (auth not ready yet), `isLoading` is `false`, which would briefly flash the
  // ConversationList's empty-state during the auth-init window. Keep the
  // skeleton up until either we are actively fetching, or auth is still
  // resolving.
  const isListLoading = isLoading || !isAuthReady;
  const conversations = useMemo(
    () => (Array.isArray(conversationsData) ? conversationsData : []),
    [conversationsData]
  );

  const autoSelectedRef = useRef(false);
  const refetchedOnceRef = useRef(false);
  useEffect(() => {
    const conversationId = searchParams.get('conversation');
    if (!conversationId || autoSelectedRef.current || isLoading) return;

    const exists = conversations.some((conversation) => conversation.id === conversationId);
    if (exists) {
      setSelectedConversation(conversationId);
      setShowConversations(false);
      autoSelectedRef.current = true;
    } else if (!refetchedOnceRef.current) {
      refetchedOnceRef.current = true;
      queryClient.invalidateQueries({ queryKey: ['conversations'] });
    }
  }, [searchParams, conversations, isLoading, queryClient]);

  const selectedConversationData =
    conversations.find((conversation) => conversation.id === selectedConversation) ?? null;
  const selectedUser = selectedConversationData?.otherUser ?? null;

  const totalUnread = useMemo(
    () => conversations.reduce((sum, conversation) => sum + (conversation.unreadCount || 0), 0),
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
      apiClient.get<Message[]>(chatRoutes.conversationMessages(selectedConversation || ''), {
        params: {
          before: pageParam,
          limit: 50,
        },
      }),
    initialPageParam: undefined as string | undefined,
    getNextPageParam: (lastPage: Message[]) =>
      lastPage.length >= 50 ? lastPage[lastPage.length - 1]?.id : undefined,
    enabled: isAuthed && !!selectedConversation,
  });

  const { data: contextData, isLoading: contextLoading } = useQuery({
    queryKey: ['conversation-context', selectedConversation],
    queryFn: () =>
      apiClient.get<ChatContext>(chatRoutes.conversationContext(selectedConversation || '')),
    enabled: isAuthed && !!selectedConversation,
  });

  const sortedMessages = useMemo(() => {
    if (!messagesPages?.pages) return [];
    return messagesPages.pages.flatMap((page) => (Array.isArray(page) ? page : [])).reverse();
  }, [messagesPages?.pages]);

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
    fetchNextPage: () => {
      void fetchNextPage();
    },
  });

  useEffect(() => {
    if (!selectedConversation) return;
    joinConversation(selectedConversation);
    setOtherReadAt(null);
    queryClient.setQueryData<Conversation[]>(['conversations', filter, searchQuery], (old) =>
      old?.map((conversation) =>
        conversation.id === selectedConversation
          ? { ...conversation, unreadCount: 0 }
          : conversation
      )
    );
    queryClient.invalidateQueries({ queryKey: ['unread-count'] });
    void markRead(selectedConversation).then(() => {
      queryClient.invalidateQueries({ queryKey: ['conversations'] });
    });
  }, [selectedConversation, joinConversation, markRead, queryClient, filter, searchQuery]);

  const preferenceMutation = useMutation({
    mutationFn: (data: {
      conversationId: string;
      preferences: { isPinned?: boolean; isArchived?: boolean; mutedUntil?: string | null };
    }) =>
      apiClient.patch(chatRoutes.conversationPreferences(data.conversationId), data.preferences),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['conversations'] });
      queryClient.invalidateQueries({ queryKey: ['conversation-context', selectedConversation] });
    },
  });

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
    // @cache-invalidation-allowed: one-shot report action (toast + close dialog); reporting does not change any displayed cached list/detail
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
      // @cache-invalidation-allowed: directly updates the ['messages', conversationId] React Query cache via updateMessageCache (queryClient.setQueryData) instead of invalidating
      if (!selectedConversation) return;
      updateMessageCache(selectedConversation, (old) => {
        if (!old?.pages) return old;
        return {
          ...old,
          pages: old.pages.map((page) =>
            page.map((message) =>
              message.id === messageId ? { ...message, isDeleted: true } : message
            )
          ),
        };
      });
    },
  });

  const recallMutation = useMutation({
    mutationFn: (messageId: string) => apiClient.patch(`${chatRoutes.message(messageId)}/recall`),
    onSuccess: (_data, messageId) => {
      // @cache-invalidation-allowed: directly updates the ['messages', conversationId] React Query cache via updateMessageCache (queryClient.setQueryData) instead of invalidating
      if (!selectedConversation) return;
      updateMessageCache(selectedConversation, (old) => {
        if (!old?.pages) return old;
        return {
          ...old,
          pages: old.pages.map((page) =>
            page.map((message) =>
              message.id === messageId ? { ...message, isRecalled: true, content: '' } : message
            )
          ),
        };
      });
      toast.success(t('chat.recallSuccess'));
    },
    onError: () => {
      toast.error(t('chat.recallTimeExpired'));
    },
  });

  const sortedConversations = useMemo(() => {
    return [...conversations].sort((a, b) => {
      if (a.isPinned && !b.isPinned) return -1;
      if (!a.isPinned && b.isPinned) return 1;
      return new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime();
    });
  }, [conversations]);

  const typingUserIds = selectedConversation ? getTypingUsers(selectedConversation) : [];
  const isOtherUserTyping =
    selectedConversationData?.kind === 'DIRECT'
      ? typingUserIds.some((id) => id === selectedUser?.id)
      : typingUserIds.length > 0;
  const currentConvIsPinned = selectedConversationData?.isPinned ?? false;
  const currentConvIsArchived = selectedConversationData?.isArchived ?? false;
  const currentConvIsMuted = isMuted(selectedConversationData);

  const handleSelectConversation = useCallback(
    (id: string) => {
      setSelectedConversation(id);
      setShowConversations(false);
      setHasNewMessage(false);
    },
    [setHasNewMessage]
  );

  const handleBack = useCallback(() => {
    setShowConversations(true);
    setSelectedConversation(null);
  }, []);

  const handleSendMessage = useCallback(
    async (content: string, retry?: { clientMessageId?: string; localId?: string }) => {
      if (!selectedConversation || !currentUserId) return;
      const clientMessageId = retry?.clientMessageId || createClientMessageId();
      const currentUserProfile = (currentUser as AuthUserWithProfile | null)?.profile;
      const optimistic: Message = {
        id: retry?.localId || `local-${clientMessageId}`,
        conversationId: selectedConversation,
        senderId: currentUserId,
        content,
        clientMessageId,
        createdAt: new Date().toISOString(),
        status: 'sending',
        sender: {
          id: currentUserId,
          email: currentUser?.email,
          profile: {
            nickname: currentUserProfile?.nickname ?? undefined,
            avatarUrl: currentUserProfile?.avatarUrl ?? undefined,
            realName: currentUserProfile?.realName ?? undefined,
          },
        },
      };

      upsertLocalMessage(selectedConversation, optimistic);
      scrollToBottom();

      try {
        const message = isConnected
          ? await socketSendMessage(selectedConversation, content, { clientMessageId })
          : await apiClient.post<Message>(
              chatRoutes.conversationMessages(selectedConversation),
              { content, clientMessageId },
              { suppressErrorToast: true }
            );

        if (!message) throw new Error(t('chat.sendFailed'));
        upsertLocalMessage(selectedConversation, { ...message, status: 'sent' });
        queryClient.invalidateQueries({ queryKey: ['conversations'] });
      } catch (error) {
        markMessageFailed(
          selectedConversation,
          clientMessageId,
          error instanceof Error ? error.message : t('chat.sendFailed')
        );
      }
    },
    [
      currentUser,
      currentUserId,
      isConnected,
      markMessageFailed,
      queryClient,
      scrollToBottom,
      selectedConversation,
      socketSendMessage,
      t,
      upsertLocalMessage,
    ]
  );

  const handleFileUpload = useCallback(
    async (file: File) => {
      if (!selectedConversation || !currentUserId) return;
      const clientMessageId = createClientMessageId();
      const previewUrl = URL.createObjectURL(file);
      const optimistic: Message = {
        id: `local-${clientMessageId}`,
        conversationId: selectedConversation,
        senderId: currentUserId,
        content: file.name,
        clientMessageId,
        createdAt: new Date().toISOString(),
        status: 'sending',
        attachments: [
          {
            id: `local-attachment-${clientMessageId}`,
            url: previewUrl,
            type: file.type.startsWith('image/') ? 'image' : 'file',
            name: file.name,
            size: file.size,
            mimeType: file.type,
          },
        ],
      };

      upsertLocalMessage(selectedConversation, optimistic);
      scrollToBottom();

      const formData = new FormData();
      formData.append('file', file);
      formData.append('clientMessageId', clientMessageId);
      formData.append('content', file.name);

      try {
        const message = await apiClient.upload<Message>(
          chatRoutes.conversationUpload(selectedConversation),
          formData,
          { suppressErrorToast: true }
        );
        URL.revokeObjectURL(previewUrl);
        upsertLocalMessage(selectedConversation, { ...message, status: 'sent' });
        queryClient.invalidateQueries({ queryKey: ['conversations'] });
        queryClient.invalidateQueries({ queryKey: ['conversation-context', selectedConversation] });
      } catch (error) {
        markMessageFailed(
          selectedConversation,
          clientMessageId,
          error instanceof Error ? error.message : t('chat.sendFailed')
        );
      }
    },
    [
      currentUserId,
      markMessageFailed,
      queryClient,
      scrollToBottom,
      selectedConversation,
      t,
      upsertLocalMessage,
    ]
  );

  const handleTyping = useCallback(
    (typing: boolean) => {
      if (selectedConversation) sendTyping(selectedConversation, typing);
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

  const handleReportMessage = useCallback((messageId: string) => {
    setReportTarget({ targetType: 'MESSAGE', targetId: messageId });
    setReportDialogOpen(true);
  }, []);

  const handleReportUser = useCallback(() => {
    if (!selectedUser) return;
    setReportTarget({ targetType: 'USER', targetId: selectedUser.id });
    setReportDialogOpen(true);
  }, [selectedUser]);

  const handlePin = useCallback(() => {
    if (!selectedConversation) return;
    preferenceMutation.mutate({
      conversationId: selectedConversation,
      preferences: { isPinned: !currentConvIsPinned },
    });
  }, [currentConvIsPinned, preferenceMutation, selectedConversation]);

  const handleArchive = useCallback(() => {
    if (!selectedConversation) return;
    preferenceMutation.mutate({
      conversationId: selectedConversation,
      preferences: { isArchived: !currentConvIsArchived },
    });
  }, [currentConvIsArchived, preferenceMutation, selectedConversation]);

  const handleMute = useCallback(() => {
    if (!selectedConversation) return;
    const mutedUntil = currentConvIsMuted
      ? null
      : new Date(Date.now() + 8 * 60 * 60 * 1000).toISOString();
    preferenceMutation.mutate({
      conversationId: selectedConversation,
      preferences: { mutedUntil },
    });
  }, [currentConvIsMuted, preferenceMutation, selectedConversation]);

  return (
    // 2026-05 PR 2/3: migrated to `variant="workbench"` — this used to
    // be `maxWidth="full"` + className override with `max-w-[1760px]
    // flex flex-col lg:h-[calc(100dvh-6.5rem)]`. That pattern depended
    // on tw-merge priority to *reverse* the variant's max-w-full, which
    // was semantically backwards and made it easy to miss (essays/page
    // had copied the same anti-pattern). The `workbench` variant
    // encodes the structural shape (mx-auto + max-w-[1760px] + flex
    // column + viewport-minus-header height + min-w-0) as a first-class
    // concept so any future three-column tool surface stays consistent.
    <PageContainer variant="workbench">
      <div className="mb-3 flex shrink-0 flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-md bg-primary text-primary-foreground">
            <MessageSquare className="h-5 w-5" />
          </div>
          <div>
            <h1 className="text-title">{t('chat.title')}</h1>
            <p className="text-sm text-muted-foreground">{t('chat.workbenchDescription')}</p>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Badge variant={isConnected ? 'success' : 'warning'} className="gap-1.5">
            {isConnected ? <Wifi className="h-3 w-3" /> : <WifiOff className="h-3 w-3" />}
            {isConnected ? t('chat.connected') : t('chat.connecting')}
          </Badge>
          <Badge variant="outline" className="gap-1.5">
            <ShieldCheck className="h-3 w-3" />
            {t('chat.verifiedNetwork')}
          </Badge>
          <Button
            variant="outline"
            size="sm"
            onClick={() => {
              queryClient.invalidateQueries({ queryKey: ['conversations'] });
              if (selectedConversation) {
                queryClient.invalidateQueries({ queryKey: ['messages', selectedConversation] });
              }
            }}
          >
            <RefreshCw className="h-4 w-4" />
            {t('chat.refresh')}
          </Button>
        </div>
      </div>

      {/*
        2026-05 chat layout fix: previous template was
          lg:grid-cols-[360px_minmax(0,1fr)_320px]
        Fixed-pixel left/right columns can't shrink. At viewport widths
        just past the lg breakpoint (1024-1280px), the 3-col layout
        exceeded the container width — and the parent (main) has
        `overflow-x-clip` which silently clipped the right panel. Users
        saw text like "暂无共享文件" cut mid-character.

        Fix: use minmax() on both fixed cols so they can shrink down to
        sensible minimums before overflow forces the clip. Middle col
        stays minmax(0,1fr) (already correctly shrinkable). At xl+ all
        cols hit their max and the layout matches the original design.
      */}
      {/* 2026-05 PR 2: `min-w-0` on the grid container itself, even
          though the PageContainer parent now has `min-w-0` via the
          workbench variant. Defence-in-depth: the grid is also a
          potential flex item inside the PageContainer's flex column,
          so it needs its own min-w-0 to prevent any future change
          from re-introducing the cascading overflow chain. */}
      <div className="grid min-w-0 min-h-[620px] gap-3 lg:grid-cols-[minmax(280px,360px)_minmax(0,1fr)_minmax(260px,320px)] lg:flex-1 lg:min-h-0 lg:overflow-hidden">
        <ChatConversationList
          conversations={sortedConversations}
          selectedId={selectedConversation}
          totalUnread={totalUnread}
          searchQuery={searchQuery}
          filter={filter}
          onSearchChange={setSearchQuery}
          onFilterChange={setFilter}
          onSelect={handleSelectConversation}
          isLoading={isListLoading}
          isUserOnline={isUserOnline}
          showConversations={showConversations}
        />

        <Card
          className={cn(
            // 2026-05 chat layout fix: `min-w-0` on the middle column
            // Card so a long chat header / message bubble can't push
            // it wider than `minmax(0,1fr)`. Without this, the chat
            // header's "Regeneron STS / Innovation Track · Science Fair
            // Innovators × 全栈开发组" title was forcing the middle col
            // wider than its grid cell, cascading into the right panel.
            'min-w-0 flex flex-col overflow-hidden min-h-0 py-0 gap-0',
            showConversations && 'hidden lg:flex'
          )}
        >
          {selectedConversation && selectedConversationData ? (
            <>
              <ChatHeader
                conversation={selectedConversationData}
                isOnline={
                  selectedConversationData.kind === 'DIRECT'
                    ? isUserOnline(selectedUser?.id || '')
                    : false
                }
                isPinned={currentConvIsPinned}
                isArchived={currentConvIsArchived}
                isMuted={currentConvIsMuted}
                onBack={handleBack}
                onPin={handlePin}
                onArchive={handleArchive}
                onMute={handleMute}
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
                onDeleteMessage={(id) => deleteMutation.mutate(id)}
                onRecallMessage={(id) => recallMutation.mutate(id)}
                onRetryMessage={(message) =>
                  void handleSendMessage(message.content, {
                    clientMessageId: message.clientMessageId,
                    localId: message.id,
                  })
                }
                onCopyMessage={handleCopy}
                onReportMessage={handleReportMessage}
              />

              {!isConnected && (
                <div className="flex items-center gap-2 border-t bg-warning/10 px-4 py-2 text-xs text-warning">
                  <AlertCircle className="h-4 w-4" />
                  {t('chat.offlineFallback')}
                </div>
              )}
              <div className="border-t bg-card/95 p-3 shrink-0">
                <MessageInput
                  onSend={handleSendMessage}
                  onFileUpload={handleFileUpload}
                  onTyping={handleTyping}
                  draftKey={`chat:draft:${selectedConversation}`}
                  placeholder={t('chat.typeMessage')}
                />
              </div>
            </>
          ) : (
            <div className="flex flex-1 items-center justify-center p-8">
              <div className="text-center">
                <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-md bg-primary/10">
                  <MessageSquare className="h-8 w-8 text-primary/55" />
                </div>
                <h3 className="text-lg font-semibold">{t('chat.selectConversation')}</h3>
                <p className="mt-2 max-w-sm text-sm text-muted-foreground">
                  {t('chat.selectConversationHint')}
                </p>
              </div>
            </div>
          )}
        </Card>

        <ChatContextPanel
          conversation={selectedConversationData}
          context={contextData}
          isLoading={contextLoading}
          isPinned={currentConvIsPinned}
          isArchived={currentConvIsArchived}
          isMuted={currentConvIsMuted}
          onPin={handlePin}
          onArchive={handleArchive}
          onMute={handleMute}
          onReport={handleReportUser}
          onBlock={() => setBlockDialogOpen(true)}
        />
      </div>

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
