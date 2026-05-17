/**
 * P2P 聊天工具函数
 */

import { formatDistanceToNow, isToday, isYesterday, isSameDay, format } from 'date-fns';
import { zhCN, enUS } from 'date-fns/locale';
import type { Conversation, Message } from './types';

/**
 * 2026-05 chat PII fix: never render a peer's raw email in the UI.
 * Backend already masks peer emails to `o***@d***.com`, but defense-in-
 * depth — if the API ever sends a real email through, the frontend
 * fallback here also strips it to the local-part only.
 */
function emailLocalPart(email: string | undefined | null): string | null {
  if (!email) return null;
  const at = email.indexOf('@');
  if (at <= 0) return null;
  // If the local part is already masked by the backend (`o***`), use it
  // as-is. Otherwise return only the username portion before `@`.
  return email.slice(0, at);
}

/** 获取用户显示名 */
export function getDisplayName(user?: Conversation['otherUser'] | null): string {
  if (!user) return '?';
  const fallback = emailLocalPart(user.email);
  return user.profile?.nickname || user.profile?.realName || fallback || '?';
}

export function getConversationTitle(conversation: Conversation): string {
  if (conversation.kind === 'MATCH_GROUP') {
    return (
      conversation.title ||
      conversation.participantPreview
        .map(
          (user) =>
            user.profile?.nickname || user.profile?.realName || emailLocalPart(user.email) || '?'
        )
        .join(', ') ||
      'Group chat'
    );
  }
  return getDisplayName(conversation.otherUser);
}

/**
 * Structured parts of a MATCH_GROUP conversation title.
 *
 * Backend currently serializes match conversations into a single title
 * string with the canonical shape:
 *
 *   "<competition> / <track> · <teamA> × <teamB>"
 *
 * (separators are localized: ` × ` for team-vs-team, ` · ` for
 * context-vs-teams, ` / ` inside the competition+track segment).
 *
 * The UI was previously cramming this 30+ character compound string
 * into a 320px right rail, where it inevitably truncated mid-name and
 * users could never see the actual matched team. Pulling it apart on
 * the client gives the panel a chance to render the structure
 * (competition badge → team A → × → team B) in a layout that
 * actually fits.
 *
 * NOTE: this is a transitional measure. The right long-term fix is a
 * backend schema change that exposes `teamA` / `teamB` / `competition`
 * as structured fields on `Conversation` — see follow-up issue. The
 * client-side parser here is intentionally defensive: any title that
 * doesn't match the expected shape falls back to a single line via
 * the `title` field on the returned object.
 */
export interface ParsedMatchTitle {
  /** Raw title as a single string — always set. */
  title: string;
  /** Left-of-`·`: competition + (optional) track. e.g. "Regeneron STS / Innovation Track". */
  context: string | null;
  /** Left team name (typically the viewer's team). */
  teamA: string | null;
  /** Right team name (the matched-with team). */
  teamB: string | null;
}

export function parseMatchTitle(title: string | null | undefined): ParsedMatchTitle {
  const raw = (title ?? '').trim();
  const empty: ParsedMatchTitle = { title: raw, context: null, teamA: null, teamB: null };
  if (!raw) return empty;

  // Tolerate both full-width and ASCII variants of the separators that
  // the backend has used historically.
  const contextSep = / [·•] /;
  const versusSep = / [×x✕] /i;

  let context: string | null = null;
  let teams = raw;

  const contextMatch = raw.split(contextSep);
  if (contextMatch.length >= 2) {
    context = contextMatch[0].trim() || null;
    teams = contextMatch.slice(1).join(' · ').trim();
  }

  const versusMatch = teams.split(versusSep);
  if (versusMatch.length === 2) {
    const [teamA, teamB] = versusMatch.map((t) => t.trim());
    return { title: raw, context, teamA: teamA || null, teamB: teamB || null };
  }

  // Title didn't follow the expected shape — keep raw for fallback rendering.
  return { title: raw, context, teamA: null, teamB: null };
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
