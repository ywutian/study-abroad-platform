'use client';

/**
 * 页面过渡动画包装器
 */

import { ReactNode } from 'react';
import { motion, AnimatePresence, useReducedMotion } from 'framer-motion';
import { usePathname } from 'next/navigation';
import { transitions } from '@/lib/motion';

interface PageTransitionWrapperProps {
  children: ReactNode;
  className?: string;
}

/**
 * 全局页面过渡动画
 * 用于包装页面内容，提供入场/退场动画
 */
export function PageTransitionWrapper({ children, className }: PageTransitionWrapperProps) {
  const pathname = usePathname();
  const prefersReducedMotion = useReducedMotion();

  if (prefersReducedMotion) {
    return <div className={className}>{children}</div>;
  }

  return (
    <AnimatePresence mode="wait">
      <motion.div
        key={pathname}
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: -4 }}
        transition={transitions.easeOut}
        className={className}
      >
        {children}
      </motion.div>
    </AnimatePresence>
  );
}

/**
 * 页面内容区域动画
 * 用于包装主内容，提供更丰富的入场效果
 */
export function PageContent({ children, className }: PageTransitionWrapperProps) {
  const prefersReducedMotion = useReducedMotion();

  if (prefersReducedMotion) {
    return <div className={className}>{children}</div>;
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={transitions.springGentle}
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
      initial={{ opacity: 0, y: -12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ ...transitions.springGentle, delay: 0.1 }}
      className={className}
    >
      {children}
    </motion.div>
  );
}









