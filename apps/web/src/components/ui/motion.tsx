'use client';

/**
 * Motion 组件集合 - 基于 Framer Motion 的可复用动画组件
 */

import { forwardRef, ReactNode } from 'react';
import {
  motion,
  HTMLMotionProps,
  AnimatePresence,
  useInView,
  useReducedMotion,
  MotionProps,
} from 'framer-motion';
import { useFormatter, useLocale } from 'next-intl';
import { toBcp47 } from '@/lib/i18n/locale-utils';
import { cn } from '@/lib/utils';
import {
  fadeIn,
  fadeInUp,
  fadeInDown,
  fadeInLeft,
  fadeInRight,
  scaleIn,
  popIn,
  staggerContainer,
  staggerItem,
  cardHover,
  buttonTap,
  messageIn,
  messageInLeft,
  messageInRight,
  transitions,
} from '@/lib/motion';
import { useRef } from 'react';

// ============================================
// 基础 Motion 包装器
// ============================================

interface MotionDivProps extends HTMLMotionProps<'div'> {
  children: ReactNode;
}

export const MotionDiv = motion.div;
export const MotionSpan = motion.span;
export const MotionButton = motion.button;
export const MotionUl = motion.ul;
export const MotionLi = motion.li;

// ============================================
// 页面过渡组件
// ============================================

interface PageTransitionProps {
  children: ReactNode;
  className?: string;
}

export function PageTransition({ children, className }: PageTransitionProps) {
  const prefersReducedMotion = useReducedMotion();

  if (prefersReducedMotion) {
    return <div className={className}>{children}</div>;
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -8 }}
      transition={transitions.easeOut}
      className={className}
    >
      {children}
    </motion.div>
  );
}

// ============================================
// 滚动触发入场动画
// ============================================

interface FadeInViewProps extends MotionDivProps {
  direction?: 'up' | 'down' | 'left' | 'right' | 'none';
  delay?: number;
  threshold?: number;
  once?: boolean;
}

export function FadeInView({
  children,
  direction = 'up',
  delay = 0,
  threshold = 0.1,
  once = true,
  className,
  ...props
}: FadeInViewProps) {
  const ref = useRef(null);
  const isInView = useInView(ref, { once, amount: threshold });
  const prefersReducedMotion = useReducedMotion();

  const variants = {
    up: fadeInUp,
    down: fadeInDown,
    left: fadeInLeft,
    right: fadeInRight,
    none: fadeIn,
  };

  if (prefersReducedMotion) {
    return (
      <div ref={ref} className={className}>
        {children}
      </div>
    );
  }

  return (
    <motion.div
      ref={ref}
      variants={variants[direction]}
      initial="hidden"
      animate={isInView ? 'visible' : 'hidden'}
      transition={{ ...transitions.springGentle, delay }}
      className={className}
      {...props}
    >
      {children}
    </motion.div>
  );
}

// ============================================
// Staggered 列表容器
// ============================================

interface StaggerContainerProps extends MotionDivProps {
  staggerDelay?: number;
  delayChildren?: number;
}

export function StaggerContainer({
  children,
  staggerDelay = 0.05,
  delayChildren = 0.1,
  className,
  ...props
}: StaggerContainerProps) {
  const prefersReducedMotion = useReducedMotion();

  if (prefersReducedMotion) {
    return <div className={className}>{children}</div>;
  }

  return (
    <motion.div
      variants={{
        hidden: { opacity: 0 },
        show: {
          opacity: 1,
          transition: {
            staggerChildren: staggerDelay,
            delayChildren,
          },
        },
      }}
      initial="hidden"
      animate="show"
      className={className}
      {...props}
    >
      {children}
    </motion.div>
  );
}

// ============================================
// Staggered 列表项
// ============================================

interface StaggerItemProps extends MotionDivProps {
  variant?: 'fade' | 'scale' | 'slide';
}

export function StaggerItem({ children, variant = 'fade', className, ...props }: StaggerItemProps) {
  const prefersReducedMotion = useReducedMotion();

  const variants = {
    fade: staggerItem,
    scale: {
      hidden: { opacity: 0, scale: 0.9 },
      show: { opacity: 1, scale: 1, transition: transitions.spring },
    },
    slide: {
      hidden: { opacity: 0, x: -16 },
      show: { opacity: 1, x: 0, transition: transitions.springGentle },
    },
  };

  if (prefersReducedMotion) {
    return <div className={className}>{children}</div>;
  }

  return (
    <motion.div variants={variants[variant]} className={className} {...props}>
      {children}
    </motion.div>
  );
}

// ============================================
// 弹入组件
// ============================================

interface PopInProps extends MotionDivProps {
  delay?: number;
}

export function PopIn({ children, delay = 0, className, ...props }: PopInProps) {
  const prefersReducedMotion = useReducedMotion();

  if (prefersReducedMotion) {
    return <div className={className}>{children}</div>;
  }

  return (
    <motion.div
      variants={popIn}
      initial="hidden"
      animate="visible"
      exit="exit"
      transition={{ ...transitions.springSnappy, delay }}
      className={className}
      {...props}
    >
      {children}
    </motion.div>
  );
}

// ============================================
// 3D 卡片 (鼠标跟随)
// ============================================

interface Card3DProps extends HTMLMotionProps<'div'> {
  children: ReactNode;
  intensity?: number;
  glare?: boolean;
}

export const Card3D = forwardRef<HTMLDivElement, Card3DProps>(
  ({ children, intensity = 10, glare = true, className, ...props }, ref) => {
    const prefersReducedMotion = useReducedMotion();

    const handleMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
      if (prefersReducedMotion) return;

      const card = e.currentTarget;
      const rect = card.getBoundingClientRect();
      const x = e.clientX - rect.left;
      const y = e.clientY - rect.top;
      const centerX = rect.width / 2;
      const centerY = rect.height / 2;
      const rotateX = ((y - centerY) / centerY) * -intensity;
      const rotateY = ((x - centerX) / centerX) * intensity;

      card.style.transform = `perspective(1000px) rotateX(${rotateX}deg) rotateY(${rotateY}deg) scale3d(1.02, 1.02, 1.02)`;

      if (glare) {
        const glareEl = card.querySelector('.card-glare') as HTMLElement;
        if (glareEl) {
          const glareX = (x / rect.width) * 100;
          const glareY = (y / rect.height) * 100;
          glareEl.style.background = `radial-gradient(circle at ${glareX}% ${glareY}%, rgba(255,255,255,0.15) 0%, transparent 60%)`;
        }
      }
    };

    const handleMouseLeave = (e: React.MouseEvent<HTMLDivElement>) => {
      const card = e.currentTarget;
      card.style.transform = 'perspective(1000px) rotateX(0) rotateY(0) scale3d(1, 1, 1)';

      if (glare) {
        const glareEl = card.querySelector('.card-glare') as HTMLElement;
        if (glareEl) {
          glareEl.style.background = 'transparent';
        }
      }
    };

    return (
      <motion.div
        ref={ref}
        className={cn(
          'relative overflow-hidden transition-transform duration-200 ease-out',
          className
        )}
        onMouseMove={handleMouseMove}
        onMouseLeave={handleMouseLeave}
        style={{ transformStyle: 'preserve-3d' }}
        {...props}
      >
        {children}
        {glare && (
          <div className="card-glare pointer-events-none absolute inset-0 transition-opacity duration-300" />
        )}
      </motion.div>
    );
  }
);

Card3D.displayName = 'Card3D';

// ============================================
// 可点击动效按钮包装
// ============================================

interface TapScaleProps extends HTMLMotionProps<'div'> {
  children: ReactNode;
  scale?: number;
}

export function TapScale({ children, scale = 0.96, className, ...props }: TapScaleProps) {
  const prefersReducedMotion = useReducedMotion();

  if (prefersReducedMotion) {
    return <div className={className}>{children}</div>;
  }

  return (
    <motion.div
      whileTap={{ scale }}
      transition={transitions.springSnappy}
      className={className}
      {...props}
    >
      {children}
    </motion.div>
  );
}

// ============================================
// 聊天消息动画
// ============================================

interface ChatMessageMotionProps extends MotionDivProps {
  isOwn?: boolean;
  index?: number;
}

export function ChatMessageMotion({
  children,
  isOwn = false,
  index = 0,
  className,
  ...props
}: ChatMessageMotionProps) {
  const prefersReducedMotion = useReducedMotion();

  if (prefersReducedMotion) {
    return <div className={className}>{children}</div>;
  }

  return (
    <motion.div
      variants={isOwn ? messageInRight : messageInLeft}
      initial="hidden"
      animate="visible"
      transition={{ ...transitions.springGentle, delay: index * 0.05 }}
      className={className}
      {...props}
    >
      {children}
    </motion.div>
  );
}

// ============================================
// 打字指示器
// ============================================

export function TypingIndicator({ className }: { className?: string }) {
  return (
    <motion.div
      className={cn('flex items-center gap-1', className)}
      initial="hidden"
      animate="visible"
    >
      {[0, 1, 2].map((i) => (
        <motion.span
          key={i}
          className="h-2 w-2 rounded-full bg-muted-foreground/50"
          animate={{
            y: [0, -4, 0],
            opacity: [0.5, 1, 0.5],
          }}
          transition={{
            duration: 0.6,
            repeat: Infinity,
            delay: i * 0.15,
          }}
        />
      ))}
    </motion.div>
  );
}

// ============================================
// 数字滚动
// ============================================

interface AnimatedNumberProps {
  value: number;
  className?: string;
  duration?: number;
  formatOptions?: Intl.NumberFormatOptions;
}

export function AnimatedNumber({
  value,
  className,
  duration = 1.5,
  formatOptions,
}: AnimatedNumberProps) {
  const prefersReducedMotion = useReducedMotion();
  const format = useFormatter();
  const locale = useLocale();
  const ref = useRef(null);
  const isInView = useInView(ref, { once: true });

  if (prefersReducedMotion) {
    return (
      <span ref={ref} className={className}>
        {format.number(value, formatOptions)}
      </span>
    );
  }

  return (
    <motion.span
      ref={ref}
      className={className}
      initial={{ opacity: 0 }}
      animate={isInView ? { opacity: 1 } : { opacity: 0 }}
    >
      <motion.span initial={{ opacity: 0 }} animate={isInView ? { opacity: 1 } : { opacity: 0 }}>
        {isInView && (
          <CountUpAnimation
            target={value}
            duration={duration}
            formatOptions={formatOptions}
            numberLocale={toBcp47(locale)}
          />
        )}
      </motion.span>
    </motion.span>
  );
}

function CountUpAnimation({
  target,
  duration,
  formatOptions,
  numberLocale,
}: {
  target: number;
  duration: number;
  formatOptions?: Intl.NumberFormatOptions;
  numberLocale: string;
}) {
  const nodeRef = useRef<HTMLSpanElement>(null);

  // 动画回调中无法使用 hook，因此直接使用 Intl.NumberFormat + toBcp47()
  const formatter = new Intl.NumberFormat(numberLocale, formatOptions);

  return (
    <motion.span
      ref={nodeRef}
      initial={{ '--num': 0 } as any}
      animate={{ '--num': target } as any}
      transition={{ duration, ease: 'easeOut' }}
      onUpdate={(latest: any) => {
        if (nodeRef.current) {
          nodeRef.current.textContent = formatter.format(Math.round(latest['--num'] || 0));
        }
      }}
    >
      0
    </motion.span>
  );
}

// ============================================
// 进度条动画
// ============================================

interface AnimatedProgressProps {
  value: number;
  className?: string;
  barClassName?: string;
}

export function AnimatedProgress({ value, className, barClassName }: AnimatedProgressProps) {
  const prefersReducedMotion = useReducedMotion();
  const ref = useRef(null);
  const isInView = useInView(ref, { once: true });

  return (
    <div ref={ref} className={cn('h-2 w-full overflow-hidden rounded-full bg-muted', className)}>
      <motion.div
        className={cn('h-full rounded-full bg-primary', barClassName)}
        initial={{ width: 0 }}
        animate={
          isInView && !prefersReducedMotion ? { width: `${value}%` } : { width: `${value}%` }
        }
        transition={{
          type: 'spring',
          stiffness: 100,
          damping: 20,
          delay: 0.2,
        }}
      />
    </div>
  );
}

// ============================================
// 脉冲效果
// ============================================

interface PulseProps {
  children: ReactNode;
  className?: string;
  pulseClassName?: string;
}

export function Pulse({ children, className, pulseClassName }: PulseProps) {
  return (
    <span className={cn('relative inline-flex', className)}>
      {children}
      <motion.span
        className={cn('absolute inset-0 rounded-full bg-primary/40', pulseClassName)}
        animate={{
          scale: [1, 1.5],
          opacity: [0.5, 0],
        }}
        transition={{
          duration: 1.5,
          repeat: Infinity,
          ease: 'easeOut',
        }}
      />
    </span>
  );
}

// ============================================
// 骨架屏闪烁
// ============================================

export function SkeletonShimmer({ className }: { className?: string }) {
  return (
    <div className={cn('relative overflow-hidden rounded bg-muted', className)}>
      <motion.div
        className="absolute inset-0 -translate-x-full bg-gradient-to-r from-transparent via-white/20 to-transparent"
        animate={{ x: ['0%', '200%'] }}
        transition={{
          duration: 1.5,
          repeat: Infinity,
          ease: 'linear',
        }}
      />
    </div>
  );
}

// ============================================
// 导出 AnimatePresence
// ============================================

export { AnimatePresence };
