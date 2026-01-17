'use client';

import { useEffect, useRef, useState } from 'react';
import { cn } from '@/lib/utils';

interface AnimatedCounterProps {
  /** 目标值 */
  value: number;
  /** 动画时长（毫秒） */
  duration?: number;
  /** 数字格式化 */
  formatter?: (value: number) => string;
  /** 前缀 */
  prefix?: string;
  /** 后缀 */
  suffix?: string;
  /** 小数位数 */
  decimals?: number;
  /** 自定义类名 */
  className?: string;
  /** 是否在视口内才开始动画 */
  inView?: boolean;
  /** 分隔符 */
  separator?: string;
}

// 缓动函数：ease-out-expo
function easeOutExpo(t: number): number {
  return t === 1 ? 1 : 1 - Math.pow(2, -10 * t);
}

export function AnimatedCounter({
  value,
  duration = 2000,
  formatter,
  prefix = '',
  suffix = '',
  decimals = 0,
  className,
  inView = true,
  separator = ',',
}: AnimatedCounterProps) {
  const [displayValue, setDisplayValue] = useState(0);
  const [hasAnimated, setHasAnimated] = useState(false);
  const ref = useRef<HTMLSpanElement>(null);
  const animationRef = useRef<number>();
  const startTimeRef = useRef<number>();

  // 格式化数字
  const formatNumber = (num: number): string => {
    if (formatter) return formatter(num);

    const fixed = num.toFixed(decimals);
    if (separator) {
      const [integer, decimal] = fixed.split('.');
      const formatted = integer.replace(/\B(?=(\d{3})+(?!\d))/g, separator);
      return decimal ? `${formatted}.${decimal}` : formatted;
    }
    return fixed;
  };

  // 动画逻辑
  useEffect(() => {
    if (hasAnimated && !inView) return;

    const animate = (timestamp: number) => {
      if (!startTimeRef.current) {
        startTimeRef.current = timestamp;
      }

      const progress = Math.min((timestamp - startTimeRef.current) / duration, 1);
      const easedProgress = easeOutExpo(progress);
      const currentValue = easedProgress * value;

      setDisplayValue(currentValue);

      if (progress < 1) {
        animationRef.current = requestAnimationFrame(animate);
      } else {
        setHasAnimated(true);
      }
    };

    // IntersectionObserver 支持
    if (inView && ref.current) {
      const observer = new IntersectionObserver(
        (entries) => {
          if (entries[0].isIntersecting && !hasAnimated) {
            startTimeRef.current = undefined;
            animationRef.current = requestAnimationFrame(animate);
          }
        },
        { threshold: 0.1 }
      );

      observer.observe(ref.current);

      return () => {
        observer.disconnect();
        if (animationRef.current) {
          cancelAnimationFrame(animationRef.current);
        }
      };
    }

    // 直接开始动画
    startTimeRef.current = undefined;
    animationRef.current = requestAnimationFrame(animate);

    return () => {
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current);
      }
    };
  }, [value, duration, hasAnimated, inView]);

  return (
    <span ref={ref} className={cn('tabular-nums', className)}>
      {prefix}
      {formatNumber(displayValue)}
      {suffix}
    </span>
  );
}

// 统计数字组件
interface StatNumberProps {
  value: number;
  label: string;
  prefix?: string;
  suffix?: string;
  trend?: number;
  className?: string;
}

export function StatNumber({ value, label, prefix, suffix, trend, className }: StatNumberProps) {
  return (
    <div className={cn('text-center', className)}>
      <div className="text-3xl font-bold tracking-tight">
        <AnimatedCounter value={value} prefix={prefix} suffix={suffix} />
      </div>
      <div className="mt-1 text-sm text-muted-foreground">{label}</div>
      {trend !== undefined && (
        <div
          className={cn(
            'mt-1 text-xs font-medium',
            trend > 0 ? 'text-success' : trend < 0 ? 'text-destructive' : 'text-muted-foreground'
          )}
        >
          {trend > 0 ? '+' : ''}
          {trend}%
        </div>
      )}
    </div>
  );
}

// 进度数字组件
interface ProgressNumberProps {
  current: number;
  total: number;
  label?: string;
  showPercentage?: boolean;
  className?: string;
}

export function ProgressNumber({
  current,
  total,
  label,
  showPercentage = true,
  className,
}: ProgressNumberProps) {
  const percentage = total > 0 ? (current / total) * 100 : 0;

  return (
    <div className={cn('space-y-2', className)}>
      <div className="flex items-baseline justify-between">
        <div className="text-2xl font-bold tabular-nums">
          <AnimatedCounter value={current} />
          <span className="text-muted-foreground text-lg"> / {total}</span>
        </div>
        {showPercentage && (
          <span className="text-sm font-medium text-muted-foreground">
            <AnimatedCounter value={percentage} suffix="%" decimals={0} />
          </span>
        )}
      </div>
      {label && <p className="text-sm text-muted-foreground">{label}</p>}
      <div className="h-2 rounded-full bg-muted overflow-hidden">
        <div
          className="h-full bg-primary transition-all duration-500 ease-out rounded-full"
          style={{ width: `${percentage}%` }}
        />
      </div>
    </div>
  );
}
