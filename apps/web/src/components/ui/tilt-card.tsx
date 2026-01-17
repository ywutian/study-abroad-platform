'use client';

/**
 * 3D 倾斜卡片组件 - 鼠标跟随效果
 */

import { forwardRef, useRef, useState, ReactNode, MouseEvent } from 'react';
import { motion, useMotionValue, useSpring, useTransform, useReducedMotion } from 'framer-motion';
import { cn } from '@/lib/utils';

interface TiltCardProps {
  children: ReactNode;
  className?: string;
  containerClassName?: string;
  intensity?: number;
  perspective?: number;
  glare?: boolean;
  glareOpacity?: number;
  scale?: number;
  border?: boolean;
  shadow?: boolean;
}

const TiltCard = forwardRef<HTMLDivElement, TiltCardProps>(
  (
    {
      children,
      className,
      containerClassName,
      intensity = 15,
      perspective = 1000,
      glare = true,
      glareOpacity = 0.15,
      scale = 1.02,
      border = true,
      shadow = true,
    },
    ref
  ) => {
    const cardRef = useRef<HTMLDivElement>(null);
    const [isHovered, setIsHovered] = useState(false);
    const prefersReducedMotion = useReducedMotion();

    // Motion values for smooth animation
    const x = useMotionValue(0);
    const y = useMotionValue(0);

    // Spring physics for natural feel
    const springConfig = { stiffness: 300, damping: 30 };
    const rotateX = useSpring(useTransform(y, [-0.5, 0.5], [intensity, -intensity]), springConfig);
    const rotateY = useSpring(useTransform(x, [-0.5, 0.5], [-intensity, intensity]), springConfig);
    const scaleValue = useSpring(isHovered ? scale : 1, springConfig);

    // Glare position
    const glareX = useTransform(x, [-0.5, 0.5], ['0%', '100%']);
    const glareY = useTransform(y, [-0.5, 0.5], ['0%', '100%']);

    const handleMouseMove = (e: MouseEvent<HTMLDivElement>) => {
      if (prefersReducedMotion || !cardRef.current) return;

      const rect = cardRef.current.getBoundingClientRect();
      const centerX = rect.left + rect.width / 2;
      const centerY = rect.top + rect.height / 2;

      // Normalize to -0.5 to 0.5
      const normalizedX = (e.clientX - centerX) / rect.width;
      const normalizedY = (e.clientY - centerY) / rect.height;

      x.set(normalizedX);
      y.set(normalizedY);
    };

    const handleMouseEnter = () => {
      setIsHovered(true);
    };

    const handleMouseLeave = () => {
      setIsHovered(false);
      x.set(0);
      y.set(0);
    };

    if (prefersReducedMotion) {
      return (
        <div ref={ref} className={cn('rounded-xl', containerClassName)}>
          <div className={cn('rounded-xl bg-card border p-6', className)}>{children}</div>
        </div>
      );
    }

    return (
      <div ref={ref} className={cn('relative', containerClassName)} style={{ perspective }}>
        <motion.div
          ref={cardRef}
          className={cn(
            'relative rounded-xl overflow-hidden bg-card',
            border && 'border',
            shadow && 'shadow-lg',
            className
          )}
          style={{
            rotateX,
            rotateY,
            scale: scaleValue,
            transformStyle: 'preserve-3d',
          }}
          onMouseMove={handleMouseMove}
          onMouseEnter={handleMouseEnter}
          onMouseLeave={handleMouseLeave}
        >
          {/* Content */}
          <div className="relative z-10" style={{ transform: 'translateZ(20px)' }}>
            {children}
          </div>

          {/* Glare effect */}
          {glare && (
            <motion.div
              className="absolute inset-0 pointer-events-none z-20"
              style={{
                background: `radial-gradient(circle at ${glareX}% ${glareY}%, rgba(255,255,255,${glareOpacity}) 0%, transparent 50%)`,
                opacity: isHovered ? 1 : 0,
              }}
              transition={{ duration: 0.2 }}
            />
          )}

          {/* Border gradient on hover */}
          {border && (
            <motion.div
              className="absolute inset-0 rounded-xl pointer-events-none z-0"
              style={{
                background: `linear-gradient(135deg, rgba(99,102,241,0.2) 0%, transparent 50%, rgba(99,102,241,0.1) 100%)`,
                opacity: isHovered ? 1 : 0,
              }}
              transition={{ duration: 0.3 }}
            />
          )}
        </motion.div>

        {/* Shadow that responds to tilt */}
        {shadow && (
          <motion.div
            className="absolute inset-0 rounded-xl -z-10"
            style={{
              background: 'transparent',
              boxShadow: isHovered
                ? '0 25px 50px -12px rgba(0, 0, 0, 0.15), 0 12px 24px -8px rgba(99, 102, 241, 0.1)'
                : '0 10px 30px -10px rgba(0, 0, 0, 0.1)',
              transform: `translateY(${isHovered ? 8 : 4}px)`,
              transition: 'all 0.3s ease',
            }}
          />
        )}
      </div>
    );
  }
);

TiltCard.displayName = 'TiltCard';

// Simple Hover Card with scale effect
interface HoverCardProps {
  children: ReactNode;
  className?: string;
  hoverScale?: number;
  hoverY?: number;
}

const HoverCard = forwardRef<HTMLDivElement, HoverCardProps>(
  ({ children, className, hoverScale = 1.02, hoverY = -4 }, ref) => {
    const prefersReducedMotion = useReducedMotion();

    if (prefersReducedMotion) {
      return (
        <div ref={ref} className={cn('rounded-xl border bg-card p-6 shadow-sm', className)}>
          {children}
        </div>
      );
    }

    return (
      <motion.div
        ref={ref}
        className={cn(
          'rounded-xl border bg-card p-6 shadow-sm transition-shadow',
          'hover:shadow-lg hover:shadow-primary/5',
          className
        )}
        whileHover={{
          scale: hoverScale,
          y: hoverY,
        }}
        transition={{
          type: 'spring',
          stiffness: 400,
          damping: 25,
        }}
      >
        {children}
      </motion.div>
    );
  }
);

HoverCard.displayName = 'HoverCard';

// Magnetic Button/Card - follows cursor slightly
interface MagneticProps {
  children: ReactNode;
  className?: string;
  intensity?: number;
}

const Magnetic = forwardRef<HTMLDivElement, MagneticProps>(
  ({ children, className, intensity = 0.3 }, ref) => {
    const magneticRef = useRef<HTMLDivElement>(null);
    const prefersReducedMotion = useReducedMotion();

    const x = useMotionValue(0);
    const y = useMotionValue(0);

    const springX = useSpring(x, { stiffness: 200, damping: 20 });
    const springY = useSpring(y, { stiffness: 200, damping: 20 });

    const handleMouseMove = (e: MouseEvent<HTMLDivElement>) => {
      if (prefersReducedMotion || !magneticRef.current) return;

      const rect = magneticRef.current.getBoundingClientRect();
      const centerX = rect.left + rect.width / 2;
      const centerY = rect.top + rect.height / 2;

      const deltaX = (e.clientX - centerX) * intensity;
      const deltaY = (e.clientY - centerY) * intensity;

      x.set(deltaX);
      y.set(deltaY);
    };

    const handleMouseLeave = () => {
      x.set(0);
      y.set(0);
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
        ref={magneticRef}
        className={className}
        style={{ x: springX, y: springY }}
        onMouseMove={handleMouseMove}
        onMouseLeave={handleMouseLeave}
      >
        {children}
      </motion.div>
    );
  }
);

Magnetic.displayName = 'Magnetic';

export { TiltCard, HoverCard, Magnetic };
