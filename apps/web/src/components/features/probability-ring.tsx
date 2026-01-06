'use client';

/**
 * 概率环组件 - 带动画效果
 */

import { useRef, useEffect, useState } from 'react';
import { motion, useInView, useSpring, useTransform, useReducedMotion } from 'framer-motion';
import { cn } from '@/lib/utils';
import { transitions } from '@/lib/motion';

interface ProbabilityRingProps {
  value: number; // 0-100
  size?: 'sm' | 'md' | 'lg' | 'xl';
  showLabel?: boolean;
  label?: string;
  className?: string;
  animated?: boolean;
  showTrend?: 'up' | 'down' | 'stable';
  delay?: number;
}

const sizeConfig = {
  sm: { size: 60, stroke: 6, fontSize: 'text-sm', innerSize: 'text-xs' },
  md: { size: 80, stroke: 8, fontSize: 'text-xl', innerSize: 'text-sm' },
  lg: { size: 120, stroke: 10, fontSize: 'text-3xl', innerSize: 'text-base' },
  xl: { size: 160, stroke: 12, fontSize: 'text-4xl', innerSize: 'text-lg' },
};

function getColorByValue(value: number) {
  if (value >= 70) return { 
    stroke: 'stroke-success', 
    text: 'text-success',
    bg: 'bg-success/10',
    gradient: 'from-success to-success/60',
  };
  if (value >= 40) return { 
    stroke: 'stroke-warning', 
    text: 'text-warning',
    bg: 'bg-warning/10',
    gradient: 'from-warning to-warning/60',
  };
  return { 
    stroke: 'stroke-destructive', 
    text: 'text-destructive',
    bg: 'bg-destructive/10',
    gradient: 'from-destructive to-destructive/60',
  };
}

export function ProbabilityRing({
  value,
  size = 'md',
  showLabel = true,
  label,
  className,
  animated = true,
  showTrend,
  delay = 0,
}: ProbabilityRingProps) {
  const ref = useRef(null);
  const isInView = useInView(ref, { once: true, amount: 0.5 });
  const prefersReducedMotion = useReducedMotion();
  
  const config = sizeConfig[size];
  const colors = getColorByValue(value);

  const radius = (config.size - config.stroke) / 2;
  const circumference = 2 * Math.PI * radius;

  // Animated value
  const springValue = useSpring(0, {
    stiffness: 50,
    damping: 20,
    restDelta: 0.001,
  });

  const displayValue = useTransform(springValue, (v) => Math.round(v));
  const strokeOffset = useTransform(
    springValue,
    (v) => circumference - (v / 100) * circumference
  );

  useEffect(() => {
    if (isInView && animated && !prefersReducedMotion) {
      const timer = setTimeout(() => {
        springValue.set(value);
      }, delay * 1000);
      return () => clearTimeout(timer);
    } else if (!animated || prefersReducedMotion) {
      springValue.set(value);
    }
  }, [isInView, value, animated, springValue, delay, prefersReducedMotion]);

  // Static version for reduced motion
  if (prefersReducedMotion) {
    const offset = circumference - (value / 100) * circumference;
    return (
      <div ref={ref} className={cn('flex flex-col items-center gap-2', className)}>
        <div className="relative" style={{ width: config.size, height: config.size }}>
          <svg className="rotate-[-90deg]" width={config.size} height={config.size}>
            <circle
              cx={config.size / 2}
              cy={config.size / 2}
              r={radius}
              fill="none"
              strokeWidth={config.stroke}
              className="stroke-muted"
            />
            <circle
              cx={config.size / 2}
              cy={config.size / 2}
              r={radius}
              fill="none"
              strokeWidth={config.stroke}
              strokeLinecap="round"
              strokeDasharray={circumference}
              strokeDashoffset={offset}
              className={colors.stroke}
            />
          </svg>
          <div className="absolute inset-0 flex items-center justify-center">
            <span className={cn('font-bold', config.fontSize, colors.text)}>{value}%</span>
          </div>
        </div>
        {showLabel && label && (
          <span className="text-sm text-muted-foreground text-center">{label}</span>
        )}
      </div>
    );
  }

  return (
    <motion.div
      ref={ref}
      className={cn('flex flex-col items-center gap-2', className)}
      initial={{ opacity: 0, scale: 0.9 }}
      animate={isInView ? { opacity: 1, scale: 1 } : {}}
      transition={{ ...transitions.springGentle, delay }}
    >
      <div className="relative" style={{ width: config.size, height: config.size }}>
        {/* Glow effect */}
        <motion.div
          className={cn('absolute inset-0 rounded-full blur-xl opacity-30', colors.bg)}
          animate={isInView ? { scale: [0.8, 1.1, 1], opacity: [0, 0.4, 0.3] } : {}}
          transition={{ duration: 1, delay: delay + 0.3 }}
        />

        <svg className="rotate-[-90deg] relative z-10" width={config.size} height={config.size}>
          {/* 背景圆环 */}
          <circle
            cx={config.size / 2}
            cy={config.size / 2}
            r={radius}
            fill="none"
            strokeWidth={config.stroke}
            className="stroke-muted"
          />

          {/* 渐变定义 */}
          <defs>
            <linearGradient id={`gradient-${value}`} x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" className={cn('stop-current', colors.text)} />
              <stop offset="100%" className={cn('stop-current', colors.text)} stopOpacity={0.6} />
            </linearGradient>
          </defs>

          {/* 进度圆环 */}
          <motion.circle
            cx={config.size / 2}
            cy={config.size / 2}
            r={radius}
            fill="none"
            strokeWidth={config.stroke}
            strokeLinecap="round"
            strokeDasharray={circumference}
            style={{ strokeDashoffset: strokeOffset }}
            stroke={`url(#gradient-${value})`}
          />
        </svg>

        {/* 中心内容 */}
        <div className="absolute inset-0 flex flex-col items-center justify-center z-10">
          {/* 数值 */}
          <motion.span className={cn('font-bold tabular-nums', config.fontSize, colors.text)}>
            <motion.span>{displayValue}</motion.span>%
          </motion.span>

          {/* 趋势指示 */}
          {showTrend && (
            <motion.span
              initial={{ opacity: 0, y: 4 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: delay + 0.5 }}
              className={cn(
                'text-xs flex items-center gap-0.5',
                showTrend === 'up' && 'text-success',
                showTrend === 'down' && 'text-destructive',
                showTrend === 'stable' && 'text-muted-foreground'
              )}
            >
              {showTrend === 'up' && '↑'}
              {showTrend === 'down' && '↓'}
              {showTrend === 'stable' && '→'}
            </motion.span>
          )}
        </div>

        {/* 完成动画粒子效果 */}
        {value >= 70 && isInView && (
          <>
            {[...Array(6)].map((_, i) => (
              <motion.span
                key={i}
                className="absolute w-1 h-1 rounded-full bg-success"
                initial={{ 
                  opacity: 0,
                  x: config.size / 2,
                  y: config.size / 2,
                }}
                animate={{
                  opacity: [0, 1, 0],
                  x: config.size / 2 + Math.cos((i * 60 * Math.PI) / 180) * (config.size / 2 + 10),
                  y: config.size / 2 + Math.sin((i * 60 * Math.PI) / 180) * (config.size / 2 + 10),
                  scale: [0, 1.5, 0],
                }}
                transition={{
                  duration: 0.8,
                  delay: delay + 0.8 + i * 0.05,
                  ease: 'easeOut',
                }}
              />
            ))}
          </>
        )}
      </div>

      {/* 标签 */}
      {showLabel && label && (
        <motion.span
          className="text-sm text-muted-foreground text-center max-w-[120px] line-clamp-2"
          initial={{ opacity: 0, y: 8 }}
          animate={isInView ? { opacity: 1, y: 0 } : {}}
          transition={{ delay: delay + 0.3 }}
        >
          {label}
        </motion.span>
      )}
    </motion.div>
  );
}

// 统计数字组件
interface AnimatedStatProps {
  value: number;
  label: string;
  prefix?: string;
  suffix?: string;
  className?: string;
  trend?: { value: number; direction: 'up' | 'down' };
  delay?: number;
}

export function AnimatedStat({
  value,
  label,
  prefix = '',
  suffix = '',
  className,
  trend,
  delay = 0,
}: AnimatedStatProps) {
  const ref = useRef(null);
  const isInView = useInView(ref, { once: true });
  const prefersReducedMotion = useReducedMotion();

  const springValue = useSpring(0, { stiffness: 50, damping: 20 });
  const displayValue = useTransform(springValue, (v) => Math.round(v));

  useEffect(() => {
    if (isInView && !prefersReducedMotion) {
      const timer = setTimeout(() => springValue.set(value), delay * 1000);
      return () => clearTimeout(timer);
    } else {
      springValue.set(value);
    }
  }, [isInView, value, springValue, delay, prefersReducedMotion]);

  return (
    <motion.div
      ref={ref}
      className={cn('text-center', className)}
      initial={{ opacity: 0, y: 16 }}
      animate={isInView ? { opacity: 1, y: 0 } : {}}
      transition={{ ...transitions.springGentle, delay }}
    >
      <div className="flex items-baseline justify-center gap-1">
        {prefix && <span className="text-muted-foreground text-lg">{prefix}</span>}
        <motion.span className="text-3xl font-bold tabular-nums">
          {prefersReducedMotion ? value : <motion.span>{displayValue}</motion.span>}
        </motion.span>
        {suffix && <span className="text-muted-foreground text-lg">{suffix}</span>}
      </div>

      {trend && (
        <motion.div
          className={cn(
            'flex items-center justify-center gap-1 text-xs mt-1',
            trend.direction === 'up' ? 'text-success' : 'text-destructive'
          )}
          initial={{ opacity: 0 }}
          animate={isInView ? { opacity: 1 } : {}}
          transition={{ delay: delay + 0.3 }}
        >
          <span>{trend.direction === 'up' ? '↑' : '↓'}</span>
          <span>{trend.value}%</span>
        </motion.div>
      )}

      <p className="text-sm text-muted-foreground mt-1">{label}</p>
    </motion.div>
  );
}

// 进度条组件
interface AnimatedProgressBarProps {
  value: number;
  label?: string;
  showValue?: boolean;
  size?: 'sm' | 'md' | 'lg';
  className?: string;
  delay?: number;
}

export function AnimatedProgressBar({
  value,
  label,
  showValue = true,
  size = 'md',
  className,
  delay = 0,
}: AnimatedProgressBarProps) {
  const ref = useRef(null);
  const isInView = useInView(ref, { once: true });
  const prefersReducedMotion = useReducedMotion();
  const colors = getColorByValue(value);

  const heights = { sm: 'h-1.5', md: 'h-2.5', lg: 'h-4' };

  return (
    <motion.div
      ref={ref}
      className={cn('w-full', className)}
      initial={{ opacity: 0 }}
      animate={isInView ? { opacity: 1 } : {}}
      transition={{ delay }}
    >
      {(label || showValue) && (
        <div className="flex justify-between items-center mb-1.5">
          {label && <span className="text-sm text-muted-foreground">{label}</span>}
          {showValue && (
            <span className={cn('text-sm font-medium', colors.text)}>{value}%</span>
          )}
        </div>
      )}

      <div className={cn('w-full rounded-full bg-muted overflow-hidden', heights[size])}>
        <motion.div
          className={cn('h-full rounded-full', colors.bg.replace('/10', ''))}
          initial={{ width: 0 }}
          animate={isInView && !prefersReducedMotion ? { width: `${value}%` } : { width: `${value}%` }}
          transition={{
            type: 'spring',
            stiffness: 50,
            damping: 20,
            delay: delay + 0.1,
          }}
        />
      </div>
    </motion.div>
  );
}
