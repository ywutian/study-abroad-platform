'use client';

import { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { useTranslations, useLocale } from 'next-intl';
import { useQuery, useInfiniteQuery, useQueryClient, useMutation } from '@tanstack/react-query';
import { motion, AnimatePresence } from 'framer-motion';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { ScrollArea } from '@/components/ui/scroll-area';
import { apiClient } from '@/lib/api';
import { PageContainer } from '@/components/layout';
import { LoadingState } from '@/components/ui/loading-state';
import { Badge } from '@/components/ui/badge';
import { CountBadge } from '@/components/ui/count-badge';
import { MessageInput, TypingIndicator, UserProfileCard } from '@/components/features';
import { useChatSocket } from '@/hooks/use-chat-socket';
import { VerificationIcon } from '@/components/features';
import { cn } from '@/lib/utils';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { toast } from 'sonner';
import { formatDistanceToNow, isToday, isYesterday, isSameDay, format } from 'date-fns';
import { zhCN, enUS } from 'date-fns/locale';
import {
  ArrowLeft,
  MessageSquare,
  Users,
  Search,
  MoreVertical,
  Check,
  CheckCheck,
  Wifi,
  WifiOff,
  ChevronDown,
  Trash2,
  Flag,
  Ban,
  Pin,
  Loader2,
} from 'lucide-react';

interface Message {
  id: string;
  content: string;
  senderId: string;
  conversationId: string;
  createdAt: string;
  isDeleted?: boolean;
  mediaUrl?: string;
  mediaType?: string;
  sender?: {
    id: string;
    email: string;
    profile?: {
      nickname?: string;
      avatarUrl?: string;
      realName?: string;
    };
  };
  status?: 'sending' | 'sent' | 'delivered' | 'read';
}

interface Conversation {
  id: string;
  otherUser: {
    id: string;
    email: string;
    role?: string;
    profile?: {
      nickname?: string;
      realName?: string;
      avatarUrl?: string;
    };
  } | null;
  lastMessage?: Message;
  unreadCount: number;
  updatedAt: string;
  isPinned?: boolean;
}

/** 获取用户显示名 */
function getDisplayName(user?: Conversation['otherUser'] | null): string {
  if (!user) return '?';
  return user.profile?.nickname || user.profile?.realName || user.email;
}

export default function ChatPage() {
  const t = useTranslations();
  const locale = useLocale();
  const queryClient = useQueryClient();
  const [selectedConversation, setSelectedConversation] = useState<string | null>(null);
  const [showConversations, setShowConversations] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const scrollAreaRef = useRef<HTMLDivElement>(null);
  const [isAtBottom, setIsAtBottom] = useState(true);
  const [hasNewMessage, setHasNewMessage] = useState(false);
  const [hoveredMessageId, setHoveredMessageId] = useState<string | null>(null);

  // Dialog states
  const [reportDialogOpen, setReportDialogOpen] = useState(false);
  const [blockDialogOpen, setBlockDialogOpen] = useState(false);
  const [reportReason, setReportReason] = useState('');
  const [reportDetail, setReportDetail] = useState('');
  const [otherReadAt, setOtherReadAt] = useState<string | null>(null);

  // WebSocket连接
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
        if (isAtBottom) {
          setTimeout(() => scrollToBottom(), 100);
          markRead(selectedConversation);
          // 乐观更新当前会话 unreadCount
          queryClient.setQueryData<Conversation[]>(['conversations'], (old) =>
            old?.map((c) => (c.id === selectedConversation ? { ...c, unreadCount: 0 } : c))
          );
        } else {
          setHasNewMessage(true);
        }
      }
      // hook 层已 invalidate ['conversations']（use-chat-socket.ts:121），只补充 unread-count
      queryClient.invalidateQueries({ queryKey: ['unread-count'] });
    },
    onMessagesRead: (data) => {
      if (data.conversationId === selectedConversation) {
        setOtherReadAt(data.readAt);
      }
    },
  });

  // 获取会话列表
  const { data: conversationsData, isLoading } = useQuery({
    queryKey: ['conversations'],
    queryFn: () => apiClient.get<Conversation[]>('/chat/conversations'),
  });
  const conversations = conversationsData || [];
  const totalUnread = useMemo(
    () => conversations.reduce((sum, c) => sum + (c.unreadCount || 0), 0),
    [conversations]
  );

  // 获取消息列表（分页）
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
        `/chat/conversations/${selectedConversation}/messages${pageParam ? `?before=${pageParam}` : ''}`
      ),
    initialPageParam: undefined as string | undefined,
    getNextPageParam: (lastPage: Message[]) =>
      lastPage.length >= 50 ? lastPage[lastPage.length - 1]?.id : undefined,
    enabled: !!selectedConversation,
  });
  const messages = messagesPages?.pages.flat() || [];

  // 拉黑用户
  const blockMutation = useMutation({
    mutationFn: (userId: string) => apiClient.post(`/chat/block/${userId}`),
    onSuccess: () => {
      toast.success(t('chat.blockSuccess'));
      setBlockDialogOpen(false);
      setSelectedConversation(null);
      setShowConversations(true);
      queryClient.invalidateQueries({ queryKey: ['conversations'] });
    },
  });

  // 举报
  const reportMutation = useMutation({
    mutationFn: (data: { targetType: string; targetId: string; reason: string; detail?: string }) =>
      apiClient.post('/chat/report', data),
    onSuccess: () => {
      toast.success(t('chat.reportSuccess'));
      setReportDialogOpen(false);
      setReportReason('');
      setReportDetail('');
    },
  });

  // 删除消息
  const deleteMutation = useMutation({
    mutationFn: (messageId: string) => apiClient.delete(`/chat/messages/${messageId}`),
    onSuccess: (_data, messageId) => {
      queryClient.setQueryData(
        ['messages', selectedConversation],
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (old: any) => {
          if (!old?.pages) return old;
          return {
            ...old,
            pages: old.pages.map((page: Message[]) =>
              page.map((m) => (m.id === messageId ? { ...m, isDeleted: true } : m))
            ),
          };
        }
      );
    },
  });

  // 置顶/取消置顶
  const pinMutation = useMutation({
    mutationFn: (conversationId: string) =>
      apiClient.post<{ isPinned: boolean }>(`/chat/conversations/${conversationId}/pin`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['conversations'] });
    },
  });

  // 滚动到底部
  const scrollToBottom = useCallback(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    setHasNewMessage(false);
  }, []);

  // 监听滚动位置
  const handleScroll = useCallback(() => {
    const el = scrollAreaRef.current?.querySelector('[data-radix-scroll-area-viewport]');
    if (!el) return;
    const threshold = 100;
    const atBottom = el.scrollHeight - el.scrollTop - el.clientHeight < threshold;
    setIsAtBottom(atBottom);
    if (atBottom) setHasNewMessage(false);

    // 滚动到顶部时加载更多
    if (el.scrollTop < 50 && hasNextPage && !isFetchingNextPage) {
      const prevHeight = el.scrollHeight;
      fetchNextPage().then(() => {
        // 保持滚动位置
        requestAnimationFrame(() => {
          el.scrollTop = el.scrollHeight - prevHeight;
        });
      });
    }
  }, [hasNextPage, isFetchingNextPage, fetchNextPage]);

  // 绑定滚动事件
  useEffect(() => {
    const el = scrollAreaRef.current?.querySelector('[data-radix-scroll-area-viewport]');
    if (!el) return;
    el.addEventListener('scroll', handleScroll, { passive: true });
    return () => el.removeEventListener('scroll', handleScroll);
  }, [handleScroll, selectedConversation]);

  // 选择会话时加入房间 + 标记已读 + 乐观更新未读计数
  useEffect(() => {
    if (selectedConversation) {
      joinConversation(selectedConversation);
      markRead(selectedConversation);
      setOtherReadAt(null);
      setTimeout(() => scrollToBottom(), 300);
      // 乐观更新：本地立即将当前会话 unreadCount 置零，避免竞态
      queryClient.setQueryData<Conversation[]>(['conversations'], (old) =>
        old?.map((c) => (c.id === selectedConversation ? { ...c, unreadCount: 0 } : c))
      );
      queryClient.invalidateQueries({ queryKey: ['unread-count'] });
    }
  }, [selectedConversation, joinConversation, markRead, scrollToBottom, queryClient]);

  const handleSelectConversation = (id: string) => {
    setSelectedConversation(id);
    setShowConversations(false);
    setHasNewMessage(false);
  };

  const handleBack = () => {
    setShowConversations(true);
    setSelectedConversation(null);
  };

  const handleSendMessage = async (content: string) => {
    if (!selectedConversation) return;
    await sendMessage(selectedConversation, content);
    scrollToBottom();
  };

  const handleFileUpload = async (file: File) => {
    if (!selectedConversation) return;
    const formData = new FormData();
    formData.append('file', file);
    await apiClient.upload(`/chat/conversations/${selectedConversation}/upload`, formData);
    scrollToBottom();
  };

  const handleTyping = (isTyping: boolean) => {
    if (selectedConversation) {
      sendTyping(selectedConversation, isTyping);
    }
  };

  const filteredConversations = conversations.filter((conv) => {
    const name = getDisplayName(conv.otherUser).toLowerCase();
    return name.includes(searchQuery.toLowerCase());
  });

  // 置顶优先排序
  const sortedConversations = useMemo(() => {
    return [...filteredConversations].sort((a, b) => {
      if (a.isPinned && !b.isPinned) return -1;
      if (!a.isPinned && b.isPinned) return 1;
      return 0;
    });
  }, [filteredConversations]);

  const selectedUser = conversations?.find((c) => c.id === selectedConversation)?.otherUser;
  const typingUserIds = selectedConversation ? getTypingUsers(selectedConversation) : [];
  const isOtherUserTyping = typingUserIds.some((id) => id !== selectedUser?.id);

  // 消息按时间正序
  const sortedMessages = useMemo(() => messages.slice().reverse(), [messages]);

  const dateFnsLocale = locale === 'zh' ? zhCN : enUS;

  // 格式化相对时间（会话列表用）
  const formatTime = (dateStr: string) => {
    try {
      return formatDistanceToNow(new Date(dateStr), { addSuffix: true, locale: dateFnsLocale });
    } catch {
      return '';
    }
  };

  // 格式化消息时间（HH:mm）
  const formatMessageTime = (dateStr: string) => {
    try {
      return format(new Date(dateStr), 'HH:mm', { locale: dateFnsLocale });
    } catch {
      return '';
    }
  };

  // 日期分隔线文本
  const getDateLabel = (dateStr: string) => {
    try {
      const date = new Date(dateStr);
      if (isToday(date)) return t('chat.today');
      if (isYesterday(date)) return t('chat.yesterday');
      return format(date, locale === 'zh' ? 'M月d日' : 'MMM d', { locale: dateFnsLocale });
    } catch {
      return '';
    }
  };

  // 判断是否需要日期分隔线
  const shouldShowDateSeparator = (index: number) => {
    if (index === 0) return true;
    return !isSameDay(
      new Date(sortedMessages[index].createdAt),
      new Date(sortedMessages[index - 1].createdAt)
    );
  };

  // 消息状态图标（基于已读回执）
  const getMessageStatusIcon = (msg: Message) => {
    if (otherReadAt && new Date(msg.createdAt) <= new Date(otherReadAt)) {
      return <CheckCheck className="h-3 w-3 text-blue-400" />;
    }
    return <Check className="h-3 w-3" />;
  };

  // 渲染消息内容（链接检测）
  const renderMessageContent = (content: string) => {
    const urlRegex = /(https?:\/\/[^\s<]+)/g;
    const parts = content.split(urlRegex);
    if (parts.length === 1) return content;
    // split with capture group: even indices = text, odd indices = URLs
    return parts.map((part, i) =>
      i % 2 === 1 ? (
        <a
          key={i}
          href={part}
          target="_blank"
          rel="noopener noreferrer"
          className="underline hover:opacity-80 break-all"
        >
          {part}
        </a>
      ) : (
        part
      )
    );
  };

  return (
    <PageContainer maxWidth="6xl">
      {/* 页面头部 */}
      <div className="relative mb-6 overflow-hidden rounded-lg bg-primary/5 p-6">
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
                ? 'bg-emerald-500/10 text-emerald-600 border-emerald-500/20'
                : 'bg-red-500/10 text-red-600 border-red-500/20'
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

      <div className="grid h-[calc(100vh-280px)] min-h-[500px] gap-4 md:grid-cols-3">
        {/* ==================== 会话列表 ==================== */}
        <Card
          className={cn('md:col-span-1 overflow-hidden', !showConversations && 'hidden md:block')}
        >
          <div className="h-1 bg-primary" />
          <CardHeader className="border-b py-4 space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Users className="h-5 w-5 text-blue-500" />
                <CardTitle className="text-lg">{t('chat.conversations')}</CardTitle>
              </div>
              <CountBadge count={totalUnread} variant="primary" size="sm" />
            </div>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                placeholder={t('chat.searchConversations')}
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-9 h-9"
              />
            </div>
          </CardHeader>
          <CardContent className="p-0">
            <ScrollArea className="h-[calc(100vh-420px)] min-h-[350px]">
              {isLoading ? (
                <div className="space-y-2 p-4">
                  <LoadingState variant="list" count={5} />
                </div>
              ) : sortedConversations.length ? (
                <div className="divide-y">
                  <AnimatePresence>
                    {sortedConversations.map((conv, index) => {
                      const isOnline = isUserOnline(conv.otherUser?.id || '');
                      const displayName = getDisplayName(conv.otherUser);
                      const isVerified = conv.otherUser?.role === 'VERIFIED';

                      return (
                        <motion.div
                          key={conv.id}
                          initial={{ opacity: 0, x: -10 }}
                          animate={{ opacity: 1, x: 0 }}
                          transition={{ delay: index * 0.05 }}
                          className={cn(
                            'flex cursor-pointer items-center gap-3 p-4 transition-all hover:bg-muted/50',
                            selectedConversation === conv.id &&
                              'bg-primary/10 border-l-2 border-l-blue-500'
                          )}
                          onClick={() => handleSelectConversation(conv.id)}
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
                            />
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
                                {formatTime(conv.updatedAt)}
                              </span>
                            </div>
                            <p className="text-sm text-muted-foreground truncate">
                              {conv.lastMessage?.isDeleted
                                ? t('chat.messageDeleted')
                                : conv.lastMessage?.content || t('chat.noMessages')}
                            </p>
                          </div>
                          <CountBadge count={conv.unreadCount} variant="primary" />
                        </motion.div>
                      );
                    })}
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
          </CardContent>
        </Card>

        {/* ==================== 消息区域 ==================== */}
        <Card
          className={cn(
            'flex flex-col md:col-span-2 overflow-hidden',
            showConversations && 'hidden md:flex'
          )}
        >
          <div className="h-1 bg-gradient-to-r bg-primary" />
          {selectedConversation ? (
            <>
              {/* 聊天头部 */}
              <CardHeader className="border-b py-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <Button variant="ghost" size="icon" className="md:hidden" onClick={handleBack}>
                      <ArrowLeft className="h-5 w-5" />
                    </Button>
                    {selectedUser && (
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
                              isUserOnline(selectedUser.id) ? 'bg-emerald-500' : 'bg-gray-400'
                            )}
                          />
                        </div>
                      </UserProfileCard>
                    )}
                    <div>
                      <p className="font-medium flex items-center gap-1">
                        {getDisplayName(selectedUser)}
                        {selectedUser?.role === 'VERIFIED' && (
                          <VerificationIcon verified size="sm" />
                        )}
                      </p>
                      <p
                        className={cn(
                          'text-xs',
                          isUserOnline(selectedUser?.id || '')
                            ? 'text-emerald-500'
                            : 'text-muted-foreground'
                        )}
                      >
                        {isUserOnline(selectedUser?.id || '')
                          ? t('chat.online')
                          : t('chat.offline')}
                      </p>
                    </div>
                  </div>

                  {/* 操作菜单 */}
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="ghost" size="icon">
                        <MoreVertical className="h-4 w-4" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuItem
                        onClick={() =>
                          selectedConversation && pinMutation.mutate(selectedConversation)
                        }
                        className="gap-2"
                      >
                        <Pin className="h-4 w-4" />
                        {conversations.find((c) => c.id === selectedConversation)?.isPinned
                          ? t('chat.unpinConversation')
                          : t('chat.pinConversation')}
                      </DropdownMenuItem>
                      <DropdownMenuSeparator />
                      <DropdownMenuItem onClick={() => setReportDialogOpen(true)} className="gap-2">
                        <Flag className="h-4 w-4" />
                        {t('chat.reportUser')}
                      </DropdownMenuItem>
                      <DropdownMenuSeparator />
                      <DropdownMenuItem
                        onClick={() => setBlockDialogOpen(true)}
                        className="gap-2 text-destructive focus:text-destructive"
                      >
                        <Ban className="h-4 w-4" />
                        {t('chat.blockUser')}
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>
              </CardHeader>

              {/* 消息列表 */}
              <ScrollArea className="flex-1 p-4 relative" ref={scrollAreaRef}>
                {messagesLoading ? (
                  <LoadingState variant="list" count={5} />
                ) : sortedMessages?.length ? (
                  <div className="space-y-3">
                    {/* 加载更多 spinner */}
                    {isFetchingNextPage && (
                      <div className="flex justify-center py-2">
                        <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
                      </div>
                    )}
                    {sortedMessages.map((msg, index) => {
                      const isOwn = msg.senderId !== selectedUser?.id;
                      const showDateSep = shouldShowDateSeparator(index);

                      return (
                        <div key={msg.id}>
                          {/* 日期分隔线 */}
                          {showDateSep && (
                            <div className="flex items-center gap-3 my-4">
                              <div className="flex-1 h-px bg-border" />
                              <span className="text-2xs text-muted-foreground font-medium px-2">
                                {getDateLabel(msg.createdAt)}
                              </span>
                              <div className="flex-1 h-px bg-border" />
                            </div>
                          )}

                          {/* 消息气泡 */}
                          <motion.div
                            initial={{ opacity: 0, y: 10 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ delay: Math.min(index * 0.03, 0.5) }}
                            className={cn('flex gap-3 group', isOwn && 'flex-row-reverse')}
                            onMouseEnter={() => setHoveredMessageId(msg.id)}
                            onMouseLeave={() => setHoveredMessageId(null)}
                          >
                            <Avatar className="h-8 w-8 shrink-0 border">
                              <AvatarImage src={msg.sender?.profile?.avatarUrl} />
                              <AvatarFallback
                                className={cn(
                                  'text-sm font-medium',
                                  isOwn ? 'bg-primary text-white' : 'bg-muted'
                                )}
                              >
                                {(msg.sender?.profile?.nickname ||
                                  msg.sender?.email)?.[0]?.toUpperCase()}
                              </AvatarFallback>
                            </Avatar>
                            <div className="flex items-center gap-1">
                              {/* 自己的消息：删除按钮 */}
                              {isOwn && !msg.isDeleted && hoveredMessageId === msg.id && (
                                <button
                                  onClick={() => deleteMutation.mutate(msg.id)}
                                  className="p-1 rounded hover:bg-destructive/10 text-muted-foreground hover:text-destructive transition-colors"
                                  title={t('chat.deleteMessage')}
                                >
                                  <Trash2 className="h-3.5 w-3.5" />
                                </button>
                              )}
                              <div
                                className={cn(
                                  'max-w-[70%] rounded-lg px-4 py-2.5 shadow-sm',
                                  msg.isDeleted
                                    ? 'bg-muted/50 italic'
                                    : isOwn
                                      ? 'bg-primary text-white rounded-br-md'
                                      : 'bg-muted rounded-bl-md'
                                )}
                              >
                                {msg.isDeleted ? (
                                  <p className="text-sm text-muted-foreground">
                                    {t('chat.messageDeleted')}
                                  </p>
                                ) : (
                                  <>
                                    {msg.mediaUrl && msg.mediaType === 'image' && (
                                      <img
                                        src={msg.mediaUrl}
                                        alt=""
                                        className="rounded-md max-w-full max-h-60 mb-1"
                                      />
                                    )}
                                    {msg.mediaUrl && msg.mediaType === 'file' && (
                                      <a
                                        href={msg.mediaUrl}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        className="flex items-center gap-2 text-sm underline mb-1"
                                      >
                                        📎 {msg.mediaUrl.split('/').pop()}
                                      </a>
                                    )}
                                    <p className="text-sm whitespace-pre-wrap break-words">
                                      {renderMessageContent(msg.content)}
                                    </p>
                                  </>
                                )}
                                <div
                                  className={cn(
                                    'flex items-center gap-1 mt-1',
                                    isOwn ? 'justify-end' : ''
                                  )}
                                >
                                  <span
                                    className={cn(
                                      'text-2xs',
                                      msg.isDeleted
                                        ? 'text-muted-foreground'
                                        : isOwn
                                          ? 'text-white/70'
                                          : 'text-muted-foreground'
                                    )}
                                  >
                                    {formatMessageTime(msg.createdAt)}
                                  </span>
                                  {isOwn && !msg.isDeleted && (
                                    <span className="text-white/70">
                                      {getMessageStatusIcon(msg)}
                                    </span>
                                  )}
                                </div>
                              </div>
                              {/* 对方消息：举报按钮 */}
                              {!isOwn && !msg.isDeleted && hoveredMessageId === msg.id && (
                                <button
                                  onClick={() => setReportDialogOpen(true)}
                                  className="p-1 rounded hover:bg-destructive/10 text-muted-foreground hover:text-destructive transition-colors"
                                  title={t('chat.reportMessage')}
                                >
                                  <Flag className="h-3.5 w-3.5" />
                                </button>
                              )}
                            </div>
                          </motion.div>
                        </div>
                      );
                    })}

                    {/* 正在输入提示 */}
                    <AnimatePresence>
                      {isOtherUserTyping && (
                        <motion.div
                          initial={{ opacity: 0, y: 10 }}
                          animate={{ opacity: 1, y: 0 }}
                          exit={{ opacity: 0, y: -10 }}
                          className="flex gap-3"
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
                ) : (
                  <div className="flex h-full items-center justify-center">
                    <div className="text-center">
                      <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-muted">
                        <MessageSquare className="h-6 w-6 text-muted-foreground" />
                      </div>
                      <p className="text-muted-foreground">{t('chat.startConversation')}</p>
                    </div>
                  </div>
                )}

                {/* 新消息浮动提示 */}
                <AnimatePresence>
                  {hasNewMessage && !isAtBottom && (
                    <motion.div
                      initial={{ opacity: 0, y: 20 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: 20 }}
                      className="sticky bottom-2 flex justify-center pointer-events-none"
                    >
                      <Button
                        size="sm"
                        onClick={scrollToBottom}
                        className="gap-1.5 rounded-full shadow-lg pointer-events-auto"
                      >
                        <ChevronDown className="h-4 w-4" />
                        {t('chat.newMessages')}
                      </Button>
                    </motion.div>
                  )}
                </AnimatePresence>
              </ScrollArea>

              {/* 输入框 */}
              <div className="border-t p-4 bg-muted/30">
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
                  <MessageSquare className="h-10 w-10 text-blue-500/50" />
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

      {/* 拉黑确认 Dialog */}
      <Dialog open={blockDialogOpen} onOpenChange={setBlockDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t('chat.blockUser')}</DialogTitle>
            <DialogDescription>{t('chat.blockConfirm')}</DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setBlockDialogOpen(false)}>
              {t('chat.cancel')}
            </Button>
            <Button
              variant="destructive"
              onClick={() => selectedUser && blockMutation.mutate(selectedUser.id)}
              disabled={blockMutation.isPending}
            >
              {blockMutation.isPending && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
              {t('chat.confirm')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* 举报 Dialog */}
      <Dialog open={reportDialogOpen} onOpenChange={setReportDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t('chat.reportUser')}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>{t('chat.reportReason')}</Label>
              <Select value={reportReason} onValueChange={setReportReason}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="spam">{t('chat.reportReasons.spam')}</SelectItem>
                  <SelectItem value="harassment">{t('chat.reportReasons.harassment')}</SelectItem>
                  <SelectItem value="inappropriate">
                    {t('chat.reportReasons.inappropriate')}
                  </SelectItem>
                  <SelectItem value="fraud">{t('chat.reportReasons.fraud')}</SelectItem>
                  <SelectItem value="other">{t('chat.reportReasons.other')}</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>{t('chat.reportDetail')}</Label>
              <Textarea
                value={reportDetail}
                onChange={(e) => setReportDetail(e.target.value)}
                rows={3}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setReportDialogOpen(false)}>
              {t('chat.cancel')}
            </Button>
            <Button
              onClick={() =>
                selectedUser &&
                reportMutation.mutate({
                  targetType: 'USER',
                  targetId: selectedUser.id,
                  reason: reportReason,
                  detail: reportDetail || undefined,
                })
              }
              disabled={!reportReason || reportMutation.isPending}
            >
              {reportMutation.isPending && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
              {t('chat.confirm')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </PageContainer>
  );
}
