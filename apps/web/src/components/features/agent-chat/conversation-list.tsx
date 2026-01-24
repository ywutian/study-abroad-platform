'use client';

/**
 * 企业级对话历史侧栏组件
 *
 * 功能：
 * - 浏览历史对话列表（按更新时间排序）
 * - 搜索过滤
 * - 恢复历史对话
 * - 删除对话（带确认）
 * - 新建对话
 * - 加载骨架屏 / 空状态
 * - Stagger 滑入动画
 */

import { useState, useMemo } from 'react';
import { useTranslations, useLocale } from 'next-intl';
import { motion, AnimatePresence } from 'framer-motion';
import { formatDistanceToNow } from 'date-fns';
import { zhCN, enUS } from 'date-fns/locale';
import { cn } from '@/lib/utils';
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from '@/components/ui/sheet';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Search, Plus, MoreHorizontal, Trash2, MessageCircle, Clock } from 'lucide-react';
import { staggerContainerFast, staggerItemSlide } from '@/lib/motion';
import { useConversationList, useDeleteConversation } from './use-chat-history';
import { AGENT_INFO, type AgentType, type ConversationSummary } from './types';
import { getLocalizedName } from '@/lib/i18n/locale-utils';
import { toast } from 'sonner';

interface ConversationListProps {
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  onSelectConversation: (id: string) => void;
  onNewConversation: () => void;
  currentConversationId?: string;
}

export function ConversationList({
  isOpen,
  onOpenChange,
  onSelectConversation,
  onNewConversation,
  currentConversationId,
}: ConversationListProps) {
  const t = useTranslations('agentChat');
  const locale = useLocale();
  const dateFnsLocale = locale === 'zh' ? zhCN : enUS;

  const [searchQuery, setSearchQuery] = useState('');
  const [deleteTarget, setDeleteTarget] = useState<string | null>(null);

  const { data: conversations, isLoading } = useConversationList();
  const deleteMutation = useDeleteConversation();

  // Client-side search filter
  const filteredConversations = useMemo(() => {
    if (!conversations) return [];
    if (!searchQuery.trim()) return conversations;
    const query = searchQuery.toLowerCase();
    return conversations.filter(
      (c) => c.title?.toLowerCase().includes(query) || c.summary?.toLowerCase().includes(query)
    );
  }, [conversations, searchQuery]);

  const handleDelete = async () => {
    if (!deleteTarget) return;
    try {
      await deleteMutation.mutateAsync(deleteTarget);
      toast.success(t('conversationDeleted'));
    } catch {
      // mutation error handled by react-query
    }
    setDeleteTarget(null);
  };

  const formatRelativeTime = (dateStr: string) => {
    try {
      return formatDistanceToNow(new Date(dateStr), {
        addSuffix: true,
        locale: dateFnsLocale,
      });
    } catch {
      return '';
    }
  };

  return (
    <>
      <Sheet open={isOpen} onOpenChange={onOpenChange}>
        <SheetContent side="left" className="p-0 flex flex-col sm:max-w-[380px]">
          <SheetHeader className="sr-only">
            <SheetTitle>{t('conversationHistory')}</SheetTitle>
            <SheetDescription>{t('noConversationsDesc')}</SheetDescription>
          </SheetHeader>

          {/* Header */}
          <div className="flex items-center justify-between px-4 py-3 border-b bg-muted/30">
            <div className="flex items-center gap-2">
              <Clock className="h-4 w-4 text-primary" />
              <h3 className="font-semibold text-sm">{t('conversationHistory')}</h3>
            </div>
            <Button
              size="sm"
              variant="default"
              className="gap-1.5 h-8"
              onClick={() => {
                onNewConversation();
                onOpenChange(false);
              }}
            >
              <Plus className="h-3.5 w-3.5" />
              {t('newConversation')}
            </Button>
          </div>

          {/* Search */}
          <div className="px-3 py-2 border-b">
            <div className="relative">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
              <Input
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder={t('searchConversations')}
                className="pl-8 h-8 text-sm"
              />
            </div>
          </div>

          {/* Conversation List */}
          <ScrollArea className="flex-1">
            <div className="py-1">
              {isLoading ? (
                <LoadingSkeleton />
              ) : filteredConversations.length === 0 ? (
                <EmptyState
                  hasSearch={searchQuery.trim().length > 0}
                  onNewConversation={() => {
                    onNewConversation();
                    onOpenChange(false);
                  }}
                  t={t}
                />
              ) : (
                <motion.div variants={staggerContainerFast} initial="hidden" animate="show">
                  {filteredConversations.map((conversation) => (
                    <ConversationItem
                      key={conversation.id}
                      conversation={conversation}
                      isActive={currentConversationId === conversation.id}
                      locale={locale}
                      formatRelativeTime={formatRelativeTime}
                      onSelect={() => {
                        onSelectConversation(conversation.id);
                        onOpenChange(false);
                      }}
                      onDelete={() => setDeleteTarget(conversation.id)}
                      t={t}
                    />
                  ))}
                </motion.div>
              )}
            </div>
          </ScrollArea>

          {/* Footer */}
          {conversations && conversations.length > 0 && (
            <div className="px-4 py-2 border-t">
              <span className="text-xs text-muted-foreground">
                {conversations.length} {t('conversations')}
              </span>
            </div>
          )}
        </SheetContent>
      </Sheet>

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={!!deleteTarget} onOpenChange={(open) => !open && setDeleteTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t('deleteConversation')}</AlertDialogTitle>
            <AlertDialogDescription>{t('deleteConfirm')}</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t('cancel')}</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {t('delete')}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}

// ─── Conversation Item ───────────────────────────────────────────────

interface ConversationItemProps {
  conversation: ConversationSummary;
  isActive: boolean;
  locale: string;
  formatRelativeTime: (dateStr: string) => string;
  onSelect: () => void;
  onDelete: () => void;
  t: ReturnType<typeof useTranslations>;
}

function ConversationItem({
  conversation,
  isActive,
  locale,
  formatRelativeTime,
  onSelect,
  onDelete,
  t,
}: ConversationItemProps) {
  const agentInfo = conversation.agentType ? AGENT_INFO[conversation.agentType as AgentType] : null;
  const agentName = agentInfo ? getLocalizedName(agentInfo.nameZh, agentInfo.name, locale) : null;

  const displayTitle =
    conversation.title ||
    conversation.summary?.slice(0, 50) ||
    `${t('newConversation')} #${conversation.id.slice(-6)}`;

  return (
    <motion.div
      variants={staggerItemSlide}
      onClick={onSelect}
      className={cn(
        'group flex items-start gap-3 px-3 py-3 mx-2 my-0.5 rounded-lg cursor-pointer',
        'transition-all duration-150',
        'hover:bg-muted/60',
        isActive && 'bg-primary/5 ring-1 ring-primary/20'
      )}
    >
      {/* Agent Icon */}
      <div
        className={cn(
          'flex h-9 w-9 shrink-0 items-center justify-center rounded-full',
          agentInfo ? 'bg-primary/10' : 'bg-primary/10'
        )}
      >
        <span className="text-base">{agentInfo?.icon || '🤖'}</span>
      </div>

      {/* Content */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center justify-between gap-2">
          <h4 className="text-sm font-medium line-clamp-1 group-hover:text-primary transition-colors">
            {displayTitle}
          </h4>
          {/* Actions - visible on hover */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                className="h-6 w-6 shrink-0 opacity-0 group-hover:opacity-100 transition-opacity"
                onClick={(e) => e.stopPropagation()}
              >
                <MoreHorizontal className="h-3.5 w-3.5" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem
                className="text-destructive focus:text-destructive"
                onClick={(e) => {
                  e.stopPropagation();
                  onDelete();
                }}
              >
                <Trash2 className="h-3.5 w-3.5 mr-2" />
                {t('deleteConversation')}
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>

        {/* Summary */}
        {conversation.summary && (
          <p className="text-xs text-muted-foreground line-clamp-1 mt-0.5">
            {conversation.summary}
          </p>
        )}

        {/* Meta: time + agent badge + message count */}
        <div className="flex items-center gap-2 mt-1.5 flex-wrap">
          <span className="text-2xs text-muted-foreground">
            {formatRelativeTime(conversation.updatedAt)}
          </span>
          {agentName && (
            <Badge variant="secondary" className={cn('text-2xs px-1.5 py-0 h-4', agentInfo?.color)}>
              {agentName}
            </Badge>
          )}
          <Badge variant="secondary" className="text-2xs px-1.5 py-0 h-4">
            {conversation.messageCount} {t('messages')}
          </Badge>
        </div>
      </div>
    </motion.div>
  );
}

// ─── Loading Skeleton ────────────────────────────────────────────────

function LoadingSkeleton() {
  return (
    <div className="space-y-1">
      {[1, 2, 3].map((i) => (
        <div key={i} className="flex items-start gap-3 px-3 py-3 mx-2">
          <Skeleton className="h-9 w-9 rounded-full shrink-0" />
          <div className="flex-1 space-y-2">
            <Skeleton className="h-4 w-3/4" />
            <Skeleton className="h-3 w-full" />
            <Skeleton className="h-3 w-1/3" />
          </div>
        </div>
      ))}
    </div>
  );
}

// ─── Empty State ─────────────────────────────────────────────────────

function EmptyState({
  hasSearch,
  onNewConversation,
  t,
}: {
  hasSearch: boolean;
  onNewConversation: () => void;
  t: ReturnType<typeof useTranslations>;
}) {
  return (
    <div className="flex flex-col items-center justify-center py-16 text-center px-4">
      <div className="h-12 w-12 rounded-full bg-primary/10 flex items-center justify-center mb-3">
        <MessageCircle className="h-6 w-6 text-primary" />
      </div>
      <p className="font-medium text-sm">
        {hasSearch ? t('noSearchResults') : t('noConversations')}
      </p>
      <p className="text-xs text-muted-foreground mt-1 max-w-[240px]">{t('noConversationsDesc')}</p>
      {!hasSearch && (
        <Button variant="outline" size="sm" className="mt-4 gap-1.5" onClick={onNewConversation}>
          <Plus className="h-3.5 w-3.5" />
          {t('newConversation')}
        </Button>
      )}
    </div>
  );
}
