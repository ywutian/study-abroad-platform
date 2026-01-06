'use client';

/**
 * Agent 聊天核心组件 - 带动画效果
 */

import { useEffect, useRef } from 'react';
import { motion, AnimatePresence, useReducedMotion } from 'framer-motion';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Badge } from '@/components/ui/badge';
import { Trash2, Sparkles, Bot, RefreshCw } from 'lucide-react';
import { useAgentChat } from './use-agent-chat';
import { ChatMessage } from './chat-message';
import { ChatInput } from './chat-input';
import { AGENT_INFO, QUICK_ACTIONS, AgentType } from './types';
import { toast } from 'sonner';
import { transitions } from '@/lib/motion';

interface AgentChatProps {
  className?: string;
  conversationId?: string;
  showHeader?: boolean;
  showQuickActions?: boolean;
  compact?: boolean;
}

export function AgentChat({
  className,
  conversationId,
  showHeader = true,
  showQuickActions = true,
  compact = false,
}: AgentChatProps) {
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

  const scrollRef = useRef<HTMLDivElement>(null);
  const agentInfo = AGENT_INFO[currentAgent];
  const prefersReducedMotion = useReducedMotion();

  // 自动滚动到底部
  useEffect(() => {
    if (scrollRef.current) {
      const scrollElement = scrollRef.current.querySelector('[data-radix-scroll-area-viewport]');
      if (scrollElement) {
        scrollElement.scrollTop = scrollElement.scrollHeight;
      }
    }
  }, [messages]);

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
              <div className="flex items-center justify-center h-10 w-10 rounded-full bg-gradient-to-br from-primary/20 to-primary/5 ring-2 ring-primary/10">
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
              <h3 className="font-semibold text-sm">AI 留学顾问</h3>
              <div className="flex items-center gap-1.5">
                <motion.span
                  key={currentAgent}
                  initial={{ opacity: 0, x: -8 }}
                  animate={{ opacity: 1, x: 0 }}
                  className={cn('text-xs', agentInfo.color)}
                >
                  {agentInfo.name}
                </motion.span>
                <AnimatePresence>
                  {activeTools.length > 0 && (
                    <motion.div
                      initial={{ opacity: 0, scale: 0.8 }}
                      animate={{ opacity: 1, scale: 1 }}
                      exit={{ opacity: 0, scale: 0.8 }}
                    >
                      <Badge variant="secondary" className="text-[10px] px-1.5 py-0 h-4 gap-1">
                        <motion.span
                          animate={{ rotate: 360 }}
                          transition={{ duration: 1, repeat: Infinity, ease: 'linear' }}
                        >
                          <RefreshCw className="h-2.5 w-2.5" />
                        </motion.span>
                        处理中
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
              <span className="hidden sm:inline text-xs">清空</span>
            </Button>
          </motion.div>
        </motion.div>
      )}

      {/* Messages */}
      <ScrollArea ref={scrollRef} className="flex-1">
        <div className="p-4">
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
                <motion.div
                  variants={itemVariants}
                  className="relative mb-6"
                >
                  <motion.div
                    className="text-7xl"
                    animate={prefersReducedMotion ? {} : {
                      y: [0, -8, 0],
                      rotate: [0, -5, 5, 0],
                    }}
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
                  你好！我是留学申请助手
                </motion.h3>
                <motion.p
                  variants={itemVariants}
                  className="text-muted-foreground text-sm mb-8 max-w-sm leading-relaxed"
                >
                  我可以帮你分析档案竞争力、推荐适合的学校、指导文书写作、规划申请时间线
                </motion.p>

                {/* Quick Actions */}
                {showQuickActions && (
                  <motion.div
                    variants={itemVariants}
                    className="flex flex-wrap justify-center gap-2 max-w-md"
                  >
                    {QUICK_ACTIONS.map((action, idx) => (
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
                          onClick={() => sendMessage(action.message)}
                          className="text-xs rounded-full px-4 hover:bg-primary/5 hover:border-primary/50 hover:text-primary transition-all"
                        >
                          {action.label}
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
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </ScrollArea>

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
              {QUICK_ACTIONS.slice(0, 3).map((action, idx) => (
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
                    onClick={() => sendMessage(action.message)}
                    className="text-xs whitespace-nowrap h-7 rounded-full hover:bg-primary/5"
                  >
                    {action.label}
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
        placeholder="输入你的问题..."
      />
    </div>
  );
}
