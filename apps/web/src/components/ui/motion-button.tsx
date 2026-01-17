'use client';

/**
 * 动效按钮组件 - 带 Ripple 效果和动画
 */

import { forwardRef, useState, useCallback, MouseEvent } from 'react';
import { motion, AnimatePresence, useReducedMotion, HTMLMotionProps } from 'framer-motion';
import { Slot } from '@radix-ui/react-slot';
import { cva, type VariantProps } from 'class-variance-authority';
import { cn } from '@/lib/utils';
import { transitions } from '@/lib/motion';
import { Loader2 } from 'lucide-react';

const motionButtonVariants = cva(
  'relative inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-lg text-sm font-medium transition-colors overflow-hidden disabled:pointer-events-none disabled:opacity-50 [&_svg]:pointer-events-none [&_svg:not([class*="size-"])]:size-4 shrink-0 outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2',
  {
    variants: {
      variant: {
        default:
          'bg-primary text-primary-foreground shadow-md shadow-primary/20 hover:shadow-lg hover:shadow-primary/30',
        destructive: 'bg-destructive text-white shadow-md shadow-destructive/20',
        outline: 'border-2 bg-background hover:bg-accent hover:text-accent-foreground',
        secondary: 'bg-secondary text-secondary-foreground hover:bg-secondary/80',
        ghost: 'hover:bg-accent hover:text-accent-foreground',
        link: 'text-primary underline-offset-4 hover:underline',
        gradient: 'bg-primary text-primary-foreground shadow-lg shadow-primary/25',
        glow: 'bg-primary text-primary-foreground shadow-[0_0_20px_rgba(99,102,241,0.4)] hover:shadow-[0_0_30px_rgba(99,102,241,0.6)]',
      },
      size: {
        default: 'h-10 px-5 py-2',
        sm: 'h-9 rounded-md gap-1.5 px-4 text-xs',
        lg: 'h-12 rounded-lg px-8 text-base',
        xl: 'h-14 rounded-xl px-10 text-lg',
        icon: 'size-10',
        'icon-sm': 'size-9',
        'icon-lg': 'size-12',
      },
    },
    defaultVariants: {
      variant: 'default',
      size: 'default',
    },
  }
);

interface RippleEffect {
  id: number;
  x: number;
  y: number;
  size: number;
}

export interface MotionButtonProps
  extends Omit<HTMLMotionProps<'button'>, 'children'>, VariantProps<typeof motionButtonVariants> {
  children?: React.ReactNode;
  asChild?: boolean;
  loading?: boolean;
  ripple?: boolean;
  pulse?: boolean;
}

const MotionButton = forwardRef<HTMLButtonElement, MotionButtonProps>(
  (
    {
      className,
      variant = 'default',
      size = 'default',
      asChild = false,
      loading = false,
      ripple = true,
      pulse = false,
      children,
      disabled,
      onClick,
      ...props
    },
    ref
  ) => {
    const [ripples, setRipples] = useState<RippleEffect[]>([]);
    const prefersReducedMotion = useReducedMotion();

    const handleClick = useCallback(
      (e: MouseEvent<HTMLButtonElement>) => {
        if (ripple && !prefersReducedMotion) {
          const button = e.currentTarget;
          const rect = button.getBoundingClientRect();
          const size = Math.max(rect.width, rect.height) * 2;
          const x = e.clientX - rect.left - size / 2;
          const y = e.clientY - rect.top - size / 2;
          const id = Date.now();

          setRipples((prev) => [...prev, { id, x, y, size }]);

          // 清理 ripple
          setTimeout(() => {
            setRipples((prev) => prev.filter((r) => r.id !== id));
          }, 600);
        }

        onClick?.(e);
      },
      [onClick, ripple, prefersReducedMotion]
    );

    const isDisabled = disabled || loading;

    const buttonContent = (
      <>
        {/* Ripple effects */}
        <AnimatePresence>
          {ripples.map((r) => (
            <motion.span
              key={r.id}
              className="absolute rounded-full bg-white/30 pointer-events-none"
              initial={{ opacity: 0.5, scale: 0 }}
              animate={{ opacity: 0, scale: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.6, ease: 'easeOut' }}
              style={{
                left: r.x,
                top: r.y,
                width: r.size,
                height: r.size,
              }}
            />
          ))}
        </AnimatePresence>

        {/* Loading spinner */}
        <AnimatePresence mode="wait">
          {loading && (
            <motion.span
              key="loader"
              initial={{ opacity: 0, scale: 0.5 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.5 }}
              className="absolute inset-0 flex items-center justify-center bg-inherit"
            >
              <Loader2 className="h-4 w-4 animate-spin" />
            </motion.span>
          )}
        </AnimatePresence>

        {/* Content */}
        <span className={cn('relative z-10 flex items-center gap-2', loading && 'opacity-0')}>
          {children}
        </span>

        {/* Pulse effect */}
        {pulse && !prefersReducedMotion && (
          <motion.span
            className="absolute inset-0 rounded-[inherit] bg-primary/20"
            animate={{
              scale: [1, 1.05, 1],
              opacity: [0.5, 0, 0.5],
            }}
            transition={{
              duration: 2,
              repeat: Infinity,
              ease: 'easeInOut',
            }}
          />
        )}
      </>
    );

    if (prefersReducedMotion) {
      return (
        <button
          ref={ref}
          className={cn(motionButtonVariants({ variant, size, className }))}
          disabled={isDisabled}
          onClick={handleClick}
          {...(props as any)}
        >
          {buttonContent}
        </button>
      );
    }

    return (
      <motion.button
        ref={ref}
        className={cn(motionButtonVariants({ variant, size, className }))}
        disabled={isDisabled}
        onClick={handleClick}
        whileHover={{ scale: 1.02, y: -1 }}
        whileTap={{ scale: 0.98 }}
        transition={transitions.springSnappy}
        {...props}
      >
        {buttonContent}
      </motion.button>
    );
  }
);

MotionButton.displayName = 'MotionButton';

export { MotionButton, motionButtonVariants };
