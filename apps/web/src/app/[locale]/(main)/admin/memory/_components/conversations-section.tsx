'use client';

import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { PaginationControls } from '../../_components/pagination-controls';
import { apiClient } from '@/lib/api';
import { adminAiAgentRoutes } from '@study-abroad/shared';
import { useTranslations } from 'next-intl';
import { cn } from '@/lib/utils';
import { MessageSquare, Eye } from 'lucide-react';
import { ConversationItem, MessageItem, formatDate, truncate } from './types';

export function ConversationsSection() {
  const t = useTranslations('admin.memory');
  const [convUserId, setConvUserId] = useState('');
  const [convPage, setConvPage] = useState(1);
  const convPageSize = 20;

  const { data: convData } = useQuery({
    queryKey: ['memoryConversations', convUserId, convPage],
    queryFn: () =>
      apiClient.get<{ data: ConversationItem[]; total: number }>(
        adminAiAgentRoutes.memoryConversations(),
        {
          params: {
            ...(convUserId && { userId: convUserId }),
            page: String(convPage),
            pageSize: String(convPageSize),
          },
        }
      ),
  });

  const [viewConvId, setViewConvId] = useState<string | null>(null);
  const { data: convMessages } = useQuery({
    queryKey: ['memoryConvMessages', viewConvId],
    queryFn: () =>
      apiClient.get<MessageItem[]>(adminAiAgentRoutes.memoryConversationMessages(viewConvId!)),
    enabled: !!viewConvId,
  });

  return (
    <>
      <Card>
        <CardHeader>
          <div className="flex items-center gap-3">
            <MessageSquare className="h-5 w-5" />
            <div>
              <CardTitle className="text-base">{t('conversations')}</CardTitle>
              <CardDescription className="mt-1">{t('conversationsDesc')}</CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="flex gap-2 mb-4">
            <Input
              placeholder={t('userIdPlaceholder')}
              value={convUserId}
              onChange={(e) => {
                setConvUserId(e.target.value);
                setConvPage(1);
              }}
            />
          </div>
          {convData?.data && convData.data.length > 0 ? (
            <>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-[100px]">ID</TableHead>
                    <TableHead className="w-[100px]">User</TableHead>
                    <TableHead>Title</TableHead>
                    <TableHead>Summary</TableHead>
                    <TableHead className="w-[80px]">Agent</TableHead>
                    <TableHead className="w-[60px]">Msgs</TableHead>
                    <TableHead className="w-[140px]">Created</TableHead>
                    <TableHead className="w-[60px]" />
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {convData.data.map((conv) => (
                    <TableRow key={conv.id}>
                      <TableCell className="font-mono text-[10px] truncate max-w-[100px]">
                        {conv.id}
                      </TableCell>
                      <TableCell className="font-mono text-[10px] truncate max-w-[100px]">
                        {conv.userId}
                      </TableCell>
                      <TableCell className="text-xs truncate max-w-[150px]">
                        {conv.title || '-'}
                      </TableCell>
                      <TableCell className="text-xs truncate max-w-[150px]">
                        {conv.summary ? truncate(conv.summary, 40) : '-'}
                      </TableCell>
                      <TableCell>
                        {conv.agentType ? (
                          <Badge variant="outline" className="text-[10px]">
                            {conv.agentType}
                          </Badge>
                        ) : (
                          '-'
                        )}
                      </TableCell>
                      <TableCell className="text-xs text-center">{conv.messageCount}</TableCell>
                      <TableCell className="text-xs text-muted-foreground">
                        {formatDate(conv.createdAt)}
                      </TableCell>
                      <TableCell>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-7 w-7"
                          onClick={() => setViewConvId(conv.id)}
                          aria-label="View conversation"
                        >
                          <Eye className="h-3.5 w-3.5" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
              <PaginationControls
                page={convPage}
                totalPages={Math.ceil((convData.total || 0) / convPageSize)}
                total={convData.total || 0}
                pageSize={convPageSize}
                onPageChange={setConvPage}
              />
            </>
          ) : (
            <p className="text-sm text-muted-foreground py-4 text-center">No conversations found</p>
          )}
        </CardContent>
      </Card>

      {/* Conversation Messages Dialog */}
      <Dialog open={!!viewConvId} onOpenChange={(open) => !open && setViewConvId(null)}>
        <DialogContent className="sm:max-w-[700px] max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{t('viewMessages')}</DialogTitle>
            <DialogDescription>{viewConvId}</DialogDescription>
          </DialogHeader>
          <div className="space-y-3 py-2">
            {convMessages && Array.isArray(convMessages) ? (
              convMessages.map((msg) => (
                <div
                  key={msg.id}
                  className={cn(
                    'rounded-lg p-3 text-sm',
                    msg.role === 'user' && 'bg-blue-50 dark:bg-blue-900/20 ml-8',
                    msg.role === 'assistant' && 'bg-muted mr-8',
                    msg.role === 'tool' &&
                      'bg-amber-50 dark:bg-amber-900/20 mr-8 border-l-2 border-amber-400',
                    msg.role === 'system' && 'bg-slate-50 dark:bg-slate-900/20 text-xs italic'
                  )}
                >
                  <div className="flex items-center gap-2 mb-1">
                    <Badge variant="outline" className="text-[10px]">
                      {msg.role}
                    </Badge>
                    {msg.agentType && (
                      <Badge variant="secondary" className="text-[10px]">
                        {msg.agentType}
                      </Badge>
                    )}
                    {msg.tokensUsed && (
                      <span className="text-[10px] text-muted-foreground">
                        {msg.tokensUsed} tokens
                      </span>
                    )}
                    {msg.latencyMs && (
                      <span className="text-[10px] text-muted-foreground">{msg.latencyMs}ms</span>
                    )}
                  </div>
                  <p className="whitespace-pre-wrap text-xs">{truncate(msg.content, 500)}</p>
                  <p className="text-[10px] text-muted-foreground mt-1">
                    {formatDate(msg.createdAt)}
                  </p>
                </div>
              ))
            ) : (
              <p className="text-sm text-muted-foreground text-center py-4">Loading...</p>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
