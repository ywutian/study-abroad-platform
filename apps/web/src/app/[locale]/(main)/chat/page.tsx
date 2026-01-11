'use client';

import { useState } from 'react';
import { useTranslations } from 'next-intl';
import { useQuery } from '@tanstack/react-query';
import { motion, AnimatePresence } from 'framer-motion';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { ScrollArea } from '@/components/ui/scroll-area';
import { apiClient } from '@/lib/api';
import { PageContainer } from '@/components/layout';
import { LoadingState } from '@/components/ui/loading-state';
import { Badge } from '@/components/ui/badge';
import {
  Send,
  ArrowLeft,
  MessageSquare,
  Users,
  Search,
  MoreVertical,
  Phone,
  Video,
  Smile,
  Paperclip,
} from 'lucide-react';
import { cn } from '@/lib/utils';

export default function ChatPage() {
  const t = useTranslations();
  const [selectedConversation, setSelectedConversation] = useState<string | null>(null);
  const [message, setMessage] = useState('');
  const [showConversations, setShowConversations] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');

  const { data: conversationsData, isLoading } = useQuery({
    queryKey: ['conversations'],
    queryFn: () => apiClient.get<{ success: boolean; data: any[] }>('/chat/conversations'),
  });
  const conversations = conversationsData?.data || [];

  const { data: messagesData } = useQuery({
    queryKey: ['messages', selectedConversation],
    queryFn: () => apiClient.get<{ success: boolean; data: any[] }>(`/chat/conversations/${selectedConversation}/messages`),
    enabled: !!selectedConversation,
  });
  const messages = messagesData?.data || [];

  const handleSelectConversation = (id: string) => {
    setSelectedConversation(id);
    setShowConversations(false);
  };

  const handleBack = () => {
    setShowConversations(true);
    setSelectedConversation(null);
  };

  const filteredConversations = conversations.filter((conv: any) =>
    conv.otherUser?.email?.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const selectedUser = conversations?.find((c: any) => c.id === selectedConversation)?.otherUser;

  return (
    <PageContainer maxWidth="6xl">
      {/* 页面头部 */}
      <div className="relative mb-6 overflow-hidden rounded-2xl bg-gradient-to-br from-blue-500/10 via-background to-indigo-500/10 p-6">
        {/* 装饰元素 */}
        <div className="absolute -right-20 -top-20 h-48 w-48 rounded-full bg-gradient-to-br from-blue-500/20 to-indigo-500/20 blur-3xl" />
        
        <div className="relative z-10 flex items-center gap-4">
          <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-gradient-to-br from-blue-500 to-indigo-500 shadow-lg shadow-blue-500/25">
            <MessageSquare className="h-6 w-6 text-white" />
          </div>
          <div>
            <h1 className="text-2xl font-bold tracking-tight">{t('chat.title')}</h1>
            <p className="text-muted-foreground">{t('chat.description')}</p>
          </div>
        </div>
      </div>

      <div className="grid h-[calc(100vh-280px)] min-h-[500px] gap-4 md:grid-cols-3">
        {/* 会话列表 */}
        <Card className={cn(
          'md:col-span-1 overflow-hidden',
          !showConversations && 'hidden md:block'
        )}>
          <div className="h-1 bg-gradient-to-r from-blue-500 to-indigo-500" />
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
                    {filteredConversations.map((conv: any, index: number) => (
                      <motion.div
                        key={conv.id}
                        initial={{ opacity: 0, x: -10 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ delay: index * 0.05 }}
                        className={cn(
                          'flex cursor-pointer items-center gap-3 p-4 transition-all hover:bg-muted/50',
                          selectedConversation === conv.id && 'bg-gradient-to-r from-blue-500/10 to-transparent border-l-2 border-l-blue-500'
                        )}
                        onClick={() => handleSelectConversation(conv.id)}
                      >
                        <div className="relative">
                          <Avatar className="h-11 w-11 border-2 border-background shadow">
                            <AvatarFallback className="bg-gradient-to-br from-blue-500 to-indigo-500 text-white font-medium">
                              {conv.otherUser?.email?.[0]?.toUpperCase() || '?'}
                            </AvatarFallback>
                          </Avatar>
                          {/* 在线状态指示器 */}
                          <span className="absolute bottom-0 right-0 h-3 w-3 rounded-full bg-emerald-500 border-2 border-background" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center justify-between">
                            <span className="font-medium truncate">{conv.otherUser?.email}</span>
                            <span className="text-xs text-muted-foreground">12:30</span>
                          </div>
                          <p className="text-sm text-muted-foreground truncate">
                            {conv.lastMessage?.content || t('chat.noMessages')}
                          </p>
                        </div>
                        {conv.unreadCount > 0 && (
                          <span className="flex h-5 min-w-[20px] items-center justify-center rounded-full bg-blue-500 px-1.5 text-[10px] font-bold text-white">
                            {conv.unreadCount}
                          </span>
                        )}
                      </motion.div>
                    ))}
                  </AnimatePresence>
                </div>
              ) : (
                <div className="flex flex-col items-center justify-center py-12 px-4">
                  <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-blue-500/10 mb-4">
                    <MessageSquare className="h-8 w-8 text-blue-500/50" />
                  </div>
                  <p className="font-medium text-center">{t('chat.noMessages')}</p>
                  <p className="text-sm text-muted-foreground text-center mt-1">{t('chat.mutualFollowRequired')}</p>
                </div>
              )}
            </ScrollArea>
          </CardContent>
        </Card>

        {/* 消息区域 */}
        <Card className={cn(
          'flex flex-col md:col-span-2 overflow-hidden',
          showConversations && 'hidden md:flex'
        )}>
          <div className="h-1 bg-gradient-to-r from-indigo-500 to-purple-500" />
          {selectedConversation ? (
            <>
              {/* 聊天头部 */}
              <CardHeader className="border-b py-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <Button
                      variant="ghost"
                      size="icon"
                      className="md:hidden"
                      onClick={handleBack}
                    >
                      <ArrowLeft className="h-5 w-5" />
                    </Button>
                    <Avatar className="h-10 w-10 border-2 border-background shadow">
                      <AvatarFallback className="bg-gradient-to-br from-indigo-500 to-purple-500 text-white font-medium">
                        {selectedUser?.email?.[0]?.toUpperCase()}
                      </AvatarFallback>
                    </Avatar>
                    <div>
                      <p className="font-medium">{selectedUser?.email}</p>
                      <p className="text-xs text-emerald-500">{t('chat.online')}</p>
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
                {messages?.length ? (
                  <div className="space-y-4">
                    <AnimatePresence>
                      {messages
                        .slice()
                        .reverse()
                        .map((msg: any, index: number) => {
                          const isOwn = msg.senderId !== selectedUser?.id;
                          return (
                            <motion.div
                              key={msg.id}
                              initial={{ opacity: 0, y: 10 }}
                              animate={{ opacity: 1, y: 0 }}
                              transition={{ delay: index * 0.03 }}
                              className={cn(
                                'flex gap-3',
                                isOwn && 'flex-row-reverse'
                              )}
                            >
                              <Avatar className="h-8 w-8 shrink-0 border">
                                <AvatarFallback className={cn(
                                  'text-sm font-medium',
                                  isOwn
                                    ? 'bg-gradient-to-br from-blue-500 to-indigo-500 text-white'
                                    : 'bg-muted'
                                )}>
                                  {msg.sender?.email?.[0]?.toUpperCase()}
                                </AvatarFallback>
                              </Avatar>
                              <div className={cn(
                                'max-w-[70%] rounded-2xl px-4 py-2.5 shadow-sm',
                                isOwn
                                  ? 'bg-gradient-to-r from-blue-500 to-indigo-500 text-white rounded-br-md'
                                  : 'bg-muted rounded-bl-md'
                              )}>
                                <p className="text-sm">{msg.content}</p>
                                <p className={cn(
                                  'text-[10px] mt-1',
                                  isOwn ? 'text-white/70' : 'text-muted-foreground'
                                )}>12:30</p>
                              </div>
                            </motion.div>
                          );
                        })}
                    </AnimatePresence>
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
                <div className="flex items-center gap-2">
                  <Button variant="ghost" size="icon" className="shrink-0">
                    <Paperclip className="h-5 w-5 text-muted-foreground" />
                  </Button>
                  <div className="relative flex-1">
                    <Input
                      placeholder={t('chat.typeMessage')}
                      value={message}
                      onChange={(e) => setMessage(e.target.value)}
                      onKeyPress={(e) => e.key === 'Enter' && message.trim() && alert('Send via WebSocket')}
                      className="pr-10 h-11"
                    />
                    <button className="absolute right-3 top-1/2 -translate-y-1/2">
                      <Smile className="h-5 w-5 text-muted-foreground hover:text-foreground transition-colors" />
                    </button>
                  </div>
                  <Button
                    onClick={() => message.trim() && alert('Send via WebSocket')}
                    disabled={!message.trim()}
                    className="shrink-0 h-11 w-11 p-0 bg-gradient-to-r from-blue-500 to-indigo-500 hover:opacity-90"
                  >
                    <Send className="h-5 w-5" />
                  </Button>
                </div>
              </div>
            </>
          ) : (
            <div className="flex flex-1 items-center justify-center p-8">
              <div className="text-center">
                <div className="mx-auto mb-4 flex h-20 w-20 items-center justify-center rounded-2xl bg-gradient-to-br from-blue-500/10 to-indigo-500/10">
                  <MessageSquare className="h-10 w-10 text-blue-500/50" />
                </div>
                <h3 className="text-lg font-semibold">{t('chat.selectConversation')}</h3>
                <p className="mt-2 text-muted-foreground max-w-sm">{t('chat.selectConversationHint')}</p>
              </div>
            </div>
          )}
        </Card>
      </div>
    </PageContainer>
  );
}
