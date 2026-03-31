'use client';

/**
 * 聊天消息组件 - 支持 Markdown 渲染、动画和工具状态可视化
 */

import { memo, useState } from 'react';
import { useTranslations, useLocale } from 'next-intl';
import { motion, AnimatePresence, useReducedMotion } from 'framer-motion';
import { cn } from '@/lib/utils';
import { getLocalizedName } from '@/lib/i18n/locale-utils';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { User, Copy, Check, ChevronDown, ChevronUp, Sparkles, Wrench } from 'lucide-react';
import { ChatMessage as ChatMessageType, AGENT_INFO, AgentType } from './types';
import { useRouter } from '@/lib/i18n/navigation';
import { transitions } from '@/lib/motion';
import { ToolCallCard } from './tool-call-card';
import { ThinkingIndicator } from './thinking-indicator';
import { MessageContent } from './message-content';

/**
 * Security allowlist: only these action strings map to valid navigation routes.
 * Any action not in this map is silently ignored to prevent open-redirect attacks.
 */
const ALLOWED_ACTIONS: Record<string, string> = {
  'navigate:/schools': '/schools',
  'navigate:/cases': '/cases',
  'navigate:/pricing': '/settings/subscription',
  'navigate:/ranking': '/ranking',
  'navigate:/profile': '/profile',
};

interface ChatMessageProps {
  message: ChatMessageType;
  isLast?: boolean;
}

export const ChatMessage = memo(function ChatMessage({
  message,
  isLast: _isLast,
}: ChatMessageProps) {
  const t = useTranslations('agentChat');
  const router = useRouter();
  const locale = useLocale();
  const isUser = message.role === 'user';
  const agentInfo = message.agent ? AGENT_INFO[message.agent] : null;
  const agentName = agentInfo ? getLocalizedName(agentInfo.nameZh, agentInfo.name, locale) : null;
  const prefersReducedMotion = useReducedMotion();
  const [copied, setCopied] = useState(false);
  const [toolsExpanded, setToolsExpanded] = useState(true);

  // 复制消息内容
  const handleCopy = async () => {
    if (message.content) {
      await navigator.clipboard.writeText(message.content);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  // 消息入场动画
  const messageVariants = {
    hidden: {
      opacity: 0,
      y: 16,
      scale: 0.96,
      x: isUser ? 12 : -12,
    },
    visible: {
      opacity: 1,
      y: 0,
      scale: 1,
      x: 0,
      transition: transitions.springGentle,
    },
  };

  // 头像动画
  const avatarVariants = {
    hidden: { opacity: 0, scale: 0.5 },
    visible: {
      opacity: 1,
      scale: 1,
      transition: { ...transitions.springSnappy, delay: 0.1 },
    },
  };

  // 工具调用动画
  const toolVariants = {
    hidden: { opacity: 0, height: 0 },
    visible: {
      opacity: 1,
      height: 'auto',
      transition: transitions.springGentle,
    },
    exit: {
      opacity: 0,
      height: 0,
      transition: transitions.easeOutFast,
    },
  };

  if (prefersReducedMotion) {
    return (
      <StaticChatMessage
        message={message}
        agentInfo={agentInfo}
        agentName={agentName}
        isUser={isUser}
      />
    );
  }

  return (
    <motion.div
      variants={messageVariants}
      initial="hidden"
      animate="visible"
      className={cn('flex gap-3 group', isUser ? 'flex-row-reverse' : 'flex-row')}
    >
      {/* Avatar */}
      <motion.div variants={avatarVariants}>
        <Avatar
          className={cn(
            'h-8 w-8 shrink-0 ring-2 ring-background shadow-md',
            isUser ? 'bg-primary' : 'bg-primary/10'
          )}
        >
          <AvatarFallback
            className={cn('text-sm', isUser ? 'bg-primary text-primary-foreground' : '')}
          >
            {isUser ? (
              <User className="h-4 w-4" />
            ) : (
              <span className="text-lg">{agentInfo?.icon || '🤖'}</span>
            )}
          </AvatarFallback>
        </Avatar>
      </motion.div>

      {/* Content */}
      <div className={cn('flex flex-col gap-1 max-w-[80%]', isUser ? 'items-end' : 'items-start')}>
        {/* Agent Badge with animation */}
        {!isUser && agentInfo && (
          <motion.div
            initial={{ opacity: 0, x: -8 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.15 }}
            className="flex items-center gap-1.5"
          >
            <Sparkles className="h-3 w-3 text-primary/60" />
            <span className={cn('text-xs font-medium', agentInfo.color)}>{agentName}</span>
          </motion.div>
        )}

        {/* Message Bubble */}
        <motion.div
          className={cn(
            'relative rounded-lg px-4 py-2.5 shadow-sm',
            isUser
              ? 'bg-primary text-primary-foreground rounded-br-md'
              : 'bg-card border rounded-bl-md'
          )}
          whileHover={!isUser ? { scale: 1.005 } : undefined}
        >
          {/* Tool Calls - Collapsible */}
          <AnimatePresence>
            {message.toolCalls && message.toolCalls.length > 0 && (
              <motion.div
                variants={toolVariants}
                initial="hidden"
                animate="visible"
                exit="exit"
                className="mb-3"
              >
                {/* Tool Header */}
                <button
                  onClick={() => setToolsExpanded(!toolsExpanded)}
                  className={cn(
                    'flex items-center gap-2 text-xs w-full mb-2',
                    isUser ? 'text-primary-foreground/70' : 'text-muted-foreground'
                  )}
                >
                  <Wrench className="h-3 w-3" />
                  <span>{t('usingTools', { count: message.toolCalls.length })}</span>
                  {toolsExpanded ? (
                    <ChevronUp className="h-3 w-3 ml-auto" />
                  ) : (
                    <ChevronDown className="h-3 w-3 ml-auto" />
                  )}
                </button>

                {/* Tool List */}
                <AnimatePresence>
                  {toolsExpanded && (
                    <motion.div
                      initial={{ opacity: 0, height: 0 }}
                      animate={{ opacity: 1, height: 'auto' }}
                      exit={{ opacity: 0, height: 0 }}
                      className="space-y-1.5"
                    >
                      {message.toolCalls.map((tool, idx) => (
                        <ToolCallCard
                          key={`${tool.name}-${idx}`}
                          tool={tool}
                          isUser={isUser}
                          index={idx}
                        />
                      ))}
                    </motion.div>
                  )}
                </AnimatePresence>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Message Content - Streamdown 处理流式和完成态的 Markdown 渲染 */}
          {message.content ? (
            <div
              className={cn(
                'prose prose-sm max-w-none',
                isUser ? 'prose-invert' : 'dark:prose-invert'
              )}
            >
              <MessageContent content={message.content} isStreaming={message.isStreaming} />
            </div>
          ) : message.isStreaming ? (
            <ThinkingIndicator thinkingText={t('thinking')} />
          ) : null}

          {/* Copy Button (for assistant messages) */}
          {!isUser && message.content && !message.isStreaming && (
            <motion.div
              initial={{ opacity: 0 }}
              whileHover={{ opacity: 1 }}
              className="absolute -right-1 -top-1 opacity-0 group-hover:opacity-100 transition-opacity"
            >
              <Button
                size="icon"
                variant="ghost"
                className="h-6 w-6 rounded-full bg-background shadow-sm"
                onClick={handleCopy}
              >
                {copied ? <Check className="h-3 w-3 text-success" /> : <Copy className="h-3 w-3" />}
              </Button>
            </motion.div>
          )}
        </motion.div>

        {/* Action Buttons */}
        {!isUser && message.actions && message.actions.length > 0 && !message.isStreaming && (
          <motion.div
            initial={{ opacity: 0, y: 4 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
            className="flex flex-wrap gap-2 mt-1"
          >
            {message.actions.map((action, idx) => {
              const path = ALLOWED_ACTIONS[action.action];
              if (!path) return null;
              return (
                <Button
                  key={`${action.action}-${idx}`}
                  size="sm"
                  variant={action.variant || 'outline'}
                  onClick={() => router.push(path)}
                >
                  {action.label}
                </Button>
              );
            })}
          </motion.div>
        )}

        {/* Timestamp */}
        <motion.span
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.3 }}
          className="text-2xs text-muted-foreground px-1"
        >
          {formatTime(message.timestamp)}
        </motion.span>
      </div>
    </motion.div>
  );
});

// 静态版本（用于 reduced motion）
function StaticChatMessage({
  message,
  agentInfo,
  agentName,
  isUser,
}: {
  message: ChatMessageType;
  agentInfo: (typeof AGENT_INFO)[AgentType] | null;
  agentName: string | null;
  isUser: boolean;
}) {
  const router = useRouter();

  return (
    <div className={cn('flex gap-3', isUser ? 'flex-row-reverse' : 'flex-row')}>
      <Avatar className={cn('h-8 w-8 shrink-0', isUser ? 'bg-primary' : '')}>
        <AvatarFallback className={cn(isUser ? 'bg-primary text-primary-foreground' : '')}>
          {isUser ? <User className="h-4 w-4" /> : agentInfo?.icon || '🤖'}
        </AvatarFallback>
      </Avatar>
      <div className={cn('flex flex-col gap-1 max-w-[80%]', isUser ? 'items-end' : 'items-start')}>
        {!isUser && agentInfo && (
          <span className={cn('text-xs', agentInfo.color)}>{agentName}</span>
        )}
        <div
          className={cn(
            'rounded-lg px-4 py-2.5',
            isUser ? 'bg-primary text-primary-foreground rounded-br-sm' : 'bg-muted rounded-bl-sm'
          )}
        >
          <MessageContent content={message.content} isStreaming={false} />
        </div>
        {!isUser && message.actions && message.actions.length > 0 && !message.isStreaming && (
          <div className="flex flex-wrap gap-2 mt-1">
            {message.actions.map((action, idx) => {
              const path = ALLOWED_ACTIONS[action.action];
              if (!path) return null;
              return (
                <Button
                  key={`${action.action}-${idx}`}
                  size="sm"
                  variant={action.variant || 'outline'}
                  onClick={() => router.push(path)}
                >
                  {action.label}
                </Button>
              );
            })}
          </div>
        )}
        <span className="text-2xs text-muted-foreground px-1">{formatTime(message.timestamp)}</span>
      </div>
    </div>
  );
}

function formatTime(date: Date): string {
  return new Intl.DateTimeFormat(undefined, {
    hour: '2-digit',
    minute: '2-digit',
  }).format(date);
}
