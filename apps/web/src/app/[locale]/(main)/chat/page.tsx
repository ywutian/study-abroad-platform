'use client';

import { useState } from 'react';
import { useTranslations } from 'next-intl';
import { useQuery } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { ScrollArea } from '@/components/ui/scroll-area';
import { apiClient } from '@/lib/api';
import { PageContainer, PageHeader } from '@/components/layout';
import { LoadingState } from '@/components/ui/loading-state';
import { EmptyState } from '@/components/ui/empty-state';
import { Send, ArrowLeft, MessageSquare, Users } from 'lucide-react';
import { cn } from '@/lib/utils';

export default function ChatPage() {
  const t = useTranslations();
  const [selectedConversation, setSelectedConversation] = useState<string | null>(null);
  const [message, setMessage] = useState('');
  const [showConversations, setShowConversations] = useState(true);

  const { data: conversations, isLoading } = useQuery({
    queryKey: ['conversations'],
    queryFn: () => apiClient.get<any[]>('/chat/conversations'),
  });

  const { data: messages } = useQuery({
    queryKey: ['messages', selectedConversation],
    queryFn: () => apiClient.get<any[]>(`/chat/conversations/${selectedConversation}/messages`),
    enabled: !!selectedConversation,
  });

  const handleSelectConversation = (id: string) => {
    setSelectedConversation(id);
    setShowConversations(false);
  };

  const handleBack = () => {
    setShowConversations(true);
    setSelectedConversation(null);
  };

  return (
    <PageContainer>
      <PageHeader
        title={t('chat.title')}
        description="与其他申请者交流经验"
      />

      <div className="grid h-[calc(100vh-220px)] min-h-[500px] gap-4 md:grid-cols-3">
        {/* Conversations List */}
        <Card className={cn(
          'md:col-span-1',
          !showConversations && 'hidden md:block'
        )}>
          <CardHeader className="border-b py-4">
            <div className="flex items-center gap-2">
              <Users className="h-5 w-5 text-primary" />
              <CardTitle className="text-lg">{t('chat.conversations')}</CardTitle>
            </div>
          </CardHeader>
          <CardContent className="p-0">
            <ScrollArea className="h-[calc(100vh-340px)] min-h-[400px]">
              {isLoading ? (
                <div className="space-y-2 p-4">
                  <LoadingState variant="list" count={5} />
                </div>
              ) : conversations?.length ? (
                <div className="divide-y">
                  {conversations.map((conv: any) => (
                    <div
                      key={conv.id}
                      className={cn(
                        'flex cursor-pointer items-center gap-3 p-4 transition-colors hover:bg-muted/50',
                        selectedConversation === conv.id && 'bg-primary/5 border-l-2 border-l-primary'
                      )}
                      onClick={() => handleSelectConversation(conv.id)}
                    >
                      <Avatar className="h-10 w-10 border">
                        <AvatarFallback className="bg-primary/10 text-primary">
                          {conv.otherUser?.email?.[0]?.toUpperCase() || '?'}
                        </AvatarFallback>
                      </Avatar>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between">
                          <span className="font-medium truncate">{conv.otherUser?.email}</span>
                          {conv.unreadCount > 0 && (
                            <span className="ml-2 flex h-5 w-5 items-center justify-center rounded-full bg-primary text-[10px] font-medium text-primary-foreground">
                              {conv.unreadCount}
                            </span>
                          )}
                        </div>
                        <p className="text-sm text-muted-foreground truncate">
                          {conv.lastMessage?.content || '暂无消息'}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="p-4">
                  <EmptyState
                    type="empty"
                    title={t('chat.noMessages')}
                    description={t('chat.mutualFollowRequired')}
                  />
                </div>
              )}
            </ScrollArea>
          </CardContent>
        </Card>

        {/* Messages */}
        <Card className={cn(
          'flex flex-col md:col-span-2',
          showConversations && 'hidden md:flex'
        )}>
          {selectedConversation ? (
            <>
              {/* Header */}
              <CardHeader className="border-b py-3">
                <div className="flex items-center gap-3">
                  <Button
                    variant="ghost"
                    size="icon"
                    className="md:hidden"
                    onClick={handleBack}
                  >
                    <ArrowLeft className="h-5 w-5" />
                  </Button>
                  <Avatar className="h-8 w-8">
                    <AvatarFallback className="bg-primary/10 text-primary text-sm">
                      {conversations?.find((c: any) => c.id === selectedConversation)?.otherUser?.email?.[0]?.toUpperCase()}
                    </AvatarFallback>
                  </Avatar>
                  <span className="font-medium">
                    {conversations?.find((c: any) => c.id === selectedConversation)?.otherUser?.email}
                  </span>
                </div>
              </CardHeader>

              {/* Messages */}
              <ScrollArea className="flex-1 p-4">
                {messages?.length ? (
                  <div className="space-y-4">
                    {messages
                      .slice()
                      .reverse()
                      .map((msg: any, index: number) => {
                        const isOwn = msg.senderId !== conversations?.find((c: any) => c.id === selectedConversation)?.otherUser?.id;
                        return (
                          <div
                            key={msg.id}
                            className={cn(
                              'flex gap-3 animate-initial animate-fade-in',
                              isOwn && 'flex-row-reverse'
                            )}
                            style={{ animationDelay: `${index * 50}ms` }}
                          >
                            <Avatar className="h-8 w-8 shrink-0">
                              <AvatarFallback className={cn(
                                'text-sm',
                                isOwn ? 'bg-primary text-primary-foreground' : 'bg-muted'
                              )}>
                                {msg.sender?.email?.[0]?.toUpperCase()}
                              </AvatarFallback>
                            </Avatar>
                            <div className={cn(
                              'max-w-[70%] rounded-2xl px-4 py-2',
                              isOwn
                                ? 'bg-primary text-primary-foreground rounded-br-md'
                                : 'bg-muted rounded-bl-md'
                            )}>
                              <p className="text-sm">{msg.content}</p>
                            </div>
                          </div>
                        );
                      })}
                  </div>
                ) : (
                  <div className="flex h-full items-center justify-center">
                    <p className="text-muted-foreground">开始对话吧！</p>
                  </div>
                )}
              </ScrollArea>

              {/* Input */}
              <div className="border-t p-4">
                <div className="flex gap-2">
                  <Input
                    placeholder={t('chat.typeMessage')}
                    value={message}
                    onChange={(e) => setMessage(e.target.value)}
                    onKeyPress={(e) => e.key === 'Enter' && message.trim() && alert('Send via WebSocket')}
                    className="flex-1"
                  />
                  <Button
                    onClick={() => message.trim() && alert('Send via WebSocket')}
                    disabled={!message.trim()}
                  >
                    <Send className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            </>
          ) : (
            <div className="flex flex-1 items-center justify-center p-8">
              <EmptyState
                icon={<MessageSquare className="h-12 w-12" />}
                title="选择一个对话"
                description="从左侧列表选择一个对话开始聊天"
              />
            </div>
          )}
        </Card>
      </div>
    </PageContainer>
  );
}
