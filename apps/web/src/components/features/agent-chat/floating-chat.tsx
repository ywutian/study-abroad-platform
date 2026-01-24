'use client';

/**
 * 悬浮聊天窗口组件 - 全局可用
 *
 * 使用企业级 Hydration 安全方案
 */

import { useState, useEffect } from 'react';
import { useTranslations } from 'next-intl';
import { createPortal } from 'react-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { MessageCircle, X, Minus, Maximize2, Minimize2 } from 'lucide-react';
import { AgentChat } from './agent-chat';
import { useHydrated } from '@/hooks/use-hydration';

interface FloatingChatProps {
  defaultOpen?: boolean;
}

export function FloatingChat({ defaultOpen = false }: FloatingChatProps) {
  const t = useTranslations('agentChat');

  // 企业级 Hydration 安全方案：使用 useSyncExternalStore
  const isHydrated = useHydrated();

  const [isOpen, setIsOpen] = useState(defaultOpen);
  const [isMinimized, setIsMinimized] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [unreadCount, setUnreadCount] = useState(0);

  // 监听快捷键
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Ctrl/Cmd + K 打开/关闭
      if ((e.ctrlKey || e.metaKey) && e.key === 'k') {
        e.preventDefault();
        setIsOpen((prev) => !prev);
        if (!isOpen) setIsMinimized(false);
      }
      // Escape 关闭
      if (e.key === 'Escape' && isOpen) {
        setIsOpen(false);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen]);

  // SSR 时不渲染（避免 createPortal 和 framer-motion 导致 hydration mismatch）
  if (!isHydrated) return null;

  const chatWindow = (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          initial={{ opacity: 0, scale: 0.95, y: 20 }}
          animate={{
            opacity: 1,
            scale: 1,
            y: 0,
            width: isFullscreen ? '100vw' : isMinimized ? 320 : 420,
            height: isFullscreen ? '100vh' : isMinimized ? 56 : 600,
          }}
          exit={{ opacity: 0, scale: 0.95, y: 20 }}
          transition={{ type: 'spring', damping: 25, stiffness: 300 }}
          className={cn(
            'fixed z-50 overflow-hidden bg-background border shadow-2xl',
            isFullscreen ? 'inset-0 rounded-none' : 'bottom-24 right-6 rounded-lg'
          )}
          style={{
            boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.25)',
          }}
        >
          {/* Header */}
          <div className="flex items-center justify-between px-4 py-2 border-b bg-muted/30">
            <div className="flex items-center gap-2">
              <span className="text-lg">🤖</span>
              <span className="font-medium text-sm">{t('assistant')}</span>
              <kbd className="hidden sm:inline-flex h-5 items-center gap-1 rounded border bg-muted px-1.5 font-mono text-2xs font-medium text-muted-foreground">
                ⌘K
              </kbd>
            </div>
            <div className="flex items-center gap-1">
              {!isMinimized && (
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-7 w-7"
                  onClick={() => setIsFullscreen(!isFullscreen)}
                >
                  {isFullscreen ? (
                    <Minimize2 className="h-4 w-4" />
                  ) : (
                    <Maximize2 className="h-4 w-4" />
                  )}
                </Button>
              )}
              <Button
                variant="ghost"
                size="icon"
                className="h-7 w-7"
                onClick={() => setIsMinimized(!isMinimized)}
              >
                <Minus className="h-4 w-4" />
              </Button>
              <Button
                variant="ghost"
                size="icon"
                className="h-7 w-7"
                onClick={() => setIsOpen(false)}
              >
                <X className="h-4 w-4" />
              </Button>
            </div>
          </div>

          {/* Chat Content */}
          {!isMinimized && (
            <div className="h-[calc(100%-44px)]">
              <AgentChat showHeader={true} showQuickActions={true} compact={!isFullscreen} />
            </div>
          )}
        </motion.div>
      )}
    </AnimatePresence>
  );

  const floatingButton = (
    <AnimatePresence>
      {!isOpen && (
        <motion.div
          initial={{ opacity: 0, scale: 0 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0, scale: 0 }}
          className="fixed bottom-6 right-6 z-50"
        >
          <Button
            onClick={() => {
              setIsOpen(true);
              setIsMinimized(false);
              setUnreadCount(0);
            }}
            size="lg"
            className={cn(
              'h-14 w-14 rounded-full shadow-lg',
              'bg-primary',
              'hover:scale-105 hover:shadow-xl transition-all',
              'relative'
            )}
          >
            <MessageCircle className="h-6 w-6" />

            {/* Unread Badge */}
            {unreadCount > 0 && (
              <span className="absolute -top-1 -right-1 flex h-5 w-5 items-center justify-center rounded-full bg-destructive text-xs text-destructive-foreground">
                {unreadCount > 9 ? '9+' : unreadCount}
              </span>
            )}

            {/* Pulse Animation */}
            <span className="absolute inset-0 rounded-full animate-ping bg-primary/30" />
          </Button>

          {/* Tooltip */}
          <div className="absolute bottom-16 right-0 opacity-0 group-hover:opacity-100 transition-opacity">
            <div className="bg-popover text-popover-foreground rounded-lg px-3 py-1.5 text-sm shadow-md whitespace-nowrap">
              {t('title')} <kbd className="ml-1 text-xs text-muted-foreground">⌘K</kbd>
            </div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );

  return createPortal(
    <>
      {chatWindow}
      {floatingButton}
    </>,
    document.body
  );
}
