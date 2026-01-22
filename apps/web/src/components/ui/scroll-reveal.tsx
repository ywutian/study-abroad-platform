'use client';

import { type ReactNode, type JSX } from 'react';
import { motion, Variants } from 'framer-motion';
import { useScrollAnimation, ScrollAnimationOptions } from '@/hooks/use-scroll-animation';
import { cn } from '@/lib/utils';

// 预设动画变体
const variants = {
  fadeUp: {
    hidden: { opacity: 0, y: 30 },
    visible: { opacity: 1, y: 0 },
  },
  fadeDown: {
    hidden: { opacity: 0, y: -30 },
    visible: { opacity: 1, y: 0 },
  },
  fadeLeft: {
    hidden: { opacity: 0, x: -30 },
    visible: { opacity: 1, x: 0 },
  },
  fadeRight: {
    hidden: { opacity: 0, x: 30 },
    visible: { opacity: 1, x: 0 },
  },
  scale: {
    hidden: { opacity: 0, scale: 0.9 },
    visible: { opacity: 1, scale: 1 },
  },
  blur: {
    hidden: { opacity: 0, filter: 'blur(10px)' },
    visible: { opacity: 1, filter: 'blur(0px)' },
  },
} satisfies Record<string, Variants>;

type AnimationVariant = keyof typeof variants;

interface ScrollRevealProps extends ScrollAnimationOptions {
  children: ReactNode;
  variant?: AnimationVariant;
  customVariants?: Variants;
  delay?: number;
  duration?: number;
  className?: string;
  as?: keyof JSX.IntrinsicElements;
}

/**
 * 滚动触发动画组件
 */
export function ScrollReveal({
  children,
  variant = 'fadeUp',
  customVariants,
  delay = 0,
  duration = 0.5,
  className,
  as = 'div',
  ...options
}: ScrollRevealProps) {
  const { ref, isInView } = useScrollAnimation<HTMLDivElement>(options);
  const selectedVariants = customVariants || variants[variant];

  const Component = motion[as as keyof typeof motion] as typeof motion.div;

  return (
    <Component
      ref={ref}
      initial="hidden"
      animate={isInView ? 'visible' : 'hidden'}
      variants={selectedVariants}
      transition={{
        duration,
        delay,
        ease: [0.16, 1, 0.3, 1],
      }}
      className={cn(className)}
    >
      {children}
    </Component>
  );
}

// 列表项专用组件
interface ScrollRevealItemProps {
  children: ReactNode;
  index: number;
  isVisible: boolean;
  variant?: AnimationVariant;
  staggerDelay?: number;
  className?: string;
}

export function ScrollRevealItem({
  children,
  index,
  isVisible,
  variant = 'fadeUp',
  staggerDelay = 0.08,
  className,
}: ScrollRevealItemProps) {
  const selectedVariants = variants[variant];

  return (
    <motion.div
      initial="hidden"
      animate={isVisible ? 'visible' : 'hidden'}
      variants={selectedVariants}
      transition={{
        duration: 0.4,
        delay: index * staggerDelay,
        ease: [0.16, 1, 0.3, 1],
      }}
      className={className}
    >
      {children}
    </motion.div>
  );
}

// 导出变体供外部使用
export { variants as scrollRevealVariants };
