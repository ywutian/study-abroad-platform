/**
 * P2P 聊天工具函数
 */

import { formatDistanceToNow, isToday, isYesterday, isSameDay, format } from 'date-fns';
import { zhCN, enUS } from 'date-fns/locale';
import type { Conversation, Message } from './types';

/** 获取用户显示名 */
export function getDisplayName(user?: Conversation['otherUser'] | null): string {
  if (!user) return '?';
  return user.profile?.nickname || user.profile?.realName || user.email;
}

/** 获取 date-fns locale */
export function getDateFnsLocale(locale: string) {
  return locale === 'zh' ? zhCN : enUS;
}

/** 格式化相对时间（会话列表用） */
export function formatTime(dateStr: string, locale: string): string {
  try {
    return formatDistanceToNow(new Date(dateStr), {
      addSuffix: true,
      locale: getDateFnsLocale(locale),
    });
  } catch {
    return '';
  }
}

/** 格式化消息时间（HH:mm） */
export function formatMessageTime(dateStr: string, locale: string): string {
  try {
    return format(new Date(dateStr), 'HH:mm', { locale: getDateFnsLocale(locale) });
  } catch {
    return '';
  }
}

/** 日期分隔线文本 */
export function getDateLabel(dateStr: string, locale: string, t: (key: string) => string): string {
  try {
    const date = new Date(dateStr);
    if (isToday(date)) return t('chat.today');
    if (isYesterday(date)) return t('chat.yesterday');
    return format(date, locale === 'zh' ? 'M月d日' : 'MMM d', {
      locale: getDateFnsLocale(locale),
    });
  } catch {
    return '';
  }
}

/** 判断是否需要日期分隔线 */
export function shouldShowDateSeparator(messages: Message[], index: number): boolean {
  if (index === 0) return true;
  return !isSameDay(new Date(messages[index].createdAt), new Date(messages[index - 1].createdAt));
}

/** 渲染消息内容（链接检测） */
export function renderMessageContent(content: string): React.ReactNode {
  const urlRegex = /(https?:\/\/[^\s<]+)/g;
  const parts = content.split(urlRegex);
  if (parts.length === 1) return content;
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
}

/** 判断消息是否在撤回时间窗口内（2分钟） */
export function isWithinRecallWindow(createdAt: string): boolean {
  const twoMinutesMs = 2 * 60 * 1000;
  return Date.now() - new Date(createdAt).getTime() < twoMinutesMs;
}
