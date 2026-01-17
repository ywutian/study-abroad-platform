'use client';

/**
 * 页面过渡动画包装器 - 柔和丝滑的切换体验
 */

import { ReactNode } from 'react';
import { motion, AnimatePresence, useReducedMotion } from 'framer-motion';
import { usePathname } from 'next/navigation';

interface PageTransitionWrapperProps {
  children: ReactNode;
  className?: string;
}

/**
 * 全局页面过渡动画
 *
 * 优化要点：
 * - 使用 popLayout 模式：新旧页面同时过渡，减少感知延迟
 * - 去掉 filter: blur()：避免 GPU 性能消耗，尤其在低端设备
 * - 缩短动画时长至 0.2s：让切换更加干脆利落
 * - 退出动画更轻量：仅淡出，不偏移
 */
export function PageTransitionWrapper({ children, className }: PageTransitionWrapperProps) {
  const pathname = usePathname();
  const prefersReducedMotion = useReducedMotion();

  if (prefersReducedMotion) {
    return <div className={className}>{children}</div>;
  }

  return (
    <AnimatePresence mode="popLayout">
      <motion.div
        key={pathname}
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0 }}
        transition={{
          type: 'tween',
          ease: [0.25, 0.46, 0.45, 0.94],
          duration: 0.2,
        }}
        className={className}
      >
        {children}
      </motion.div>
    </AnimatePresence>
  );
}

/**
 * 页面内容区域动画
 * 用于包装主内容，提供柔和的入场效果
 */
export function PageContent({ children, className }: PageTransitionWrapperProps) {
  const prefersReducedMotion = useReducedMotion();

  if (prefersReducedMotion) {
    return <div className={className}>{children}</div>;
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{
        type: 'spring',
        stiffness: 260,
        damping: 28,
        mass: 0.8,
      }}
      className={className}
    >
      {children}
    </motion.div>
  );
}

/**
 * 页面头部区域动画
 */
export function PageHeaderMotion({ children, className }: PageTransitionWrapperProps) {
  const prefersReducedMotion = useReducedMotion();

  if (prefersReducedMotion) {
    return <div className={className}>{children}</div>;
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: -8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{
        type: 'spring',
        stiffness: 280,
        damping: 26,
        delay: 0.08,
      }}
      className={className}
    >
      {children}
    </motion.div>
  );
}
