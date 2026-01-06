'use client';

import { motion, AnimatePresence } from 'framer-motion';
import { WifiOff, Wifi } from 'lucide-react';
import { useOfflineNotification } from '@/hooks/use-network-status';
import { cn } from '@/lib/utils';

interface OfflineIndicatorProps {
  className?: string;
  position?: 'top' | 'bottom';
}

/**
 * 离线状态指示器
 */
export function OfflineIndicator({
  className,
  position = 'bottom',
}: OfflineIndicatorProps) {
  const { isOffline, showNotification, dismiss } = useOfflineNotification();

  return (
    <AnimatePresence>
      {showNotification && (
        <motion.div
          initial={{ opacity: 0, y: position === 'top' ? -20 : 20 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: position === 'top' ? -20 : 20 }}
          transition={{ type: 'spring', stiffness: 400, damping: 30 }}
          className={cn(
            'fixed left-1/2 -translate-x-1/2 z-50',
            position === 'top' ? 'top-4' : 'bottom-4',
            className
          )}
        >
          <div
            className={cn(
              'flex items-center gap-2 px-4 py-2 rounded-full shadow-lg',
              isOffline
                ? 'bg-destructive text-destructive-foreground'
                : 'bg-success text-success-foreground'
            )}
          >
            {isOffline ? (
              <>
                <WifiOff className="w-4 h-4" />
                <span className="text-sm font-medium">当前离线</span>
              </>
            ) : (
              <>
                <Wifi className="w-4 h-4" />
                <span className="text-sm font-medium">已恢复连接</span>
              </>
            )}
            <button
              onClick={dismiss}
              className="ml-2 p-1 hover:bg-white/20 rounded-full transition-colors"
              aria-label="关闭"
            >
              ×
            </button>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

/**
 * 全屏离线页面
 */
export function OfflinePage() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-background">
      <motion.div
        initial={{ opacity: 0, scale: 0.9 }}
        animate={{ opacity: 1, scale: 1 }}
        className="text-center px-4"
      >
        <div className="w-20 h-20 mx-auto mb-6 rounded-full bg-muted flex items-center justify-center">
          <WifiOff className="w-10 h-10 text-muted-foreground" />
        </div>
        <h1 className="text-2xl font-bold mb-2">您当前离线</h1>
        <p className="text-muted-foreground mb-6 max-w-sm">
          请检查您的网络连接，部分功能可能暂时不可用
        </p>
        <button
          onClick={() => window.location.reload()}
          className="px-6 py-2 bg-primary text-primary-foreground rounded-lg hover:bg-primary/90 transition-colors"
        >
          重试
        </button>
      </motion.div>
    </div>
  );
}



