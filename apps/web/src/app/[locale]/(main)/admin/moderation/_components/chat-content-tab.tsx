'use client';

import { useState } from 'react';
import { useTranslations, useFormatter } from 'next-intl';
import { keepPreviousData, useQuery } from '@tanstack/react-query';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { ListSkeleton } from '@/components/ui/loading-state';
import { EmptyState } from '@/components/ui/empty-state';
import { PaginationControls } from '../../_components/pagination-controls';
import { apiClient } from '@/lib/api';
import { Search, Trash2, MessageSquare, ArrowLeft } from 'lucide-react';

interface Conversation {
  id: string;
  createdAt: string;
  participants: { user: { email: string } }[];
  _count?: { messages: number };
}

interface ChatMessage {
  id: string;
  content: string;
  createdAt: string;
  sender: { email: string };
}

interface ChatContentTabProps {
  pageSize: number;
  onDeleteRequest: (target: { type: string; id: string }) => void;
}

export function ChatContentTab({ pageSize, onDeleteRequest }: ChatContentTabProps) {
  const t = useTranslations('admin');
  const fmt = useFormatter();

  const [chatPage, setChatPage] = useState(1);
  const [chatSearch, setChatSearch] = useState('');
  const [selectedConvo, setSelectedConvo] = useState<string | null>(null);
  const [msgPage, setMsgPage] = useState(1);

  const { data: convosData, isLoading: convosLoading } = useQuery({
    // Keeps the rows on screen while the next page/filter loads.
    placeholderData: keepPreviousData,
    queryKey: ['adminChatConvos', chatSearch, chatPage],
    queryFn: () => {
      const params: Record<string, string> = { page: String(chatPage), pageSize: String(pageSize) };
      if (chatSearch) params.search = chatSearch;
      return apiClient.get<{ data: Conversation[]; total: number; totalPages: number }>(
        '/admin/chats/conversations',
        { params }
      );
    },
    enabled: !selectedConvo,
  });

  const { data: messagesData, isLoading: messagesLoading } = useQuery({
    placeholderData: keepPreviousData,
    queryKey: ['adminChatMessages', selectedConvo, msgPage],
    queryFn: () =>
      apiClient.get<{ data: ChatMessage[]; total: number; totalPages: number }>(
        `/admin/chats/conversations/${selectedConvo}/messages`,
        { params: { page: String(msgPage), pageSize: String(pageSize) } }
      ),
    enabled: !!selectedConvo,
  });

  if (selectedConvo) {
    return (
      <div className="space-y-4">
        <Button
          variant="ghost"
          size="sm"
          onClick={() => {
            setSelectedConvo(null);
            setMsgPage(1);
          }}
        >
          <ArrowLeft className="mr-2 h-4 w-4" />
          {t('contentMod.backToConversations')}
        </Button>

        {messagesLoading ? (
          <ListSkeleton count={5} />
        ) : messagesData?.data && messagesData.data.length > 0 ? (
          <>
            <Card>
              <ScrollArea className="h-[500px]">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>{t('contentMod.sender')}</TableHead>
                      <TableHead>{t('contentMod.content')}</TableHead>
                      <TableHead>{t('contentMod.sentAt')}</TableHead>
                      <TableHead className="w-[50px]"></TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {messagesData.data.map((msg) => (
                      <TableRow key={msg.id}>
                        <TableCell className="text-muted-foreground">{msg.sender?.email}</TableCell>
                        <TableCell className="max-w-[300px] truncate">{msg.content}</TableCell>
                        <TableCell className="text-muted-foreground">
                          {fmt.dateTime(new Date(msg.createdAt), 'medium')}
                        </TableCell>
                        <TableCell>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-10 w-10 text-destructive md:h-8 md:w-8"
                            onClick={() => onDeleteRequest({ type: 'message', id: msg.id })}
                            aria-label={t('contentMod.deleteMessage')}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </ScrollArea>
            </Card>
            <PaginationControls
              page={msgPage}
              totalPages={messagesData.totalPages ?? 1}
              total={messagesData.total ?? 0}
              pageSize={pageSize}
              onPageChange={setMsgPage}
            />
          </>
        ) : (
          <EmptyState
            icon={<MessageSquare className="h-12 w-12" />}
            title={t('contentMod.noMessages')}
            description={t('contentMod.noMessagesDesc')}
          />
        )}
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="relative">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          placeholder={t('contentMod.search')}
          value={chatSearch}
          onChange={(e) => {
            setChatSearch(e.target.value);
            setChatPage(1);
          }}
          className="pl-9"
        />
      </div>

      {convosLoading ? (
        <ListSkeleton count={5} />
      ) : convosData?.data && convosData.data.length > 0 ? (
        <>
          <Card>
            <ScrollArea className="h-[500px]">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>{t('contentMod.participants')}</TableHead>
                    <TableHead>{t('contentMod.messages')}</TableHead>
                    <TableHead>{t('contentMod.createdAt')}</TableHead>
                    <TableHead className="w-[100px]"></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {convosData.data.map((convo) => (
                    <TableRow key={convo.id}>
                      <TableCell>
                        {convo.participants
                          ?.map((p) => p.user?.email)
                          .filter(Boolean)
                          .join(', ') || '—'}
                      </TableCell>
                      <TableCell>{convo._count?.messages ?? 0}</TableCell>
                      <TableCell className="text-muted-foreground">
                        {fmt.dateTime(new Date(convo.createdAt), 'medium')}
                      </TableCell>
                      <TableCell>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => setSelectedConvo(convo.id)}
                        >
                          {t('contentMod.viewMessages')}
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </ScrollArea>
          </Card>
          <PaginationControls
            page={chatPage}
            totalPages={convosData.totalPages ?? 1}
            total={convosData.total ?? 0}
            pageSize={pageSize}
            onPageChange={setChatPage}
          />
        </>
      ) : (
        <EmptyState
          icon={<MessageSquare className="h-12 w-12" />}
          title={t('contentMod.noConversations')}
          description={t('contentMod.noConversationsDesc')}
        />
      )}
    </div>
  );
}
