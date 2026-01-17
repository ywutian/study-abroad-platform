'use client';

import { ReactNode, useState, useRef } from 'react';
import { motion, useMotionValue, useSpring, useTransform } from 'framer-motion';
import { cn } from '@/lib/utils';

interface TouchCardProps {
  children: ReactNode;
  className?: string;
  onClick?: () => void;
  /** 是否启用触控反馈 */
  enableTouchFeedback?: boolean;
  /** 是否启用3D倾斜（仅非触控设备） */
  enableTilt?: boolean;
  /** 是否启用悬浮效果（仅非触控设备） */
  enableHover?: boolean;
  /** 卡片变体 */
  variant?: 'default' | 'elevated' | 'outlined';
}

export function TouchCard({
  children,
  className,
  onClick,
  enableTouchFeedback = true,
  enableTilt = true,
  enableHover = true,
  variant = 'default',
}: TouchCardProps) {
  const [isPressed, setIsPressed] = useState(false);
  const [isTouchDevice, setIsTouchDevice] = useState(false);
  const cardRef = useRef<HTMLDivElement>(null);

  // 用于3D倾斜效果
  const x = useMotionValue(0);
  const y = useMotionValue(0);
  const rotateX = useSpring(useTransform(y, [-0.5, 0.5], [5, -5]), {
    stiffness: 300,
    damping: 30,
  });
  const rotateY = useSpring(useTransform(x, [-0.5, 0.5], [-5, 5]), {
    stiffness: 300,
    damping: 30,
  });

  const handleMouseMove = (event: React.MouseEvent<HTMLDivElement>) => {
    if (!enableTilt || isTouchDevice || !cardRef.current) return;

    const rect = cardRef.current.getBoundingClientRect();
    const centerX = rect.left + rect.width / 2;
    const centerY = rect.top + rect.height / 2;

    x.set((event.clientX - centerX) / rect.width);
    y.set((event.clientY - centerY) / rect.height);
  };

  const handleMouseLeave = () => {
    x.set(0);
    y.set(0);
  };

  const handleTouchStart = () => {
    setIsTouchDevice(true);
    if (enableTouchFeedback) {
      setIsPressed(true);
    }
  };

  const handleTouchEnd = () => {
    if (enableTouchFeedback) {
      setIsPressed(false);
    }
  };

  const variantClasses = {
    default: 'bg-card border border-border',
    elevated: 'bg-card shadow-lg',
    outlined: 'bg-transparent border-2 border-border',
  };

  return (
    <motion.div
      ref={cardRef}
      className={cn(
        'rounded-xl transition-colors',
        variantClasses[variant],
        onClick && 'cursor-pointer tap-highlight',
        className
      )}
      style={{
        rotateX: enableTilt && !isTouchDevice ? rotateX : 0,
        rotateY: enableTilt && !isTouchDevice ? rotateY : 0,
        transformPerspective: 1000,
      }}
      animate={{
        scale: isPressed ? 0.98 : 1,
        y: enableHover && !isTouchDevice ? undefined : 0,
      }}
      whileHover={
        enableHover && !isTouchDevice
          ? {
              y: -4,
              boxShadow:
                '0 12px 40px -12px oklch(0.55 0.22 265 / 15%), 0 4px 16px -4px oklch(0 0 0 / 8%)',
            }
          : undefined
      }
      whileTap={
        enableTouchFeedback
          ? {
              scale: 0.98,
            }
          : undefined
      }
      transition={{
        type: 'spring',
        stiffness: 400,
        damping: 25,
      }}
      onMouseMove={handleMouseMove}
      onMouseLeave={handleMouseLeave}
      onTouchStart={handleTouchStart}
      onTouchEnd={handleTouchEnd}
      onClick={onClick}
    >
      {children}
    </motion.div>
  );
}

// 触控友好的按钮包装器
interface TouchButtonWrapperProps {
  children: ReactNode;
  className?: string;
  onClick?: () => void;
  disabled?: boolean;
}

export function TouchButtonWrapper({
  children,
  className,
  onClick,
  disabled,
}: TouchButtonWrapperProps) {
  return (
    <motion.div
      className={cn(
        'touch-target tap-highlight-none no-select',
        disabled && 'opacity-50 pointer-events-none',
        className
      )}
      whileTap={{ scale: 0.96 }}
      transition={{
        type: 'spring',
        stiffness: 500,
        damping: 30,
      }}
      onClick={disabled ? undefined : onClick}
    >
      {children}
    </motion.div>
  );
}

// 可滑动的卡片容器
interface SwipeableContainerProps {
  children: ReactNode;
  className?: string;
  /** 滑动方向 */
  direction?: 'horizontal' | 'vertical';
  /** 是否显示滚动条 */
  showScrollbar?: boolean;
  /** 是否启用滚动贴合 */
  snapEnabled?: boolean;
}

export function SwipeableContainer({
  children,
  className,
  direction = 'horizontal',
  showScrollbar = false,
  snapEnabled = true,
}: SwipeableContainerProps) {
  return (
    <div
      className={cn(
        'overflow-auto',
        direction === 'horizontal' ? 'overflow-y-hidden' : 'overflow-x-hidden',
        !showScrollbar && 'hide-scrollbar',
        snapEnabled && (direction === 'horizontal' ? 'scroll-snap-x' : 'scroll-snap-type-y'),
        '-webkit-overflow-scrolling-touch',
        className
      )}
    >
      {children}
    </div>
  );
}

// 可滑动的项目
interface SwipeableItemProps {
  children: ReactNode;
  className?: string;
}

export function SwipeableItem({ children, className }: SwipeableItemProps) {
  return <div className={cn('scroll-snap-item flex-shrink-0', className)}>{children}</div>;
}
