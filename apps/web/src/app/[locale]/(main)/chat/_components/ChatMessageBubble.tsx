'use client';

import { memo, useMemo, useRef, useCallback, useState } from 'react';
import { useTranslations, useLocale } from 'next-intl';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { cn } from '@/lib/utils';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  Check,
  CheckCheck,
  MoreHorizontal,
  Copy,
  Undo2,
  Trash2,
  Flag,
  Loader2,
} from 'lucide-react';
import type { Message, Conversation } from './types';
import { formatMessageTime, renderMessageContent, isWithinRecallWindow } from './utils';

interface ChatMessageBubbleProps {
  message: Message;
  isOwn: boolean;
  isNew: boolean;
  selectedUser: Conversation['otherUser'];
  otherReadAt: string | null;
  onDelete: (messageId: string) => void;
  onRecall: (messageId: string) => void;
  onCopy: (content: string) => void;
  onReportMessage: (messageId: string) => void;
}

export const ChatMessageBubble = memo(function ChatMessageBubble({
  message,
  isOwn,
  isNew,
  selectedUser,
  otherReadAt,
  onDelete,
  onRecall,
  onCopy,
  onReportMessage,
}: ChatMessageBubbleProps) {
  const t = useTranslations();
  const locale = useLocale();
  const [menuOpen, setMenuOpen] = useState(false);

  const isActionable = !message.isDeleted && !message.isRecalled;
  const isSending = message.status === 'sending';

  // Long-press detection for mobile
  const longPressTimer = useRef<ReturnType<typeof setTimeout>>(undefined);
  const handleTouchStart = useCallback(() => {
    if (!isActionable) return;
    longPressTimer.current = setTimeout(() => setMenuOpen(true), 300);
  }, [isActionable]);
  const handleTouchEnd = useCallback(() => {
    if (longPressTimer.current) clearTimeout(longPressTimer.current);
  }, []);
  const handleContextMenu = useCallback(
    (e: React.MouseEvent) => {
      if (!isActionable) return;
      e.preventDefault();
      setMenuOpen(true);
    },
    [isActionable]
  );

  /** 消息状态图标（基于已读回执） */
  const isRead = useMemo(() => {
    if (!otherReadAt) return false;
    return new Date(message.createdAt).getTime() <= new Date(otherReadAt).getTime();
  }, [message.createdAt, otherReadAt]);

  const statusIcon = isSending ? (
    <Loader2 className="h-3 w-3 animate-spin" />
  ) : isRead ? (
    <CheckCheck className="h-3 w-3 text-blue-400" />
  ) : (
    <Check className="h-3 w-3" />
  );

  return (
    <div
      className={cn(
        'flex gap-3 group',
        isOwn && 'flex-row-reverse',
        isNew && (isOwn ? 'animate-message-in-right' : 'animate-message-in-left'),
        isSending && 'opacity-70'
      )}
      onTouchStart={handleTouchStart}
      onTouchEnd={handleTouchEnd}
      onTouchCancel={handleTouchEnd}
      onContextMenu={handleContextMenu}
    >
      {/* 头像 */}
      <Avatar className="h-8 w-8 shrink-0 border">
        <AvatarImage src={message.sender?.profile?.avatarUrl} />
        <AvatarFallback
          className={cn('text-sm font-medium', isOwn ? 'bg-primary text-white' : 'bg-muted')}
        >
          {(message.sender?.profile?.nickname || message.sender?.email)?.[0]?.toUpperCase()}
        </AvatarFallback>
      </Avatar>

      {/* 操作按钮 + 气泡 */}
      <div className="flex items-center gap-1">
        {/* 自己的消息 — 操作菜单在气泡左侧 */}
        {isOwn && isActionable && !isSending && (
          <div className="opacity-0 group-hover:opacity-100 transition-opacity duration-150 hidden sm:block">
            <MessageActions
              message={message}
              isOwn={isOwn}
              menuOpen={menuOpen}
              onMenuOpenChange={setMenuOpen}
              onCopy={onCopy}
              onRecall={onRecall}
              onDelete={onDelete}
              onReport={onReportMessage}
              t={t}
            />
          </div>
        )}

        {/* 消息气泡 */}
        <div
          className={cn(
            'max-w-[70%] md:max-w-[60%] rounded-lg px-4 py-2.5 shadow-sm',
            message.isRecalled
              ? 'bg-muted/30 italic'
              : message.isDeleted
                ? 'bg-muted/50 italic'
                : isOwn
                  ? 'bg-primary text-white rounded-br-md'
                  : 'bg-muted rounded-bl-md'
          )}
        >
          {message.isRecalled ? (
            <p className="text-sm text-muted-foreground italic">
              {isOwn ? t('chat.youRecalledMessage') : t('chat.messageRecalled')}
            </p>
          ) : message.isDeleted ? (
            <p className="text-sm text-muted-foreground">{t('chat.messageDeleted')}</p>
          ) : (
            <>
              {message.mediaUrl && message.mediaType === 'image' && (
                <img
                  src={message.mediaUrl}
                  alt=""
                  className="rounded-md max-w-full max-h-60 mb-1"
                />
              )}
              {message.mediaUrl && message.mediaType === 'file' && (
                <a
                  href={message.mediaUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-2 text-sm underline mb-1"
                >
                  {message.mediaUrl.split('/').pop()}
                </a>
              )}
              <p className="text-sm whitespace-pre-wrap break-words">
                {renderMessageContent(message.content)}
              </p>
            </>
          )}

          {/* 时间 + 已读状态 */}
          <div className={cn('flex items-center gap-1 mt-1', isOwn ? 'justify-end' : '')}>
            <span
              className={cn(
                'text-2xs',
                message.isDeleted || message.isRecalled
                  ? 'text-muted-foreground'
                  : isOwn
                    ? 'text-white/70'
                    : 'text-muted-foreground'
              )}
            >
              {formatMessageTime(message.createdAt, locale)}
            </span>
            {isOwn && !message.isDeleted && !message.isRecalled && (
              <span className="text-white/70">{statusIcon}</span>
            )}
          </div>
        </div>

        {/* 对方消息 — 操作菜单在气泡右侧 */}
        {!isOwn && isActionable && (
          <div className="opacity-0 group-hover:opacity-100 transition-opacity duration-150 hidden sm:block">
            <MessageActions
              message={message}
              isOwn={isOwn}
              menuOpen={menuOpen}
              onMenuOpenChange={setMenuOpen}
              onCopy={onCopy}
              onRecall={onRecall}
              onDelete={onDelete}
              onReport={onReportMessage}
              t={t}
            />
          </div>
        )}
      </div>

      {/* 移动端长按菜单 — 通过 DropdownMenu 的 open 状态控制 */}
      {isActionable && !isSending && (
        <div className="sm:hidden">
          <DropdownMenu open={menuOpen} onOpenChange={setMenuOpen}>
            <DropdownMenuTrigger className="hidden" />
            <DropdownMenuContent align={isOwn ? 'start' : 'end'} className="w-48">
              <MessageMenuItems
                message={message}
                isOwn={isOwn}
                onCopy={onCopy}
                onRecall={onRecall}
                onDelete={onDelete}
                onReport={onReportMessage}
                t={t}
              />
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      )}
    </div>
  );
});

/** 桌面端消息操作下拉菜单 */
function MessageActions({
  message,
  isOwn,
  menuOpen,
  onMenuOpenChange,
  onCopy,
  onRecall,
  onDelete,
  onReport,
  t,
}: {
  message: Message;
  isOwn: boolean;
  menuOpen: boolean;
  onMenuOpenChange: (open: boolean) => void;
  onCopy: (content: string) => void;
  onRecall: (messageId: string) => void;
  onDelete: (messageId: string) => void;
  onReport: (messageId: string) => void;
  t: ReturnType<typeof useTranslations>;
}) {
  return (
    <DropdownMenu open={menuOpen} onOpenChange={onMenuOpenChange}>
      <DropdownMenuTrigger asChild>
        <button
          className={cn(
            'p-1.5 rounded-md hover:bg-muted text-muted-foreground',
            'transition-colors sm:p-1'
          )}
          aria-label={t('common.more')}
        >
          <MoreHorizontal className="h-4 w-4 sm:h-3.5 sm:w-3.5" />
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align={isOwn ? 'start' : 'end'} className="w-48">
        <MessageMenuItems
          message={message}
          isOwn={isOwn}
          onCopy={onCopy}
          onRecall={onRecall}
          onDelete={onDelete}
          onReport={onReport}
          t={t}
        />
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

/** 菜单项（桌面和移动端共用） */
function MessageMenuItems({
  message,
  isOwn,
  onCopy,
  onRecall,
  onDelete,
  onReport,
  t,
}: {
  message: Message;
  isOwn: boolean;
  onCopy: (content: string) => void;
  onRecall: (messageId: string) => void;
  onDelete: (messageId: string) => void;
  onReport: (messageId: string) => void;
  t: ReturnType<typeof useTranslations>;
}) {
  return (
    <>
      {/* 复制 */}
      <DropdownMenuItem onClick={() => onCopy(message.content)} className="gap-2">
        <Copy className="h-4 w-4" />
        {t('chat.copyMessage')}
      </DropdownMenuItem>

      <DropdownMenuSeparator />

      {/* 撤回 — 自己的消息, 2分钟内 */}
      {isOwn && isWithinRecallWindow(message.createdAt) && (
        <DropdownMenuItem onClick={() => onRecall(message.id)} className="gap-2">
          <Undo2 className="h-4 w-4" />
          {t('chat.recallMessage')}
        </DropdownMenuItem>
      )}

      {/* 删除 — 自己的消息 */}
      {isOwn && (
        <DropdownMenuItem
          variant="destructive"
          onClick={() => onDelete(message.id)}
          className="gap-2"
        >
          <Trash2 className="h-4 w-4" />
          {t('chat.deleteMessage')}
        </DropdownMenuItem>
      )}

      {/* 举报 — 对方的消息 */}
      {!isOwn && (
        <DropdownMenuItem
          variant="destructive"
          onClick={() => onReport(message.id)}
          className="gap-2"
        >
          <Flag className="h-4 w-4" />
          {t('chat.reportMessage')}
        </DropdownMenuItem>
      )}
    </>
  );
}
