'use client';

/**
 * 思考指示器组件 - AI 正在思考时的动画效果
 */

import { motion } from 'framer-motion';

interface ThinkingIndicatorProps {
  thinkingText: string;
}

export function ThinkingIndicator({ thinkingText }: ThinkingIndicatorProps) {
  return (
    <div className="flex items-center gap-2 py-1">
      <motion.div
        className="flex items-center gap-1"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
      >
        {[0, 1, 2].map((i) => (
          <motion.span
            key={i}
            className="w-2 h-2 rounded-full bg-primary/60"
            animate={{
              y: [0, -6, 0],
              scale: [1, 1.1, 1],
            }}
            transition={{
              duration: 0.6,
              repeat: Infinity,
              delay: i * 0.15,
              ease: 'easeInOut',
            }}
          />
        ))}
      </motion.div>
      <motion.span
        className="text-xs text-muted-foreground"
        animate={{ opacity: [0.5, 1, 0.5] }}
        transition={{ duration: 1.5, repeat: Infinity }}
      >
        {thinkingText}
      </motion.span>
    </div>
  );
}
