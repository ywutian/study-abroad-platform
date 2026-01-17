'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { useTranslations, useLocale } from 'next-intl';
import { useQuery } from '@tanstack/react-query';
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
import { MessageInput, TypingIndicator } from '@/components/features';
import { useChatSocket } from '@/hooks/use-chat-socket';
import { VerificationIcon } from '@/components/features';
import { cn } from '@/lib/utils';
import { formatDistanceToNow } from 'date-fns';
import { zhCN, enUS } from 'date-fns/locale';
import {
  ArrowLeft,
  MessageSquare,
  Users,
  Search,
  MoreVertical,
  Phone,
  Video,
  Check,
  CheckCheck,
  Wifi,
  WifiOff,
} from 'lucide-react';

interface Message {
  id: string;
  content: string;
  senderId: string;
  conversationId: string;
  createdAt: string;
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
}

/** 获取用户显示名 */
function getDisplayName(user?: Conversation['otherUser'] | null): string {
  if (!user) return '?';
  return user.profile?.nickname || user.profile?.realName || user.email;
}

export default function ChatPage() {
  const t = useTranslations();
  const locale = useLocale();
  const [selectedConversation, setSelectedConversation] = useState<string | null>(null);
  const [showConversations, setShowConversations] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // WebSocket连接
  const { isConnected, sendMessage, joinConversation, sendTyping, getTypingUsers, isUserOnline } =
    useChatSocket({
      onNewMessage: (message) => {
        // 如果消息来自当前会话，滚动到底部
        if (message.conversationId === selectedConversation) {
          setTimeout(() => scrollToBottom(), 100);
        }
      },
    });

  // 获取会话列表
  const { data: conversationsData, isLoading } = useQuery({
    queryKey: ['conversations'],
    queryFn: () => apiClient.get<Conversation[]>('/chat/conversations'),
  });
  const conversations = conversationsData || [];

  // 获取消息列表
  const { data: messagesData, isLoading: messagesLoading } = useQuery({
    queryKey: ['messages', selectedConversation],
    queryFn: () => apiClient.get<Message[]>(`/chat/conversations/${selectedConversation}/messages`),
    enabled: !!selectedConversation,
  });
  const messages = messagesData || [];

  // 滚动到底部
  const scrollToBottom = useCallback(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, []);

  // 选择会话时加入房间
  useEffect(() => {
    if (selectedConversation) {
      joinConversation(selectedConversation);
      setTimeout(() => scrollToBottom(), 300);
    }
  }, [selectedConversation, joinConversation, scrollToBottom]);

  const handleSelectConversation = (id: string) => {
    setSelectedConversation(id);
    setShowConversations(false);
  };

  const handleBack = () => {
    setShowConversations(true);
    setSelectedConversation(null);
  };

  // 发送消息
  const handleSendMessage = async (content: string) => {
    if (!selectedConversation) return;
    await sendMessage(selectedConversation, content);
    scrollToBottom();
  };

  // 发送正在输入状态
  const handleTyping = (isTyping: boolean) => {
    if (selectedConversation) {
      sendTyping(selectedConversation, isTyping);
    }
  };

  const filteredConversations = conversations.filter((conv) => {
    const name = getDisplayName(conv.otherUser).toLowerCase();
    return name.includes(searchQuery.toLowerCase());
  });

  const selectedUser = conversations?.find((c) => c.id === selectedConversation)?.otherUser;
  const typingUserIds = selectedConversation ? getTypingUsers(selectedConversation) : [];
  const isOtherUserTyping = typingUserIds.some((id) => id !== selectedUser?.id);

  // 格式化时间
  const formatTime = (dateStr: string) => {
    try {
      return formatDistanceToNow(new Date(dateStr), {
        addSuffix: true,
        locale: locale === 'zh' ? zhCN : enUS,
      });
    } catch {
      return '';
    }
  };

  // 获取消息状态图标
  const getMessageStatusIcon = (status?: string) => {
    switch (status) {
      case 'read':
        return <CheckCheck className="h-3 w-3 text-blue-400" />;
      case 'delivered':
        return <CheckCheck className="h-3 w-3" />;
      case 'sent':
        return <Check className="h-3 w-3" />;
      default:
        return null;
    }
  };

  return (
    <PageContainer maxWidth="6xl">
      {/* 页面头部 */}
      <div className="relative mb-6 overflow-hidden rounded-lg bg-primary/5 p-6">
        <div className="absolute -right-20 -top-20 h-48 w-48 rounded-full bg-primary/15 blur-3xl" />

        <div className="relative z-10 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-primary ">
              <MessageSquare className="h-6 w-6 text-white" />
            </div>
            <div>
              <h1 className="text-title">{t('chat.title')}</h1>
              <p className="text-muted-foreground">{t('chat.description')}</p>
            </div>
          </div>

          {/* 连接状态指示器 */}
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
        {/* 会话列表 */}
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
              {conversations.length > 0 && (
                <Badge variant="secondary">{conversations.length}</Badge>
              )}
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
              ) : filteredConversations.length ? (
                <div className="divide-y">
                  <AnimatePresence>
                    {filteredConversations.map((conv, index) => {
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
                            {/* 在线状态 */}
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
                                {displayName}
                                {isVerified && <VerificationIcon verified size="sm" />}
                              </span>
                              <span className="text-xs text-muted-foreground">
                                {formatTime(conv.updatedAt)}
                              </span>
                            </div>
                            <p className="text-sm text-muted-foreground truncate">
                              {conv.lastMessage?.content || t('chat.noMessages')}
                            </p>
                          </div>
                          {conv.unreadCount > 0 && (
                            <span className="flex h-5 min-w-[20px] items-center justify-center rounded-full bg-blue-500 px-1.5 text-2xs font-bold text-white">
                              {conv.unreadCount > 99 ? '99+' : conv.unreadCount}
                            </span>
                          )}
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

        {/* 消息区域 */}
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
                    <div className="relative">
                      <Avatar className="h-10 w-10 border-2 border-background shadow">
                        <AvatarImage src={selectedUser?.profile?.avatarUrl} />
                        <AvatarFallback className="bg-gradient-to-br bg-primary text-white font-medium">
                          {getDisplayName(selectedUser)?.[0]?.toUpperCase()}
                        </AvatarFallback>
                      </Avatar>
                      <span
                        className={cn(
                          'absolute bottom-0 right-0 h-2.5 w-2.5 rounded-full border-2 border-background',
                          isUserOnline(selectedUser?.id || '') ? 'bg-emerald-500' : 'bg-gray-400'
                        )}
                      />
                    </div>
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
                  <div className="flex items-center gap-1">
                    <Button variant="ghost" size="icon" className="hidden sm:flex">
                      <Phone className="h-4 w-4" />
                    </Button>
                    <Button variant="ghost" size="icon" className="hidden sm:flex">
                      <Video className="h-4 w-4" />
                    </Button>
                    <Button variant="ghost" size="icon">
                      <MoreVertical className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              </CardHeader>

              {/* 消息列表 */}
              <ScrollArea className="flex-1 p-4">
                {messagesLoading ? (
                  <LoadingState variant="list" count={5} />
                ) : messages?.length ? (
                  <div className="space-y-4">
                    <AnimatePresence>
                      {messages
                        .slice()
                        .reverse()
                        .map((msg, index) => {
                          const isOwn = msg.senderId !== selectedUser?.id;
                          return (
                            <motion.div
                              key={msg.id}
                              initial={{ opacity: 0, y: 10 }}
                              animate={{ opacity: 1, y: 0 }}
                              transition={{ delay: index * 0.03 }}
                              className={cn('flex gap-3', isOwn && 'flex-row-reverse')}
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
                              <div
                                className={cn(
                                  'max-w-[70%] rounded-lg px-4 py-2.5 shadow-sm',
                                  isOwn
                                    ? 'bg-primary text-white rounded-br-md'
                                    : 'bg-muted rounded-bl-md'
                                )}
                              >
                                <p className="text-sm whitespace-pre-wrap break-words">
                                  {msg.content}
                                </p>
                                <div
                                  className={cn(
                                    'flex items-center gap-1 mt-1',
                                    isOwn ? 'justify-end' : ''
                                  )}
                                >
                                  <span
                                    className={cn(
                                      'text-2xs',
                                      isOwn ? 'text-white/70' : 'text-muted-foreground'
                                    )}
                                  >
                                    {formatTime(msg.createdAt)}
                                  </span>
                                  {isOwn && (
                                    <span className="text-white/70">
                                      {getMessageStatusIcon(msg.status)}
                                    </span>
                                  )}
                                </div>
                              </div>
                            </motion.div>
                          );
                        })}
                    </AnimatePresence>

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
              </ScrollArea>

              {/* 输入框 */}
              <div className="border-t p-4 bg-muted/30">
                <MessageInput
                  onSend={handleSendMessage}
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
    </PageContainer>
  );
}
