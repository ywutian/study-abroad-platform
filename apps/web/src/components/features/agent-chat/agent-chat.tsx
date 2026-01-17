'use client';

/**
 * Agent 聊天核心组件 - 企业级滚动实现
 */

import { useEffect, useRef, useState, useCallback } from 'react';
import { useTranslations, useLocale } from 'next-intl';
import { motion, AnimatePresence, useReducedMotion } from 'framer-motion';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Trash2, Sparkles, RefreshCw, ChevronDown } from 'lucide-react';
import { useAgentChat } from './use-agent-chat';
import { ChatMessage } from './chat-message';
import { ChatInput } from './chat-input';
import { AGENT_INFO, QUICK_ACTION_KEYS } from './types';
import { toast } from 'sonner';
import { transitions } from '@/lib/motion';
import { getLocalizedName } from '@/lib/i18n/locale-utils';

interface AgentChatProps {
  className?: string;
  conversationId?: string;
  showHeader?: boolean;
  showQuickActions?: boolean;
  compact?: boolean;
}

/**
 * 企业级滚动 Hook
 * - 智能检测用户是否在阅读历史消息
 * - 新消息时自动滚动（除非用户在阅读）
 * - 流式输出时渐进式滚动
 */
function useSmartScroll(deps: unknown[]) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [isAtBottom, setIsAtBottom] = useState(true);
  const [showScrollButton, setShowScrollButton] = useState(false);
  const isScrollingRef = useRef(false);
  const lastScrollHeightRef = useRef(0);

  // 检查是否在底部（允许 50px 误差）
  const checkIsAtBottom = useCallback(() => {
    const container = containerRef.current;
    if (!container) return true;
    const threshold = 50;
    return container.scrollHeight - container.scrollTop - container.clientHeight < threshold;
  }, []);

  // 滚动到底部
  const scrollToBottom = useCallback((smooth = true) => {
    const container = containerRef.current;
    if (!container) return;

    isScrollingRef.current = true;
    container.scrollTo({
      top: container.scrollHeight,
      behavior: smooth ? 'smooth' : 'auto',
    });

    // 滚动完成后重置标记
    setTimeout(
      () => {
        isScrollingRef.current = false;
        setIsAtBottom(true);
        setShowScrollButton(false);
      },
      smooth ? 300 : 0
    );
  }, []);

  // 监听滚动事件
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const handleScroll = () => {
      // 忽略程序触发的滚动
      if (isScrollingRef.current) return;

      const atBottom = checkIsAtBottom();
      setIsAtBottom(atBottom);
      setShowScrollButton(!atBottom && container.scrollHeight > container.clientHeight);
    };

    container.addEventListener('scroll', handleScroll, { passive: true });
    return () => container.removeEventListener('scroll', handleScroll);
  }, [checkIsAtBottom]);

  // 内容变化时自动滚动
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const currentScrollHeight = container.scrollHeight;
    const heightChanged = currentScrollHeight !== lastScrollHeightRef.current;
    lastScrollHeightRef.current = currentScrollHeight;

    // 如果用户在底部，自动滚动到新内容
    if (heightChanged && isAtBottom) {
      // 使用 requestAnimationFrame 确保 DOM 更新后再滚动
      requestAnimationFrame(() => {
        scrollToBottom(false); // 流式输出时不使用 smooth，避免卡顿
      });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);

  return {
    containerRef,
    isAtBottom,
    showScrollButton,
    scrollToBottom,
  };
}

export function AgentChat({
  className,
  conversationId,
  showHeader = true,
  showQuickActions = true,
  compact: _compact = false,
}: AgentChatProps) {
  const t = useTranslations('agentChat');
  const locale = useLocale();
  const {
    messages,
    isLoading,
    currentAgent,
    activeTools,
    sendMessage,
    stopGeneration,
    clearMessages,
  } = useAgentChat({
    conversationId,
    onError: (error) => toast.error(error),
  });

  const agentInfo = AGENT_INFO[currentAgent];
  const agentName = getLocalizedName(agentInfo.nameZh, agentInfo.name, locale);
  const prefersReducedMotion = useReducedMotion();

  // 企业级智能滚动
  const { containerRef, showScrollButton, scrollToBottom } = useSmartScroll([
    messages,
    messages[messages.length - 1]?.content, // 监听最后一条消息的内容变化（流式）
    isLoading,
  ]);

  // 空状态动画变体
  const emptyStateVariants = {
    hidden: { opacity: 0, y: 20 },
    visible: {
      opacity: 1,
      y: 0,
      transition: {
        ...transitions.springGentle,
        staggerChildren: 0.1,
        delayChildren: 0.2,
      },
    },
  };

  const itemVariants = {
    hidden: { opacity: 0, y: 16 },
    visible: { opacity: 1, y: 0 },
  };

  return (
    <div className={cn('flex flex-col h-full bg-background', className)}>
      {/* Header */}
      {showHeader && (
        <motion.div
          initial={prefersReducedMotion ? false : { opacity: 0, y: -8 }}
          animate={{ opacity: 1, y: 0 }}
          className="flex items-center justify-between px-4 py-3 border-b bg-background/95 backdrop-blur"
        >
          <div className="flex items-center gap-3">
            {/* Agent Avatar */}
            <motion.div
              className="relative"
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
            >
              <div className="flex items-center justify-center h-10 w-10 rounded-full bg-primary/10 ring-2 ring-primary/10">
                <span className="text-xl">{agentInfo.icon}</span>
              </div>
              {/* Online indicator */}
              <motion.span
                className="absolute -bottom-0.5 -right-0.5 h-3 w-3 rounded-full bg-green-500 ring-2 ring-background"
                animate={{ scale: [1, 1.2, 1] }}
                transition={{ duration: 2, repeat: Infinity }}
              />
            </motion.div>

            <div>
              <h3 className="font-semibold text-sm">{t('title')}</h3>
              <div className="flex items-center gap-1.5">
                <motion.span
                  key={currentAgent}
                  initial={{ opacity: 0, x: -8 }}
                  animate={{ opacity: 1, x: 0 }}
                  className={cn('text-xs', agentInfo.color)}
                >
                  {agentName}
                </motion.span>
                <AnimatePresence>
                  {activeTools.length > 0 && (
                    <motion.div
                      initial={{ opacity: 0, scale: 0.8 }}
                      animate={{ opacity: 1, scale: 1 }}
                      exit={{ opacity: 0, scale: 0.8 }}
                    >
                      <Badge variant="secondary" className="text-2xs px-1.5 py-0 h-4 gap-1">
                        <motion.span
                          animate={{ rotate: 360 }}
                          transition={{ duration: 1, repeat: Infinity, ease: 'linear' }}
                        >
                          <RefreshCw className="h-2.5 w-2.5" />
                        </motion.span>
                        {t('processing')}
                      </Badge>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            </div>
          </div>

          <motion.div whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }}>
            <Button
              variant="ghost"
              size="sm"
              onClick={clearMessages}
              disabled={messages.length === 0 || isLoading}
              className="gap-1.5 text-muted-foreground hover:text-destructive"
            >
              <Trash2 className="h-4 w-4" />
              <span className="hidden sm:inline text-xs">{t('clear')}</span>
            </Button>
          </motion.div>
        </motion.div>
      )}

      {/* Messages Container with Smart Scroll */}
      <div className="relative flex-1 overflow-hidden">
        <div
          ref={containerRef}
          className="h-full overflow-y-auto scroll-smooth scrollbar-thin scrollbar-thumb-border scrollbar-track-transparent"
        >
          <div className="p-4 min-h-full">
            <AnimatePresence mode="popLayout">
              {messages.length === 0 ? (
                <motion.div
                  key="empty"
                  variants={emptyStateVariants}
                  initial="hidden"
                  animate="visible"
                  exit={{ opacity: 0, scale: 0.95 }}
                  className="flex flex-col items-center justify-center h-full min-h-[400px] text-center"
                >
                  {/* Animated Logo */}
                  <motion.div variants={itemVariants} className="relative mb-6">
                    <motion.div
                      className="text-7xl"
                      animate={
                        prefersReducedMotion
                          ? {}
                          : {
                              y: [0, -8, 0],
                              rotate: [0, -5, 5, 0],
                            }
                      }
                      transition={{
                        duration: 4,
                        repeat: Infinity,
                        ease: 'easeInOut',
                      }}
                    >
                      🎓
                    </motion.div>
                    {/* Sparkle effects */}
                    {!prefersReducedMotion && (
                      <>
                        <motion.span
                          className="absolute -top-2 -right-2 text-lg"
                          animate={{
                            scale: [0, 1, 0],
                            rotate: [0, 180],
                          }}
                          transition={{ duration: 2, repeat: Infinity, delay: 0.5 }}
                        >
                          ✨
                        </motion.span>
                        <motion.span
                          className="absolute -bottom-1 -left-3 text-sm"
                          animate={{
                            scale: [0, 1, 0],
                            rotate: [0, -180],
                          }}
                          transition={{ duration: 2, repeat: Infinity, delay: 1 }}
                        >
                          ⭐
                        </motion.span>
                      </>
                    )}
                  </motion.div>

                  <motion.h3 variants={itemVariants} className="text-lg font-semibold mb-2">
                    {t('welcome')}
                  </motion.h3>
                  <motion.p
                    variants={itemVariants}
                    className="text-muted-foreground text-sm mb-8 max-w-sm leading-relaxed"
                  >
                    {t('welcomeDesc')}
                  </motion.p>

                  {/* Quick Actions */}
                  {showQuickActions && (
                    <motion.div
                      variants={itemVariants}
                      className="flex flex-wrap justify-center gap-2 max-w-md"
                    >
                      {QUICK_ACTION_KEYS.map((action, idx) => (
                        <motion.div
                          key={idx}
                          initial={{ opacity: 0, scale: 0.8 }}
                          animate={{ opacity: 1, scale: 1 }}
                          transition={{ delay: 0.4 + idx * 0.1 }}
                          whileHover={{ scale: 1.05, y: -2 }}
                          whileTap={{ scale: 0.95 }}
                        >
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => sendMessage(t(`quickActions.${action.messageKey}`))}
                            className="text-xs rounded-full px-4 hover:bg-primary/5 hover:border-primary/50 hover:text-primary transition-all"
                          >
                            {t(`quickActions.${action.labelKey}`)}
                          </Button>
                        </motion.div>
                      ))}
                    </motion.div>
                  )}
                </motion.div>
              ) : (
                <motion.div
                  key="messages"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  className="space-y-4"
                >
                  {messages.map((message, index) => (
                    <ChatMessage
                      key={message.id}
                      message={message}
                      isLast={index === messages.length - 1}
                    />
                  ))}
                  {/* 底部占位，确保最后一条消息可见 */}
                  <div className="h-4" aria-hidden="true" />
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </div>

        {/* Scroll to Bottom Button */}
        <AnimatePresence>
          {showScrollButton && (
            <motion.div
              initial={{ opacity: 0, scale: 0.8, y: 10 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.8, y: 10 }}
              className="absolute bottom-4 right-4"
            >
              <Button
                size="icon"
                variant="secondary"
                onClick={() => scrollToBottom(true)}
                className="h-10 w-10 rounded-full shadow-lg border bg-background/95 backdrop-blur hover:bg-background"
              >
                <ChevronDown className="h-5 w-5" />
                <span className="sr-only">{t('scrollToBottom')}</span>
              </Button>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Quick Actions (when has messages) */}
      <AnimatePresence>
        {showQuickActions && messages.length > 0 && !isLoading && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            className="px-4 pb-2 overflow-hidden"
          >
            <div className="flex items-center gap-2 overflow-x-auto scrollbar-none py-1">
              <Sparkles className="h-3 w-3 text-muted-foreground shrink-0" />
              {QUICK_ACTION_KEYS.slice(0, 3).map((action, idx) => (
                <motion.div
                  key={idx}
                  initial={{ opacity: 0, x: -8 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: idx * 0.05 }}
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                >
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => sendMessage(t(`quickActions.${action.messageKey}`))}
                    className="text-xs whitespace-nowrap h-7 rounded-full hover:bg-primary/5"
                  >
                    {t(`quickActions.${action.labelKey}`)}
                  </Button>
                </motion.div>
              ))}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Input */}
      <ChatInput
        onSend={sendMessage}
        onStop={stopGeneration}
        isLoading={isLoading}
        placeholder={t('placeholder')}
      />
    </div>
  );
}
